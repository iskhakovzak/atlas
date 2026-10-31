"""Reattach Atlas routes when the independently deployed shared Caddy is recreated."""
from pathlib import Path
import subprocess
import time

ROOT = Path('/opt/atlas/edge')
CONTAINER = 'prop-deskos-edge-1'
MARKER = '# Atlas managed edge routes'


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=25).stdout


def attach():
    current = run('docker', 'exec', CONTAINER, 'cat', '/etc/caddy/Caddyfile')
    if MARKER in current:
        return
    if 'atlasmarket.uz' in current:
        raise RuntimeError('Unmanaged Atlas route exists; refusing to overwrite')
    merged = ROOT / 'Caddyfile.merged'
    merged.write_text(current + '\n' + (ROOT / 'atlas.Caddyfile').read_text())
    # Validate before replacing the active file: the other project keeps serving on failure.
    run('docker', 'cp', str(merged), CONTAINER + ':/tmp/atlas-Caddyfile')
    run('docker', 'exec', CONTAINER, 'caddy', 'validate', '--config', '/tmp/atlas-Caddyfile', '--adapter', 'caddyfile')
    run('docker', 'cp', str(merged), CONTAINER + ':/etc/caddy/Caddyfile')
    run('docker', 'exec', CONTAINER, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')


previous = None
while True:
    try:
        identity = run('docker', 'inspect', '--format', '{{.Id}} {{.State.Running}}', CONTAINER).strip()
        if identity.endswith('true') and identity != previous:
            attach()
            previous = identity
            print('Atlas routes attached to shared edge', flush=True)
    except (subprocess.SubprocessError, OSError, RuntimeError):
        print('Atlas edge attachment pending; retrying', flush=True)
    time.sleep(3)
