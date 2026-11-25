'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tool = require('../工具/项目管理.cjs');
const rootSkill = path.resolve(__dirname, '..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xingying-project-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const p = tool.init(root, 'TEST');
  const script = '起初阿宁活着，身体无伤。\n第2集阿宁死亡。\n第70集阿宁明确复活。\n第8集阿宁左臂受伤。';
  const scriptPath = path.join(root, '01-剧本', '原始输入', '原稿.txt');
  fs.writeFileSync(scriptPath, script);
  p.documents.push({ id: 'D1', path: '01-剧本/原始输入/原稿.txt', version: 'v1', sha256: tool.fileHash(scriptPath), kind: 'script', dependsOn: [] });
  const promptPath = path.join(root, '05-分段提示词', 'B01.txt');
  fs.writeFileSync(promptPath, '分镜S1：阿宁正常站立。');
  p.documents.push({ id: 'OUT', path: '05-分段提示词/B01.txt', version: 'v1', sha256: tool.fileHash(promptPath), kind: 'prompt', dependsOn: [{ id: 'D1', sha256: p.documents[0].sha256 }] });
  p.adoptions.push({ scope: 'EP001/SC001', stage: '01', documentId: 'D1', source: '测试用户明确采用原稿' });
  p.objects.push({ id: 'P1', name: '阿宁', type: 'character', aliases: [] });
  p.events.push({ id: 'BASE', objectId: 'P1', timeline: 'main', point: 0, until: null, scope: 'EP001', status: 'adopted', from: {}, to: { life: 'alive', injury: 'normal' }, evidence: { documentId: 'D1', quote: '起初阿宁活着，身体无伤。' } });
  const imagePath = path.join(root, '03-资产', '正常.png');
  fs.writeFileSync(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCz8AAAAASUVORK5CYII=', 'base64'));
  p.images.push({ id: 'I1', objectId: 'P1', name: '阿宁正常', path: '03-资产/正常.png', sha256: tool.fileHash(imagePath), sourceRef: 'test-upload-1', version: 'v1', status: 'available', viewed: true, state: { injury: 'normal' }, roles: ['appearance'], source: '测试用户指认' });
  p.settings.push({ id: 'SET1', key: 'segmentSeconds', value: 15, status: 'confirmed', source: '测试实际回答15秒', scopes: ['EP001/SC001'] });
  p.units.push({ id: 'U1', parentId: '', scope: 'EP001/SC001', stage: '04B', workStatus: '进行中', adoptionStatus: '草稿', reviewStatus: '未检查', next: '核对', blocker: '', documentIds: ['OUT'], sourceDocumentIds: ['D1'], dependsOnUnits: [], requiredSettings: ['SET1'], requiredGates: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'], observations: [{ id: 'O1', shotId: 'S1', objectId: 'P1', timeline: 'main', point: 1, requires: { life: 'alive', injury: 'normal' } }], referenceNeeds: [{ id: 'N1', observationId: 'O1', role: 'appearance', mode: 'image' }], bindings: [{ needId: 'N1', imageId: 'I1', label: '图1' }] });
  p.currentUnit = 'U1';
  return { root, p, u: p.units[0] };
}
function codes(p, root) { return tool.validate(p, root).map(e => e.code); }
function deathAndRevival(p) {
  p.events.push({ id: 'DEATH', objectId: 'P1', timeline: 'main', point: 2, until: null, scope: 'EP002', status: 'adopted', from: { life: 'alive' }, to: { life: 'dead' }, evidence: { documentId: 'D1', quote: '第2集阿宁死亡。' } });
  p.events.push({ id: 'REVIVE', objectId: 'P1', timeline: 'main', point: 70, until: null, scope: 'EP070', status: 'adopted', from: { life: 'dead' }, to: { life: 'alive' }, evidence: { documentId: 'D1', quote: '第70集阿宁明确复活。' } });
}
function deliver(p, u) {
  u.workStatus = '已交付'; u.reviewStatus = '通过';
  const related = tool.relevantEventsForUnit(p, u);
  const inputs = p.documents.map(d => ({ id: d.id, sha256: d.sha256 }));
  for (const gate of u.requiredGates) {
    p.checks.push({
      id: u.id + gate, unitId: u.id, gate, result: '通过', inputs,
      contextHash: tool.gateFingerprint(p, u, gate),
      basisEventIds: related.map(e => e.id),
      ...(gate === 'G1' && related.length ? { basisEventHash: tool.eventsHash(p, related.map(e => e.id)) } : {}),
      basisImageIds: u.bindings.map(b => b.imageId),
      evidence: '测试夹具显式核查记录，仅验证校验器，不代表真实模型语义验收'
    });
  }
}
test('初始化不覆盖已有项目，合法数据可读回与渲染', t => {
  const { root, p } = fixture(t);
  assert.deepEqual(tool.validate(p, root), []);
  assert.throws(() => tool.init(root, 'OTHER'), /拒绝覆盖/);
  tool.render(p, root, []);
  assert.match(fs.readFileSync(path.join(root, '00-项目管理', '项目总览.md'), 'utf8'), /图片登记/);
  assert.equal(tool.readProject(root).projectId, 'TEST');
});
test('死亡到明确复活之间不能作为活人，倒叙及未来复活不过早生效', t => {
  const { root, p, u } = fixture(t); deathAndRevival(p);
  assert.equal(tool.stateAt(p, 'P1', 'main', 69).life, 'dead');
  u.observations[0].point = 69;
  assert.ok(codes(p, root).includes('STATE_MISMATCH'));
  u.observations[0].point = 70;
  assert.deepEqual(tool.validate(p, root), []);
  u.observations[0].point = 1;
  assert.deepEqual(tool.validate(p, root), []);
});
test('伤后绑正常图被拦截，同段前后图可分别合法绑定', t => {
  const { root, p, u } = fixture(t);
  p.events.push({ id: 'INJ', objectId: 'P1', timeline: 'main', point: 8, until: null, scope: 'EP008', status: 'adopted', from: { injury: 'normal' }, to: { injury: 'injured' }, evidence: { documentId: 'D1', quote: '第8集阿宁左臂受伤。' } });
  u.observations.push({ ...u.observations[0], id: 'O2', point: 8.1, requires: { life: 'alive', injury: 'injured' } });
  u.referenceNeeds.push({ id: 'N2', observationId: 'O2', role: 'appearance', mode: 'image' });
  u.bindings.push({ needId: 'N2', imageId: 'I1', label: '图1' });
  assert.ok(codes(p, root).includes('IMAGE_STATE'));
  p.images.push({ ...p.images[0], id: 'I2', name: '伤后', state: { injury: 'injured' } });
  u.bindings[1] = { needId: 'N2', imageId: 'I2', label: '图2' };
  assert.deepEqual(tool.validate(p, root), []);
});
test('多绑、漏绑、会话图及标签冲突分别报错', t => {
  const { root, p, u } = fixture(t);
  u.bindings = [];
  assert.ok(codes(p, root).includes('MISSING_BINDING'));
  u.bindings = [{ needId: 'unknown', imageId: 'I1', label: '图1' }];
  assert.ok(codes(p, root).includes('EXTRA_BINDING'));
  u.bindings[0].needId = 'N1'; p.images[0].status = 'session-only';
  assert.ok(codes(p, root).includes('UNAVAILABLE_IMAGE'));
  p.images[0].status = 'available'; p.images.push({ ...p.images[0], id: 'I2' });
  u.referenceNeeds.push({ ...u.referenceNeeds[0], id: 'N2' });
  u.bindings.push({ needId: 'N2', imageId: 'I2', label: '图1' });
  assert.ok(codes(p, root).includes('LABEL'));
});
test('图片原地替换、路径越界与垃圾箱引用不能放行', t => {
  const { root, p } = fixture(t);
  fs.appendFileSync(path.join(root, p.images[0].path), 'changed');
  assert.ok(codes(p, root).includes('IMAGE_HASH'));
  p.images[0].path = '../escape.png';
  assert.ok(codes(p, root).includes('PATH'));
  p.images[0].path = '99-垃圾箱/弃用.png';
  assert.ok(codes(p, root).includes('TRASH_ACTIVE'));
  assert.throws(() => tool.inside(root, '../outside'), /越界/);
});
test('推荐设置、过期原文、无证据片段和重复采用会报错', t => {
  const { root, p } = fixture(t);
  p.settings[0].status = 'recommended';
  assert.ok(codes(p, root).includes('UNCONFIRMED'));
  p.events[0].evidence.quote = '不存在的假句';
  assert.ok(codes(p, root).includes('EVIDENCE'));
  p.adoptions.push({ ...p.adoptions[0] });
  assert.ok(codes(p, root).includes('ADOPTION'));
  fs.appendFileSync(path.join(root, p.documents[0].path), '改稿');
  assert.ok(codes(p, root).includes('HASH'));
});
test('交付须有各关证据，状态或设置变更让旧指纹失效', t => {
  const { root, p, u } = fixture(t);
  u.workStatus = '已交付'; u.reviewStatus = '通过';
  assert.ok(codes(p, root).includes('GATE'));
  deliver(p, u);
  assert.deepEqual(tool.validate(p, root), []);
  p.settings[0].value = 30;
  assert.ok(codes(p, root).includes('GATE'));
});
test('依赖循环、前值矛盾、中断批次和开放问题不能伪装通过', t => {
  const { root, p, u } = fixture(t);
  deathAndRevival(p); p.events[1].from.life = 'dead';
  assert.ok(codes(p, root).includes('STATE_FROM'));
  u.dependsOnUnits.push(u.id);
  assert.ok(codes(p, root).includes('CYCLE'));
  p.batches.push({ id: 'B1', status: 'pending', summary: '保存中断' });
  assert.ok(codes(p, root).includes('PENDING_BATCH'));
  p.issues.push({ id: 'X1', scope: u.scope, unitIds: [u.id], status: 'open', summary: '源稿冲突' });
  u.workStatus = '已交付';
  assert.ok(codes(p, root).includes('OPEN_ISSUE'));
});
test('状态失效后不回弹到旧值，其他时间线不污染现实', t => {
  const { p } = fixture(t);
  p.events.push({ ...p.events[0], id: 'TEMP', point: 3, until: 5, from: { injury: 'normal' }, to: { injury: 'injured' } });
  assert.equal(tool.stateAt(p, 'P1', 'main', 5).injury, undefined);
  p.events.push({ ...p.events[0], id: 'DREAM', timeline: 'dream', point: 0, to: { life: 'dead' } });
  assert.equal(tool.stateAt(p, 'P1', 'main', 1).life, 'alive');
});
test('畸形输入安全报告，失败CLI返回非零且不改权威记录', t => {
  const { root, p } = fixture(t);
  assert.ok(tool.validate({ schemaVersion: 3 }, root).length);
  p.settings[0].status = 'recommended';
  const file = path.join(root, '00-项目管理', '项目.json');
  fs.writeFileSync(file, JSON.stringify(p));
  const before = tool.fileHash(file);
  const result = spawnSync(process.execPath, [path.join(rootSkill, '工具', '项目管理.cjs'), 'check', root], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /UNCONFIRMED/);
  assert.equal(tool.fileHash(file), before);
});
test('变更影响沿上游依赖传递，引用链不漏后续', t => {
  const { p, u } = fixture(t);
  p.units.push({ ...u, id: 'U2', dependsOnUnits: ['U1'], documentIds: [] });
  const impact = tool.affected(p, 'I1');
  assert.ok(impact.unitIds.includes('U1'));
  assert.ok(impact.unitIds.includes('U2'));
  const eventImpact = tool.affected(p, 'BASE');
  assert.ok(eventImpact.objectIds.includes('P1'));
});
test('百集显式时间线逐集与重新读取后保持死亡/复活边界', t => {
  const { root, p, u } = fixture(t); deathAndRevival(p);
  const file = path.join(root, '00-项目管理', '项目.json');
  for (let episode = 1; episode <= 100; episode++) {
    u.observations[0].point = episode;
    const expected = episode >= 2 && episode < 70 ? 'dead' : 'alive';
    u.observations[0].requires.life = expected;
    assert.deepEqual(tool.validate(p, root), [], '第' + episode + '集');
    if (episode % 10 === 0) {
      fs.writeFileSync(file, JSON.stringify(p));
      const recovered = tool.readProject(root);
      assert.equal(tool.stateAt(recovered, 'P1', 'main', episode).life, expected);
      assert.deepEqual(tool.validate(recovered, root), []);
    }
  }
});
test('知识库及检索文件跨平台基线完整无篡改', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '基线清单.json'), 'utf8'));
  assert.ok(manifest.files.length >= 60);
  for (const file of manifest.files) {
    assert.ok(!file.relative.includes('\\'), '基线相对路径应使用正斜线：' + file.relative);
    const full = path.join(rootSkill, ...file.relative.split('/'));
    assert.equal(tool.fileHash(full), file.sha256, '知识库文件改变：' + file.relative);
  }
});
test('4.0实际入口和责任步骤直接调用项目/状态/确认/登记/绑定与双模式分流', () => {
  const read = rel => fs.readFileSync(path.join(rootSkill, rel), 'utf8');
  assert.match(read('SKILL.md'), /xingying-fenjing-v4-0/);
  assert.match(read('SKILL.md'), /轻量单场模式/);
  for (const step of ['01-剧本理解', '02-资产清单', '03-分镜', '04-提示词']) assert.match(read(`流程/${step}/流程.md`), /项目.*关卡|项目G0/);
  assert.match(read('流程/02-资产清单/流程.md'), /image-registration/);
  assert.match(read('流程/04-提示词/流程.md'), /binding-gate/);
  assert.match(read('流程/项目交接与恢复.md'), /唯一机器记录/);
  assert.match(read('流程/项目记录契约.md'), /gateFingerprint/);
  assert.match(read('流程/制作设置与强制确认.md'), /实际调用/);
});
test('v3.5分阶段实时关卡：开工过G0-G2、成稿过G3-G5、交付与采用全程不误红', t => {
  const { root, p, u } = fixture(t);
  u.documentIds = []; u.observations = []; u.referenceNeeds = []; u.bindings = [];
  const preInputs = [{ id: 'D1', sha256: p.documents[0].sha256 }];
  for (const gate of ['G0', 'G1', 'G2']) {
    p.checks.push({
      id: 'PRE_' + gate, unitId: u.id, gate, result: '通过', inputs: preInputs,
      contextHash: tool.gateFingerprint(p, u, gate),
      basisEventIds: gate === 'G1' ? ['BASE'] : [],
      ...(gate === 'G1' ? { basisEventHash: tool.eventsHash(p, ['BASE']) } : {}),
      basisImageIds: [], evidence: '开工前真实检查'
    });
  }
  assert.deepEqual(tool.validate(p, root), []);
  u.observations.push({ id: 'O1', shotId: 'S1', objectId: 'P1', timeline: 'main', point: 1, requires: { life: 'alive', injury: 'normal' } });
  u.referenceNeeds.push({ id: 'N1', observationId: 'O1', role: 'appearance', mode: 'image' });
  u.bindings.push({ needId: 'N1', imageId: 'I1', label: '图1' });
  p.checks.push({ id: 'MID_G3', unitId: u.id, gate: 'G3', result: '通过', inputs: preInputs, contextHash: tool.gateFingerprint(p, u, 'G3'), basisEventIds: ['BASE'], basisImageIds: ['I1'], evidence: '绑定检查' });
  u.documentIds.push('OUT');
  const fullInputs = p.documents.map(d => ({ id: d.id, sha256: d.sha256 }));
  for (const gate of ['G4', 'G5']) {
    p.checks.push({ id: 'END_' + gate, unitId: u.id, gate, result: '通过', inputs: fullInputs, contextHash: tool.gateFingerprint(p, u, gate), basisEventIds: ['BASE'], basisImageIds: ['I1'], evidence: '交付检查' });
  }
  u.workStatus = '已交付'; u.reviewStatus = '通过';
  assert.deepEqual(tool.validate(p, root), []);
  u.adoptionStatus = '已采用'; u.next = '推进第2集';
  p.adoptions.push({ scope: 'EP001/SC001', stage: '04B', documentId: 'OUT', source: '用户采纳' });
  assert.deepEqual(tool.validate(p, root), []);
});
test('v3.5真多集演进：后续集数采用与未来死亡不破坏第1集，修改第1集早期事件精准报错', t => {
  const { root, p, u } = fixture(t);
  deliver(p, u);
  u.adoptionStatus = '已采用';
  const ep2Path = path.join(root, '01-剧本', '原始输入', 'ep2.txt');
  fs.writeFileSync(ep2Path, '第2集阿宁死亡。');
  p.documents.push({ id: 'D2', path: '01-剧本/原始输入/ep2.txt', version: 'v1', sha256: tool.fileHash(ep2Path), kind: 'script', dependsOn: [] });
  p.adoptions.push({ scope: 'EP002/SC001', stage: '01', documentId: 'D2', source: '用户采用第2集' });
  p.events.push({ id: 'DEATH2', objectId: 'P1', timeline: 'main', point: 2, until: null, scope: 'EP002', status: 'adopted', from: { life: 'alive' }, to: { life: 'dead' }, evidence: { documentId: 'D2', quote: '第2集阿宁死亡。' } });
  assert.deepEqual(tool.validate(p, root), []);
  const affFuture = tool.affected(p, 'DEATH2');
  assert.equal(affFuture.found, true);
  assert.deepEqual(affFuture.preciseUnitIds, []);
  assert.equal(tool.affected(p, 'NOT_EXIST').found, false);
  p.events[0].to.injury = 'injured';
  assert.ok(codes(p, root).includes('GATE'));
});
test('v3.5防空图状态绕过、防未看图静默放行，非视觉音色职责不受限制', t => {
  const { root, p, u } = fixture(t);
  p.images[0].state = {};
  assert.ok(codes(p, root).includes('IMAGE_STATE_MISSING'));
  p.images[0].state = { life: 'alive' };
  assert.ok(codes(p, root).includes('IMAGE_STATE_MISSING'));
  p.images[0].state = { injury: 'normal' };
  p.images[0].viewed = false;
  assert.ok(codes(p, root).includes('UNVIEWED_IMAGE'));
  p.images[0].unviewedAck = '当前宿主无读图能力，按用户指认登记';
  assert.deepEqual(tool.validate(p, root), []);
  p.images.push({ ...p.images[0], id: 'AUD1', name: '阿宁音色', state: {}, roles: ['timbre'], viewed: false, unviewedAck: '' });
  u.referenceNeeds.push({ id: 'N_AUD', observationId: 'O1', role: 'timbre', mode: 'image' });
  u.bindings.push({ needId: 'N_AUD', imageId: 'AUD1', label: '音频1' });
  assert.deepEqual(tool.validate(p, root), []);
});
test('v3.5用户弹卡授权后允许用正常图+文字补状态（overrideDims+overrideAuth），无授权仍严格拦截', t => {
  const { root, p, u } = fixture(t);
  p.events.push({ id: 'INJ8', objectId: 'P1', timeline: 'main', point: 8, until: null, scope: 'EP008', status: 'adopted', from: { injury: 'normal' }, to: { injury: 'injured' }, evidence: { documentId: 'D1', quote: '第8集阿宁左臂受伤。' } });
  u.observations[0].point = 8;
  u.observations[0].requires = { life: 'alive', injury: 'injured' };
  // 无授权直接绑正常图 -> 必须拦
  assert.ok(codes(p, root).includes('IMAGE_STATE'));
  // 只写 overrideDims 不写 overrideAuth -> 必须报 OVERRIDE_AUTH
  u.bindings[0].overrideDims = ['injury'];
  assert.ok(codes(p, root).includes('OVERRIDE_AUTH'));
  // 补齐用户明确授权 overrideAuth -> 放行
  u.bindings[0].overrideAuth = '用户弹卡确认：不做伤后图，沿用正常图参考脸与服装，伤势由正文描写';
  assert.deepEqual(tool.validate(p, root), []);
  // 但未授权的其他视觉维度（如 costume）变化仍会被严格拦住
  p.events.push({ id: 'COS8', objectId: 'P1', timeline: 'main', point: 8, until: null, scope: 'EP008', status: 'adopted', from: {}, to: { costume: 'armor' }, evidence: { documentId: 'D1', quote: '第8集阿宁左臂受伤。' } });
  u.observations[0].requires.costume = 'armor';
  assert.ok(codes(p, root).includes('IMAGE_STATE_MISSING'));
});
test('v3.5支持CRLF+BOM原稿引文、层级设置作用域、冲突检测与until无缝衔接', t => {
  const { root, p } = fixture(t);
  const crlfFile = path.join(root, '01-剧本', '原始输入', '原稿.txt');
  fs.writeFileSync(crlfFile, '\uFEFF起初阿宁活着，身体无伤。\r\n第2行继续。\r\n第3集短暂受伤。\r\n第5集恢复正常。\r\n');
  p.documents[0].sha256 = tool.fileHash(crlfFile);
  p.documents[1].dependsOn[0].sha256 = p.documents[0].sha256;
  p.events[0].evidence.quote = '起初阿宁活着，身体无伤。\n第2行继续。';
  p.settings[0].scopes = ['EP001'];
  p.events.push({ id: 'TMP', objectId: 'P1', timeline: 'main', point: 3, until: 5, scope: 'EP003', status: 'adopted', from: { injury: 'normal' }, to: { injury: 'injured' }, evidence: { documentId: 'D1', quote: '第3集短暂受伤。' } });
  p.events.push({ id: 'REC', objectId: 'P1', timeline: 'main', point: 5, until: null, scope: 'EP005', status: 'adopted', from: { injury: 'injured' }, to: { injury: 'normal' }, evidence: { documentId: 'D1', quote: '第5集恢复正常。' } });
  assert.deepEqual(tool.validate(p, root), []);
  p.settings.push({ id: 'SET_DUP', key: 'segmentSeconds', value: 30, status: 'confirmed', source: '冲突值', scopes: ['EP001'] });
  assert.ok(codes(p, root).includes('SETTING_CONFLICT'));
});
test('v3.5写入CLI全链路：无需手改JSON完成建项、分阶段过关、交付采用、安全垃圾箱与乐观锁', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xingying-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cli = path.join(rootSkill, '工具', '项目管理.cjs');
  const run = (args, input) => {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
    assert.equal(r.status, 0, `${args.join(' ')} 失败：${r.stdout}\n${r.stderr}`);
    return JSON.parse(r.stdout);
  };
  const runFail = (args, input) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
  assert.equal(run(['init', root, 'CLI_TEST']).ok, true);
  fs.writeFileSync(path.join(root, '01-剧本/原始输入/s1.txt'), '阿宁在客栈，完好无伤。\r\n');
  fs.writeFileSync(path.join(root, '03-资产/ok.png'), Buffer.from('89504e4701', 'hex'));
  fs.writeFileSync(path.join(root, '03-资产/old.png'), Buffer.from('89504e4702', 'hex'));
  run(['add-doc', root, '--id', 'D1', '--path', '01-剧本/原始输入/s1.txt', '--kind', 'script', '--version', 'v1']);
  run(['adopt', root, '--scope', 'EP001/SC001', '--stage', '01', '--doc', 'D1', '--source', '用户采用']);
  run(['add-object', root, '--id', 'P1', '--name', '阿宁', '--type', 'character']);
  run(['add-event', root, '--json', '-'], JSON.stringify({ id: 'E1', objectId: 'P1', timeline: 'main', point: 1, scope: 'EP001', to: { life: 'alive', injury: 'normal' }, evidence: { documentId: 'D1', quote: '阿宁在客栈，完好无伤。' } }));
  run(['register-image', root, '--json', '-'], JSON.stringify({ id: 'I1', objectId: 'P1', name: '正图', path: '03-资产/ok.png', sourceRef: 'u1', viewed: true, state: { injury: 'normal' }, roles: ['appearance'], source: '指认' }));
  run(['register-image', root, '--json', '-'], JSON.stringify({ id: 'I_OLD', objectId: 'P1', name: '旧图', path: '03-资产/old.png', sourceRef: 'u0', viewed: true, state: { injury: 'normal' }, roles: ['appearance'], source: '旧图' }));
  const setOut = run(['set-setting', root, '--id', 'S1', '--key', 'segmentSeconds', '--value', '15', '--status', 'confirmed', '--scopes', 'EP001', '--source', '答15秒']);
  assert.notEqual(runFail(['set-setting', root, '--expected-revision', '0', '--id', 'S2', '--key', 'aspect', '--value', '16:9', '--status', 'confirmed', '--scopes', '*', '--source', '旧版本冲突']).status, 0);
  assert.ok(setOut.revision >= 7);
  run(['upsert-unit', root, '--set-current', '--json', '-'], JSON.stringify({ id: 'U1', scope: 'EP001/SC001', stage: '04V', sourceDocumentIds: ['D1'], requiredSettings: ['S1'] }));
  run(['record-check', root, '--unit', 'U1', '--gate', 'G0', '--result', '通过', '--evidence', '恢复']);
  run(['record-check', root, '--unit', 'U1', '--gate', 'G1', '--result', '通过', '--events', 'E1', '--evidence', '核原稿与E1']);
  run(['record-check', root, '--unit', 'U1', '--gate', 'G2', '--result', '通过', '--evidence', '核15秒']);
  assert.notEqual(runFail(['mark-unit', root, '--unit', 'U1', '--work', '已交付', '--review', '通过']).status, 0);
  run(['upsert-unit', root, '--json', '-'], JSON.stringify({ id: 'U1', observations: [{ id: 'O1', shotId: 'S1', objectId: 'P1', timeline: 'main', point: 1, requires: { life: 'alive', injury: 'normal' } }], referenceNeeds: [{ id: 'N1', observationId: 'O1', role: 'appearance', mode: 'image' }], bindings: [{ needId: 'N1', imageId: 'I1', label: '图1' }] }));
  run(['record-check', root, '--unit', 'U1', '--gate', 'G3', '--result', '通过', '--evidence', '核图1']);
  run(['begin-batch', root, '--id', 'B1', '--summary', '交付U1']);
  fs.writeFileSync(path.join(root, '05-分段提示词/B01.txt'), '分镜S1');
  run(['add-doc', root, '--in-batch', '--id', 'OUT1', '--path', '05-分段提示词/B01.txt', '--kind', 'prompt', '--version', 'v1', '--depends', 'D1']);
  run(['upsert-unit', root, '--in-batch', '--json', '-'], JSON.stringify({ id: 'U1', documentIds: ['OUT1'] }));
  run(['record-check', root, '--in-batch', '--unit', 'U1', '--gate', 'G4', '--result', '通过', '--evidence', '正文通过']);
  run(['record-check', root, '--in-batch', '--unit', 'U1', '--gate', 'G5', '--result', '通过', '--evidence', '落盘读回通过']);
  assert.equal(run(['mark-unit', root, '--unit', 'U1', '--work', '已交付', '--review', '通过', '--commit-batch', 'B1']).ok, true);
  assert.equal(run(['mark-unit', root, '--unit', 'U1', '--adoption', '已采用']).ok, true);
  assert.notEqual(runFail(['trash', root, '--id', 'T1', '--path', '03-资产/ok.png', '--category', '图片', '--reason', '测试拦活跃图', '--restore', '原位']).status, 0);
  assert.equal(run(['trash', root, '--id', 'T2', '--path', '03-资产/old.png', '--category', '图片', '--subpath', 'P1', '--reason', '弃用旧图', '--restore', '移回03-资产/old.png']).ok, true);
  assert.equal(run(['state', root, 'P1', 'main', '1']).state.life, 'alive');
  assert.equal(run(['check', root]).ok, true);
});
test('v3.5声纹锁图voice/timbre互通与forObjectId绑定、state空参拦截及set-coverage原子更新', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xingying-voice-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cli = path.join(rootSkill, '工具', '项目管理.cjs');
  const run = (args, input) => {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
    assert.equal(r.status, 0, `${args.join(' ')} 失败：${r.stdout}\n${r.stderr}`);
    return JSON.parse(r.stdout);
  };
  const runFail = (args, input) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
  run(['init', root, 'VOICE_TEST']);
  fs.writeFileSync(path.join(root, '01-剧本/原始输入/ep1.txt'), '阿宁站在廊下说话。\n');
  fs.writeFileSync(path.join(root, '03-资产/voice_card.png'), Buffer.from('89504e4709', 'hex'));
  run(['add-doc', root, '--id', 'D1', '--path', '01-剧本/原始输入/ep1.txt', '--kind', 'script', '--version', 'v1']);
  run(['add-object', root, '--id', 'P1', '--name', '阿宁', '--type', 'character']);
  run(['add-object', root, '--id', 'P2', '--name', '周宁', '--type', 'character']);
  run(['add-object', root, '--id', 'V1', '--name', '阿宁声纹卡', '--type', 'reference']);
  run(['add-event', root, '--json', '-'], JSON.stringify({ id: 'E0', objectId: 'P1', timeline: 'main', point: 1, scope: 'EP001', to: { life: 'alive' }, evidence: { documentId: 'D1', quote: '阿宁站在廊下说话。' } }));
  run(['add-event', root, '--json', '-'], JSON.stringify({ id: 'E1', objectId: 'P1', timeline: 'main', point: 10, scope: 'EP001', from: { life: 'alive' }, to: { life: 'dead' }, evidence: { documentId: 'D1', quote: '阿宁站在廊下说话。' } }));
  // Empty string point must fail instead of silently querying point = 0
  assert.notEqual(runFail(['state', root, 'P1', 'main', '']).status, 0);
  assert.notEqual(runFail(['state', root, 'P1', 'main', '   ']).status, 0);
  assert.notEqual(runFail(['set-coverage', root, '--expected-revision', '', '--received', 'EP001']).status, 0);
  assert.equal(run(['set-coverage', root, '--received', 'EP001,EP002', '--unknown', 'false', '--note', '前两集收齐']).ok, true);
  assert.deepEqual(tool.readProject(root).coverage, { received: ['EP001', 'EP002'], unknown: false, note: '前两集收齐' });
  // Voiceprint card registered under V1 with forObjectId='P1' and roles=['timbre'] binds cleanly to P1 need role='voice'
  run(['register-image', root, '--json', '-'], JSON.stringify({ id: 'IMG_VP', objectId: 'V1', forObjectId: 'P1', name: '阿宁-声纹锁图', path: '03-资产/voice_card.png', sourceRef: 'gen1', viewed: false, state: {}, roles: ['timbre'], source: '02声纹锁图' }));
  run(['upsert-unit', root, '--json', '-'], JSON.stringify({
    id: 'UV1', scope: 'EP001/SC001', stage: '04V', sourceDocumentIds: ['D1'],
    observations: [{ id: 'O1', shotId: 'S1', objectId: 'P1', timeline: 'main', point: 1, requires: { life: 'alive' } }],
    referenceNeeds: [{ id: 'NV1', observationId: 'O1', role: 'voice', mode: 'image' }],
    bindings: [{ needId: 'NV1', imageId: 'IMG_VP', label: '阿宁-声纹锁图' }]
  }));
  assert.equal(run(['check', root]).ok, true);
  const overview = fs.readFileSync(path.join(root, '00-项目管理/项目总览.md'), 'utf8');
  assert.match(overview, /IMG_VP 阿宁-声纹锁图 → V1（服务角色：P1）/);
  // Misbinding P1's voiceprint card to P2 must still be rejected with BINDING_ROLE
  run(['add-event', root, '--json', '-'], JSON.stringify({ id: 'E2', objectId: 'P2', timeline: 'main', point: 1, scope: 'EP001', to: { life: 'alive' }, evidence: { documentId: 'D1', quote: '阿宁站在廊下说话。' } }));
  const badProj = tool.readProject(root);
  badProj.units[0].observations[0].objectId = 'P2';
  assert.ok(codes(badProj, root).includes('BINDING_ROLE'));
});
