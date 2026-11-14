const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '索引.json'), 'utf8').replace(/^\uFEFF/, ''));
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

function retrieve(input) {
  const query = normalize(input);
  if (!query) throw new Error('用法：node 检索.cjs "场面、案例编号或作品与季别"');

  const asciiTokens = new Set(input.normalize('NFKC').toLowerCase().match(/[a-z\d_-]+/g) ?? []);
  const findMatches = terms => terms.filter(term => {
    const normalized = normalize(term);
    return /^[a-z\d_-]+$/.test(normalized) ? asciiTokens.has(normalized) : query.includes(normalized);
  });
  const candidates = data.cases.flatMap(entry => {
    const direct = asciiTokens.has(normalize(entry.id));
    const scenarioHits = findMatches(entry.scenario_terms ?? []);
    for (const group of entry.scenario_groups ?? []) {
      const hits = group.flatMap(terms => findMatches(terms).slice(0, 1));
      if (hits.length === group.length) scenarioHits.push(hits.join(' + '));
    }
    const detailHits = findMatches(entry.terms);
    const matched = [...new Set([...scenarioHits, ...detailHits])];
    if (!direct && !matched.length) return [];
    // 作品名只查资料。案例编号优先，其次匹配场型，最后按具体观看问题推荐。
    return [{
      id: entry.id,
      title: entry.title,
      anchor: entry.anchor,
      condition: entry.condition,
      matched: direct ? [entry.id, ...matched] : matched,
      priority: direct ? 2 : scenarioHits.length ? 1 : 0,
      detailLength: Math.max(0, ...matched.map(term => normalize(term).length))
    }];
  }).sort((a, b) => b.priority - a.priority || b.detailLength - a.detailLength || a.id.localeCompare(b.id));

  const workHits = data.works.filter(work => findMatches(work.aliases).length);
  const seasons = [5, 6].filter(season => {
    const chinese = season === 5 ? '五' : '六';
    return new RegExp('第?(?:' + chinese + '|' + season + ')季|不良人(?:' + chinese + '|' + season + ')|s0?' + season + '(?![0-9])').test(query);
  });
  if (/五[、和与至/-]?六季|5[、和与至/-]?6季/.test(query)) seasons.push(5, 6);

  const sources = workHits.flatMap(work => work.sources
    .filter(source => !seasons.length || !source.season || seasons.includes(source.season))
    .map(source => ({ work: work.name, ...source })));

  return {
    candidates: candidates.slice(0, 4).map(({ priority, detailLength, ...candidate }) => candidate),
    sources,
    fallback: candidates.length ? undefined : '按具体观看问题查阅索引.md，或转对应摄影、武打、特效索引。'
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(retrieve(process.argv.slice(2).join(' ')), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { retrieve };
