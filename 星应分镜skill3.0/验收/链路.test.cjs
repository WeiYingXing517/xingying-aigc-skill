const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const entry = read('SKILL.md');
const video = read('流程/04-提示词/流程.md');
const shots = read('流程/03-分镜/流程.md');
const prose = read('流程/04-提示词/可观测写法.md');
const lookup = read('流程/知识检索与采用.md');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const target = path.join(directory, item.name);
  return item.isDirectory() ? walk(target) : [target];
});
const stripCode = text => text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
const anchors = text => {
  const result = new Set([...text.matchAll(/<a\s+id=["']([^"']+)["']/g)].map(match => match[1]));
  const counts = new Map();
  for (const match of stripCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1].trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = counts.get(base) || 0;
    result.add(count ? `${base}-${count}` : base);
    counts.set(base, count + 1);
  }
  return result;
};

test('包内Markdown相对链接与锚点可定位', () => {
  const failures = [];
  for (const file of walk(root).filter(file => file.endsWith('.md'))) {
    const text = stripCode(fs.readFileSync(file, 'utf8'));
    for (const match of text.matchAll(/\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(match[1])) continue;
      const [relative, fragment] = decodeURIComponent(match[1]).split('#');
      const target = relative ? path.resolve(path.dirname(file), relative) : file;
      if (!fs.existsSync(target)) failures.push(`${path.relative(root, file)} -> ${match[1]} 文件缺失`);
      else if (fragment && target.endsWith('.md') && !anchors(fs.readFileSync(target, 'utf8')).has(fragment.toLowerCase())) {
        failures.push(`${path.relative(root, file)} -> ${match[1]} 锚点缺失`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('视频共同入口不可被默认A分支绕开', () => {
  assert.match(entry, /04共同入口/);
  assert.match(video, /所有视频请求先过此入口/);
  assert.match(video, /实际调用选项卡/);
  assert.match(video, /无交互工具则文字询问并等答复/);
  assert.doesNotMatch(entry + video + shots, /默认走\s*A|无需另排段或弹分段卡/);
});

test('主路由直达动作覆盖、表述、保真与交付门槛', () => {
  for (const fragment of ['#action-coverage', '#information-mapping', '#executable-check']) {
    assert.ok(entry.includes(fragment), fragment);
    assert.ok(lookup.includes(fragment), fragment);
  }
  const step = shots.match(/3\. 先按[^\n]+/)[0];
  assert.ok(step.indexOf('#action-coverage') < step.indexOf('逐镜估时'));
  for (const fragment of ['#information-mapping', '#executable-check', '#delivery-gate']) assert.ok(video.includes(fragment));
  assert.match(prose, /每份视频复制块交付前必检/);
  assert.match(entry, /只有产物实际写回并被下游采用才算完成/);
});

test('自然分段后局部增减替代只压缩和凑整数', () => {
  assert.match(video, /自然分段优先/);
  assert.match(video, /局部增减，不机械取整/);
  assert.match(video, /14\.6秒/);
  assert.match(video, /0\.4秒/);
  assert.match(video, /0\.6秒/);
  assert.match(video, /按镜4\.6秒且镜长锁定/);
  assert.doesNotMatch(video, /时长不得延长|只准合理压缩|强行贴合|B 仅在允许的贴合模式下合理压缩/);
});

test('B模板自含前置、空间、完整镜头和段末交接', () => {
  const b = video.split('### B 可复制块')[1].split('<a id="part-6-分镜图提示词模板">')[0];
  const block = b.match(/```text\n([\s\S]*?)```/)[1];
  for (const label of ['固定约束', '本段信息', '素材绑定', '全局信息', '场景空间与本段开场站位', '上一段承接点', '本段结束与后续交接']) {
    assert.ok(block.includes(`【${label}】`), label);
  }
  assert.match(block, /无字幕，无水印，无平台角标/);
  assert.match(block, /摄影机、特效用各自具体主语/);
  assert.match(block, /角色名\]的音色/);
  assert.match(block, /画面文字.*无则整项省略/);
  assert.match(b, /05、06、07、08必须有四份正文/);
  assert.doesNotMatch(b, /把 \[共用段首\]/);
});

test('无内容省栏与固定约束同时成立，不强配神情', () => {
  assert.match(video, /删去对应栏目及空子项/);
  assert.match(entry, /必要信息缺失不等于不适用/);
  assert.match(video, /必要站位、主语、接触和时间缺失须补/);
  assert.match(video, /不默认禁止必要对白/);
  assert.match(video, /仅对该项和范围改成具体允许内容/);
  assert.doesNotMatch(video, /每位面部可读的参与者至少写一个|面部可读的参与者都写明具体神情/);
});

test('继承源、空间、资产与恢复职责保持连通', () => {
  assert.match(read('流程/02-资产清单/流程.md'), /资产号→稳定对象名→实际文件\/版本/);
  assert.match(read('流程/空间基准与调度.md'), /续段开场=最近有效尾态\+期间明确变化/);
  assert.match(read('流程/项目交接与恢复.md'), /确认或授权来源和范围/);
  assert.match(video, /缺设计回03对应项，漏写由04直接补/);
});
