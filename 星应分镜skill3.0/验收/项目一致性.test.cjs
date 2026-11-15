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
  p.images.push({ id: 'I1', objectId: 'P1', name: '阿宁正常', path: '03-资产/正常.png', sha256: tool.fileHash(imagePath), sourceRef: 'test-upload-1', version: 'v1', status: 'available', viewed: false, state: { injury: 'normal' }, roles: ['appearance'], source: '测试用户指认' });
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
  const related = p.events.filter(e => e.status === 'adopted' && u.observations.some(o => o.objectId === e.objectId && o.timeline === e.timeline && e.point <= o.point));
  const inputs = p.documents.map(d => ({ id: d.id, sha256: d.sha256 }));
  const contextHash = tool.fingerprint(p, u);
  for (const gate of u.requiredGates) p.checks.push({ id: u.id + gate, unitId: u.id, gate, result: '通过', inputs, contextHash, basisEventIds: related.map(e => e.id), basisImageIds: u.bindings.map(b => b.imageId), evidence: '测试夹具显式核查记录，仅验证校验器，不代表真实模型语义验收' });
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
test('基线源目录保持原样，知识库及检索文件复制完整', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '基线清单.json'), 'utf8'));
  for (const file of manifest.files) {
    const source = path.join(manifest.source, file.relative);
    if (fs.existsSync(source)) assert.equal(tool.fileHash(source), file.sha256, '源文件被改变：' + file.relative);
    if (file.relative.startsWith('知识库' + path.sep)) assert.equal(tool.fileHash(path.join(rootSkill, file.relative)), file.sha256, '知识库复制改变：' + file.relative);
  }
});
test('3.0实际入口和责任步骤直接调用项目/状态/确认/登记/绑定', () => {
  const read = rel => fs.readFileSync(path.join(rootSkill, rel), 'utf8');
  assert.match(read('SKILL.md'), /xingying-fenjing-v3-0/);
  for (const step of ['01-剧本理解', '02-资产清单', '03-分镜', '04-提示词']) assert.match(read(`流程/${step}/流程.md`), /项目.*关卡|项目G0/);
  assert.match(read('流程/02-资产清单/流程.md'), /image-registration/);
  assert.match(read('流程/04-提示词/流程.md'), /binding-gate/);
  assert.match(read('流程/项目交接与恢复.md'), /唯一机器记录/);
  assert.match(read('流程/制作设置与强制确认.md'), /实际调用/);
});
