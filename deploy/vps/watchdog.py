"""Atlas host watchdog (every 2 minutes, atlas-watchdog.timer).

Written after 3 November 2026: another project's Redis grew to 10.6 GB of RAM and 151 GB of failed snapshot files on
the shared VPS, the disk filled, the kernel kept killing processes and atlasmarket.uz stopped answering.

It only does what is safe without a person:
- disk over 85 %: deletes Redis temp-*.rdb / temp-rewriteaof-*.aof files older than two hours (failed snapshots that
  Redis never cleans up), Docker build cache older than three days, old Atlas images and source archives, journal over
  200 MB. It never touches databases, dump.rdb, appendonly files or another project's containers;
- Atlas not answering three checks in a row: restarts the atlas-web container (compose up when it is missing);
and tells the owner in Telegram (at most once an hour per problem, and once when it is over) about: low disk, low
memory, any container without a memory limit (that is how one service can take the whole server), Atlas down.
Prints no secrets and no customer data. `--dry-run` reports without changing anything or sending.
"""
from pathlib import Path
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import urllib.request

DRY = '--dry-run' in sys.argv
ROOT = Path('/opt/atlas')
STATE = ROOT / 'watchdog-state.json'
ENV_FILE = ROOT / 'config/environment.json'
VOLUMES = Path('/var/lib/docker/volumes')
HEALTH_URL = 'http://127.0.0.1:18792/'
DISK_CLEAN_PCT = 85
DISK_ALERT_PCT = 90
MEM_ALERT_MB = 700
ALERT_EVERY_S = 3600
ATLAS_FAILS_BEFORE_RESTART = 3


def run(*args, timeout=120):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception:
        return ''


def disk_pct():
    st = os.statvfs('/')
    return round(100 * (1 - st.f_bavail / st.f_blocks), 1)


def mem_available_mb():
    for line in Path('/proc/meminfo').read_text().splitlines():
        if line.startswith('MemAvailable:'):
            return int(line.split()[1]) // 1024
    return -1


def atlas_ok():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=15) as response:
            return response.status == 200
    except Exception:
        return False


def unlimited_containers():
    names = run('docker', 'ps', '--format', '{{.Names}}').split()
    out = []
    for name in names:
        if run('docker', 'inspect', name, '--format', '{{.HostConfig.Memory}}') == '0':
            out.append(name)
    return out


def clean_disk(log):
    cutoff = time.time() - 2 * 3600
    freed = 0
    if VOLUMES.is_dir():
        for volume in VOLUMES.iterdir():
            data = volume / '_data'
            if not data.is_dir():
                continue
            for pattern in ('temp-*.rdb', 'temp-rewriteaof-*.aof'):
                for orphan in data.glob(pattern):
                    try:
                        st = orphan.stat()
                        if st.st_mtime < cutoff:
                            if not DRY:
                                orphan.unlink()
                            freed += st.st_size
                    except OSError:
                        pass
    if freed:
        log.append(f'удалены незавершённые снимки Redis: {freed / 2**30:.1f} ГБ')
    if not DRY:
        run('docker', 'builder', 'prune', '-f', '--filter', 'until=72h', timeout=600)
        tags = run('docker', 'images', 'atlas-web', '--format', '{{.Tag}}').split()
        current = run('docker', 'inspect', 'atlas-web', '--format', '{{.Config.Image}}').split(':')[-1]
        for tag in tags[3:]:
            if tag != current:
                run('docker', 'rmi', f'atlas-web:{tag}')
        archives = sorted(ROOT.glob('main-source-*.tar'), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in archives[2:]:
            old.unlink(missing_ok=True)
        run('journalctl', '--vacuum-size=200M')
    log.append('очищены кэш сборок Docker, старые образы и архивы Atlas')


def env_value(name):
    try:
        data = json.loads(ENV_FILE.read_text())
    except Exception:
        return None
    stack = [data]
    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            if isinstance(item.get(name), str):
                return item[name]
            stack.extend(item.values())
        elif isinstance(item, list):
            stack.extend(item)
    return None


def owner_chat():
    """The same owner Telegram the import monitor uses (lib/market/import-monitor-server.ts ownerTelegram)."""
    chat = (env_value('ATLAS_MONITOR_TELEGRAM') or '').strip().removeprefix('tg:')
    if chat.isdigit():
        return chat
    email = (env_value('ATLAS_OPERATOR_EMAIL') or '').strip().lower()
    if not email:
        return None
    try:
        db = sqlite3.connect(f'file:{ROOT / "data/atlas.sqlite"}?mode=ro', uri=True, timeout=5)
        row = db.execute('SELECT user_id FROM market_auth_links WHERE subject=?', ('email:' + email,)).fetchone()
        account = row[0] if row else 'email:' + email
        if account.startswith('tg:'):
            return account[3:]
        row = db.execute("SELECT subject FROM market_auth_links WHERE user_id=? AND subject LIKE 'tg:%' ORDER BY created_at DESC LIMIT 1", (account,)).fetchone()
        return row[0][3:] if row else None
    except Exception:
        return None


def send(text):
    if DRY:
        print('[telegram]', text)
        return
    token, chat = env_value('TELEGRAM_BOT_TOKEN'), owner_chat()
    if not token or not chat:
        return
    body = urllib.parse.urlencode({'chat_id': chat, 'text': text}).encode()
    try:
        urllib.request.urlopen(f'https://api.telegram.org/bot{token}/sendMessage', data=body, timeout=10).read()
    except Exception:
        pass


def main():
    try:
        state = json.loads(STATE.read_text())
    except Exception:
        state = {}
    now = time.time()
    problems, actions = {}, []

    disk = disk_pct()
    if disk >= DISK_CLEAN_PCT:
        clean_disk(actions)
        disk = disk_pct()
    if disk >= DISK_ALERT_PCT:
        problems['disk'] = f'Диск сервера заполнен на {disk} %. Проверьте, какой проект его занимает (docker system df -v).'

    mem = mem_available_mb()
    if 0 <= mem < MEM_ALERT_MB:
        top = run('docker', 'stats', '--no-stream', '--format', '{{.MemPerc}} {{.MemUsage}} {{.Name}}', timeout=60)
        def share(line):
            try:
                return float(line.split('%')[0])
            except ValueError:
                return 0.0
        heavy = sorted(top.splitlines(), key=share, reverse=True)[:3]
        problems['memory'] = f'Свободно памяти {mem} МБ. Крупнейшие контейнеры: ' + '; '.join(heavy)

    unlimited = unlimited_containers()
    if unlimited:
        problems['limits'] = 'Контейнеры без лимита памяти (один такой может занять весь сервер): ' + ', '.join(sorted(unlimited))

    if atlas_ok():
        state['atlas_fails'] = 0
    else:
        state['atlas_fails'] = state.get('atlas_fails', 0) + 1
        if state['atlas_fails'] >= ATLAS_FAILS_BEFORE_RESTART:
            running = run('docker', 'inspect', 'atlas-web', '--format', '{{.State.Running}}') == 'true'
            if not DRY:
                if running:
                    run('docker', 'restart', 'atlas-web', timeout=180)
                else:
                    run('docker', 'compose', '-p', 'atlas', '-f', str(ROOT / 'compose.yml'), 'up', '-d', timeout=300)
            actions.append('Atlas не отвечал 3 проверки подряд — контейнер перезапущен')
            state['atlas_fails'] = 0
        problems['atlas'] = 'atlasmarket.uz не отвечает на сервере.'

    sent = state.setdefault('sent', {})
    for key, text in problems.items():
        # Missing limits are a standing risk, not an outage: once a day is enough.
        if now - sent.get(key, 0) >= (86400 if key == 'limits' else ALERT_EVERY_S):
            send('⚠️ Сервер Atlas: ' + text + ('\n' + '\n'.join(actions) if actions else ''))
            sent[key] = now
    for key in [k for k in sent if k not in problems]:
        send('✅ Сервер Atlas: проблема устранена — ' + {'disk': 'диск', 'memory': 'память', 'limits': 'лимиты контейнеров', 'atlas': 'сайт отвечает'}.get(key, key))
        del sent[key]
    if actions and not problems and now - state.get('cleaned_sent', 0) >= ALERT_EVERY_S:
        send('🧹 Сервер Atlas: ' + '; '.join(actions))
        state['cleaned_sent'] = now

    if DRY:
        print(json.dumps({'disk_pct': disk, 'mem_available_mb': mem, 'unlimited': unlimited, 'problems': list(problems), 'actions': actions}, ensure_ascii=False))
    else:
        STATE.write_text(json.dumps(state))


if __name__ == '__main__':
    main()
