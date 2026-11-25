const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
const entry = read('SKILL.md');
const script01 = read('流程/01-剧本理解/流程.md');
const video = read('流程/04-提示词/流程.md');
const videoTemplate = read('流程/04-提示词/模板.md');
const shots = read('流程/03-分镜/流程.md');
const shotsTemplate = read('流程/03-分镜/模板.md');
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

test('视频统一入口不可绕开，且已移除冗余A双轨', () => {
  assert.match(entry, /04视频统一入口/);
  assert.match(video, /所有视频请求先过此入口/);
  assert.match(video, /实际调用选项卡/);
  assert.match(video, /整场不分段（单块）/);
  assert.match(video, /无交互工具则文字询问并等答复/);
  assert.doesNotMatch(entry + video + shots, /默认走\s*A|无需另排段或弹分段卡|A 与 B 共用段首/);
});

test('主路由直达动作覆盖、表述、保真与交付门槛，01保留署名且首轮合并主色调', () => {
  for (const fragment of ['#action-coverage', '#information-mapping', '#executable-check']) {
    assert.ok(entry.includes(fragment), fragment);
    assert.ok(lookup.includes(fragment), fragment);
  }
  const step = shots.match(/3\. 先按[^\n]+/)[0];
  assert.ok(step.indexOf('#action-coverage') < step.indexOf('逐镜估时'));
  for (const fragment of ['#information-mapping', '#executable-check', '#delivery-gate']) assert.ok(video.includes(fragment));
  assert.match(prose, /每份视频复制块交付前必检/);
  assert.match(entry, /只有产物实际写回并被下游采用才算完成/);
  assert.match(script01, /Weiyx517517/);
  assert.match(script01, /首轮集中确认/);
  assert.doesNotMatch(script01, /主色调参考未明确就留到最后确认/);
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

test('统一视频模板保持纯净块与块外交接分离，使用清晰图片名且03/04完成瘦身', () => {
  const b = videoTemplate.split('### 二、视频可复制块')[1].split('### 三、复制块外')[0];
  const block = b.match(/```text\n([\s\S]*?)```/)[1];
  for (const label of ['本段时长', '参考素材', '全局风格与光色', '场景空间与开场站位', '上一段承接点', '画面约束']) {
    assert.ok(block.includes(`【${label}】`), label);
  }
  assert.match(block, /无字幕，无水印，无平台角标/);
  assert.ok(block.indexOf('【画面约束】') > block.indexOf('分镜[源镜号]'), '画面约束应后置块尾不抢开头权重');
  assert.doesNotMatch(block, /登记图\[图片ID|本段结束与后续交接/, '内部台账与段末交接不应混入视频生成块');
  assert.match(videoTemplate.split('### 三、复制块外')[1], /【本段结束与后续交接】/);
  assert.match(videoTemplate, /单镜直出简化版/);
  assert.match(block, /清晰的图片名称/);
  assert.match(block, /摄影机、特效各自用具体主语/);
  assert.match(block, /角色名\]的音色/);
  assert.match(block, /画面文字.*无则整项省略/);
  assert.match(videoTemplate, /05、06、07、08，块内必须有四份完整分镜正文/);
  assert.doesNotMatch(video + videoTemplate, /把 \[共用段首\]/);
  assert.ok(Buffer.byteLength(shots, 'utf8') < 22000, '03主流程应瘦身至22KB以内');
  assert.ok(Buffer.byteLength(video, 'utf8') < 24000, '04主流程应瘦身至24KB以内');
  assert.match(shotsTemplate, /不填字面“无”/);
  assert.match(shotsTemplate, /机位方位、高度与俯仰｜焦段与景深/);
  assert.match(shotsTemplate, /不凭空编光圈/);
  assert.match(read('流程/04-提示词/表演光声与接缝细化.md'), /\*\*镜头与构图\*\*/);
  assert.doesNotMatch(read('流程/04-提示词/表演光声与接缝细化.md'), /\*\*动态时间轴\*\*|\*\*尾帧与转场\*\*/);
  assert.match(video, /04 流程内强制前置：先跑完整内部十四栏分镜/);
  assert.match(video, /沿用正常图\+文字写清状态/);
  assert.match(video, /角色与场景固定外观（纯文字锁）/);
  assert.match(shots, /动笔前 5 问推演/);
  assert.match(shots, /后果不归零/);
  assert.match(prose, /抽象词物理化与特效四维显形/);
  assert.match(prose, /四维物理显形法则/);
  const styleLock = read('流程/文风锁与黄金样板.md');
  assert.match(styleLock, /弱模型防降智 4 条硬底线/);
  assert.match(styleLock, /词动铆钉/);
  assert.match(styleLock, /贯通式双题材黄金样板/);
  assert.match(entry, /文风锁与黄金样板\.md/);
  assert.match(shotsTemplate, /文风锁与黄金样板\.md/);
  assert.doesNotMatch(shotsTemplate, /两人未位移|切出时两人位置与接触状态未变/);
  assert.match(videoTemplate, /文风锁与黄金样板\.md/);
  assert.match(read('流程/03-分镜/排镜与摄影细则.md'), /冗余动作过渡与运镜强化/);
  const asset02 = read('流程/02-资产清单/流程.md');
  assert.match(asset02, /声音资产（声纹锁图）与人物特征对齐/);
  assert.match(asset02, /参考音色优先/);
  assert.match(asset02, /声纹锁图一键生图提示词模板/);
  assert.match(videoTemplate, /声纹锁绑定/);
  assert.match(videoTemplate, /画面中严禁出现声波图形或文字/);
  assert.match(videoTemplate, /逐镜「音频与对白」绝不重复绑定/);
  assert.match(video, /角色音色只在块首人物后缀绑定一次，逐镜不重复/);
  const space = read('流程/空间基准与调度.md');
  assert.match(space, /多人站位两级锚定法/);
  assert.match(space, /180° 同侧反打投影 4 句硬口诀/);
  assert.match(space, /角色-专属背板地标锁/);
  assert.match(space, /禁用东西南北进视频块/);
  assert.doesNotMatch(shotsTemplate, /东西方向|桌西端|西南后方/);
  assert.match(video, /分段切口红绿灯/);
  assert.match(video, /必须写透人物开场状态与人物语气状态/);
  assert.match(video, /禁写已完成过去动词/);
  assert.match(videoTemplate, /人物开场状态/);
  assert.match(videoTemplate, /人物语气状态/);
  assert.match(videoTemplate, /人物语气与情绪余韵/);
  assert.match(videoTemplate, /下段衔接工艺/);
  assert.match(script01, /读透剧本 5 层透视法/);
  assert.match(script01, /潜台词与权力翻转/);
  assert.match(script01, /一针见血读剧快照/);
  assert.match(script01, /按节拍归组与权重分级/);
  const novelSample = read('流程/01-剧本理解/小说转译与读剧样板.md');
  assert.match(novelSample, /四路可拍化转译器/);
  assert.match(novelSample, /防穿帮三项排雷/);
  assert.match(novelSample, /导演级深度透视/);
  assert.match(shots, /承接 01 戏眼、片型细分通道与潜台词/);
  assert.match(script01, /片型细分方向/);
  assert.match(script01, /产品TVC\/卖点演示/);
  assert.match(script01, /第一项必须给出.*具体推荐色调/);
  assert.match(video, /Weiyx517517/);
  const singleShotSec = videoTemplate.split('### 单镜直出简化版')[1];
  assert.match(singleShotSec, /续镜写清0秒人物开场状态与人物语气状态/);
  assert.match(singleShotSec, /非末镜保持动作光影延续至末帧/);
  const contract = read('流程/项目记录契约.md');
  assert.match(contract, /set-coverage/);
  assert.match(contract, /"stage":"04V"/);
  assert.doesNotMatch(contract, /"label":"图2"/);
  assert.doesNotMatch(shotsTemplate + styleLock, /大段K|大段 1-分镜/);
  assert.match(read('流程/03-分镜/排镜与摄影细则.md'), /不强行包裹「成片大段」/);
  assert.match(videoTemplate, /分段 1、分段 2/);
  assert.match(videoTemplate, /\*\*分段\[编号\]｜成片\[起止\]｜段长\[整数秒数，须≤所选上限\]/);
  assert.doesNotMatch(videoTemplate, /\*\*大段\[编号\]|大段 1、大段 2/);
  assert.match(video, /所选秒数默认即每段硬上限/);
  assert.match(video, /宁短勿超/);
  assert.match(video, /自由分段按自然转折切分但仍严格/);
  assert.match(video, /单镜本身超/);
  assert.match(video, /按秒分段每段总长严格/);
  const settings = read('流程/制作设置与强制确认.md');
  assert.match(settings, /按秒排段时所选秒数默认即硬上限/);
  assert.match(settings, /仅用户明确要求大段才出整场单块/);
  assert.doesNotMatch(settings, /未给上限不自设/);
  assert.doesNotMatch(lookup, /前置约束/);
  assert.match(lookup, /块尾画面约束与空栏目/);
  assert.doesNotMatch(shotsTemplate, /实际标签/);
  assert.match(shotsTemplate, /绑定时采用清晰图片名称/);
  assert.match(shotsTemplate, /声纹锁图\/声纹特征词/);
  assert.doesNotMatch(video, /标签真实/);
  assert.match(video, /素材名与绑定真实/);
  assert.doesNotMatch(videoTemplate, /part-b-分段视频提示词模板/);
  assert.match(shots, /### 导演决策执行 5 步/);
  assert.match(styleLock, /样板 C：续段承接黑红榜/);
  assert.match(styleLock, /不提前慢停、不淡黑、人物不看镜头/);
  const detail04 = read('流程/04-提示词/表演光声与接缝细化.md');
  assert.match(detail04, /声纹锁图/);
  assert.match(detail04, /180° 同侧反打投影 4 句硬口诀/);
  assert.match(detail04, /人物开场状态.*人物语气状态/);
  assert.match(detail04, /按秒分段时所选秒数默认即硬上限/);
  const diag = read('流程/04-提示词/成片症状诊断.md');
  assert.match(diag, /声波图\/文字跑进画面/);
  assert.match(diag, /续段 0 秒重演上一幕/);
  assert.match(diag, /非末段结尾提前慢停、人物看镜头或淡黑/);
  assert.match(diag, /切近景后背景换房间/);
  const regCases = read('验收/回归用例.md');
  assert.doesNotMatch(regCases, /## v2\.8 调用与成稿回归|## 3\.5 调用与成稿回归/);
  assert.match(regCases, /## 4\.0 调用与成稿回归/);
  assert.match(regCases, /27秒\+6秒=33秒/);
  assert.match(regCases, /TIM-A11/);
  assert.match(entry, /# 星应分镜 4\.0/);
  assert.match(shots, /三式速度坡道/);
  assert.match(shots, /单镜最多 1 次速度转换/);
  assert.match(shots, /爆发提速 vs 过程拉快/);
  assert.match(video, /悬浮微粒双速差或压簧广角后掠介质/);
  assert.match(prose, /真慢速 \/ 升格感/);
  assert.match(prose, /真提速 \/ 爆发冲刺/);
  assert.match(prose, /碰撞顿挫（Hit-stop）/);
  assert.match(read('流程/03-分镜/排镜与摄影细则.md'), /破防三态流转与擦身闪避分段让位/);
  assert.match(read('流程/03-分镜/排镜与摄影细则.md'), /兵种力学与距离克制/);
  assert.match(read('流程/03-分镜/排镜与摄影细则.md'), /mov-a21/);
  assert.match(detail04, /快慢变速与重击命中的声场协同/);
  assert.match(diag, /慢动作软绵像打太极，或提速原地鬼畜无冲劲/);
  assert.match(diag, /打斗像回合制木偶对砍/);
  assert.match(diag, /长枪跳劈变垂直僵坠/);
  assert.match(diag, /大招期间双方傻站读条/);
  assert.doesNotMatch(shotsTemplate + videoTemplate, /240fps|1:2000|0\.02s/);
  const midRev = read('流程/中途建议与局部修订专册.md');
  assert.match(entry, /进度锚点与中途建议防失忆协议/);
  assert.match(entry, /【星应进度锚点】/);
  assert.match(entry, /中途建议与局部修订专册\.md/);
  assert.doesNotMatch(block, /星应进度锚点/, '进度锚点条必须置于复制块外，严禁污染视频提示词块');
  assert.match(midRev, /双保险防失忆机制/);
  assert.match(midRev, /导演感口语建议 → 物理视听动作转译矩阵/);
  assert.match(midRev, /五链涟漪追平与五项底线重锚/);
  assert.match(midRev, /分阶段标准交付粒度 ＋ 自动续跑原流程/);
  assert.match(settings, /弹卡等待期插话与挂起重弹规则/);
  assert.match(shots, /中途建议与局部修订专册\.md/);
  assert.match(video, /中途建议与局部修订专册\.md/);
  assert.match(lookup, /中途建议与局部修订专册\.md/);
  assert.match(read('流程/项目交接与恢复.md'), /中途建议与局部修订专册\.md/);
  const transitions = read('流程/转场与运镜衔接专册.md');
  assert.match(transitions, /三层转场观与防炫技铁律/);
  assert.match(transitions, /分镜标术语，进 04 复制块必转物理画面/);
  assert.match(transitions, /运镜能量衔接五模式/);
  assert.match(transitions, /固定机位，镜头完全静止，不推拉、不摇移/);
  assert.match(transitions, /全流程严禁默认首尾帧/);
  assert.match(transitions, /仅当用户主动提供首尾帧素材或明确要求/);
  assert.doesNotMatch(video + videoTemplate + detail04 + diag + shots, /务必截.*末帧作下段首帧|块外标「截上段末帧/);
  assert.match(entry, /转场与运镜衔接专册\.md/);
  assert.match(lookup, /转场与运镜衔接专册\.md/);
  assert.match(shots, /转场与运镜衔接专册\.md/);
  assert.match(shots, /完整演一遍复核/);
  assert.match(video, /转场与运镜衔接专册\.md/);
  assert.match(video, /跨段新增前段未入画的具名角色/);
  assert.match(space, /头身分离防扭身正对镜头＋封闭场人数封顶锁/);
  assert.match(detail04, /双面小道具正反面朝向锁/);
  assert.match(detail04, /同道具单实例互斥锁/);
  assert.match(detail04, /环境声退让与外语释义隔离/);
  assert.match(diag, /手机背面变发光屏、同道具变两件/);
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
  assert.match(video, /缺设计回 03 对应项，漏写由 04 直接补/);
});
