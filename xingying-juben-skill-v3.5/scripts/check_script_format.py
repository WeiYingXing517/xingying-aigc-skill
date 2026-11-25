"""Validate either the xingying-juben-v3-5 skill package (--self-check) or a screenplay file."""
import argparse
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
HEDGING = ("不承诺完播", "不保证跨模型", "尚未完成发布回归", "缺实际独立运行", "不承诺独创性")
ISOLATED_DIRS = {"core", "channels", "examples", "templates"}
CLICHES = ("命运的齿轮", "气氛瞬间凝固", "空气瞬间凝固", "三分凉薄", "三分讥诮", "展开了一番激烈")
MODERN_STIFF = ("是否", "因此", "从而", "鉴于", "予以", "加以", "可否", "何以", "颇为", "甚为", "然而")
ANCIENT_ANACH = ("逻辑", "机制", "维度", "复盘", "闭环", "赋能", "抓手", "颗粒度", "情绪价值", "经济损失", "心理阴影", "物理意义")


def slugify(title: str) -> str:
    s = re.sub(r"[`*_~]", "", title).strip().lower()
    kept = "".join(ch for ch in s if ch in "-_ " or ch.isalnum())
    return re.sub(r"\s", "-", kept)


def extract_anchors(md_text: str) -> set[str]:
    found: set[str] = set()
    counts: dict[str, int] = {}
    in_fence = False
    for line in md_text.splitlines():
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = re.match(r"^#{1,6}\s+(.+?)\s*#*$", line)
        if m:
            base = slugify(m.group(1))
            c = counts.get(base, 0)
            found.add(base if c == 0 else f"{base}-{c}")
            counts[base] = c + 1
    return found


def self_check() -> int:
    errors: list[str] = []
    entry = ROOT / "SKILL.md"
    skills = list(ROOT.rglob("SKILL.md"))
    if skills != [entry]:
        errors.append(f"Expected single root SKILL.md, found {len(skills)}")

    entry_text = entry.read_text(encoding="utf-8-sig")
    entry_lines = entry_text.splitlines()
    if len(entry_lines) > 120:
        errors.append(f"SKILL.md exceeds 120-line budget ({len(entry_lines)} lines)")
    if not re.match(r"\A---\r?\nname:\s*xingying-juben-v3-5\r?\ndescription:\s*.+\r?\n---", entry_text):
        errors.append("Invalid SKILL.md YAML frontmatter (expected name: xingying-juben-v3-5)")

    md_files = sorted(ROOT.rglob("*.md"))
    link_count = 0
    anchor_count = 0
    for path in md_files:
        txt = path.read_text(encoding="utf-8-sig")
        rel_parts = path.relative_to(ROOT).parts
        top_dir = rel_parts[0] if len(rel_parts) > 1 else ""

        if top_dir != "dev":
            for bad in HEDGING:
                if bad in txt:
                    errors.append(f"Banned hedging phrase '{bad}' in runtime file {path.relative_to(ROOT)}")

        for m in re.finditer(r"!?\[[^\]\n]*\]\(([^)\n]+)\)", txt):
            target = m.group(1).strip().strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or (not parsed.path and not parsed.fragment):
                continue
            link_count += 1
            clean_rel = unquote(parsed.path)
            resolved = (path.parent / clean_rel).resolve() if clean_rel else path.resolve()
            if not resolved.is_relative_to(ROOT.resolve()):
                errors.append(f"Link escapes skill root in {path.name}: {target}")
                continue
            elif not resolved.exists():
                errors.append(f"Broken relative link in {path.name}: {target}")
                continue
            if top_dir in ISOLATED_DIRS and clean_rel and clean_rel.endswith(".md"):
                errors.append(f"Lateral cross-link violation in {path.relative_to(ROOT)} -> {target}")
            if parsed.fragment and resolved.suffix.lower() == ".md":
                anchor_count += 1
                frag = unquote(parsed.fragment)
                if frag not in extract_anchors(resolved.read_text(encoding="utf-8-sig")):
                    errors.append(f"Missing heading anchor in {path.name}: {target}")

    required = [
        "channels/ch-short-drama.md", "channels/ch-series.md", "channels/ch-film.md",
        "channels/ch-commercial.md", "channels/ch-narrated.md",
        "core/iron-laws.md", "core/dialogue-surgery.md", "core/adaptation.md", "core/audit-and-risk.md",
        "examples/samples-short-drama.md", "examples/samples-film-series.md", "examples/samples-commercial-vo.md",
        "templates/project-state-schema.md",
        "scripts/estimate_duration.cjs", "scripts/check_script_format.cjs",
    ]
    for r in required:
        if r not in entry_text:
            errors.append(f"SKILL.md missing dispatch route: {r}")

    print("=== 星应剧本 3.5 · 架构与全链路路由自检 ===")
    print(f"检查范围 : {len(md_files)} 份 Markdown | {link_count} 个文件/脚本链接 | {anchor_count} 个精确章节锚点 | SKILL.md 行数={len(entry_lines)}/120")
    print("架构守卫 : 单向路由派发锁 + 精确章节锚点可达 + 脚本路径挂载 + 运行时零免责废话锁")
    for e in errors:
        print(f"ERROR: {e}")
    print("RESULT: FAIL" if errors else "RESULT: PASS")
    return 1 if errors else 0


def check_script(path: Path, era: str) -> int:
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    issues: list[str] = []
    current_scene = ""
    cast_list: list[str] = []
    has_cast = False
    scene_count = 0
    table_mode = False

    for ln, raw_line in enumerate(lines, start=1):
        raw = raw_line.strip()
        if not raw or raw.startswith(("#", "```")):
            continue
        for c in CLICHES:
            if c in raw:
                issues.append(f"L{ln} [抽象废话预警]: 命中禁用套话「{c}」，请改为具体可拍动作")
        if raw.startswith("△"):
            if re.search(r"(车窗.{0,6}递.{0,6}伞|伞.{0,6}递出车窗)", raw):
                issues.append(f"L{ln} [AIGC防穿模预警]: 跨窄车窗递伞极易导致 AI 视频穿模，建议改为推门下车撑伞或门外收伞")
            if re.search(r"(伞尖悬在雨里|剑尖停在咽喉)", raw):
                issues.append(f"L{ln} [AIGC防穿模预警]: 无根局部悬空词，请补全握持部位、开合状态与物理落点")
        if raw.startswith("|") and re.match(r"^\|\s*\*?\*?S\d+", raw, re.I):
            table_mode = True
            scene_count += 1
            cols = [c.strip() for c in raw.strip("|").split("|")]
            if len(cols) >= 3:
                if re.search(r"(车窗.{0,6}递.{0,6}伞|伞.{0,6}递出车窗)", cols[1]):
                    issues.append(f"L{ln} [AIGC防穿模预警]: 跨窄车窗递伞极易导致 AI 视频穿模，建议改为推门下车撑伞或门外收伞")
                if era == "modern":
                    for w in MODERN_STIFF:
                        if w in cols[2]:
                            issues.append(f"L{ln} [现代书面虚词预警]: 台词含公文腔词「{w}」，非官腔人设建议改为自然口语")
                elif era == "ancient":
                    for w in ANCIENT_ANACH:
                        if w in cols[2]:
                            issues.append(f"L{ln} [古装现代词穿越预警]: 古装台词混入现代词「{w}」，请替换为符合时代的表达")
            continue
        if re.match(r"^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场)\s+.+", raw):
            current_scene = raw
            cast_list = []
            has_cast = False
            table_mode = False
            scene_count += 1
            continue
        if re.match(r"^【段落\s*\d+", raw):
            current_scene = raw
            cast_list = []
            has_cast = False
            table_mode = False
            scene_count += 1
            continue
        m_cast = re.match(r"^人物\s*[:：]\s*(.+)$", raw)
        if m_cast:
            has_cast = True
            cleaned = re.sub(r"（[^）]*）|\([^)]*\)", "", m_cast.group(1))
            cast_list = [x for x in re.split(r"[\s、，,/]+", cleaned) if x]
            continue
        if re.match(r"^[^\s:：△【】（()）]{1,12}\s+(VO|OS|O\.S\.)\s*[:：]", raw, re.I):
            issues.append(f"L{ln} [说话人通道歧义]: 请将 VO/OS 放入圆括号内（如 角色名（VO）：），避免下游误生成幽灵角色")
            continue
        m_sp = re.match(r"^([^\s:：△【】（()）]{1,12})\s*([（(][^）)]*[）)])?\s*[:：]\s*(.+)$", raw)
        if current_scene and not table_mode and m_sp:
            speaker = m_sp.group(1).strip()
            channel_tag = (m_sp.group(2) or "").strip()
            speech = m_sp.group(3).strip()
            if speaker in {"时间", "地点", "传播目标", "预估发声字数"}:
                continue
            if speaker in {"内心", "主角", "角色"}:
                issues.append(f"L{ln} [非具名说话人违规]: 严禁用「{speaker}」当说话人，请改为真实角色名（如 角色名（OS）：）")
            elif speaker == "旁白" and "VO" not in channel_tag.upper():
                issues.append(f"L{ln} [旁白标记不规范]: 无具名旁白请统一写作「旁白（VO）：」以区分实体角色")
            elif speaker != "旁白" and has_cast and cast_list and speaker not in cast_list:
                issues.append(f"L{ln} [出场名单漏标]: 场景「{current_scene}」中角色「{speaker}」未列入本场「人物：」行")

            if era == "modern":
                for w in MODERN_STIFF:
                    if w in speech:
                        issues.append(f"L{ln} [现代书面虚词预警]: 台词含公文腔词「{w}」，非官腔人设建议改为自然口语")
            elif era == "ancient":
                for w in ANCIENT_ANACH:
                    if w in speech:
                        issues.append(f"L{ln} [古装现代词穿越预警]: 古装台词混入现代词「{w}」，请替换为符合时代的表达")

    label = f" (era={era})" if era else ""
    print(f"=== 星应剧本 3.5 · 成稿格式与语感体检报告{label} ===")
    print(f"识别场次/镜段数 : {scene_count}")
    for it in issues:
        print(f"  - {it}")
    print(f"RESULT: WARN ({len(issues)} 项待修正)" if issues else "RESULT: PASS（场标、出场名单、通道防歧义及反套话扫描全部通过）")
    return 1 if issues else 0


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("path", nargs="?", type=Path)
    p.add_argument("--era", choices=["modern", "ancient"], default="")
    p.add_argument("--self-check", action="store_true")
    a = p.parse_args()
    sys.exit(self_check() if (a.self_check or not a.path) else check_script(a.path, a.era))
