"""Check local Markdown links, heading anchors and required routing."""
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors = []
files = sorted(ROOT.rglob('*.md'))
texts = {}
for path in files:
    try:
        texts[path.resolve()] = path.read_text(encoding='utf-8-sig')
    except (OSError, UnicodeError) as exc:
        errors.append(f'{path}: {exc}')

def slug(text):
    text = re.sub(r'[`*_~]', '', text).strip().lower()
    text = ''.join(c for c in text if c in '-_ ' or unicodedata.category(c)[0] in 'LN')
    return re.sub(r'\s', '-', text)

def anchors(text):
    found, counts = set(), {}
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith(('```', '~~~')):
            in_fence = not in_fence
        if in_fence:
            continue
        match = re.match(r'^#{1,6}\s+(.+?)\s*#*$', line)
        if match:
            base = slug(match.group(1))
            count = counts.get(base, 0)
            found.add(f'{base}-{count}' if count else base)
            counts[base] = count + 1
    return found

entry = ROOT / 'screenplay-writing' / 'SKILL.md'
entries = list((ROOT / 'screenplay-writing').rglob('SKILL.md'))
if entries != [entry]:
    errors.append('Expected exactly one installed SKILL.md entry')
entry_text = texts.get(entry.resolve(), '')
if not re.match(r'\A---\r?\nname: screenplay-writing\r?\ndescription: .+\r?\n---', entry_text):
    errors.append('Invalid expected entry metadata')
link_count = 0
for path, text in texts.items():
    for match in re.finditer(r'!?\[[^\]\n]*\]\(([^)\n]+)\)', text):
        target = match.group(1).strip()
        if target.startswith('<') and target.endswith('>'):
            target = target[1:-1]
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc:
            continue
        link_count += 1
        resolved = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
        if not resolved.is_relative_to(ROOT.resolve()):
            errors.append(f'{path.relative_to(ROOT)}: link escapes package: {target}')
        elif not resolved.exists():
            errors.append(f'{path.relative_to(ROOT)}: missing link: {target}')
        elif parsed.fragment and resolved.suffix.lower() == '.md':
            if unquote(parsed.fragment) not in anchors(texts.get(resolved, '')):
                errors.append(f'{path.relative_to(ROOT)}: missing heading: {target}')

required = {
    'screenplay-writing/SKILL.md': ['创作导航与路况', 'references/style.md', 'references/curves.md', 'references/characters.md'],
    'screenplay-writing/references/characters.md': ['反应机制与人物层次', 'script.md#情绪变化链与跨场余波'],
    'screenplay-writing/references/script.md': ['情绪变化链与跨场余波', 'style.md', 'curves.md'],
    'screenplay-writing/references/brief.md': ['起伏与文风偏好', 'style.md', 'curves.md'],
    'screenplay-writing/references/review.md': ['人物情绪、文风与起伏复核', 'style.md', 'curves.md'],
    'screenplay-writing/references/project.md': ['创作路线、文风与情绪的最小交接'],
    'screenplay-writing/references/style.md': ['style-samples.md', '缺实际独立运行', '有限轮次'],
    'screenplay-writing/references/style-samples.md': ['## A.', '## B.', '## C.', '## D.', '## E.', '候选'],
    'tests/回归规范.md': ['人物情绪与起伏文风回归.md'],
}
for relative, tokens in required.items():
    text = texts.get((ROOT / relative).resolve(), '')
    for token in tokens:
        if token not in text:
            errors.append(f'{relative}: missing required route/token: {token}')

print(f'Checked {len(texts)} Markdown files, {link_count} local links, {len(required)} routing contracts.')
print('Scope: static package structure only; no narrative or cross-model validation.')
for error in errors:
    print(f'ERROR: {error}')
print('FAIL' if errors else 'PASS')
sys.exit(1 if errors else 0)
