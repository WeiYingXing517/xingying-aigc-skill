"""Estimate screenplay playback duration interval and flag overly long clauses."""
import argparse
import re
from pathlib import Path

RATES = {
    "short-drama": {"min": 4.2, "max": 4.8, "clause": 18, "action": 2.2, "scene": 1.2},
    "series":      {"min": 3.5, "max": 4.0, "clause": 25, "action": 3.0, "scene": 2.0},
    "film":        {"min": 3.2, "max": 3.8, "clause": 25, "action": 3.8, "scene": 2.5},
    "commercial":  {"min": 4.5, "max": 5.0, "clause": 18, "action": 1.5, "scene": 0.5},
    "narrated":    {"min": 4.5, "max": 5.2, "clause": 18, "action": 1.5, "scene": 0.8},
}

WORD_RE = re.compile(r"[\w\u4e00-\u9fff]", re.UNICODE)
SPLIT_RE = re.compile(r"[，。！？；：、,.!?;:—…]+")


def count_spoken(text: str) -> int:
    clean = re.sub(r"（[^）]*）|\([^)]*\)|【[^】]*】", "", text)
    return len(WORD_RE.findall(clean))


def check_clauses(text: str, line_no: int, limit: int, out: list[str]) -> None:
    clean = re.sub(r"^[（(][^）)]*[）)]\s*[:：]?\s*", "", text)
    clean = re.sub(r"（[^）]*）|【[^】]*】", "", clean)
    for part in SPLIT_RE.split(clean):
        n = len(WORD_RE.findall(part))
        if n > limit:
            out.append(f"L{line_no} ({n}字 > {limit}字上限): {part.strip()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Screenplay duration estimator")
    parser.add_argument("path", type=Path, help="Path to screenplay markdown/text file")
    parser.add_argument("--channel", choices=list(RATES.keys()), default="short-drama")
    args = parser.parse_args()

    cfg = RATES[args.channel]
    lines = args.path.read_text(encoding="utf-8-sig").splitlines()

    spoken_chars = 0
    action_blocks = 0.0
    scene_count = 0
    long_lines: list[str] = []
    in_fence = False

    for idx, raw_line in enumerate(lines, start=1):
        raw = raw_line.strip()
        if not raw:
            continue
        if raw.startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if raw.startswith(("#", ">")):
            continue

        if raw.startswith("|") and raw.endswith("|"):
            if re.match(r"^\|\s*[-:]+\s*\|", raw) or re.search(r"镜号与秒段|画面动作", raw):
                continue
            cols = [c.strip() for c in raw.strip("|").split("|")]
            if len(cols) >= 3:
                scene_count += 1
                c_count = count_spoken(cols[2])
                spoken_chars += c_count
                if c_count == 0 and cols[1]:
                    action_blocks += 1.0
                check_clauses(cols[2], idx, cfg["clause"], long_lines)
            continue

        if re.match(r"^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场|【段落\s*\d+)", raw):
            scene_count += 1
            continue
        if re.match(r"^(第\s*\d+\s*集|人物|【状态锚点|【视角|【字幕|【花字|【音效|【系统|【闪回)", raw):
            continue
        if raw.startswith("△"):
            action_blocks += 1.0
            continue

        m = re.match(r"^([^\s:：△【】（()）]{1,16})\s*(?:[（(][^）)]*[）)])?\s*[:：]\s*(.+)$", raw)
        if m:
            speech = m.group(2).strip()
            spoken_chars += count_spoken(speech)
            check_clauses(speech, idx, cfg["clause"], long_lines)

    scene_count = max(scene_count, 1)
    speech_min = round(spoken_chars / cfg["max"], 1)
    speech_max = round(spoken_chars / cfg["min"], 1)
    act_min = round(action_blocks * cfg["action"] * 0.55, 1)
    act_max = round(action_blocks * cfg["action"] * 0.85, 1)
    trans = round(scene_count * cfg["scene"], 1)
    total_min = round(speech_min + act_min + trans, 1)
    total_max = round(speech_max + act_max + trans, 1)

    print("=== 剧本时长与气口测算报告 ===")
    print(f"通道模式   : {args.channel} (语速基准 {cfg['min']}~{cfg['max']} 字/秒 | 单句气口上限 {cfg['clause']} 字)")
    print(f"统计概览   : 场次/镜段数={scene_count} | 有效发声字数={spoken_chars} 字 | 动作段落数={action_blocks:g}")
    print(f"分项耗时   : 发声对白 {speech_min}~{speech_max}s + 非重叠动作 {act_min}~{act_max}s + 转场停顿 {trans}s")
    print(f"预估总时长 : {total_min} ~ {total_max} 秒 (约 {total_min/60:.1f} ~ {total_max/60:.1f} 分钟)")
    if long_lines:
        print(f"\n[气口超长预警] 发现 {len(long_lines)} 处单句连续字数超限，建议拆短或插入动作气口：")
        for item in long_lines:
            print(f"  - {item}")
    else:
        print("[气口检查] PASS（所有台词单句长度均符合当前通道气口上限）")


if __name__ == "__main__":
    main()
