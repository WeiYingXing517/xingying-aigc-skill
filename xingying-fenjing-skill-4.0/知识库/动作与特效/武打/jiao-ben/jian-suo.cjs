const fs = require('node:fs');
const path = require('node:path');
const indexDirectory = path.join(__dirname, '..', 'zhi-shi-ku');

function readIndex(filename) {
  return JSON.parse(fs.readFileSync(path.join(indexDirectory, filename), 'utf8').replace(/^\uFEFF/, ''));
}

const normalize = text => text.normalize('NFKC').toLowerCase().trim();

// 只读候选检索；不判断复杂身体可行性，不改变任何设计文件。
function retrieve(query, facts = {}, weapon = null) {
  if (!query.trim()) throw new Error('需要检索词。');
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) throw new Error('条件须为JSON对象。');
  if (Object.values(facts).some(v => v !== true && v !== false && v !== null)) throw new Error('条件值仅允许true/false/null。');
  if (weapon && !['unarmed', 'rigid-handheld'].includes(weapon)) throw new Error('器械类别无效。');
  const library = readIndex('tiao-mu-suo-yin.json');
  const known = new Set(library.entries.flatMap(e => [...e.required_facts, ...e.exclusions]));
  const invalid = Object.keys(facts).filter(k => !known.has(k));
  if (invalid.length) throw new Error('未知条件键：' + invalid.join(','));
  const normalized = normalize(query);
  const tokens = normalized.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
  const asciiTokens = new Set(normalized.match(/[a-z\d_-]+/g) ?? []);
  const compactQuery = normalized.replace(/\s+/g, '');
  const matches = phrase => {
    const term = normalize(phrase);
    if (!term) return false;
    if (/^[a-z\d\s_-]+$/.test(term)) {
      if (!term.includes(' ')) return asciiTokens.has(term);
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      return new RegExp(`(?:^|[^a-z\\d_-])${esc}(?:$|[^a-z\\d_-])`).test(normalized);
    }
    return compactQuery.includes(term.replace(/\s+/g, ''));
  };
  const scenes = readIndex('chang-jing-ci.json');
  const sceneHits = new Map();
  for (const scene of scenes) {
    for (const phrase of [scene.phrase, ...scene.aliases].filter(matches)) {
      const len = phrase.replace(/\s+/g, '').length;
      scene.ids.forEach((id, idx) => {
        const prev = sceneHits.get(id);
        if (!prev || len > prev.len || (len === prev.len && idx < prev.order)) {
          sceneHits.set(id, { phrase, len, order: idx });
        }
      });
    }
  }
  const results = [];
  for (const e of library.entries) {
    const names = [e.name, ...e.aliases];
    const sceneHit = sceneHits.get(e.id);
    const nameHit = names.find(matches);
    let rank, match;
    if (asciiTokens.has(e.id.toLowerCase())) {
      rank = 100;
      match = '精确编号';
    } else if (names.some(name => tokens.includes(normalize(name)))) {
      rank = 80;
      match = '名称候选，变体仍须核对';
    } else if (sceneHit) {
      rank = 70;
      match = '场景词：' + sceneHit.phrase + '（动作类型待确认）';
    } else if (nameHit) {
      rank = 60;
      match = '片语：' + nameHit + '（动作类型待确认）';
    } else {
      continue;
    }
    const conflicts = [], unknown = [];
    if (weapon && !e.weapon_scope.includes(weapon) && !e.weapon_scope.includes('as-scripted') && !e.weapon_scope.includes('not-applicable')) conflicts.push('weapon-scope');
    for (const key of e.required_facts) {
      if (facts[key] === false) conflicts.push(key);
      else if (facts[key] !== true) unknown.push(key);
    }
    for (const key of e.exclusions) {
      if (facts[key] === true) conflicts.push(key);
      else if (facts[key] !== false) unknown.push(key);
    }
    results.push({id:e.id, name:e.name, file:e.file, location:e.file + '#' + e.id.toLowerCase(), match, rank,
      state: conflicts.length ? '冲突' : unknown.length ? '未定' : '满足索引条件，仍读正文', conflicts, unknown,
      result_policy:e.result_policy});
  }
  const priority = candidate => candidate.rank === 100 ? 0 : candidate.conflicts.length ? 2 : 1;
  const sceneLength = candidate => sceneHits.get(candidate.id)?.len ?? 0;
  const sceneOrder = candidate => sceneHits.get(candidate.id)?.order ?? 999;
  results.sort((a, b) =>
    priority(a) - priority(b) ||
    b.rank - a.rank ||
    sceneLength(b) - sceneLength(a) ||
    sceneOrder(a) - sceneOrder(b) ||
    a.id.localeCompare(b.id)
  );
  return {query, candidates:results, ...(!results.length && {
    diagnostic: {domain: '武打', tokens, fallback: '改用条目编号或短术语，或查阅流程/知识检索与采用.md。'}
  }), note:'候选不是结果授权；未知不当通过，索引条件满足不保证动作可行。'};
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2), words = [];
    let facts = {}, weapon = null;
    for (let i=0; i<args.length; i++) {
      if (args[i] === '--tiao-jian') {
        if (!args[i+1]) throw new Error('缺条件文件路径。');
        facts = JSON.parse(fs.readFileSync(args[++i], 'utf8').replace(/^\uFEFF/, ''));
      } else if (args[i] === '--wu-qi') {
        if (!args[i+1]) throw new Error('缺器械类别。');
        weapon = args[++i];
      } else if (args[i].startsWith('--')) throw new Error('未知选项：'+args[i]);
      else words.push(args[i]);
    }
    process.stdout.write(JSON.stringify(retrieve(words.join(' '),facts,weapon),null,2)+'\n');
  } catch(e) { process.stderr.write(e.message+'\n'); process.exitCode=2; }
}
module.exports = {retrieve};
