"""Copy the offline director template into a new project directory."""
import argparse
import shutil
import sys
from pathlib import Path

def create(output):
    template = Path(__file__).resolve().parents[1] / 'templates' / 'threejs-director'
    target = Path(output).expanduser().resolve()
    if target.exists():
        raise FileExistsError(f'Refusing to overwrite existing directory: {target}')
    required = ['index.html', 'app.js', 'core.js', 'project.json', 'serve.py', 'vendor/three.module.js', 'vendor/three.core.js', 'vendor/controls/OrbitControls.js', 'vendor/controls/TransformControls.js']
    for name in required:
        if not (template / name).is_file():
            raise FileNotFoundError(f'Missing template dependency: {name}')
    shutil.copytree(template, target)
    if sys.platform == 'win32':
        (target / 'start.cmd').write_text(
            f'@echo off\r\n"{sys.executable}" -X utf8 "%~dp0serve.py" --port 8765\r\npause\r\n',
            encoding='utf-8'
        )
    print(f'Created: {target}')
    print(f'Run: python "{target / "serve.py"}" --port 8765')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--output', required=True)
    args = p.parse_args()
    create(args.output)
