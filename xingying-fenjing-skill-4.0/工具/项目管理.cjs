'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const array = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' && value.trim().length > 0;
const normalizeText = value => String(value ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const recordPath = root => path.join(root, '00-项目管理', '项目.json');
const tables = ['documents', 'adoptions', 'objects', 'events', 'images', 'settings', 'units', 'checks', 'issues', 'batches', 'trash'];
const NON_VISUAL_ROLES = new Set(['timbre', 'audio', 'voice', 'sfx', 'music']);
const VOICE_ROLES = new Set(['voice', 'timbre']);
const roleMatches = (imgRoles, needRole) => array(imgRoles).includes(needRole) || (VOICE_ROLES.has(needRole) && array(imgRoles).some(r => VOICE_ROLES.has(r)));
const NON_VISUAL_STATE_KEYS = new Set(['life', 'presence', 'knowledge']);
const UPSTREAM_STAGES = {
  '01': new Set(),
  '02': new Set(['01']),
  '03': new Set(['01', '02']),
  '04V': new Set(['01', '02', '03']),
  '04A': new Set(['01', '02', '03']), // 向下兼容旧 3.0 项目数据；新项目统一使用 04V
  '04B': new Set(['01', '02', '03']), // 向下兼容旧 3.0 项目数据；新项目统一使用 04V
  '04I': new Set(['01', '02', '03'])
};
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) if (value[key] !== undefined) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}
const canonicalHash = value => hash(JSON.stringify(canonicalize(value)));
function scopeMatches(settingScope, targetScope) {
  if (!text(settingScope) || !text(targetScope)) return false;
  if (settingScope === '*' || settingScope === targetScope) return true;
  return targetScope.startsWith(settingScope.replace(/\/+$/, '') + '/');
}
function blank(projectId) {
  return { schemaVersion: 3, projectId, revision: 0, currentUnit: '', coverage: { received: [], unknown: true }, ...Object.fromEntries(tables.map(key => [key, []])) };
}
function inside(root, relative) {
  if (!text(relative) || path.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.includes('\\')) throw new Error('路径须用项目内相对路径和正斜线');
  const base = path.resolve(root);
  const full = path.resolve(base, relative);
  const rel = path.relative(base, full);
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('路径越界');
  let probe = full;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) throw new Error('无可定位父目录');
    probe = parent;
  }
  const realRel = path.relative(fs.realpathSync(base), fs.realpathSync(probe));
  if (realRel === '..' || realRel.startsWith('..' + path.sep) || path.isAbsolute(realRel)) throw new Error('符号链接越界');
  return full;
}
const inTrash = value => typeof value === 'string' && value.split(/[\\/]/)[0] === '99-垃圾箱';
function stateAt(project, objectId, timeline, point) {
  const result = {};
  const latest = new Map();
  const events = array(project.events)
    .filter(e => e.status === 'adopted' && e.objectId === objectId && e.timeline === timeline && Number.isFinite(e.point) && e.point <= point)
    .sort((a, b) => a.point - b.point || String(a.id).localeCompare(String(b.id)));
  for (const event of events) for (const [key, value] of Object.entries(event.to || {})) latest.set(key, { value, event });
  for (const [key, { value, event }] of latest) {
    if (event.until == null || point < event.until) result[key] = value;
  }
  return result;
}
function stateExpiringAt(project, objectId, timeline, point) {
  const expiring = {};
  const latest = new Map();
  const events = array(project.events)
    .filter(e => e.status === 'adopted' && e.objectId === objectId && e.timeline === timeline && Number.isFinite(e.point) && e.point < point)
    .sort((a, b) => a.point - b.point || String(a.id).localeCompare(String(b.id)));
  for (const event of events) for (const [key, value] of Object.entries(event.to || {})) latest.set(key, { value, event });
  for (const [key, { value, event }] of latest) {
    if (event.until === point) expiring[key] = value;
  }
  return expiring;
}
function documentClosure(project, ids) {
  const found = new Set();
  const byId = new Map(array(project.documents).map(d => [d.id, d]));
  function visit(id) {
    if (!text(id) || found.has(id)) return;
    found.add(id);
    for (const dep of array(byId.get(id)?.dependsOn)) visit(dep.id);
  }
  ids.forEach(visit);
  return [...found].sort();
}
function relevantEventsForUnit(project, unit) {
  const maxPoints = new Map();
  for (const o of array(unit?.observations)) {
    if (!text(o?.objectId) || !text(o?.timeline) || !Number.isFinite(o?.point)) continue;
    const key = `${o.objectId}\0${o.timeline}`;
    const prev = maxPoints.get(key);
    if (prev === undefined || o.point > prev) maxPoints.set(key, o.point);
  }
  return array(project.events)
    .filter(e => e.status === 'adopted' && Number.isFinite(e.point) && maxPoints.has(`${e.objectId}\0${e.timeline}`) && e.point <= maxPoints.get(`${e.objectId}\0${e.timeline}`))
    .sort((a, b) => a.point - b.point || String(a.id).localeCompare(String(b.id)));
}
const pickDoc = d => ({ id: d.id, path: d.path, version: d.version, sha256: d.sha256, kind: d.kind, dependsOn: array(d.dependsOn).map(x => ({ id: x.id, sha256: x.sha256 })).sort((a, b) => String(a.id).localeCompare(String(b.id))) });
const pickEvent = e => ({ id: e.id, objectId: e.objectId, timeline: e.timeline, point: e.point, until: e.until ?? null, scope: e.scope, status: e.status, from: e.from || {}, to: e.to || {}, evidence: e.evidence || {} });
const pickImage = i => ({ id: i.id, objectId: i.objectId, forObjectId: i.forObjectId || '', version: i.version, path: i.path || '', sha256: i.sha256 || '', status: i.status, viewed: Boolean(i.viewed), unviewedAck: i.unviewedAck || '', state: i.state || {}, roles: [...array(i.roles)].sort() });
const pickSetting = s => ({ id: s.id, key: s.key, value: s.value, status: s.status, scopes: [...array(s.scopes)].sort() });
function eventsHash(project, ids) {
  const wanted = new Set(array(ids));
  const picked = array(project.events).filter(e => wanted.has(e.id)).map(pickEvent).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return canonicalHash(picked);
}
function upstreamFingerprints(project, unit, seen) {
  const byId = new Map(array(project.units).map(u => [u.id, u]));
  const result = [];
  for (const depId of [...new Set(array(unit?.dependsOnUnits))].sort()) {
    const dep = byId.get(depId);
    if (!dep || seen.has(depId)) continue;
    const nextSeen = new Set(seen);
    nextSeen.add(depId);
    result.push([depId, deliveryFingerprint(project, dep, nextSeen)]);
  }
  return result;
}
function preFingerprint(project, unit, seen = new Set([unit?.id])) {
  const sourceIds = documentClosure(project, array(unit?.sourceDocumentIds));
  const sourceSet = new Set(sourceIds);
  const upStages = UPSTREAM_STAGES[unit?.stage] || new Set();
  const adoptions = array(project.adoptions)
    .filter(a => sourceSet.has(a.documentId) || (scopeMatches(a.scope, unit?.scope) && upStages.has(a.stage)))
    .map(a => ({ scope: a.scope, stage: a.stage, documentId: a.documentId }))
    .sort((a, b) => `${a.scope}:${a.stage}`.localeCompare(`${b.scope}:${b.stage}`));
  const settings = array(project.settings)
    .filter(s => array(unit?.requiredSettings).includes(s.id))
    .map(pickSetting)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return canonicalHash({
    tier: 'pre',
    projectId: project.projectId,
    unit: {
      id: unit?.id,
      scope: unit?.scope,
      stage: unit?.stage,
      sourceDocumentIds: [...array(unit?.sourceDocumentIds)].sort(),
      dependsOnUnits: [...array(unit?.dependsOnUnits)].sort(),
      requiredSettings: [...array(unit?.requiredSettings)].sort()
    },
    sourceDocuments: array(project.documents).filter(d => sourceSet.has(d.id)).map(pickDoc).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    adoptions,
    settings,
    upstream: upstreamFingerprints(project, unit, seen)
  });
}
function bindingFingerprint(project, unit, seen = new Set([unit?.id])) {
  const relatedEvents = relevantEventsForUnit(project, unit);
  const eventDocIds = new Set(documentClosure(project, relatedEvents.map(e => e.evidence?.documentId).filter(Boolean)));
  const usedImages = new Set(array(unit?.bindings).map(b => b.imageId));
  return canonicalHash({
    tier: 'binding',
    pre: preFingerprint(project, unit, seen),
    noStateReason: unit?.noStateReason || '',
    observations: [...array(unit?.observations)].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    referenceNeeds: [...array(unit?.referenceNeeds)].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    bindings: [...array(unit?.bindings)].sort((a, b) => `${a.needId}:${a.imageId}:${a.label}`.localeCompare(`${b.needId}:${b.imageId}:${b.label}`)),
    events: relatedEvents.map(pickEvent),
    eventDocuments: array(project.documents).filter(d => eventDocIds.has(d.id)).map(pickDoc).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    images: array(project.images).filter(i => usedImages.has(i.id)).map(pickImage).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  });
}
function deliveryFingerprint(project, unit, seen = new Set([unit?.id])) {
  const outputIds = new Set(documentClosure(project, array(unit?.documentIds)));
  return canonicalHash({
    tier: 'delivery',
    binding: bindingFingerprint(project, unit, seen),
    documentIds: [...array(unit?.documentIds)].sort(),
    outputDocuments: array(project.documents).filter(d => outputIds.has(d.id)).map(pickDoc).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    openIssues: array(project.issues).filter(i => i.status === 'open' && array(i.unitIds).includes(unit?.id)).map(i => i.id).sort()
  });
}
function gateFingerprint(project, unit, gate) {
  if (gate === 'G0' || gate === 'G1' || gate === 'G2') return preFingerprint(project, unit);
  if (gate === 'G3') return bindingFingerprint(project, unit);
  return deliveryFingerprint(project, unit);
}
const fingerprint = (project, unit) => deliveryFingerprint(project, unit);
function validate(project, root) {
  const errors = [];
  const fail = (code, id, message) => errors.push({ code, id: id || '', message });
  if (!project || typeof project !== 'object' || Array.isArray(project)) return [{ code: 'SCHEMA', id: '', message: '项目记录必须为对象' }];
  if (project.schemaVersion !== 3 || !text(project.projectId) || !Number.isInteger(project.revision) || project.revision < 0) fail('SCHEMA', '', '项目ID/版本/revision无效');
  for (const key of tables) {
    if (!Array.isArray(project[key])) fail('SCHEMA', key, '必须为数组');
    else if (project[key].some(item => !item || typeof item !== 'object' || Array.isArray(item))) return [...errors, { code: 'SCHEMA', id: key, message: '数组记录必须为对象' }];
  }
  const maps = {};
  for (const key of tables.filter(k => k !== 'adoptions')) {
    maps[key] = new Map();
    for (const item of array(project[key])) {
      if (!text(item.id) || maps[key].has(item.id)) fail('ID', key, 'ID缺失或重复：' + item.id);
      maps[key].set(item.id, item);
    }
  }
  const checkPath = (relative, id, mustExist = true) => {
    try {
      const full = inside(root, relative);
      if (mustExist && (!fs.existsSync(full) || !fs.statSync(full).isFile())) throw new Error('文件不存在或不是普通文件');
      return full;
    } catch (e) { fail('PATH', id, e.message); return null; }
  };
  for (const d of array(project.documents)) {
    const full = checkPath(d.path, d.id);
    if (!text(d.version) || !/^[a-f0-9]{64}$/.test(d.sha256 || '') || !text(d.kind)) fail('DOCUMENT', d.id, '版本、类型或哈希无效');
    if (full && fs.existsSync(full) && fs.statSync(full).isFile() && fileHash(full) !== d.sha256) fail('HASH', d.id, '实际文件改变，须核上游并标记依赖待复核');
    if (!Array.isArray(d.dependsOn)) fail('SCHEMA', d.id, 'dependsOn须为数组');
    for (const dep of array(d.dependsOn)) {
      const source = maps.documents.get(dep.id);
      if (!source || source.sha256 !== dep.sha256) fail('DEPENDENCY', d.id, '依赖不存在或摘要不符：' + dep.id);
    }
  }
  const routes = new Set();
  for (const route of array(project.adoptions)) {
    const key = route.scope + ':' + route.stage;
    if (!text(route.scope) || !text(route.stage) || !text(route.source) || routes.has(key) || !maps.documents.has(route.documentId)) fail('ADOPTION', route.documentId, '采用路由缺失、重复或无采用来源');
    routes.add(key);
    if (inTrash(maps.documents.get(route.documentId)?.path)) fail('TRASH_ACTIVE', route.documentId, '采用稿不能位于垃圾箱');
  }
  for (const object of array(project.objects)) if (!text(object.name) || !['character', 'scene', 'prop', 'reference'].includes(object.type) || !Array.isArray(object.aliases)) fail('OBJECT', object.id, '对象名称/类别/别名无效');
  function evidence(e, owner) {
    const d = maps.documents.get(e?.documentId);
    if (!d || !text(e?.quote)) { fail('EVIDENCE', owner, '缺少原文引用'); return; }
    const full = checkPath(d.path, owner);
    if (full && fs.existsSync(full) && fs.statSync(full).isFile() && !normalizeText(fs.readFileSync(full, 'utf8')).includes(normalizeText(e.quote))) fail('EVIDENCE', owner, '引用片段不在登记原文中');
  }
  const stateKeys = new Map();
  for (const event of array(project.events)) {
    if (!maps.objects.has(event.objectId) || !text(event.timeline) || !text(event.scope) || !Number.isFinite(event.point) || !['adopted', 'candidate', 'superseded'].includes(event.status)) fail('EVENT', event.id, '状态身份/时点/范围无效');
    if (event.until != null && (!Number.isFinite(event.until) || event.until <= event.point)) fail('EVENT', event.id, '失效边界必须晚于生效点');
    if (!event.to || typeof event.to !== 'object' || Array.isArray(event.to) || !Object.keys(event.to).length || Object.values(event.to).some(v => !text(v))) fail('EVENT', event.id, '后值必须为非空维度字符串映射');
    if (!event.from || typeof event.from !== 'object' || Array.isArray(event.from)) fail('EVENT', event.id, '前值必须为维度映射');
    evidence(event.evidence, event.id);
    if (event.status !== 'adopted' || !Number.isFinite(event.point)) continue;
    const earlier = { ...project, events: array(project.events).filter(e => e.point < event.point) };
    const previous = stateAt(earlier, event.objectId, event.timeline, event.point);
    const expiring = stateExpiringAt(earlier, event.objectId, event.timeline, event.point);
    for (const [dimension, value] of Object.entries(event.to || {})) {
      const key = JSON.stringify([event.objectId, event.timeline, event.point, dimension]);
      if (stateKeys.has(key)) fail('STATE_COLLISION', event.id, '同一时点维度重复采用：' + stateKeys.get(key));
      stateKeys.set(key, event.id);
      const fromVal = event.from?.[dimension];
      if (Object.hasOwn(previous, dimension)) {
        if (fromVal !== previous[dimension]) fail('STATE_FROM', event.id, dimension + '前值与有效历史不符');
      } else if (Object.hasOwn(expiring, dimension)) {
        if (fromVal != null && fromVal !== expiring[dimension]) fail('STATE_FROM', event.id, dimension + '前值与到期紧邻状态不符');
      } else if (fromVal != null) {
        fail('STATE_FROM', event.id, dimension + '前值没有有效来源');
      }
      if (!text(value)) fail('EVENT', event.id, '维度值无效');
    }
  }
  for (const image of array(project.images)) {
    if (!maps.objects.has(image.objectId) || (text(image.forObjectId) && !maps.objects.has(image.forObjectId)) || !text(image.name) || !text(image.version) || !text(image.source) || !text(image.sourceRef) || typeof image.viewed !== 'boolean' || !['available', 'session-only', 'retired'].includes(image.status) || !Array.isArray(image.roles) || !image.state || typeof image.state !== 'object' || Array.isArray(image.state)) fail('IMAGE', image.id, '登记身份/状态/来源/职责无效');
    if (image.status === 'available') {
      const imageFile = checkPath(image.path, image.id);
      if (!/^[a-f0-9]{64}$/.test(image.sha256 || '') || (imageFile && fs.existsSync(imageFile) && fs.statSync(imageFile).isFile() && fileHash(imageFile) !== image.sha256)) fail('IMAGE_HASH', image.id, '图片哈希缺失或文件被替换，须重新核对登记与绑定');
      if (inTrash(image.path)) fail('TRASH_ACTIVE', image.id, '可用图不能在垃圾箱');
    }
  }
  const settingScopes = new Map();
  for (const setting of array(project.settings)) {
    if (!text(setting.key) || setting.value == null || setting.value === '' || !['recommended', 'confirmed', 'authorized'].includes(setting.status) || !Array.isArray(setting.scopes) || !setting.scopes.length || !text(setting.source)) {
      fail('SETTING', setting.id, '设置值/状态/范围/来源缺失');
      continue;
    }
    if (['confirmed', 'authorized'].includes(setting.status)) {
      for (const sc of setting.scopes) {
        const skey = `${setting.key}\0${sc}`;
        const prev = settingScopes.get(skey);
        if (prev && JSON.stringify(prev.value) !== JSON.stringify(setting.value)) fail('SETTING_CONFLICT', setting.id, `同作用域设置冲突：${setting.key}@${sc} 与 ${prev.id}`);
        else settingScopes.set(skey, setting);
      }
    }
  }
  const validWork = ['未开始', '进行中', '待确认', '阻塞', '已交付'];
  const validReview = ['未检查', '通过', '失败', '待复核'];
  const validAdoption = ['草稿', '候选', '已采用', '已替代'];
  for (const unit of array(project.units)) {
    if (!text(unit.scope) || !text(unit.stage) || !validWork.includes(unit.workStatus) || !validReview.includes(unit.reviewStatus) || !validAdoption.includes(unit.adoptionStatus)) fail('UNIT', unit.id, '单元范围/阶段/状态无效');
    for (const key of ['documentIds', 'sourceDocumentIds', 'dependsOnUnits', 'requiredSettings', 'requiredGates', 'observations', 'referenceNeeds', 'bindings']) if (!Array.isArray(unit[key])) fail('SCHEMA', unit.id, key + '须为数组');
    if (['01', '02', '03', '04V', '04A', '04B', '04I'].includes(unit.stage)) for (const gate of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5']) if (!array(unit.requiredGates).includes(gate)) fail('GATE_REQUIRED', unit.id, '缺少关卡声明：' + gate);
    if (['03', '04V', '04A', '04B', '04I'].includes(unit.stage) && (unit.workStatus === '已交付' || unit.reviewStatus === '通过' || array(unit.documentIds).length > 0 || array(unit.bindings).length > 0) && !array(unit.observations).length && !text(unit.noStateReason)) fail('OBSERVATION', unit.id, '无状态观察点须提供确实不适用的依据');
    if (unit.parentId && !maps.units.has(unit.parentId)) fail('UNIT_PARENT', unit.id, '父级不存在');
    for (const id of [...array(unit.documentIds), ...array(unit.sourceDocumentIds)]) if (!maps.documents.has(id)) fail('DOCUMENT_REF', unit.id, '文档不存在：' + id);
    for (const id of array(unit.dependsOnUnits)) {
      const up = maps.units.get(id);
      if (!up) fail('UNIT_DEPENDENCY', unit.id, '上游单元不存在：' + id);
      else if ((unit.reviewStatus === '通过' || unit.workStatus === '已交付') && up.reviewStatus !== '通过') fail('STALE_UPSTREAM', unit.id, '上游未通过或待复核：' + id);
    }
    for (const id of array(unit.requiredSettings)) {
      const s = maps.settings.get(id);
      if (!s || !['confirmed', 'authorized'].includes(s.status) || !array(s.scopes).some(scope => scopeMatches(scope, unit.scope))) fail('UNCONFIRMED', unit.id, '缺有效设置确认：' + id);
    }
    const observations = new Map();
    for (const o of array(unit.observations)) {
      if (!text(o.id) || observations.has(o.id) || !maps.objects.has(o.objectId) || !text(o.shotId) || !text(o.timeline) || !Number.isFinite(o.point) || !o.requires || typeof o.requires !== 'object' || Array.isArray(o.requires) || !Object.keys(o.requires).length) { fail('OBSERVATION', unit.id, '观察点缺字段或ID重复'); continue; }
      observations.set(o.id, o);
      const state = stateAt(project, o.objectId, o.timeline, o.point);
      for (const [key, value] of Object.entries(o.requires)) if (!text(value) || state[key] !== value) fail('STATE_MISMATCH', unit.id + '/' + o.id, key + '正文状态与有效剧情不符或未知');
    }
    const needs = new Map();
    for (const need of array(unit.referenceNeeds)) {
      if (!text(need.id) || needs.has(need.id) || !observations.has(need.observationId) || !text(need.role) || !['image', 'text'].includes(need.mode)) fail('NEED', unit.id, '参考需求缺字段或引用错误');
      if (need.mode === 'text' && !text(need.authorization)) fail('TEXT_AUTH', unit.id, '纯文字替代缺少明确授权');
      needs.set(need.id, need);
    }
    const count = new Map(); const labels = new Map(); const imageLabels = new Map();
    for (const binding of array(unit.bindings)) {
      count.set(binding.needId, (count.get(binding.needId) || 0) + 1);
      const need = needs.get(binding.needId); const image = maps.images.get(binding.imageId);
      if (!need || need.mode !== 'image') fail('EXTRA_BINDING', unit.id, '绑定没有实际图片需求：' + binding.needId);
      if (!image || image.status !== 'available' || inTrash(image?.path)) { fail('UNAVAILABLE_IMAGE', unit.id, '图片未登记/未落盘/已弃用：' + binding.imageId); continue; }
      if (!text(binding.label) || (labels.has(binding.label) && labels.get(binding.label) !== image.id) || (imageLabels.has(image.id) && imageLabels.get(image.id) !== binding.label)) fail('LABEL', unit.id, '标签重复指向不同图或同图重复设标签');
      labels.set(binding.label, image.id); imageLabels.set(image.id, binding.label);
      const observation = observations.get(need?.observationId);
      if (observation && need) {
        const objectOk = image.objectId === observation.objectId || (text(image.forObjectId) && image.forObjectId === observation.objectId);
        if (!objectOk || !roleMatches(image.roles, need.role)) fail('BINDING_ROLE', unit.id, '图片对象或职责不符');
        const isVisual = !NON_VISUAL_ROLES.has(need.role);
        if (isVisual && image.viewed !== true && !text(image.unviewedAck)) fail('UNVIEWED_IMAGE', unit.id + '/' + image.id, '视觉参考图未查看，须查看后标viewed=true或写明unviewedAck');
        const state = stateAt(project, observation.objectId, observation.timeline, observation.point);
        const imgState = image.state || {};
        const overrideDims = new Set(array(binding.overrideDims).filter(text));
        if (overrideDims.size && !text(binding.overrideAuth)) fail('OVERRIDE_AUTH', unit.id + '/' + observation.id, '降级沿用旧状态图须有用户明确授权overrideAuth');
        for (const [key, value] of Object.entries(imgState)) {
          if (overrideDims.has(key)) continue;
          if (state[key] !== value) fail('IMAGE_STATE', unit.id + '/' + observation.id, '图片' + key + '与有效剧情不符或缺少依据');
        }
        if (isVisual) {
          const reqKeys = Array.isArray(need.requiredStateKeys)
            ? need.requiredStateKeys
            : Object.keys(observation.requires || {}).filter(k => !NON_VISUAL_STATE_KEYS.has(k));
          for (const key of reqKeys) {
            if (overrideDims.has(key)) continue;
            if (!Object.hasOwn(imgState, key)) fail('IMAGE_STATE_MISSING', unit.id + '/' + observation.id, '视觉图缺少必需状态维度登记：' + key);
            else if (imgState[key] !== state[key]) fail('IMAGE_STATE', unit.id + '/' + observation.id, '图片' + key + '与有效剧情不符');
          }
        }
      }
    }
    for (const need of needs.values()) if (need.mode === 'image' && count.get(need.id) !== 1) fail('MISSING_BINDING', unit.id, '图片需求须恰有一项绑定：' + need.id);
    if (unit.workStatus === '已交付' || unit.reviewStatus === '通过') {
      if (!array(unit.documentIds).length || !array(unit.sourceDocumentIds).length) fail('DELIVERY', unit.id, '已交付单元缺源稿或产物');
      if (!array(unit.requiredGates).length) fail('GATE', unit.id, '没有适用关卡');
      const relatedEvents = relevantEventsForUnit(project, unit);
      const eventDocIds = relatedEvents.map(e => e.evidence?.documentId).filter(Boolean);
      const preDocs = documentClosure(project, array(unit.sourceDocumentIds));
      const g1Docs = documentClosure(project, [...array(unit.sourceDocumentIds), ...eventDocIds]);
      const fullDocs = documentClosure(project, [...array(unit.documentIds), ...array(unit.sourceDocumentIds), ...eventDocIds]);
      const coversDocs = (c, docIds) => docIds.every(id => array(c.inputs).some(i => i.id === id && i.sha256 === maps.documents.get(id)?.sha256));
      for (const gate of array(unit.requiredGates)) {
        const checks = array(project.checks).filter(c => c.unitId === unit.id && c.gate === gate);
        const c = checks[checks.length - 1];
        const expectedHash = gateFingerprint(project, unit, gate);
        const requiredDocs = (gate === 'G0' || gate === 'G2') ? preDocs : (gate === 'G1' || gate === 'G3') ? g1Docs : fullDocs;
        const needEvents = ['G1', 'G3', 'G4', 'G5'].includes(gate);
        const needImages = ['G3', 'G4', 'G5'].includes(gate);
        const eventsOk = !needEvents || (relatedEvents.every(e => array(c?.basisEventIds).includes(e.id)) && (!text(c?.basisEventHash) || c.basisEventHash === eventsHash(project, c.basisEventIds)));
        const imagesOk = !needImages || array(unit.bindings).every(b => array(c?.basisImageIds).includes(b.imageId));
        if (!c || !['通过', '不适用'].includes(c.result) || !text(c.evidence) || c.contextHash !== expectedHash || !coversDocs(c, requiredDocs) || !eventsOk || !imagesOk) {
          fail('GATE', unit.id + '/' + gate, '检查缺失、未通过或对应阶段文档/状态/图片依据指纹过期');
        }
      }
    }
  }
  for (const c of array(project.checks)) {
    if (!maps.units.has(c.unitId) || !/^G[0-5]$/.test(c.gate || '') || !['通过', '失败', '不适用'].includes(c.result) || !text(c.evidence) || !Array.isArray(c.inputs) || !Array.isArray(c.basisEventIds) || !Array.isArray(c.basisImageIds)) fail('CHECK', c.id, '检查结构/证据缺失');
    for (const id of array(c.basisEventIds)) if (!maps.events.has(id)) fail('CHECK', c.id, '状态依据不存在');
    for (const id of array(c.basisImageIds)) if (!maps.images.has(id)) fail('CHECK', c.id, '图像依据不存在');
  }
  function cycles(key, edges) {
    const done = new Set(); const active = new Set();
    function visit(id) {
      if (active.has(id)) { fail('CYCLE', id, key + '依赖循环'); return; }
      if (done.has(id)) return;
      active.add(id);
      for (const next of edges(maps[key].get(id) || {})) if (maps[key].has(next)) visit(next);
      active.delete(id); done.add(id);
    }
    maps[key].forEach((_, id) => visit(id));
  }
  cycles('documents', d => array(d.dependsOn).map(dep => dep.id));
  cycles('units', u => [...array(u.dependsOnUnits), ...(u.parentId ? [u.parentId] : [])]);
  if (project.currentUnit && !maps.units.has(project.currentUnit)) fail('CURRENT', project.currentUnit, '当前单元不存在');
  for (const issue of array(project.issues)) {
    if (!text(issue.scope) || !text(issue.summary) || !['open', 'resolved'].includes(issue.status) || !Array.isArray(issue.unitIds)) fail('ISSUE', issue.id, '问题范围/状态/说明无效');
    for (const id of array(issue.unitIds)) {
      const u = maps.units.get(id);
      if (!u) fail('ISSUE', issue.id, '关联单元不存在');
      else if (issue.status === 'open' && (u.workStatus === '已交付' || u.reviewStatus === '通过')) fail('OPEN_ISSUE', id, issue.summary);
    }
  }
  for (const batch of array(project.batches)) {
    if (!['pending', 'committed'].includes(batch.status) || !text(batch.summary)) fail('BATCH', batch.id, '批次结构无效');
    if (batch.status === 'pending') fail('PENDING_BATCH', batch.id, '存在中断或尚未完成的保存批次');
  }
  for (const item of array(project.trash)) {
    checkPath(item.originalPath, item.id, false); checkPath(item.path, item.id);
    if (!inTrash(item.path) || !text(item.reason) || !text(item.restore)) fail('TRASH', item.id, '归档位置/原因/恢复信息不完整');
  }
  return errors;
}
function readProject(root) { return JSON.parse(fs.readFileSync(inside(root, '00-项目管理/项目.json'), 'utf8').replace(/^\uFEFF/, '')); }
function affected(project, id) {
  const documents = new Set(); const objects = new Set(); const images = new Set(); const units = new Set(); const adoptions = new Set();
  const isDoc = array(project.documents).some(d => d.id === id);
  const isObj = array(project.objects).some(o => o.id === id);
  const targetEvent = array(project.events).find(e => e.id === id);
  const isImg = array(project.images).some(i => i.id === id);
  const isSet = array(project.settings).some(s => s.id === id);
  const isUnit = array(project.units).some(u => u.id === id);
  const found = isDoc || isObj || Boolean(targetEvent) || isImg || isSet || isUnit;
  if (isDoc) documents.add(id);
  if (isObj) objects.add(id);
  if (targetEvent) objects.add(targetEvent.objectId);
  for (const e of array(project.events)) if (documents.has(e.evidence?.documentId)) objects.add(e.objectId);
  if (isImg) images.add(id);
  if (isUnit) units.add(id);
  let changed = true;
  while (changed) {
    const size = documents.size + objects.size + images.size + units.size + adoptions.size;
    for (const d of array(project.documents)) if (array(d.dependsOn).some(dep => documents.has(dep.id))) documents.add(d.id);
    for (const a of array(project.adoptions)) if (documents.has(a.documentId)) adoptions.add(`${a.scope}:${a.stage}`);
    for (const e of array(project.events)) if (documents.has(e.evidence?.documentId)) objects.add(e.objectId);
    for (const i of array(project.images)) if (objects.has(i.objectId) || (text(i.forObjectId) && objects.has(i.forObjectId))) images.add(i.id);
    for (const u of array(project.units)) {
      if (
        [...array(u.sourceDocumentIds), ...array(u.documentIds)].some(d => documents.has(d)) ||
        array(u.observations).some(o => objects.has(o.objectId)) ||
        array(u.bindings).some(b => images.has(b.imageId)) ||
        array(u.dependsOnUnits).some(dep => units.has(dep)) ||
        (u.parentId && units.has(u.parentId)) ||
        array(u.requiredSettings).includes(id)
      ) units.add(u.id);
    }
    for (const u of array(project.units)) if (units.has(u.id)) for (const d of array(u.documentIds)) documents.add(d);
    changed = size !== documents.size + objects.size + images.size + units.size + adoptions.size;
  }
  const preciseUnits = new Set();
  if (targetEvent) {
    for (const u of array(project.units)) {
      if (array(u.observations).some(o => o.objectId === targetEvent.objectId && o.timeline === targetEvent.timeline && Number.isFinite(o.point) && o.point >= targetEvent.point)) preciseUnits.add(u.id);
    }
    let pChanged = true;
    while (pChanged) {
      const sz = preciseUnits.size;
      for (const u of array(project.units)) {
        if (array(u.dependsOnUnits).some(dep => preciseUnits.has(dep)) || (u.parentId && preciseUnits.has(u.parentId))) preciseUnits.add(u.id);
      }
      pChanged = sz !== preciseUnits.size;
    }
  } else {
    units.forEach(u => preciseUnits.add(u));
  }
  return {
    changedId: id,
    found,
    documents: [...documents].sort(),
    adoptions: [...adoptions].sort(),
    objectIds: [...objects].sort(),
    imageIds: [...images].sort(),
    preciseUnitIds: [...preciseUnits].sort(),
    unitIds: [...units].sort(),
    note: found
      ? 'preciseUnitIds按故事时点与直接依赖收窄；unitIds为保守候选影响范围；按语义复核后人工标待复核，不自动改稿或采用'
      : '未在项目记录中找到该ID，请核对拼写或表名'
  };
}
function report(project, errors) {
  return { projectId: project.projectId, revision: project.revision, currentUnit: project.currentUnit, coverage: project.coverage, units: array(project.units).map(u => ({ id: u.id, scope: u.scope, stage: u.stage, work: u.workStatus, review: u.reviewStatus, adoption: u.adoptionStatus, next: u.next, blocker: u.blocker })), images: array(project.images).map(i => ({ id: i.id, objectId: i.objectId, name: i.name, status: i.status, path: i.path })), errors };
}
const clean = value => String(value ?? '').replace(/[\r\n|]/g, ' ');
function render(project, root, errors) {
  const lines = ['# 项目总览（自动派生，请勿手改）', '', `项目：${clean(project.projectId)}；修订：${project.revision}；当前：${clean(project.currentUnit) || '尚未开始'}`, '', '## 校验与阻塞', '', ...(errors.length ? errors.map(e => `- ${clean(e.code)} ${clean(e.id)}：${clean(e.message)}`) : ['- 结构和显式数据检查通过；不等于原文语义或实际生成验收通过。']), '', '## 剧本与采用稿', ''];
  for (const d of array(project.documents).filter(d => d.kind === 'script')) lines.push(`- ${clean(d.id)} ${clean(d.version)}：${clean(d.path)}`);
  for (const a of array(project.adoptions)) lines.push(`- ${clean(a.scope)} / ${clean(a.stage)} → ${clean(a.documentId)}`);
  lines.push('', '## 制作进度', '', '| 单元 | 范围/阶段 | 工作/采用/检查 | 下一步/阻塞 |', '|---|---|---|---|');
  for (const u of array(project.units)) lines.push(`| ${clean(u.id)} | ${clean(u.scope)} / ${clean(u.stage)} | ${clean(u.workStatus)} / ${clean(u.adoptionStatus)} / ${clean(u.reviewStatus)} | ${clean(u.next)} ${clean(u.blocker)} |`);
  lines.push('', '## 对象与状态变化（必须按故事时点查询，不代表当前全剧统一状态）', '');
  for (const o of array(project.objects)) {
    lines.push(`### ${clean(o.id)} ${clean(o.name)}`);
    for (const e of array(project.events).filter(e => e.objectId === o.id && e.status === 'adopted').sort((a, b) => a.point - b.point)) lines.push(`- ${clean(e.id)} / ${clean(e.scope)} / ${clean(e.timeline)} @ ${e.point}：${clean(JSON.stringify(e.to))}；依据 ${clean(e.evidence?.documentId)}：${clean(e.evidence?.quote)}`);
  }
  lines.push('', '## 图片登记', '');
  for (const i of array(project.images)) {
    const forTarget = text(i.forObjectId) ? `（服务角色：${clean(i.forObjectId)}）` : '';
    lines.push(`- ${clean(i.id)} ${clean(i.name)} → ${clean(i.objectId)}${forTarget}；${clean(JSON.stringify(i.state))}；${clean(i.status)}；${clean(i.path || i.sourceRef)}`);
  }
  lines.push('', '## 已收范围与未知', '', clean(JSON.stringify(project.coverage)), '', '完整权威记录：项目.json。检查失败须先处理，不把此视图当作已验证事实。', '');
  fs.writeFileSync(inside(root, '00-项目管理/项目总览.md'), lines.join('\n'));
  const entry = ['# 项目入口（自动派生）', '', `项目：${clean(project.projectId)}`, '', '- [项目总览：剧本、进度、人物状态、图片登记及阻塞](00-项目管理/项目总览.md)', '- [唯一权威记录](00-项目管理/项目.json)', '', '恢复时先读取这两个文件，再读取本轮采用剧本原文、状态事件、实际图片与源镜。不得只凭总览摘要生成。', '', `当前工作单元：${clean(project.currentUnit) || '尚未开始'}`, ''];
  fs.writeFileSync(inside(root, '项目入口.md'), entry.join('\n'));
}
function init(root, projectId) {
  if (!text(projectId)) throw new Error('需要项目ID');
  if (fs.existsSync(root) && !fs.statSync(root).isDirectory()) throw new Error('项目位置不是目录');
  for (const relative of ['项目入口.md', '00-项目管理/项目.json', '00-项目管理/项目总览.md']) if (fs.existsSync(path.join(root, relative))) throw new Error('拒绝覆盖已有项目：' + relative);
  fs.mkdirSync(root, { recursive: true });
  for (const relative of ['00-项目管理', '01-剧本/原始输入', '02-连续性', '03-资产', '04-分镜', '05-分段提示词', '06-生成与验收', '99-垃圾箱']) fs.mkdirSync(inside(root, relative), { recursive: true });
  const project = blank(projectId);
  fs.writeFileSync(recordPath(root), JSON.stringify(project, null, 2) + '\n', { flag: 'wx' });
  render(project, root, []);
  return project;
}
function main(args) {
  const [command, directory, arg3, arg4, arg5] = args;
  const writer = require('./项目写入.cjs');
  if (writer.WRITE_COMMANDS.has(command)) {
    if (!directory) throw new Error('缺少项目目录');
    const out = writer.dispatch(command, directory, args.slice(2));
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 1;
    return;
  }
  if (!['init', 'check', 'status', 'render', 'affected', 'state'].includes(command) || !directory) throw new Error('用法：项目管理.cjs init|check|status|render|affected|state|<写入命令> <项目目录> [参数]');
  const root = path.resolve(directory);
  const project = command === 'init' ? init(root, arg3) : readProject(root);
  const errors = validate(project, root);
  if (command === 'render') render(project, root, errors);
  if (command === 'state') {
    if (!text(arg3) || !text(arg4) || !text(arg5) || !Number.isFinite(Number(arg5))) throw new Error('state用法：项目管理.cjs state <项目目录> <对象ID> <timeline> <point>');
    const point = Number(arg5);
    console.log(JSON.stringify({ projectId: project.projectId, objectId: arg3, timeline: arg4, point, state: stateAt(project, arg3, arg4, point), errors }, null, 2));
    if (errors.length) process.exitCode = 1;
    return;
  }
  if (command === 'affected') {
    if (!text(arg3)) throw new Error('affected需要变更对象/事件/文档/图片/设置/单元ID');
    const impact = affected(project, arg3);
    console.log(JSON.stringify({ ...impact, ok: impact.found && errors.length === 0, errors }, null, 2));
    if (!impact.found || errors.length) process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(command === 'status' ? report(project, errors) : { projectId: project.projectId, command, ok: errors.length === 0, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
module.exports = {
  blank, inside, inTrash, recordPath, fileHash, normalizeText, canonicalize, canonicalHash, scopeMatches,
  stateAt, stateExpiringAt, relevantEventsForUnit, eventsHash,
  preFingerprint, bindingFingerprint, deliveryFingerprint, gateFingerprint, fingerprint,
  validate, readProject, init, render, documentClosure, affected, report,
  NON_VISUAL_ROLES, NON_VISUAL_STATE_KEYS
};
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; } }
