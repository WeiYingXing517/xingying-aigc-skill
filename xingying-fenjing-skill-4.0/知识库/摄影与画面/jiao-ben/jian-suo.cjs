'use strict';
/**
 * 在摄影知识库离线检索定义和应用候选（纯 Node.js，零外部依赖）。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'zhi-shi-ku', 'jian-suo-shu-ju.json');
const SCENE_FILE = path.join(ROOT, 'zhi-shi-ku', 'chang-jing-ci.json');

const TERM_ALIASES = {
  ots: '过肩',
  pov: '主观',
  '180': '跨轴',
  '180度': '跨轴',
  'shot reverse shot': '正反打',
  dof: '景深',
  'rack focus': '转焦',
  'j cut': 'j剪',
  'l cut': 'l剪',
  'dutch angle': '荷兰角',
  'dolly zoom': '希区柯克变焦',
  'hitchcock zoom': '希区柯克变焦',
  'bullet time': '动静凝固',
  'leading shot': '牵引镜头',
  'trailing shot': '尾随镜头',
  'split diopter': '分裂屈光',
  'speed ramp': '速度坡道',
  'slow motion': '升格慢镜',
  'hit stop': '咬合顿挫',
  hitstop: '咬合顿挫'
};

const ENTRY_ALIASES = {
  ANG01: ['正脸', '正面特写'],
  ANG03: ['侧脸', '纯侧拍'],
  'SIZ-A01': ['正面特写', '微表情'],
  SPA01: ['画面投影', '场内地标'],
  SPA02: ['画面投影', '身体相对方位'],
  ORG15: ['画面投影', '银幕方向'],
  'MOV-A14': ['前景遮挡跟拍', '前景掠过']
};

const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().trim();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function loadIndex() {
  return readJson(INDEX);
}

function loadDefinitions(domains) {
  const result = [];
  for (const domain of domains) {
    const slug = domain.slug;
    const rel = `zhuan-xiang/${slug}/ji-chu-ding-yi-ku.md`;
    const full = path.join(ROOT, 'zhuan-xiang', slug, 'ji-chu-ding-yi-ku.md');
    const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (const section of text.split(/\n(?=## )/)) {
      const heading = section.match(/^## ([A-Z]+\d+) (.+)\n/);
      if (!heading) continue;
      const [, id, title] = heading;
      const summary = section.match(/^- 定义与效果：(.*)$/m);
      const boundary = section.match(/^- 边界与区分：(.*)$/m);
      result.push({
        id,
        title: title.trim(),
        domain: slug,
        domain_name: domain.title,
        path: `${rel}#${id.toLowerCase()}`,
        definition: summary ? summary[1].trim() : '',
        boundary: boundary ? boundary[1].trim() : '',
        kind: 'definition'
      });
    }
  }
  return result;
}

function titleChunks(title) {
  return norm(title)
    .split(/[、与和或的，（）()\s/]+/)
    .filter(chunk => chunk.length >= 2);
}

function bigrams(str) {
  const out = new Set();
  for (let i = 0; i < str.length - 1; i++) out.add(str.slice(i, i + 2));
  return out;
}

function scoreEntry(entry, terms, compactQuery, asciiTokens, searchable) {
  const entryId = entry.id;
  const normId = norm(entryId);
  const aliases = ENTRY_ALIASES[entryId] || [];
  let score = 0;
  const hits = new Set();
  const exclusionHits = new Set();

  if (asciiTokens.has(normId)) {
    score += 1000;
    hits.add('编号');
  }

  for (const alias of aliases) {
    const a = norm(alias);
    if (a && compactQuery.includes(a)) {
      score += 40;
      hits.add(`同义词：${alias}`);
    }
  }

  // Natural Chinese full-sentence support: match meaningful title phrases directly in compactQuery
  if (compactQuery.length >= 4 && !asciiTokens.has(normId)) {
    for (const chunk of titleChunks(entry.title)) {
      if (compactQuery.includes(chunk)) {
        score += 22;
        hits.add(`标题短语：${chunk}`);
      }
    }
  }

  for (const term of terms) {
    if (term === normId) {
      if (!hits.has('编号')) { score += 1000; hits.add('编号'); }
      continue;
    }
    if (/^[a-z]+(?:-a)?\d+$/.test(term)) continue;
    const matchedFields = [];
    for (const [field, weight, label] of searchable) {
      if (norm(entry[field]).includes(term)) matchedFields.push([weight, label]);
    }
    for (const [weight, label] of matchedFields) {
      score += weight;
      hits.add(`${label}：${term}`);
    }
    if (norm(entry.exclude).includes(term)) {
      exclusionHits.add(term);
    } else if (!matchedFields.length && term.length >= 4) {
      const pairs = bigrams(term);
      const normTitle = norm(entry.title);
      let titleOverlap = 0;
      for (const pair of pairs) if (normTitle.includes(pair)) titleOverlap++;
      if (titleOverlap >= 2) {
        score += Math.min(titleOverlap * 3, 12);
        hits.add(`标题弱匹配：${term}`);
      } else {
        const body = norm(entry.kind === 'application' ? `${entry.conditions} ${entry.action}` : entry.definition);
        let bodyOverlap = 0;
        for (const pair of pairs) if (body.includes(pair)) bodyOverlap++;
        if (bodyOverlap >= 3) {
          score += Math.min(bodyOverlap, 5);
          hits.add(`语义弱匹配：${term}`);
        }
      }
    }
  }
  return { score, matched: [...hits].sort(), exclusion_hits: [...exclusionHits].sort() };
}

function search(words, domain = null, limit = 6, data = null) {
  const indexData = data || loadIndex();
  const raw = Array.isArray(words) ? words.join(' ') : String(words ?? '');
  const query = norm(raw);
  if (!query) return [];
  const compactQuery = query.replace(/\s+/g, '');
  const asciiTokens = new Set(query.match(/[a-z\d_-]+/g) || []);

  const matchAsciiPhrase = (text, phrase) => {
    if (!phrase.includes(' ')) return asciiTokens.has(phrase);
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z\\d_-])${esc}(?:$|[^a-z\\d_-])`).test(text);
  };

  // Expand English/film aliases both as whole query and embedded phrases
  let expandedQuery = query;
  const aliasExtras = [];
  for (const [key, mapped] of Object.entries(TERM_ALIASES)) {
    const isAscii = /^[a-z\d\s_-]+$/.test(key);
    const hit = isAscii ? matchAsciiPhrase(query, key) : compactQuery.includes(key);
    if (hit) {
      aliasExtras.push(mapped);
      expandedQuery += ' ' + mapped;
    }
  }
  const expandedCompact = norm(expandedQuery).replace(/\s+/g, '');

  const rawParts = query.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
  const terms = [...new Set([
    ...(TERM_ALIASES[query] ? [TERM_ALIASES[query]] : rawParts.map(t => TERM_ALIASES[t] || t)),
    ...aliasExtras
  ].filter(Boolean))];

  const sceneRows = readJson(SCENE_FILE);
  const sceneHits = new Map();
  for (const row of sceneRows) {
    for (const phrase of [row.phrase, ...(row.aliases || [])]) {
      const rawPhrase = norm(phrase);
      const p = rawPhrase.replace(/\s+/g, '');
      if (!p) continue;
      const isAscii = /^[a-z\d\s_-]+$/.test(rawPhrase);
      if (isAscii ? matchAsciiPhrase(expandedQuery, rawPhrase) : expandedCompact.includes(p)) {
        const len = p.length;
        row.ids.forEach((id, idx) => {
          let meta = sceneHits.get(id);
          if (!meta) {
            meta = { phrases: new Set(), maxLen: len, bestOrder: idx };
            sceneHits.set(id, meta);
          } else if (len > meta.maxLen || (len === meta.maxLen && idx < meta.bestOrder)) {
            meta.maxLen = len;
            meta.bestOrder = idx;
          }
          meta.phrases.add(phrase);
        });
      }
    }
  }

  const domains = indexData.domains.filter(d => !domain || d.slug === domain);
  const entries = [
    ...loadDefinitions(domains),
    ...indexData.applications
      .filter(a => !domain || a.domain === domain)
      .map(a => ({ ...a, kind: 'application' }))
  ];

  const found = [];
  for (const entry of entries) {
    const fields = [['title', 24, '标题']];
    if (entry.kind === 'application') {
      fields.push(['conditions', 13, '条件'], ['action', 8, '做法'], ['alternative', 3, '替代'], ['example', 2, '示例']);
    } else {
      fields.push(['definition', 8, '定义']);
    }
    const { score: baseScore, matched, exclusion_hits } = scoreEntry(entry, terms, expandedCompact, asciiTokens, fields);
    let score = baseScore;
    const meta = sceneHits.get(entry.id);
    if (meta && meta.phrases.size) {
      const orderBoost = meta.bestOrder === 0 ? 52 : Math.max(20, 34 - meta.bestOrder * 4);
      const lenBoost = Math.min(meta.maxLen * 4, 24);
      const countBoost = Math.min((meta.phrases.size - 1) * 5, 10);
      score += orderBoost + lenBoost + countBoost;
      for (const ph of [...meta.phrases].sort()) matched.push(`场景词：${ph}`);
    }
    if (score > 0) found.push({ ...entry, score, matched, exclusion_hits, _sceneOrder: meta ? meta.bestOrder : 999 });
  }
  found.sort((a, b) => b.score - a.score || a._sceneOrder - b._sceneOrder || a.id.localeCompare(b.id));
  const cleaned = found.map(({ _sceneOrder, ...rest }) => rest);
  return limit == null ? cleaned : cleaned.slice(0, limit);
}

function parseCli(argv) {
  const words = [];
  let domain = null;
  let limit = 6;
  let detail = false;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ling-yu' || a === '--domain') { domain = argv[++i]; }
    else if (a === '--shu-liang' || a === '--limit') { limit = Number(argv[++i]); }
    else if (a === '--xiang-xi' || a === '--detail') { detail = true; }
    else if (a === '--json') { asJson = true; }
    else if (a.startsWith('--')) throw new Error('未知选项：' + a);
    else words.push(a);
  }
  if (!words.length) throw new Error('用法：node jiao-ben/jian-suo.cjs <检索词> [--ling-yu/--domain 域] [--shu-liang/--limit N] [--xiang-xi] [--json]');
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('数量应为1至30');
  return { words, domain, limit, detail, asJson };
}

function main(argv) {
  const opts = parseCli(argv);
  const data = loadIndex();
  if (opts.domain && !data.domains.some(d => d.slug === opts.domain)) throw new Error('未知专项，请查看知识总索引');
  const found = search(opts.words, opts.domain, null, data);
  const result = found.slice(0, opts.limit);
  if (opts.asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (!result.length) {
    process.stdout.write(`摄影检索未命中（${opts.domain || '全部摄影专项'}）：${opts.words.join(' ')}。可换术语，或按「流程/知识检索与采用.md」转查其他领域。\n`);
    return;
  }
  process.stdout.write('以下是检索候选。采用前读取对应条目，并核对当前场面和锁定项。\n');
  process.stdout.write(`找到 ${found.length} 条，当前显示 ${result.length} 条。\n`);
  for (const e of result) {
    const layer = e.kind === 'definition' ? '定义' : '应用';
    process.stdout.write(`\n${e.id} ${e.domain_name} / ${e.title}（${layer}）\n位置：${e.path}\n命中：${e.matched.join('、')}\n`);
    if (e.kind === 'definition') {
      process.stdout.write(`定义：${e.definition}\n边界：${e.boundary}\n`);
    } else {
      process.stdout.write(`条件：${e.conditions}\n做法：${e.action}\n排除：${e.exclude}\n`);
      if (e.exclusion_hits.length) process.stdout.write(`排除提示：检索词 ${e.exclusion_hits.join('、')} 出现在排除条件\n`);
      if (opts.detail) process.stdout.write(`替代：${e.alternative}\n正反例：${e.example}\n状态：${e.status}\n`);
    }
  }
}

module.exports = { search, loadIndex, TERM_ALIASES, ENTRY_ALIASES };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (err) { process.stderr.write(err.message + '\n'); process.exitCode = 2; }
}
