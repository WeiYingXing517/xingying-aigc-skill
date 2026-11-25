'use strict';
/**
 * 主动更新 知识库/ 内容后，运行本脚本刷新 验收/基线清单.json 的跨平台 SHA-256 哈希。
 * 用法：node 工具/刷新基线.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const kb = path.join(root, '知识库');
const outPath = path.join(root, '验收', '基线清单.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error('不收录符号链接：' + full);
    if (item.isDirectory()) walk(full);
    else files.push({ relative: path.relative(root, full).split(path.sep).join('/'), sha256: hash(full) });
  }
}

walk(kb);
fs.writeFileSync(outPath, JSON.stringify({ version: '4.0', scope: '知识库', files }, null, 2) + '\n', 'utf8');
process.stdout.write(JSON.stringify({ updated: true, version: '4.0', scope: '知识库', fileCount: files.length, manifest: '验收/基线清单.json' }, null, 2) + '\n');
