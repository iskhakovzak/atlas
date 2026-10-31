"""Host-local Atlas recovery copy. Does not print customer records or secrets."""
from pathlib import Path
from datetime import datetime, timezone
import os
import shutil
import sqlite3
import tarfile
import tempfile
import time

os.umask(0o077)
root = Path('/opt/atlas')
backups = root / 'backups'
backups.mkdir(mode=0o700, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='snapshot-', dir=backups) as temporary:
    stage = Path(temporary)
    with sqlite3.connect(f'file:{root / "data/atlas.sqlite"}?mode=ro', uri=True) as source:
        with sqlite3.connect(stage / 'atlas.sqlite') as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Atlas backup integrity check failed')
    archive = backups / ('atlas-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S') + '.tar.gz')
    pending = archive.with_suffix('.pending')
    with tarfile.open(pending, 'w:gz') as output:
        output.add(stage / 'atlas.sqlite', arcname='data/atlas.sqlite')
        output.add(root / 'data/objects', arcname='data/objects')
        output.add(root / 'config/environment.json', arcname='config/environment.json')
    shutil.move(pending, archive)
    for old in backups.glob('atlas-*.tar.gz'):
        if old.stat().st_mtime < time.time() - 7 * 86400:
            old.unlink()
print('Atlas local backup complete; SQLite integrity verified')
