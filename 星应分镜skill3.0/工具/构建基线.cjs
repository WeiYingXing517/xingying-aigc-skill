'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const target = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '');
if (!process.argv[2] || source === target || !fs.existsSync(path.join(source, 'SKILL.md'))) throw new Error('必须指定独立且有效的源 Skill 目录');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error('不复制符号链接');
    if (item.isDirectory()) walk(full);
    else files.push({ relative: path.relative(source, full), sha256: hash(full) });
  }
}
walk(source);
for (const file of files) {
  const destination = path.join(target, file.relative);
  if (fs.existsSync(destination) && hash(destination) !== file.sha256) throw new Error(`目标已有不同文件，停止覆盖：${file.relative}`);
}
for (const file of files) {
  const destination = path.join(target, file.relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fs.existsSync(destination)) fs.copyFileSync(path.join(source, file.relative), destination, fs.constants.COPYFILE_EXCL);
  if (hash(destination) !== file.sha256) throw new Error(`复制校验失败：${file.relative}`);
}
const manifest = path.join(target, '验收', '基线清单.json');
if (!fs.existsSync(manifest)) fs.writeFileSync(manifest, JSON.stringify({ source, files }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ copiedAndVerified: files.length, target, sourceUnchanged: true }));
