'use strict';
/**
 * 特效知识库离线候选检索（读取 zhi-shi-ku/tiao-mu-suo-yin.json，零外部依赖）。
 */
const fs = require('node:fs');
const path = require('node:path');

const indexDir = path.join(__dirname, '..', 'zhi-shi-ku');
const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().trim();
const readJson = file => JSON.parse(fs.readFileSync(path.join(indexDir, file), 'utf8').replace(/^\uFEFF/, ''));

function headingAnchor(heading) {
  return norm(heading)
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '')
    .replace(/\s+/g, '-');
}

function chunks(str) {
  return norm(str).split(/[、与和或的，。→（）()\s/]+/).filter(s => s.length >= 2);
}

function bigrams(str) {
  const out = new Set();
  for (let i = 0; i < str.length - 1; i++) out.add(str.slice(i, i + 2));
  return out;
}

function retrieve(query, opts = {}) {
  if (!String(query ?? '').trim()) throw new Error('需要检索词。');
  const layerFilter = opts.layer || null;
  if (layerFilter && !['process', 'family', 'application'].includes(layerFilter)) {
    throw new Error('层类别须为 process / family / application');
  }
  const library = readJson('tiao-mu-suo-yin.json');
  const normalized = norm(query);
  const compact = normalized.replace(/\s+/g, '');
  const tokens = normalized.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
  const asciiTokens = new Set(normalized.match(/[a-z\d_-]+/g) || []);

  const matchesPhrase = phrase => {
    const t = norm(phrase);
    if (!t) return false;
    return /^[a-z\d_-]+$/.test(t) ? asciiTokens.has(t) : compact.includes(t.replace(/\s+/g, ''));
  };

  const results = [];
  for (const e of library.entries) {
    if (layerFilter && e.layer !== layerFilter) continue;
    const names = [e.name, ...(e.aliases || [])];
    let rank = 0;
    const reasons = [];

    if (asciiTokens.has(norm(e.id))) {
      rank += 1000;
      reasons.push('精确编号');
    } else {
      const exactName = names.find(n => tokens.includes(norm(n)));
      const matchedSubs = names.filter(matchesPhrase).sort((a, b) => norm(b).length - norm(a).length);
      if (exactName) {
        rank += 120 + norm(exactName).length * 8;
        reasons.push('名称：' + exactName);
      } else if (norm(e.name).includes(compact) && compact.length >= 2) {
        rank += 95 + compact.length * 10;
        reasons.push('名称包含：' + query);
      } else if (matchedSubs.length) {
        const best = matchedSubs[0];
        rank += 40 + norm(best).length * 10;
        reasons.push('短语：' + best);
      }
      for (const part of chunks(e.name)) {
        if (compact.includes(part) && !reasons.some(r => r.includes(part))) {
          rank += 35 + part.length * 10 + (part === compact ? 30 : 0);
          reasons.push('名称片语：' + part);
        }
      }
      for (const alias of e.aliases || []) {
        for (const part of chunks(alias)) {
          if (compact.includes(part) && !reasons.some(r => r.includes(part))) {
            rank += 20 + part.length * 8;
            reasons.push('别名片语：' + part);
          }
        }
      }
      if (rank === 0 && compact.length >= 2) {
        const qPairs = bigrams(compact);
        const target = norm(`${e.name} ${(e.aliases || []).join(' ')}`);
        let overlap = 0;
        for (const pair of qPairs) if (target.includes(pair)) overlap++;
        if (overlap >= 1) {
          rank += overlap * 12;
          reasons.push('关键词匹配');
        } else if (compact.length >= 4) {
          const cons = norm(e.result_constraints || '');
          let cOverlap = 0;
          for (const pair of qPairs) if (cons.includes(pair)) cOverlap++;
          if (cOverlap >= 2) {
            rank += Math.min(cOverlap * 4, 16);
            reasons.push('约束弱匹配');
          }
        }
      }
    }

    if (rank > 0) {
      results.push({
        id: e.id,
        name: e.name,
        layer: e.layer,
        file: e.file,
        location: `${e.file}#${headingAnchor(e.heading || `${e.id} ${e.name}`)}`,
        match: reasons.join('、'),
        rank,
        required_conditions: e.required_conditions || [],
        result_constraints: e.result_constraints || '',
        related: e.related || []
      });
    }
  }

  results.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  const limit = opts.limit || 8;
  const candidates = results.slice(0, limit);
  return {
    query,
    candidates,
    ...(!candidates.length && {
      diagnostic: { domain: '特效', tokens, fallback: '改用条目编号（如V04/F02/A05）或查阅知识库/动作与特效/特效/zhi-shi-ku/suo-yin.md。' }
    }),
    note: '候选不是项目采用状态；采用前核对原稿授权、来源和环境反馈。'
  };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const words = [];
    let layer = null;
    let limit = 8;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--layer' || args[i] === '--ceng') layer = args[++i];
      else if (args[i] === '--limit' || args[i] === '--shu-liang') limit = Number(args[++i]);
      else if (args[i].startsWith('--')) throw new Error('未知选项：' + args[i]);
      else words.push(args[i]);
    }
    process.stdout.write(JSON.stringify(retrieve(words.join(' '), { layer, limit }), null, 2) + '\n');
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exitCode = 2;
  }
}

module.exports = { retrieve };
