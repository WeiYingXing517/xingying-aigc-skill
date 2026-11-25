'use strict';
/**
 * 统一中文知识库检索总入口（纯 Node.js）。
 * 用法：node 工具/检索.cjs <摄影|表演|武打|特效|案例|全部> "<检索词或短句>" [--domain <摄影子域>] [--limit <N>] [--layer <特效层>] [--wu-qi <器械>] [--tiao-jian <facts.json>]
 */
const fs = require('node:fs');
const path = require('node:path');

const photo = require('../知识库/摄影与画面/jiao-ben/jian-suo.cjs');
const martial = require('../知识库/动作与特效/武打/jiao-ben/jian-suo.cjs');
const vfx = require('../知识库/动作与特效/特效/jiao-ben/jian-suo.cjs');
const cases = require('../知识库/动作与特效/动画案例/检索.cjs');

const ACTING_ROOT = path.resolve(__dirname, '../知识库/人物与声音/zhi-shi-ku');
const ACTING_FOLDERS = ['mian-bu', 'shen-ti', 'ren-sheng', 'jiao-liu'];
let actingCache = null;

function loadActing() {
  if (actingCache) return actingCache;
  const entries = [];
  const indexBoosts = new Map();
  const idxFile = path.join(ACTING_ROOT, 'suo-yin.md');
  if (fs.existsSync(idxFile)) {
    const idxText = fs.readFileSync(idxFile, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (const line of idxText.split('\n')) {
      if (!line.startsWith('|') || line.includes('---|') || line.includes('条件或问题')) continue;
      const cols = line.split('|').map(s => s.trim()).filter(Boolean);
      if (cols.length < 2) continue;
      const phrases = cols[0].split(/[、，/\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 2);
      const ids = [...line.matchAll(/\[([A-Z]+\d+)\]/g)].map(m => m[1]);
      for (const id of ids) {
        if (!indexBoosts.has(id)) indexBoosts.set(id, new Set());
        phrases.forEach(p => indexBoosts.get(id).add(p));
      }
    }
  }
  for (const folder of ACTING_FOLDERS) {
    for (const [file, kind] of [['ji-chu.md', 'definition'], ['ying-yong.md', 'application']]) {
      const full = path.join(ACTING_ROOT, folder, file);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      for (const sec of content.split(/\n(?=## )/)) {
        const m = sec.match(/^## ([A-Z]+\d+) (.+)\n/);
        if (!m) continue;
        const [, id, title] = m;
        entries.push({
          id,
          name: title.trim(),
          kind,
          location: `知识库/人物与声音/zhi-shi-ku/${folder}/${file}#${id.toLowerCase()}`,
          body: sec.toLowerCase(),
          phrases: [...(indexBoosts.get(id) || [])]
        });
      }
    }
  }
  actingCache = entries;
  return entries;
}

function searchActing(query, limit = 6) {
  const q = String(query ?? '').normalize('NFKC').toLowerCase().trim();
  if (!q) return [];
  const compact = q.replace(/\s+/g, '');
  const ascii = new Set(q.match(/[a-z]+\d+/g) || []);
  const pairs = [];
  for (let i = 0; i < compact.length - 1; i++) {
    const bg = compact.slice(i, i + 2);
    if (!/[，。！？、\s]/.test(bg)) pairs.push(bg);
  }
  const scored = [];
  for (const e of loadActing()) {
    let score = 0;
    const matched = [];
    if (ascii.has(e.id.toLowerCase())) { score += 1000; matched.push('编号'); }
    const normName = e.name.toLowerCase();
    for (const chunk of normName.split(/[、与和或的，\s/]+/).filter(c => c.length >= 2)) {
      if (compact.includes(chunk)) { score += 26; matched.push(`标题：${chunk}`); }
    }
    for (const p of e.phrases) {
      if (compact.includes(p) || p.includes(compact)) { score += 35; matched.push(`索引词：${p}`); }
    }
    if (pairs.length >= 2) {
      let nameHits = 0, bodyHits = 0;
      for (const bg of new Set(pairs)) {
        if (normName.includes(bg)) nameHits++;
        if (e.body.includes(bg)) bodyHits++;
      }
      if (nameHits >= 1) score += nameHits * 8;
      if (bodyHits >= 2) { score += Math.min(bodyHits * 3, 18); matched.push('正文匹配'); }
    }
    if (score > 0) scored.push({ id: e.id, name: e.name, kind: e.kind, location: e.location, score, matched });
  }
  return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

const DOMAIN_MAP = {
  '摄影': 'photo', '画面': 'photo', photo: 'photo',
  '表演': 'acting', '人物': 'acting', '人声': 'acting', '声音': 'acting', acting: 'acting',
  '武打': 'martial', '打斗': 'martial', '动作': 'martial', martial: 'martial',
  '特效': 'vfx', vfx: 'vfx',
  '案例': 'case', '动画案例': 'case', case: 'case',
  '全部': 'all', all: 'all'
};

const PHOTO_EXPANSIONS = [
  [/焦段|广角|长焦|中焦|标准镜|50mm|85mm|35mm|24mm/i, ' 同主体范围换镜头 近距离人脸 透视'],
  [/机位高度|视平线|低机位|高机位|平视|仰俯/i, ' 高低人物正反打 俯拍 镜内仰俯变化']
];

function expandPhotoQuery(query) {
  let out = String(query ?? '');
  for (const [re, extra] of PHOTO_EXPANSIONS) if (re.test(out)) out += extra;
  return out;
}

function searchDomain(rawDomain, query, opts = {}) {
  const domainKey = DOMAIN_MAP[String(rawDomain || '').toLowerCase()] || DOMAIN_MAP[rawDomain];
  const limit = opts.limit || 6;
  if (domainKey === 'photo') {
    const items = photo.search(expandPhotoQuery(query), opts.subDomain || null, limit).map(e => ({
      id: e.id,
      name: e.title,
      kind: e.kind,
      location: `知识库/摄影与画面/${e.path}`,
      score: e.score,
      matched: e.matched,
      ...(e.exclusion_hits?.length ? { exclusion_hits: e.exclusion_hits } : {})
    }));
    return { domain: '摄影', query, candidates: items };
  }
  if (domainKey === 'acting') {
    return { domain: '表演', query, candidates: searchActing(query, limit) };
  }
  if (domainKey === 'martial') {
    const res = martial.retrieve(query, opts.facts || {}, opts.weapon || null);
    return {
      domain: '武打',
      query,
      candidates: res.candidates.slice(0, limit).map(c => ({
        ...c,
        location: `知识库/动作与特效/武打/zhi-shi-ku/${c.location}`
      })),
      ...(res.diagnostic ? { diagnostic: res.diagnostic } : {})
    };
  }
  if (domainKey === 'vfx') {
    const res = vfx.retrieve(query, { layer: opts.layer || null, limit });
    return {
      domain: '特效',
      query,
      candidates: res.candidates.map(c => ({
        ...c,
        location: `知识库/动作与特效/特效/zhi-shi-ku/${c.location}`
      })),
      ...(res.diagnostic ? { diagnostic: res.diagnostic } : {})
    };
  }
  if (domainKey === 'case') {
    const res = cases.retrieve(query);
    return {
      domain: '案例',
      query,
      candidates: res.candidates.slice(0, limit).map(c => ({
        ...c,
        location: `知识库/动作与特效/动画案例/${c.anchor}`
      })),
      sources: res.sources,
      ...(res.fallback ? { fallback: res.fallback } : {})
    };
  }
  if (domainKey === 'all') {
    return {
      domain: '全部',
      query,
      results: {
        '摄影': searchDomain('photo', query, { ...opts, limit: Math.min(limit, 4) }).candidates,
        '表演': searchDomain('acting', query, { ...opts, limit: Math.min(limit, 4) }).candidates,
        '武打': searchDomain('martial', query, { ...opts, limit: Math.min(limit, 4) }).candidates,
        '特效': searchDomain('vfx', query, { ...opts, limit: Math.min(limit, 4) }).candidates,
        '案例': searchDomain('case', query, { ...opts, limit: Math.min(limit, 4) }).candidates
      }
    };
  }
  throw new Error('未知领域，请使用：摄影 | 表演 | 武打 | 特效 | 案例 | 全部');
}

function main(argv) {
  const [rawDomain, ...rest] = argv;
  const domainKey = DOMAIN_MAP[String(rawDomain || '').toLowerCase()] || DOMAIN_MAP[rawDomain];
  if (!domainKey) throw new Error('用法：node 工具/检索.cjs <摄影|表演|武打|特效|案例|全部> "<检索词>" [--domain 子域] [--limit N] [--layer 层] [--wu-qi 器械] [--tiao-jian facts.json]');
  const words = [];
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--domain' || a === '--ling-yu') opts.subDomain = rest[++i];
    else if (a === '--limit' || a === '--shu-liang') opts.limit = Number(rest[++i]);
    else if (a === '--layer' || a === '--ceng') opts.layer = rest[++i];
    else if (a === '--wu-qi' || a === '--weapon') opts.weapon = rest[++i];
    else if (a === '--tiao-jian' || a === '--facts') opts.facts = JSON.parse(fs.readFileSync(rest[++i], 'utf8').replace(/^\uFEFF/, ''));
    else if (a.startsWith('--')) throw new Error('未知选项：' + a);
    else words.push(a);
  }
  if (!words.length) throw new Error('请提供检索词或动作/画面短句。');
  process.stdout.write(JSON.stringify(searchDomain(domainKey, words.join(' '), opts), null, 2) + '\n');
}

module.exports = { searchDomain, DOMAIN_MAP };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (err) { process.stderr.write(err.message + '\n'); process.exitCode = 2; }
}
