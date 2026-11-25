# 专项检索总索引

每个专项分为基础定义和有适用条件的应用场景。从当前方法中的具体画面问题进入，按需定位条目。来源见[登记](../lai-yuan/quan-wei-lai-yuan.md)。知识状态区分技术参照、主创个案与本地条件化建议。

## 读取方式

已知编号直接打开对应条目。只知道问题时先用下方高频入口，再进入相关专项。核对条目的条件、排除和替代。

可用 Node.js 从摄影与画面目录执行 `node jiao-ben/jian-suo.cjs 过肩 反打`（或直接从 Skill 根目录运行统一中文入口 `node 工具/检索.cjs 摄影 "两人窗边过肩反打"`）。检索同时覆盖基础定义和应用，支持中文整句，加 `--ling-yu/--domain jing-tou-zu-zhi` 限域，加 `--xiang-xi/--detail` 查看细节。编号精确命中优先，应用排除词单独显示提示。

## 导演问题入口

“镜头太平”“缺少拍摄理由”先由[03 导演决策](../../../流程/03-分镜/流程.md#director-decision)确定本轮观看损失，不自动等同于缺推近、特写或斜角。知识提供条件化候选，采用决定写回源镜十四项和内部记录，04按[导演继承](../../../流程/04-提示词/流程.md#director-inheritance)落实；已有可执行采用版不因理由未记录而重排。

| 问题 | 查阅候选 |
|---|---|
| 不知何时变速、慢镜软绵或提速无力 | [03常速默认与少量例外](../../../流程/03-分镜/流程.md#playback-design)，候选[TIM-A07](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a07)、[TIM-A11](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a11)及[速度执行边界](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#playback-guidance) |
| 漏插入、关键细节或人物特写没给 | [03细节覆盖](../../../流程/03-分镜/流程.md#detail-coverage)，候选[ORG-A08](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a08)、[SIZ-A01](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a01)、[SIZ-A05](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a05) |
| 同景别跳切、相邻镜太像 | [03近似切口](../../../流程/03-分镜/流程.md#cut-continuity)，候选[SIZ-A08](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a08)，正常同景别反打不自动排除 |
| 重点不清、注意力乱、先看哪里 | [CMP-A01](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a01)、[CMP-A03](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a03)，方法见[观看顺序](../../../流程/03-分镜/流程.md#attention-design) |
| 反应没拍到、信息与回应脱节 | [ORG-A09](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a09) |
| 揭示太早、人物像预知 | [ORG-A14](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a14)、[ORG-A17](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a17) |
| 运镜没意义、推拉过多或复合运动过载 | [MOV-A01](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a01)、[MOV-A02](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a02)、[MOV-A05](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a05)、[MOV-A10](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a10)、[MOV-A12](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a12) |

场景词只帮助召回，不是“情绪到拍法”的唯一处方。无脚本环境时直接用本页和[导演问题检索](../../../流程/知识检索与采用.md#director-lookup)定位正文。

## 专业入口
|专项|基础定义|应用场景|定义数|应用数|
|---|---|---|---|---|
|镜头组织|[定义](../zhuan-xiang/jing-tou-zu-zhi/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md)|20|24|
|景别|[定义](../zhuan-xiang/jing-bie/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md)|10|8|
|机位与角度|[定义](../zhuan-xiang/ji-wei-yu-jiao-du/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md)|12|11|
|运镜与焦点|[定义](../zhuan-xiang/yun-jing-yu-jiao-dian/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md)|15|21|
|构图|[定义](../zhuan-xiang/gou-tu/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md)|12|10|
|空间与调度|[定义](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md)|12|10|
|相机与成像|[定义](../zhuan-xiang/xiang-ji-yu-cheng-xiang/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/xiang-ji-yu-cheng-xiang/ying-yong-chang-jing-ku.md)|15|8|
|景深与空间感|[定义](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md)|12|9|
|渲染与质感|[定义](../zhuan-xiang/xuan-ran-yu-zhi-gan/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md)|12|8|
|光线|[定义](../zhuan-xiang/guang-xian/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md)|33|20|
|色彩|[定义](../zhuan-xiang/se-cai/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/se-cai/ying-yong-chang-jing-ku.md)|12|8|
|音源与音效|[定义](../zhuan-xiang/yin-yuan-yu-yin-xiao/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md)|16|12|
|时间与节奏|[定义](../zhuan-xiang/shi-jian-yu-jie-zou/ji-chu-ding-yi-ku.md)|[场景](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md)|14|11|

## 高频组合

| 画面问题 | 条目 |
|---|---|
| 空间站位缺失、建立本场空间基准 | 先执行[空间基准与调度](../../../流程/空间基准与调度.md#space-baseline)，再按疑问查 [SPA01](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa01)、[SPA03](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa03)、[SPA-A01](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a01)；已定空间漏写走[04 空间继承核对](../../../流程/04-提示词/流程.md#space-inheritance) |
| 走近取物、距离不够、路线受阻 | [SPA-A02](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a02)、[SPA03](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa03)、[SPA06](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa06)、[SPA07](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa07) |
| 画外留场者、隔镜再出现、第三人位置 | [SPA-A09](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a09)、[SPA09](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa09)，状态写回[空间记录](../../../流程/空间基准与调度.md#space-transition) |
| 双人、过肩、反打 | [ORG-A02](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a02)、[ORG-A03](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a03)、[ANG-A01](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md#ang-a01)、[ANG-A03](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md#ang-a03)、[CMP-A02](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a02)、[DEP-A04](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a04)、[LIT-A01](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md#lit-a01) |
| 正面特写、侧脸、关键反应 | [ANG01](../zhuan-xiang/ji-wei-yu-jiao-du/ji-chu-ding-yi-ku.md#ang01)、[ANG03](../zhuan-xiang/ji-wei-yu-jiao-du/ji-chu-ding-yi-ku.md#ang03)、[SIZ-A01](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a01)、[ORG-A09](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a09)、[MOV-A01](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a01)、[DEP-A01](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a01) |
| 换机位后的画面投影、场内方向与持物 | [SPA01](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa01)、[SPA02](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa02)、[SPA08](../zhuan-xiang/kong-jian-yu-diao-du/ji-chu-ding-yi-ku.md#spa08)、[ORG15](../zhuan-xiang/jing-tou-zu-zhi/ji-chu-ding-yi-ku.md#org15)、[ORG16](../zhuan-xiang/jing-tou-zu-zhi/ji-chu-ding-yi-ku.md#org16) |
| 跨轴、换侧或位移改变轴线 | [ORG-A04](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a04)、[ORG-A05](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a05)、[ORG-A06](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a06)、[SPA-A07](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a07) |
| 多人对话、圆桌位置 | [ORG-A07](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a07)、[CMP-A03](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a03)、[SPA-A09](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a09) |
| 打斗的动作链、取景和节奏 | [ORG-A10](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a10)、[ORG-A11](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a11)、[ORG-A12](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a12)、[SIZ-A02](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a02)、[MOV-A08](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a08)、[MOV-A21](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a21)、[SPA-A06](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a06)、[DEP-A06](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a06)、[LIT-A07](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md#lit-a07)、[SND-A07](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a07)、[TIM-A07](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a07)、[TIM-A11](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a11) |
| 追逐、跟拍或转弯 | [ORG-A13](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a13)、[MOV-A03](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a03)、[MOV-A06](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a06)、[SPA-A03](../zhuan-xiang/kong-jian-yu-diao-du/ying-yong-chang-jing-ku.md#spa-a03) |
| 操作、教程或产品细节 | [ORG-A15](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a15)、[SIZ-A03](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a03)、[SIZ-A04](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a04)、[SIZ-A05](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a05)、[CMP-A10](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a10)、[DEP-A02](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a02)、[DEP-A07](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a07)、[REN-A03](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md#ren-a03)、[REN-A04](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md#ren-a04)、[COL-A03](../zhuan-xiang/se-cai/ying-yong-chang-jing-ku.md#col-a03) |
| 静态对白、画外续声、边做边说 | [ORG-A01](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a01)、[MOV-A10](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a10)、[SND-A01](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a01)、[SND-A03](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a03)、[SND-A06](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a06)、[SND-A09](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a09)、[TIM-A01](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a01)、[TIM-A02](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a02)、[TIM-A06](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a06) |
| 悬念或恐怖中的信息可见性 | [ORG-A14](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a14)、[ORG-A20](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a20)、[DEP-A05](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a05)、[MOV-A15](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a15)、[ANG-A09](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md#ang-a09)、[SND-A11](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a11) |
| 牵引尾随、前景遮挡、道具拉远与半弧绕拍 | [MOV-A13](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a13)、[MOV-A14](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a14)、[MOV-A16](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a16)、[MOV-A17](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a17)、[MOV-A18](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a18)、[MOV-A19](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a19)、[MOV-A20](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a20)、[MOV-A21](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a21) |
| 特殊视点（顶拍/监控/门缝/桌面/水下）与反射碎镜 | [ANG-A10](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md#ang-a10)、[ANG-A11](../zhuan-xiang/ji-wei-yu-jiao-du/ying-yong-chang-jing-ku.md#ang-a11)、[DEP-A09](../zhuan-xiang/jing-shen-yu-kong-jian-gan/ying-yong-chang-jing-ku.md#dep-a09) |
| 喜剧、亲密、对峙的观察重点 | [ORG-A17](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a17)、[ORG-A18](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a18)、[ORG-A19](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a19) |
| 无对白、口播、回忆、舞蹈 | [ORG-A21](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a21)、[ORG-A22](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a22)、[ORG-A23](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a23)、[ORG-A24](../zhuan-xiang/jing-tou-zu-zhi/ying-yong-chang-jing-ku.md#org-a24)、[SND-A12](../zhuan-xiang/yin-yuan-yu-yin-xiao/ying-yong-chang-jing-ku.md#snd-a12) |
| 竖屏、横竖改版或画面文字 | [SIZ-A07](../zhuan-xiang/jing-bie/ying-yong-chang-jing-ku.md#siz-a07)、[CMP-A08](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a08)、[CMP-A07](../zhuan-xiang/gou-tu/ying-yong-chang-jing-ku.md#cmp-a07) |
| 超时、渐紧与收束 | [MOV-A12](../zhuan-xiang/yun-jing-yu-jiao-dian/ying-yong-chang-jing-ku.md#mov-a12)、[TIM-A02](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a02)、[TIM-A04](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a04)、[TIM-A05](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a05)、[TIM-A08](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a08)、[TIM-A09](../zhuan-xiang/shi-jian-yu-jie-zou/ying-yong-chang-jing-ku.md#tim-a09) |
| 风格基准与段内光色 | [COL-A01](../zhuan-xiang/se-cai/ying-yong-chang-jing-ku.md#col-a01)、[REN-A01](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md#ren-a01)、[REN-A05](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md#ren-a05)、[REN-A06](../zhuan-xiang/xuan-ran-yu-zhi-gan/ying-yong-chang-jing-ku.md#ren-a06)、[LIT-A01](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md#lit-a01)、[LIT-A03](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md#lit-a03)、[LIT-A12](../zhuan-xiang/guang-xian/ying-yong-chang-jing-ku.md#lit-a12) |

## 非穷尽范围
本库覆盖常见关系、动作、声音与视觉条件，不能保证所有项目。特殊镜头、非常规光学、精确设备规格、复杂空间数值需相应依据或实测。技术事实与软件实现不同，真实摄影规则正确不代表AI模型必然遵循；不把一次生成偏差反向写成光学定律。

场景词如「对峙」「吵架」可直接查询，映射维护在[场景词表](chang-jing-ci.json)。过肩候选用于表现已定站位与视线，冲突候选用于核对已有关系转折。常规文本输出会报告候选总数，必要时加 `--shu-liang 30` 扩大显示范围。
