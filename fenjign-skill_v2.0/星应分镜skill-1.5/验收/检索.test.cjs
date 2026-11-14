const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const martialPath = path.join(__dirname, '../知识库/动作与特效/武打/jiao-ben/jian-suo.cjs');
const animationPath = path.join(__dirname, '../知识库/动作与特效/动画案例/检索.cjs');
const { retrieve: martialSearch } = require(martialPath);
const { retrieve: caseSearch } = require(animationPath);
const candidateIds = result => result.candidates.map(candidate => candidate.id);
const noConflicts = { 'ability-conflict': false, 'locked-result-conflict': false };
const threePersonFacts = {
  'third-person-present': true,
  'three-person-start-states-known': true,
  'three-person-goals-known': true,
  'intervention-route-established': true,
  'three-person-perception-known': true
};

test('中文动作句保留转向与接近候选，三人场景优先', () => {
  assert.ok(candidateIds(martialSearch('主角向左转向')).includes('A02'));
  const candidates = candidateIds(martialSearch('两人一前一后接近主角'));
  assert.deepEqual(candidates.slice(0, 2), ['C07', 'X03']);
  assert.ok(candidates.includes('R01'));
  const example = candidateIds(martialSearch('两个人从两侧夹击主角，主角向左转向'));
  assert.deepEqual(example.slice(0, 2), ['C07', 'X03']);
  assert.ok(example.includes('A02'));
});

test('自然说法、全角与数字写法均召回三人交锋', () => {
  for (const query of ['一对二', '两个角色夹击主角', '请写一段１Ｖ２的交锋', '以一敌二']) {
    assert.deepEqual(candidateIds(martialSearch(query)).slice(0, 2), ['C07', 'X03'], query);
  }
});

test('已登记的短术语继续给出相应的动作条目', () => {
  assert.ok(candidateIds(martialSearch('武器归属')).includes('X06'));
  assert.ok(candidateIds(martialSearch('落空')).includes('R04'));
  assert.ok(candidateIds(martialSearch('脱手')).includes('R05'));
});

test('C07 和 X03 将未给定的条件、冲突与成立分开', () => {
  for (const id of ['C07', 'X03']) {
    const [pending] = martialSearch(id, noConflicts).candidates;
    assert.equal(pending.state, '未定');
    assert.deepEqual(new Set(pending.unknown), new Set(Object.keys(threePersonFacts)));

    const facts = { ...noConflicts, ...threePersonFacts };
    const [passing] = martialSearch(id, facts).candidates;
    assert.equal(passing.state, '满足索引条件，仍读正文');

    const [conflicting] = martialSearch(id, { ...facts, 'intervention-route-established': false }).candidates;
    assert.equal(conflicting.state, '冲突');
    assert.deepEqual(conflicting.conflicts, ['intervention-route-established']);
  }
});

test('有三人场型时先给完整案例，再给变速和近身视觉问题参考', () => {
  const candidates = candidateIds(caseSearch('一对二快速近身，交会慢放，再切常速'));
  assert.equal(candidates[0], 'DF08');
  assert.ok(candidates.includes('DF06'));
  assert.ok(candidates.includes('DF07'));
  assert.equal(candidateIds(caseSearch('一对二镜头参考DF06'))[0], 'DF06');
});

test('两段斗法调用 DF09，普通两段对白不误入斗法案例', () => {
  const candidate = caseSearch('两段各30秒，第一段交锋，第二段大战，余效从地标继续').candidates[0];
  assert.equal(candidate.id, 'DF09');
  assert.equal(candidate.anchor, '实战样例.md#df09');
  assert.deepEqual(caseSearch('两段各30秒，拍一场两人站在窗边的对白').candidates, []);
});

test('宽泛词与待核验作品名不自动匹配镜头案例', () => {
  assert.deepEqual(caseSearch('补一段常速打戏').candidates, []);
  assert.deepEqual(caseSearch('查 DF080').candidates, []);
  const { candidates, sources } = caseSearch('参考沧元图');
  assert.deepEqual(candidates, []);
  assert.ok(sources.some(source => source.work === '沧元图' && source.status === '待逐镜核验'));
  assert.equal(candidateIds(caseSearch('法阵破裂，余光留在石壁'))[0], 'DF04');
});

test('两个 CLI 保留原有的传参和 JSON 输出', () => {
  const run = (script, ...args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }));
  assert.equal(candidateIds(run(martialPath, 'A06', '--wu-qi', 'unarmed'))[0], 'A06');
  assert.equal(candidateIds(run(animationPath, 'ＤＦ０８'))[0], 'DF08');
});
