#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HEDGING = ['不承诺完播', '不保证跨模型', '尚未完成发布回归', '缺实际独立运行', '不承诺独创性'];
const ISOLATED_DIRS = new Set(['core', 'channels', 'examples', 'templates']);
const CLICHES = ['命运的齿轮', '气氛瞬间凝固', '空气瞬间凝固', '三分凉薄', '三分讥诮', '展开了一番激烈'];
const MODERN_STIFF = ['是否', '因此', '从而', '鉴于', '予以', '加以', '可否', '何以', '颇为', '甚为', '然而'];
const ANCIENT_ANACHRONISM = ['逻辑', '机制', '维度', '复盘', '闭环', '赋能', '抓手', '颗粒度', '情绪价值', '经济损失', '心理阴影', '物理意义'];
const CLIPPING_PATTERNS = [
  { re: /(车窗.{0,6}递.{0,6}伞|伞.{0,6}递出车窗)/, msg: '跨窄车窗递伞极易导致 AI 视频穿模，建议改为推门下车撑伞或门外收伞' },
  { re: /(伞尖悬在雨里|剑尖停在咽喉)/, msg: '无根局部悬空词，请补全握持部位、开合状态与物理落点' },
];

function slugifyHeading(title) {
  const stripped = title.replace(/[`*_~]/g, '').trim().toLowerCase();
  let kept = '';
  for (const ch of stripped) {
    if (ch === '-' || ch === '_' || ch === ' ' || /[\p{L}\p{N}]/u.test(ch)) {
      kept += ch;
    }
  }
  return kept.replace(/\s/g, '-');
}

function extractAnchors(markdownText) {
  const found = new Set();
  const counts = new Map();
  let inFence = false;
  for (const line of markdownText.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (m) {
      const base = slugifyHeading(m[1]);
      const c = counts.get(base) || 0;
      found.add(c === 0 ? base : `${base}-${c}`);
      counts.set(base, c + 1);
    }
  }
  return found;
}

function walkMarkdown(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMarkdown(full, out);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function walkSkills(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSkills(full, out);
    else if (ent.isFile() && ent.name === 'SKILL.md') out.push(full);
  }
  return out;
}

function scanEraWords(speech, ln, era, issues) {
  if (era === 'modern') {
    for (const w of MODERN_STIFF) {
      if (speech.includes(w)) {
        issues.push(`L${ln} [现代书面虚词预警]: 台词含公文腔词「${w}」，非官腔人设建议改为自然口语`);
      }
    }
  } else if (era === 'ancient') {
    for (const w of ANCIENT_ANACHRONISM) {
      if (speech.includes(w)) {
        issues.push(`L${ln} [古装现代词穿越预警]: 古装台词混入现代词「${w}」，请替换为符合时代的表达`);
      }
    }
  }
}

function selfCheck() {
  const errors = [];
  const entry = path.join(ROOT, 'SKILL.md');
  const skills = walkSkills(ROOT);
  if (skills.length !== 1 || path.resolve(skills[0]) !== path.resolve(entry)) {
    errors.push(`Expected single root SKILL.md, found ${skills.length}`);
  }

  const entryText = fs.readFileSync(entry, 'utf8').replace(/^\uFEFF/, '');
  const entryLines = entryText.split(/\r?\n/);
  if (entryLines.length > 120) {
    errors.push(`SKILL.md exceeds 120-line budget (${entryLines.length} lines)`);
  }
  if (!/^---\r?\nname:\s*xingying-juben-v3-5\r?\ndescription:\s*.+\r?\n---/.test(entryText)) {
    errors.push('Invalid SKILL.md YAML frontmatter (expected name: xingying-juben-v3-5)');
  }

  const mdFiles = walkMarkdown(ROOT).sort();
  const mdCache = new Map();
  for (const f of mdFiles) {
    mdCache.set(path.resolve(f), fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
  }

  let linkCount = 0;
  let anchorCount = 0;

  for (const fullPath of mdFiles) {
    const txt = mdCache.get(path.resolve(fullPath));
    const rel = path.relative(ROOT, fullPath);
    const parts = rel.split(path.sep);
    const topDir = parts.length > 1 ? parts[0] : '';

    if (topDir !== 'dev') {
      for (const bad of HEDGING) {
        if (txt.includes(bad)) {
          errors.push(`Banned hedging phrase '${bad}' found in runtime file ${rel}`);
        }
      }
    }

    const linkRe = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
    let m;
    while ((m = linkRe.exec(txt)) !== null) {
      const target = m[1].trim().replace(/^<|>$/g, '');
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || target.startsWith('//')) continue;
      linkCount++;
      const [rawPath, rawFrag] = target.split('#', 2);
      const cleanRel = decodeURIComponent((rawPath || '').split('?')[0]);
      const resolved = cleanRel ? path.resolve(path.dirname(fullPath), cleanRel) : path.resolve(fullPath);
      const normRoot = path.resolve(ROOT) + path.sep;

      if (resolved !== path.resolve(ROOT) && !resolved.toLowerCase().startsWith(normRoot.toLowerCase())) {
        errors.push(`Link escapes skill root in ${rel}: ${target}`);
        continue;
      }
      if (!fs.existsSync(resolved)) {
        errors.push(`Broken relative link in ${rel}: ${target}`);
        continue;
      }
      if (ISOLATED_DIRS.has(topDir) && cleanRel && cleanRel.toLowerCase().endsWith('.md')) {
        errors.push(`Lateral cross-link violation in ${rel} -> ${target} (only SKILL.md may dispatch)`);
      }
      if (rawFrag && resolved.toLowerCase().endsWith('.md')) {
        anchorCount++;
        const frag = decodeURIComponent(rawFrag);
        const targetTxt = mdCache.get(resolved) || fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, '');
        const anchors = extractAnchors(targetTxt);
        if (!anchors.has(frag)) {
          errors.push(`Missing heading anchor in ${rel}: ${target} (anchor '#${frag}' not found)`);
        }
      }
    }
  }

  const requiredRoutes = [
    'channels/ch-short-drama.md', 'channels/ch-series.md', 'channels/ch-film.md',
    'channels/ch-commercial.md', 'channels/ch-narrated.md',
    'core/iron-laws.md', 'core/dialogue-surgery.md', 'core/adaptation.md', 'core/audit-and-risk.md',
    'examples/samples-short-drama.md', 'examples/samples-film-series.md', 'examples/samples-commercial-vo.md',
    'templates/project-state-schema.md',
    'scripts/estimate_duration.cjs', 'scripts/check_script_format.cjs',
  ];
  for (const r of requiredRoutes) {
    if (!entryText.includes(r)) {
      errors.push(`SKILL.md missing dispatch route: ${r}`);
    }
  }

  console.log('=== 星应剧本 3.5 · 架构与全链路路由自检 ===');
  console.log(`检查范围 : ${mdFiles.length} 份 Markdown | ${linkCount} 个文件/脚本链接 | ${anchorCount} 个精确章节锚点 | SKILL.md 行数=${entryLines.length}/120`);
  console.log('架构守卫 : 单向路由派发锁 + 精确章节锚点可达 + 脚本路径挂载 + 运行时零免责废话锁');
  for (const e of errors) console.log(`ERROR: ${e}`);
  console.log(errors.length ? 'RESULT: FAIL' : 'RESULT: PASS');
  return errors.length ? 1 : 0;
}

function checkScript(scriptPath, era) {
  const absPath = path.resolve(scriptPath);
  if (!fs.existsSync(absPath)) {
    console.error(`Script file not found: ${absPath}`);
    return 1;
  }
  const lines = fs.readFileSync(absPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const issues = [];
  let currentScene = '';
  let castList = [];
  let hasCast = false;
  let sceneCount = 0;
  let tableMode = false;

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('```')) continue;

    for (const c of CLICHES) {
      if (raw.includes(c)) {
        issues.push(`L${ln} [抽象废话预警]: 命中禁用套话「${c}」，请改为具体可拍动作`);
      }
    }

    if (raw.startsWith('△')) {
      for (const pat of CLIPPING_PATTERNS) {
        if (pat.re.test(raw)) {
          issues.push(`L${ln} [AIGC防穿模预警]: ${pat.msg}`);
        }
      }
    }

    if (raw.startsWith('|') && /^\|\s*\*?\*?S\d+/i.test(raw)) {
      tableMode = true;
      sceneCount++;
      const cols = raw.slice(1, -1).split('|').map((c) => c.trim());
      if (cols.length >= 3) {
        const visualCol = cols[1];
        const audioCol = cols[2];
        for (const pat of CLIPPING_PATTERNS) {
          if (pat.re.test(visualCol)) {
            issues.push(`L${ln} [AIGC防穿模预警]: ${pat.msg}`);
          }
        }
        scanEraWords(audioCol, ln, era, issues);
      }
      continue;
    }

    if (/^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场)\s+.+/.test(raw)) {
      currentScene = raw;
      castList = [];
      hasCast = false;
      tableMode = false;
      sceneCount++;
      continue;
    }
    if (/^【段落\s*\d+/.test(raw)) {
      currentScene = raw;
      castList = [];
      hasCast = false;
      tableMode = false;
      sceneCount++;
      continue;
    }
    const mCast = raw.match(/^人物\s*[:：]\s*(.+)$/);
    if (mCast) {
      hasCast = true;
      const cleaned = mCast[1].replace(/（[^）]*）|\([^)]*\)/g, '');
      castList = cleaned.split(/[\s、，,/]+/).filter(Boolean);
      continue;
    }

    if (/^[^\s:：△【】（()）]{1,12}\s+(VO|OS|O\.S\.)\s*[:：]/i.test(raw)) {
      issues.push(`L${ln} [说话人通道歧义]: 请将 VO/OS 放入圆括号内（如 角色名（VO）：），避免下游误生成幽灵角色`);
      continue;
    }

    const mSp = raw.match(/^([^\s:：△【】（()）]{1,12})\s*([（(][^）)]*[）)])?\s*[:：]\s*(.+)$/);
    if (currentScene && !tableMode && mSp) {
      const speaker = mSp[1].trim();
      const channelTag = (mSp[2] || '').trim();
      const speech = mSp[3].trim();
      if (['时间', '地点', '传播目标', '预估发声字数'].includes(speaker)) continue;

      if (['内心', '主角', '角色'].includes(speaker)) {
        issues.push(`L${ln} [非具名说话人违规]: 严禁用「${speaker}」当说话人，请改为真实角色名（如 角色名（OS）：）`);
      } else if (speaker === '旁白' && !/VO/i.test(channelTag)) {
        issues.push(`L${ln} [旁白标记不规范]: 无具名旁白请统一写作「旁白（VO）：」以区分实体角色`);
      } else if (speaker !== '旁白' && hasCast && castList.length > 0 && !castList.includes(speaker)) {
        issues.push(`L${ln} [出场名单漏标]: 场景「${currentScene}」中角色「${speaker}」未列入本场「人物：」行`);
      }

      scanEraWords(speech, ln, era, issues);
    }
  }

  console.log(`=== 星应剧本 3.5 · 成稿格式与语感体检报告${era ? ` (era=${era})` : ''} ===`);
  console.log(`识别场次/镜段数 : ${sceneCount}`);
  for (const it of issues) console.log(`  - ${it}`);
  console.log(issues.length ? `RESULT: WARN (${issues.length} 项待修正)` : 'RESULT: PASS（场标、出场名单、通道防歧义及反套话扫描全部通过）');
  return issues.length ? 1 : 0;
}

const args = process.argv.slice(2);
let era = '';
let target = '';
let isSelf = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--self-check') isSelf = true;
  else if (args[i] === '--era') era = (args[++i] || '').toLowerCase();
  else if (!args[i].startsWith('-')) target = args[i];
}
if (!target && !isSelf) isSelf = true;
process.exit(isSelf ? selfCheck() : checkScript(target, era));
