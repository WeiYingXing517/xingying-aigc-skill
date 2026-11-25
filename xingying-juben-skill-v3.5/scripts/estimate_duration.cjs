#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const RATES = {
  'short-drama': { min: 4.2, max: 4.8, clause: 18, action: 2.2, scene: 1.2 },
  'series':      { min: 3.5, max: 4.0, clause: 25, action: 3.0, scene: 2.0 },
  'film':        { min: 3.2, max: 3.8, clause: 25, action: 3.8, scene: 2.5 },
  'commercial':  { min: 4.5, max: 5.0, clause: 18, action: 1.5, scene: 0.5 },
  'narrated':    { min: 4.5, max: 5.2, clause: 18, action: 1.5, scene: 0.8 },
};

function parseArgs(argv) {
  let filePath = '';
  let channel = 'short-drama';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--channel' || arg === '-c') {
      channel = argv[++i] || channel;
    } else if (!arg.startsWith('-')) {
      filePath = arg;
    }
  }
  return { filePath, channel };
}

function countSpoken(text) {
  const clean = text.replace(/（[^）]*）|\([^)]*\)|【[^】]*】/g, '');
  const matches = clean.match(/[\p{L}\p{N}]/gu);
  return matches ? matches.length : 0;
}

function checkClauses(text, lineNo, limit, out) {
  const clean = text
    .replace(/^[（(][^）)]*[）)]\s*[:：]?\s*/, '')
    .replace(/（[^）]*）|【[^】]*】/g, '');
  const parts = clean.split(/[，。！？；：、,.!?;:—…]+/);
  for (const part of parts) {
    const matches = part.match(/[\p{L}\p{N}]/gu);
    const len = matches ? matches.length : 0;
    if (len > limit) {
      out.push(`L${lineNo} (${len}字 > ${limit}字上限): ${part.trim()}`);
    }
  }
}

function main() {
  const { filePath, channel } = parseArgs(process.argv.slice(2));
  if (!filePath || !RATES[channel]) {
    console.error('Usage: node scripts/estimate_duration.cjs <script_path> [--channel short-drama|series|film|commercial|narrated]');
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const cfg = RATES[channel];
  const lines = fs.readFileSync(absPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);

  let spokenChars = 0;
  let actionBlocks = 0;
  let sceneCount = 0;
  const longLines = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('>') || raw.startsWith('```') || raw.startsWith('~~~')) {
      continue;
    }

    if (raw.startsWith('|') && raw.endsWith('|')) {
      if (/^\|\s*[-:]+\s*\|/.test(raw) || /镜号与秒段|画面动作/.test(raw)) continue;
      const cols = raw.slice(1, -1).split('|').map((c) => c.trim());
      if (cols.length >= 3) {
        sceneCount++;
        const cCount = countSpoken(cols[2]);
        spokenChars += cCount;
        if (cCount === 0 && cols[1]) actionBlocks += 1;
        checkClauses(cols[2], lineNo, cfg.clause, longLines);
      }
      continue;
    }

    if (/^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场|【段落\s*\d+)/.test(raw)) {
      sceneCount++;
      continue;
    }
    if (/^(第\s*\d+\s*集|人物|【状态锚点|【视角|【字幕|【花字|【音效|【系统|【闪回)/.test(raw)) {
      continue;
    }
    if (raw.startsWith('△')) {
      actionBlocks += 1;
      continue;
    }

    const m = raw.match(/^([^\s:：△【】（()）]{1,16})\s*(?:[（(][^）)]*[）)])?\s*[:：]\s*(.+)$/);
    if (m) {
      const speech = m[2].trim();
      spokenChars += countSpoken(speech);
      checkClauses(speech, lineNo, cfg.clause, longLines);
    }
  }

  sceneCount = Math.max(sceneCount, 1);
  const round1 = (n) => Math.round(n * 10) / 10;
  const speechMin = round1(spokenChars / cfg.max);
  const speechMax = round1(spokenChars / cfg.min);
  const actMin = round1(actionBlocks * cfg.action * 0.55);
  const actMax = round1(actionBlocks * cfg.action * 0.85);
  const trans = round1(sceneCount * cfg.scene);
  const totalMin = round1(speechMin + actMin + trans);
  const totalMax = round1(speechMax + actMax + trans);

  console.log('=== 星应剧本 3.5 · 时长与气口测算报告 ===');
  console.log(`通道模式   : ${channel} (语速基准 ${cfg.min}~${cfg.max} 字/秒 | 单句气口上限 ${cfg.clause} 字)`);
  console.log(`统计概览   : 场次/镜段数=${sceneCount} | 有效发声字数=${spokenChars} 字 | 动作段落数=${actionBlocks}`);
  console.log(`分项耗时   : 发声对白 ${speechMin}~${speechMax}s + 非重叠动作 ${actMin}~${actMax}s + 转场停顿 ${trans}s`);
  console.log(`预估总时长 : ${totalMin} ~ ${totalMax} 秒 (约 ${(totalMin / 60).toFixed(1)} ~ ${(totalMax / 60).toFixed(1)} 分钟)`);
  if (longLines.length > 0) {
    console.log(`\n[气口超长预警] 发现 ${longLines.length} 处单句连续字数超限，建议拆短或插入动作气口：`);
    for (const item of longLines) console.log(`  - ${item}`);
  } else {
    console.log('[气口检查] PASS（所有台词单句长度均符合当前通道气口上限）');
  }
}

main();
