# 官方资料与设计适用边界

以下仅采纳已读官方文档支持的概念，不把某软件节点或数值变成通用分镜规定。核对日期为2026年11月7日；网页的版本标签不作为本方案指定的软件版本。

## 局部空间与场景空间

Niagara官方把粒子相对发射器或全局空间的行为区分开。[Epic：Emitter Settings](https://dev.epicgames.com/documentation/en-us/unreal-engine/emitter-settings-reference-for-niagara-effects-in-unreal-engine)

**用于本Skill的设计推导：** 来源跟随手掌，不代表已释放烟雾必须跟随；附着部分与脱离部分分别说明空间规则。这里只借用关系区分，不要求用户使用Niagara。

## 产生新内容与已有内容消退

Houdini Pyro文档分别描述来源注入、运动和密度消散。[SideFX：Understanding how pyro works](https://www.sidefx.com/docs/houdini/pyro/background)

**设计推导：** “停止喷烟”只确定不再产生新烟，旧烟按已设计方式继续变化。是否立刻消失属于另一个需要有依据的结束规则。停止、残留、移出画面不能合并为“无效果”。

## 发亮、光晕与照明

Epic文档区分自发亮外观、环境照明的设置条件，并说明Bloom可独立调整。[Epic：Emissive Material Input](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-emissive-material-input-in-unreal-engine)

Bloom文档讨论亮部周围的光晕表现。[Epic：Bloom](https://dev.epicgames.com/documentation/en-us/unreal-engine/bloom-in-unreal-engine)

**设计推导：** 写清“本体发亮”“周围光晕”“环境受光”三件事。不能从“亮”字自动推导整场照明，也不能说所有发光效果都绝不照明；根据项目规则选择，缺依据则注明。具体受光交完整分镜。

## 外形与作用可分开交接

Niagara渲染器文档分别提供光、网格、条带、精灵等呈现类型。[Epic：Niagara Renderers](https://dev.epicgames.com/documentation/en-us/unreal-engine/render-module-reference-for-niagara-effects-in-unreal-engine)

**设计推导：** 光带、实体碎片、雾状体和环境照明不是一个“炫酷能量”字段，按需要分别描述。不照搬渲染器技术字段，更不把技术类型当成添加效果的授权。

本轮Blender手册页面访问失败，未将未成功读取的内容作为方案事实依据。没有检索或核实任何视频生成平台参数，本方案不承诺某模型能稳定执行这些效果。
