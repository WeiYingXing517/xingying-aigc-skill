"""在摄影知识库离线检索定义和应用候选。"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "zhi-shi-ku" / "jian-suo-shu-ju.json"
TERM_ALIASES = {
    "ots": "过肩",
    "pov": "主观",
    "180": "跨轴",
    "180度": "跨轴",
    "shot reverse shot": "正反打",
    "dof": "景深",
    "rack focus": "转焦",
    "j cut": "j剪",
    "l cut": "l剪",
}
ENTRY_ALIASES = {
    "ANG01": ("正脸", "正面特写"),
    "ANG03": ("侧脸", "纯侧拍"),
    "SIZ-A01": ("正面特写", "微表情"),
    "SPA01": ("画面投影", "场内地标"),
    "SPA02": ("画面投影", "身体相对方位"),
    "ORG15": ("画面投影", "银幕方向"),
}


def norm(value):
    return unicodedata.normalize("NFKC", value).lower().strip()


def load_index():
    return json.loads(INDEX.read_text(encoding="utf-8-sig"))


def definitions(domains):
    for domain in domains:
        slug = domain["slug"]
        relative = Path("zhuan-xiang") / slug / "ji-chu-ding-yi-ku.md"
        text = (ROOT / relative).read_text(encoding="utf-8-sig")
        for section in re.split(r"\n(?=## )", text):
            heading = re.match(r"## ([A-Z]+\d+) (.+)\n", section)
            if heading is None:
                continue
            entry_id, title = heading.groups()
            summary = re.search(r"(?m)^- 定义与效果：(.*)$", section)
            boundary = re.search(r"(?m)^- 边界与区分：(.*)$", section)
            yield {
                "id": entry_id,
                "title": title,
                "domain": slug,
                "domain_name": domain["title"],
                "path": f"{relative.as_posix()}#{entry_id.lower()}",
                "definition": summary[1] if summary else "",
                "boundary": boundary[1] if boundary else "",
                "kind": "definition",
            }


def score_entry(entry, terms, searchable):
    entry_id = entry["id"]
    aliases = ENTRY_ALIASES.get(entry_id, ())
    score, hits, exclusion_hits = 0, set(), set()
    for term in terms:
        if term == norm(entry_id):
            score += 1000
            hits.add("编号")
            continue
        if re.fullmatch(r"[a-z]+(?:-a)?\d+", term):
            continue
        if term in aliases:
            score += 40
            hits.add(f"同义词：{term}")
        matching = [(weight, label) for field, weight, label in searchable if term in norm(entry[field])]
        for weight, label in matching:
            score += weight
            hits.add(f"{label}：{term}")
        if term in norm(entry.get("exclude", "")):
            exclusion_hits.add(term)
        # A weak match cannot be driven by words that only occur in an exclusion.
        elif not matching and len(term) >= 4:
            title = norm(entry["title"])
            pairs = {term[i:i + 2] for i in range(len(term) - 1)}
            partial = sum(pair in title for pair in pairs)
            if partial >= 2:
                score += min(partial, 5)
                hits.add(f"标题弱匹配：{term}")
    return score, sorted(hits), sorted(exclusion_hits)


def search(words, domain=None, limit=6, data=None):
    if data is None:
        data = load_index()
    query = norm(" ".join(words))
    parts = [part for part in re.split(r"[^\w-]+", query) if part]
    terms = [query] if query in TERM_ALIASES else parts
    scene_rows = json.loads(INDEX.with_name("chang-jing-ci.json").read_text(encoding="utf-8"))
    scene_hits = {}
    for row in scene_rows:
        for phrase in [row["phrase"], *row["aliases"]]:
            if phrase in query:
                for entry_id in row["ids"]:
                    scene_hits.setdefault(entry_id, set()).add(phrase)
    terms = tuple(dict.fromkeys(TERM_ALIASES.get(term, term) for term in terms if term))
    if not terms:
        return []
    domains = [item for item in data["domains"] if not domain or item["slug"] == domain]
    entries = list(definitions(domains))
    entries.extend(
        dict(item, kind="application")
        for item in data["applications"]
        if not domain or item["domain"] == domain
    )
    found = []
    for entry in entries:
        fields = [("title", 24, "标题")]
        if entry["kind"] == "application":
            fields.extend([("conditions", 13, "条件"), ("action", 8, "做法"), ("alternative", 3, "替代"), ("example", 2, "示例")])
        else:
            fields.append(("definition", 8, "定义"))
        score, matched, exclusion_hits = score_entry(entry, terms, fields)
        phrases = scene_hits.get(entry["id"], ())
        if phrases:
            score += 30
            matched.extend(f"场景词：{phrase}" for phrase in sorted(phrases))
        if score:
            found.append(dict(entry, score=score, matched=matched, exclusion_hits=exclusion_hits))
    return sorted(found, key=lambda entry: (-entry["score"], entry["id"]))[:limit]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ci", nargs="+")
    parser.add_argument("--ling-yu")
    parser.add_argument("--shu-liang", type=int, default=6)
    parser.add_argument("--xiang-xi", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    data = load_index()
    if args.ling_yu and args.ling_yu not in {item["slug"] for item in data["domains"]}:
        parser.error("未知专项，请查看知识总索引")
    if not 1 <= args.shu_liang <= 30:
        parser.error("数量应为1至30")
    found = search(args.ci, args.ling_yu, None, data)
    result = found[:args.shu_liang]
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    if not result:
        print(f"摄影检索未命中（{args.ling_yu or '全部摄影专项'}）：{' '.join(args.ci)}。可换术语，或按「流程/知识检索与采用.md」转查其他领域。")
        return
    print("以下是检索候选。采用前读取对应条目，并核对当前场面和锁定项。")
    print(f"找到 {len(found)} 条，当前显示 {len(result)} 条。")
    for entry in result:
        layer = "定义" if entry["kind"] == "definition" else "应用"
        print(f"\n{entry['id']} {entry['domain_name']} / {entry['title']}（{layer}）\n位置：{entry['path']}")
        print("命中：" + "、".join(entry["matched"]))
        if entry["kind"] == "definition":
            print(f"定义：{entry['definition']}\n边界：{entry['boundary']}")
            continue
        print(f"条件：{entry['conditions']}\n做法：{entry['action']}\n排除：{entry['exclude']}")
        if entry["exclusion_hits"]:
            print(f"排除提示：检索词 {'、'.join(entry['exclusion_hits'])} 出现在排除条件")
        if args.xiang_xi:
            print(f"替代：{entry['alternative']}\n正反例：{entry['example']}\n状态：{entry['status']}")


if __name__ == "__main__":
    main()

