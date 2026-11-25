const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const martialPath = path.join(__dirname, '../知识库/动作与特效/武打/jiao-ben/jian-suo.cjs');
const animationPath = path.join(__dirname, '../知识库/动作与特效/动画案例/检索.cjs');
const photoPath = path.join(__dirname, '../知识库/摄影与画面/jiao-ben/jian-suo.cjs');
const vfxPath = path.join(__dirname, '../知识库/动作与特效/特效/jiao-ben/jian-suo.cjs');
const routerPath = path.join(__dirname, '../工具/检索.cjs');
const { retrieve: martialSearch } = require(martialPath);
const { retrieve: caseSearch } = require(animationPath);
const { search: photoSearch } = require(photoPath);
const { retrieve: vfxSearch } = require(vfxPath);
const { searchDomain } = require(routerPath);
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

test('具体镜头任务仍能召回变速和切宽案例', () => {
  const candidates = candidateIds(caseSearch('快速近身，交会慢放，再切常速'));
  assert.ok(candidates.includes('DF06'));
  assert.ok(candidates.includes('DF07'));
  assert.equal(candidateIds(caseSearch('镜头参考DF06'))[0], 'DF06');
});

test('普通两段对白不误入动作案例', () => {
  assert.deepEqual(caseSearch('两段各30秒，拍一场两人站在窗边的对白').candidates, []);
});

test('宽泛词与待核验作品名不自动匹配镜头案例', () => {
  assert.deepEqual(caseSearch('补一段常速打戏').candidates, []);
  assert.deepEqual(caseSearch('查 DF060').candidates, []);
  const { candidates, sources } = caseSearch('参考沧元图');
  assert.deepEqual(candidates, []);
  assert.ok(sources.some(source => source.work === '沧元图' && source.status === '待逐镜核验'));
  assert.equal(candidateIds(caseSearch('法阵破裂，余光留在石壁'))[0], 'DF04');
});

test('各子库与统一中文入口 CLI 均保留稳定传参和 JSON 输出', () => {
  const run = (script, ...args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' }));
  assert.equal(candidateIds(run(martialPath, 'A06', '--wu-qi', 'unarmed'))[0], 'A06');
  assert.equal(candidateIds(run(animationPath, 'ＤＦ０６'))[0], 'DF06');
  assert.equal(run(photoPath, 'ORG-A02', '--json')[0].id, 'ORG-A02');
  assert.equal(candidateIds(run(vfxPath, 'V04'))[0], 'V04');
  assert.equal(run(routerPath, '摄影', '两人站在窗边谈话怎么拍过肩反打').candidates[0].id, 'ORG-A02');
  assert.equal(run(routerPath, '特效', '剑光落空').candidates[0].id, 'A02');
  const allRes = run(routerPath, '全部', '法阵破裂');
  assert.ok(allRes.results['案例'].some(c => c.id === 'DF04'));
});

test('摄影 Node.js 检索支持中文整句、英文影视术语、精确编号与限域', () => {
  assert.equal(photoSearch('ORG-A02')[0].id, 'ORG-A02');
  assert.equal(photoSearch('两人站在窗边谈话怎么拍过肩反打')[0].id, 'ORG-A02');
  assert.ok(photoSearch('如何用OTS拍双人对话').some(e => e.id === 'ORG05'));
  assert.equal(photoSearch('rack focus转焦')[0].id, 'MOV-A05');
  assert.equal(photoSearch('逆光看不清人脸表情怎么办')[0].id, 'LIT-A04');
  const limited = photoSearch('竖屏', 'jing-bie');
  assert.ok(limited.length > 0 && limited.every(e => e.domain === 'jing-bie'));
  assert.ok(photoSearch('焦段怎么选，广角还是长焦').some(e => e.id === 'CAM-A03' || e.id === 'CAM-A04'));
  assert.ok(photoSearch('低机位视平线').some(e => e.id === 'ANG-A01' || e.id === 'ANG-A08'));
  assert.ok(searchDomain('摄影', '焦段怎么选，近景人脸广角会不会畸变').candidates.some(c => c.id === 'CAM-A03' || c.id === 'CAM-A04'));
  assert.ok(searchDomain('摄影', '低机位视平线和高低人物正反打').candidates.some(c => c.id === 'ANG-A01' || c.id === 'ANG-A08'));
});

test('提纯运镜与特殊视点检索命中新增条目及漫剧高频词', () => {
  assert.equal(photoSearch('牵引镜头和尾随镜头怎么选')[0].id, 'MOV-A13');
  assert.equal(photoSearch('追逐戏用前景遮挡跟拍')[0].id, 'MOV-A14');
  assert.equal(photoSearch('固定机位画外入侵悬疑感')[0].id, 'MOV-A15');
  assert.equal(photoSearch('道具特写拉远揭示环境')[0].id, 'MOV-A16');
  assert.equal(photoSearch('半弧绕拍避免360度环绕穿墙')[0].id, 'MOV-A17');
  assert.equal(photoSearch('时间凝固微粒飘散子弹时间')[0].id, 'MOV-A18');
  assert.equal(photoSearch('荷兰角倾斜再缓慢回正')[0].id, 'ANG-A09');
  assert.equal(photoSearch('监视器视角和门缝视角')[0].id, 'ANG-A10');
  assert.equal(photoSearch('水面反射倒影转场与碎镜')[0].id, 'ANG-A11');
  assert.ok(photoSearch('dolly zoom 希区柯克变焦').some(e => e.id === 'MOV-A11'));
  assert.ok(photoSearch('split diopter 分裂屈光前景背景同时清晰').some(e => e.id === 'DEP-A09'));
  assert.equal(photoSearch('贴身追拍和碎片擦镜转场')[0].id, 'MOV-A19');
  assert.equal(photoSearch('一镜到底摇臂长镜头衔接动机')[0].id, 'MOV-A20');
  assert.equal(photoSearch('贴地冲刺跟拍和攻击部位联动')[0].id, 'MOV-A21');
  assert.equal(photoSearch('速度坡道快慢转换与慢放提速')[0].id, 'TIM-A11');
  assert.ok(photoSearch('speed ramp 快慢反差').some(e => e.id === 'TIM-A11'));
  assert.ok(photoSearch('hit-stop 咬合顿挫').some(e => e.id === 'TIM-A11'));
  assert.ok(candidateIds(martialSearch('六名敌人围攻主角群战清场')).includes('X09'));
  assert.ok(searchDomain('武打', '多人围攻主角').candidates.some(c => c.id === 'X09'));
  assert.equal(candidateIds(martialSearch('长枪跳劈半圆弧与被近身抽杆拉开'))[0], 'W06');
  assert.equal(candidateIds(martialSearch('拉弓射箭引弓满月边退边射'))[0], 'W07');
  assert.equal(candidateIds(martialSearch('空手夺白刃擒拿锁腕'))[0], 'W08');
  assert.equal(candidateIds(martialSearch('格挡被震开破防零碎闪躲'))[0], 'C09');
  assert.equal(candidateIds(martialSearch('惊险躲刀铁板桥分段让位闪避'))[0], 'C10');
  assert.equal(candidateIds(martialSearch('撞破木门破窗换场'))[0], 'X10');
  assert.equal(candidateIds(martialSearch('战损累积无血重创与大招反站桩'))[0], 'X11');
  const crossHit = searchDomain('全部', '擦身慢镜闪避');
  assert.equal(crossHit.results['武打'][0].id, 'C10');
  assert.equal(crossHit.results['摄影'][0].id, 'TIM-A11');
});

test('特效检索激活 42KB 结构化索引，支持编号、中文短句与限层', () => {
  assert.equal(candidateIds(vfxSearch('F04'))[0], 'F04');
  assert.equal(candidateIds(vfxSearch('剑光落空'))[0], 'A02');
  assert.ok(candidateIds(vfxSearch('火焰熄灭')).includes('V11'));
  assert.ok(candidateIds(vfxSearch('水墨扩散', { layer: 'family' })).every(id => id.startsWith('F')));
  const unified = searchDomain('特效', '法阵停止来源后的残留');
  assert.ok(unified.candidates.some(c => c.id === 'A03' && c.location.startsWith('知识库/动作与特效/特效/zhi-shi-ku/')));
});

test('人物与声音第5子库接入统一中文检索并参与全部联查', () => {
  assert.equal(searchDomain('表演', 'BA07').candidates[0].id, 'BA07');
  assert.ok(searchDomain('表演', '吃糖葫芦唇齿接触与咬痕').candidates.some(c => c.id === 'BA07' || c.id === 'B07'));
  assert.ok(searchDomain('人声', '笑着说话想哭不落泪').candidates.some(c => c.id === 'FA06' || c.id === 'F04'));
  assert.ok(searchDomain('人物', '听者反应提前').candidates.some(c => c.id === 'CA01' || c.id === 'C01'));
  const allOut = searchDomain('全部', '笑着说话');
  assert.ok(Array.isArray(allOut.results['表演']) && allOut.results['表演'].length > 0);
});

test('场景词主次顺序优先于字母字典序，且多词英文别名正常召回', () => {
  assert.deepEqual(candidateIds(martialSearch('多人围攻')).slice(0, 2), ['X09', 'C07']);
  assert.deepEqual(candidateIds(martialSearch('倒地后起身')).slice(0, 2), ['R03', 'A05']);
  assert.deepEqual(candidateIds(martialSearch('空手夺白刃')).slice(0, 2), ['W08', 'R05']);
  assert.deepEqual(candidateIds(martialSearch('破防零碎闪躲')).slice(0, 2), ['C09', 'C04']);
  assert.equal(photoSearch('one take')[0].id, 'MOV-A20');
  assert.equal(photoSearch('摇臂长镜头')[0].id, 'MOV-A20');
  assert.equal(photoSearch('贴刃跟拍')[0].id, 'MOV-A19');
  assert.equal(photoSearch('同景别跳切')[0].id, 'SIZ-A08');
  assert.equal(photoSearch('空间站位')[0].id, 'SPA01');
  assert.equal(photoSearch('分裂屈光')[0].id, 'DEP-A09');
});
