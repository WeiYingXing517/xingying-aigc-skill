# 研发维护规范（仅开发者阅读，不加载至运行时上下文）

## 一、 架构红线（修改必守）

1. **根目录唯一入口**：`SKILL.md` 直接位于包根目录，行数严格控制在 **120 行以内**，只负责双轨判断、通道锁定与阶段派发，不塞具体写作讲义。
2. **禁止横向互跳**：`core/`、`channels/`、`examples/`、`templates/` 四个目录下的 Markdown 文件**严禁出现指向其他 `.md` 的本地链接**。一切按需加载统一由 `SKILL.md` 单向点名，确保上下文体积永远可控。
3. **禁止免责套话回流**：所有「不承诺完播率」「不保证跨模型效果」「尚未完成回归」等研发说明只允许记录在 `dev/` 目录，严禁写入运行时文件污染模型创作心态。
4. **通道物理隔离**：新增或修改某一载体（如竖屏短剧、商业广告）的规则时，只改对应的 `channels/ch-*.md` 与 `examples/samples-*.md`，禁止在通用底座塞入带大量豁免反例的混合条款。

---

## 二、 每次修改后的必跑检查

1. **包结构与架构防线自检**：
   - Node.js：`node scripts/check_script_format.cjs --self-check`
   - PowerShell：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check_script_format.ps1 -SelfCheck`
   - Python：`python scripts/check_script_format.py --self-check`
2. **跨通道真实出稿抽检**：按 [regression-cases.md](regression-cases.md) 跑对应通道的真实生成与估时脚本校验，禁止只改文档不跑实测样本。
