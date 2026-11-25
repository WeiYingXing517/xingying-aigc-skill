'use strict';
const fs = require('node:fs');
const path = require('node:path');
const core = require('./项目管理.cjs');

const array = v => (Array.isArray(v) ? v : []);
const text = v => typeof v === 'string' && v.trim().length > 0;
const clone = obj => JSON.parse(JSON.stringify(obj));

function writeAtomic(file, content) {
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}`;
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw err;
  }
}

function saveProject(root, project, opts = {}) {
  const current = core.readProject(root);
  const expected = opts.expectedRevision ?? opts['expected-revision'];
  if (expected !== undefined && expected !== null) {
    if (expected === true || !text(String(expected)) || !Number.isInteger(Number(expected)) || current.revision !== Number(expected)) {
      throw new Error(`revision冲突：期望${expected}，当前${current.revision}`);
    }
  }
  project.revision = current.revision + 1;
  writeAtomic(core.recordPath(root), JSON.stringify(project, null, 2) + '\n');
  const errors = core.validate(project, root);
  if (opts.autoRender !== false) core.render(project, root, errors);
  return { project, errors };
}

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(token);
    }
  }
  return { flags, rest };
}

function readJsonPayload(flags) {
  if (flags['json-file']) return JSON.parse(fs.readFileSync(flags['json-file'], 'utf8').replace(/^\uFEFF/, ''));
  if (flags.json === '-') return JSON.parse(fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
  if (typeof flags.json === 'string') return JSON.parse(flags.json);
  return null;
}

function listFlag(value) {
  if (Array.isArray(value)) return value.filter(text);
  if (!text(value)) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function assertCleanFor(errors, codes, idPrefix) {
  const hits = errors.filter(e => codes.includes(e.code) && (!idPrefix || e.id === idPrefix || String(e.id).startsWith(idPrefix + '/')));
  if (hits.length) throw new Error(hits.map(h => `${h.code}(${h.id}): ${h.message}`).join('；'));
}

function upsertById(list, item) {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
}

function addDoc(root, opts) {
  const p = clone(core.readProject(root));
  const full = core.inside(root, opts.path);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error('文档文件不存在：' + opts.path);
  const byId = new Map(array(p.documents).map(d => [d.id, d]));
  const depIds = listFlag(opts.depends);
  const dependsOn = depIds.map(id => {
    const dep = byId.get(id);
    if (!dep) throw new Error('依赖文档不存在：' + id);
    return { id: dep.id, sha256: dep.sha256 };
  });
  const doc = { id: opts.id, path: opts.path, version: opts.version || 'v1', sha256: core.fileHash(full), kind: opts.kind || 'script', dependsOn };
  upsertById(p.documents, doc);
  assertCleanFor(core.validate(p, root), ['ID', 'PATH', 'DOCUMENT', 'HASH', 'DEPENDENCY', 'CYCLE'], doc.id);
  return saveProject(root, p, opts);
}

function adopt(root, opts) {
  const p = clone(core.readProject(root));
  if (!text(opts.scope) || !text(opts.stage) || !text(opts.doc) || !text(opts.source)) throw new Error('adopt缺少scope/stage/doc/source');
  p.adoptions = array(p.adoptions).filter(a => !(a.scope === opts.scope && a.stage === opts.stage));
  p.adoptions.push({ scope: opts.scope, stage: opts.stage, documentId: opts.doc, source: opts.source });
  assertCleanFor(core.validate(p, root), ['ADOPTION', 'TRASH_ACTIVE']);
  return saveProject(root, p, opts);
}

function addObject(root, opts) {
  const p = clone(core.readProject(root));
  const obj = { id: opts.id, name: opts.name, type: opts.type, aliases: listFlag(opts.aliases) };
  upsertById(p.objects, obj);
  assertCleanFor(core.validate(p, root), ['ID', 'OBJECT'], obj.id);
  return saveProject(root, p, opts);
}

function addEvent(root, eventObj, opts = {}) {
  const p = clone(core.readProject(root));
  const ev = { until: null, status: 'adopted', from: {}, ...eventObj };
  upsertById(p.events, ev);
  assertCleanFor(core.validate(p, root), ['ID', 'EVENT', 'EVIDENCE', 'STATE_COLLISION', 'STATE_FROM'], ev.id);
  return saveProject(root, p, opts);
}

function registerImage(root, imageObj, opts = {}) {
  const p = clone(core.readProject(root));
  const img = { version: 'v1', status: 'available', viewed: false, state: {}, roles: [], ...imageObj };
  if (img.status === 'available') {
    const full = core.inside(root, img.path);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error('图片文件不存在：' + img.path);
    img.sha256 = core.fileHash(full);
  }
  upsertById(p.images, img);
  assertCleanFor(core.validate(p, root), ['ID', 'PATH', 'IMAGE', 'IMAGE_HASH', 'TRASH_ACTIVE'], img.id);
  return saveProject(root, p, opts);
}

function setSetting(root, opts) {
  const p = clone(core.readProject(root));
  let val = opts.value;
  if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
  const setting = { id: opts.id, key: opts.key, value: val, status: opts.status || 'confirmed', source: opts.source, scopes: listFlag(opts.scopes) };
  upsertById(p.settings, setting);
  assertCleanFor(core.validate(p, root), ['ID', 'SETTING', 'SETTING_CONFLICT'], setting.id);
  return saveProject(root, p, opts);
}

function upsertUnit(root, unitObj, opts = {}) {
  const p = clone(core.readProject(root));
  const existing = array(p.units).find(u => u.id === unitObj.id) || {};
  const unit = {
    parentId: '', workStatus: '进行中', adoptionStatus: '草稿', reviewStatus: '未检查', next: '', blocker: '',
    documentIds: [], sourceDocumentIds: [], dependsOnUnits: [], requiredSettings: [],
    requiredGates: ['G0', 'G1', 'G2', 'G3', 'G4', 'G5'], observations: [], referenceNeeds: [], bindings: [],
    ...existing, ...unitObj
  };
  upsertById(p.units, unit);
  if (opts['set-current']) p.currentUnit = unit.id;
  assertCleanFor(core.validate(p, root), ['ID', 'SCHEMA', 'UNIT', 'UNIT_PARENT', 'DOCUMENT_REF', 'UNIT_DEPENDENCY', 'CYCLE'], unit.id);
  return saveProject(root, p, opts);
}

function recordCheck(root, opts) {
  const p = clone(core.readProject(root));
  const unit = array(p.units).find(u => u.id === opts.unit);
  if (!unit) throw new Error('工作单元不存在：' + opts.unit);
  if (!/^G[0-5]$/.test(opts.gate || '')) throw new Error('关卡必须为G0—G5');
  const relatedEvents = core.relevantEventsForUnit(p, unit);
  const explicitEvents = listFlag(opts.events);
  const needEvents = ['G1', 'G3', 'G4', 'G5'].includes(opts.gate);
  const basisEventIds = needEvents
    ? [...new Set([...relatedEvents.map(e => e.id), ...explicitEvents])].sort()
    : [];
  const evDocs = array(p.events).filter(e => basisEventIds.includes(e.id)).map(e => e.evidence?.documentId).filter(Boolean);
  const baseDocs = (opts.gate === 'G0' || opts.gate === 'G2')
    ? array(unit.sourceDocumentIds)
    : (opts.gate === 'G1' || opts.gate === 'G3')
      ? [...array(unit.sourceDocumentIds), ...evDocs]
      : [...array(unit.documentIds), ...array(unit.sourceDocumentIds), ...evDocs];
  const docIds = core.documentClosure(p, baseDocs);
  const docMap = new Map(array(p.documents).map(d => [d.id, d]));
  const inputs = docIds.map(id => {
    const d = docMap.get(id);
    if (!d) throw new Error('输入文档缺失：' + id);
    return { id: d.id, sha256: d.sha256 };
  });
  const basisImageIds = ['G3', 'G4', 'G5'].includes(opts.gate)
    ? [...new Set(array(unit.bindings).map(b => b.imageId))].sort()
    : [];
  const check = {
    id: opts.id || `${unit.id}-${opts.gate}-${Date.now()}`,
    unitId: unit.id,
    gate: opts.gate,
    result: opts.result || '通过',
    inputs,
    contextHash: core.gateFingerprint(p, unit, opts.gate),
    basisEventIds,
    ...(needEvents && basisEventIds.length ? { basisEventHash: core.eventsHash(p, basisEventIds) } : {}),
    basisImageIds,
    evidence: opts.evidence
  };
  p.checks.push(check);
  assertCleanFor(core.validate(p, root), ['ID', 'CHECK'], check.id);
  return saveProject(root, p, opts);
}

function markUnit(root, opts) {
  const p = clone(core.readProject(root));
  const unit = array(p.units).find(u => u.id === opts.unit);
  if (!unit) throw new Error('工作单元不存在：' + opts.unit);
  if (text(opts.work)) unit.workStatus = opts.work;
  if (text(opts.review)) unit.reviewStatus = opts.review;
  if (text(opts.adoption)) unit.adoptionStatus = opts.adoption;
  if (opts.next !== undefined) unit.next = String(opts.next);
  if (opts.blocker !== undefined) unit.blocker = String(opts.blocker);
  if (opts['set-current']) p.currentUnit = unit.id;
  if (text(opts['commit-batch'])) {
    const batch = array(p.batches).find(b => b.id === opts['commit-batch']);
    if (!batch) throw new Error('批次不存在：' + opts['commit-batch']);
    batch.status = 'committed';
  }
  if (unit.workStatus === '已交付' || unit.reviewStatus === '通过') {
    const errs = core.validate(p, root).filter(e => !(opts['in-batch'] && e.code === 'PENDING_BATCH'));
    if (errs.length) throw new Error('未通过交付校验，拒绝标记：' + errs.map(e => `${e.code}(${e.id}):${e.message}`).join('；'));
  }
  return saveProject(root, p, opts);
}

function addIssue(root, opts) {
  const p = clone(core.readProject(root));
  const issue = { id: opts.id, scope: opts.scope, unitIds: listFlag(opts.units), status: 'open', summary: opts.summary };
  upsertById(p.issues, issue);
  assertCleanFor(core.validate(p, root), ['ID', 'ISSUE'], issue.id);
  return saveProject(root, p, opts);
}

function resolveIssue(root, opts) {
  const p = clone(core.readProject(root));
  const issue = array(p.issues).find(i => i.id === opts.id);
  if (!issue) throw new Error('问题不存在：' + opts.id);
  issue.status = 'resolved';
  if (text(opts.summary)) issue.summary = opts.summary;
  return saveProject(root, p, opts);
}

function beginBatch(root, opts) {
  const p = clone(core.readProject(root));
  upsertById(p.batches, { id: opts.id, status: 'pending', summary: opts.summary });
  assertCleanFor(core.validate(p, root), ['ID', 'BATCH'], opts.id);
  return saveProject(root, p, opts);
}

function commitBatch(root, opts) {
  const p = clone(core.readProject(root));
  const batch = array(p.batches).find(b => b.id === opts.id);
  if (!batch) throw new Error('批次不存在：' + opts.id);
  batch.status = 'committed';
  if (text(opts.summary)) batch.summary = opts.summary;
  return saveProject(root, p, opts);
}

function trashFile(root, opts) {
  const p = clone(core.readProject(root));
  const rel = opts.path;
  if (core.inTrash(rel)) throw new Error('文件已在垃圾箱：' + rel);
  const src = core.inside(root, rel);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) throw new Error('待归档文件不存在：' + rel);
  if (!['图片', '弃用稿', '其他'].includes(opts.category)) throw new Error('垃圾箱类别须为 图片/弃用稿/其他');
  const activeUnits = array(p.units).filter(u => u.adoptionStatus !== '已替代');
  const matchingDocs = array(p.documents).filter(d => d.path === rel);
  for (const d of matchingDocs) {
    if (array(p.adoptions).some(a => a.documentId === d.id)) throw new Error('拒绝移入垃圾箱：文档正被采用路由引用：' + d.id);
    if (activeUnits.some(u => [...array(u.sourceDocumentIds), ...array(u.documentIds)].includes(d.id))) throw new Error('拒绝移入垃圾箱：文档正被活跃工作单元引用：' + d.id);
  }
  const matchingImgs = array(p.images).filter(i => i.path === rel && i.status === 'available');
  for (const img of matchingImgs) {
    if (activeUnits.some(u => array(u.bindings).some(b => b.imageId === img.id))) throw new Error('拒绝移入垃圾箱：图片正被活跃单元绑定：' + img.id);
  }
  const sub = text(opts.subpath) ? opts.subpath.replace(/^\/+|\/+$/g, '') : '';
  const base = path.basename(rel);
  const parts = ['99-垃圾箱', opts.category, ...(sub ? [sub] : []), base];
  let destRel = parts.join('/');
  let destFull = core.inside(root, destRel);
  if (fs.existsSync(destFull)) {
    destRel = ['99-垃圾箱', opts.category, ...(sub ? [sub] : []), `${opts.id || Date.now()}-${base}`].join('/');
    destFull = core.inside(root, destRel);
  }
  fs.mkdirSync(path.dirname(destFull), { recursive: true });
  fs.renameSync(src, destFull);
  for (const img of matchingImgs) { img.status = 'retired'; img.path = destRel; }
  for (const d of matchingDocs) { d.path = destRel; }
  const entry = {
    id: opts.id || `TRASH-${Date.now()}`,
    originalPath: rel,
    path: destRel,
    reason: opts.reason,
    replacement: opts.replacement || '',
    restore: opts.restore
  };
  p.trash.push(entry);
  try {
    assertCleanFor(core.validate(p, root), ['ID', 'TRASH', 'TRASH_ACTIVE', 'PATH'], entry.id);
    return saveProject(root, p, opts);
  } catch (err) {
    fs.renameSync(destFull, src);
    throw err;
  }
}

function setCoverage(root, opts) {
  const p = clone(core.readProject(root));
  const cur = p.coverage && typeof p.coverage === 'object' ? p.coverage : { received: [], unknown: true };
  const received = opts.received !== undefined ? listFlag(opts.received) : array(cur.received);
  let unknown = cur.unknown;
  if (opts.unknown !== undefined) {
    if (typeof opts.unknown === 'boolean') unknown = opts.unknown;
    else if (String(opts.unknown).toLowerCase() === 'true') unknown = true;
    else if (String(opts.unknown).toLowerCase() === 'false') unknown = false;
    else throw new Error('unknown须为true或false');
  }
  p.coverage = {
    received,
    unknown: Boolean(unknown),
    ...(text(opts.note) ? { note: String(opts.note).trim() } : (text(cur.note) ? { note: cur.note } : {}))
  };
  return saveProject(root, p, opts);
}

const WRITE_COMMANDS = new Set([
  'add-doc', 'adopt', 'add-object', 'add-event', 'register-image', 'set-setting', 'set-coverage',
  'upsert-unit', 'record-check', 'mark-unit', 'add-issue', 'resolve-issue',
  'begin-batch', 'commit-batch', 'trash'
]);

function dispatch(command, directory, restArgs) {
  const root = path.resolve(directory);
  const { flags } = parseFlags(restArgs);
  const payload = readJsonPayload(flags);
  let res;
  if (command === 'add-doc') res = addDoc(root, { ...payload, ...flags });
  else if (command === 'adopt') res = adopt(root, { ...payload, ...flags });
  else if (command === 'add-object') res = addObject(root, { ...payload, ...flags });
  else if (command === 'add-event') res = addEvent(root, payload || {}, flags);
  else if (command === 'register-image') res = registerImage(root, payload || {}, flags);
  else if (command === 'set-setting') res = setSetting(root, { ...payload, ...flags });
  else if (command === 'set-coverage') res = setCoverage(root, { ...payload, ...flags });
  else if (command === 'upsert-unit') res = upsertUnit(root, payload || {}, flags);
  else if (command === 'record-check') res = recordCheck(root, { ...payload, ...flags });
  else if (command === 'mark-unit') res = markUnit(root, { ...payload, ...flags });
  else if (command === 'add-issue') res = addIssue(root, { ...payload, ...flags });
  else if (command === 'resolve-issue') res = resolveIssue(root, { ...payload, ...flags });
  else if (command === 'begin-batch') res = beginBatch(root, { ...payload, ...flags });
  else if (command === 'commit-batch') res = commitBatch(root, { ...payload, ...flags });
  else if (command === 'trash') res = trashFile(root, { ...payload, ...flags });
  else throw new Error('未知写入命令：' + command);
  const effectiveErrors = (command === 'begin-batch' || flags['in-batch'])
    ? res.errors.filter(e => e.code !== 'PENDING_BATCH')
    : res.errors;
  return { projectId: res.project.projectId, revision: res.project.revision, command, ok: effectiveErrors.length === 0, errors: res.errors };
}

module.exports = {
  WRITE_COMMANDS, writeAtomic, saveProject, parseFlags,
  addDoc, adopt, addObject, addEvent, registerImage, setSetting, setCoverage,
  upsertUnit, recordCheck, markUnit, addIssue, resolveIssue,
  beginBatch, commitBatch, trashFile, dispatch
};
