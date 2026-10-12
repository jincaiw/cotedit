#!/usr/bin/env python3
"""Build CotEdit's compact Unicode scalar-name/category/block table from UCD 17.0.0."""
from __future__ import annotations

import hashlib
import json
import urllib.request
from pathlib import Path

VERSION = "17.0.0"
BASE = f"https://www.unicode.org/Public/{VERSION}/ucd"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "lib" / "unicode-character-data.json"
HEADERS = {"User-Agent": "CotEdit-Unicode-data-builder/1.0"}


def fetch(name: str) -> bytes:
    request = urllib.request.Request(f"{BASE}/{name}", headers=HEADERS)
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def hex_cp(value: int) -> str:
    return f"{value:04X}"


def main() -> None:
    unicode_data = fetch("UnicodeData.txt")
    aliases_data = fetch("NameAliases.txt")
    blocks_data = fetch("Blocks.txt")
    age_data = fetch("DerivedAge.txt")

    # Select the primary normative alias for control characters. UnicodeData's
    # formal name for these scalars is the placeholder "<control>".
    alias_priority = {"control": 0, "correction": 1, "alternate": 2, "figment": 3, "abbreviation": 4}
    primary_aliases: dict[int, tuple[int, str]] = {}
    for line in aliases_data.decode("utf-8").splitlines():
        content = line.split("#", 1)[0].strip()
        if not content:
            continue
        cp_text, alias, kind = (part.strip() for part in content.split(";"))
        if kind not in alias_priority:
            continue
        cp = int(cp_text, 16)
        candidate = (alias_priority[kind], alias.upper())
        if cp not in primary_aliases or candidate[0] < primary_aliases[cp][0]:
            primary_aliases[cp] = candidate

    explicit_names: dict[str, str] = {}
    assigned_ranges: list[tuple[int, int, str]] = []
    algorithmic_ranges: list[list[object]] = []
    pending_range: tuple[int, str, str] | None = None

    for line in unicode_data.decode("utf-8").splitlines():
        fields = line.split(";")
        cp = int(fields[0], 16)
        raw_name = fields[1]
        category = fields[2]
        if raw_name.endswith(", First>"):
            if pending_range is not None:
                raise ValueError(f"Unclosed UnicodeData range before U+{cp:04X}")
            pending_range = (cp, raw_name[1:-len(", First>")], category)
            continue
        if raw_name.endswith(", Last>"):
            if pending_range is None:
                raise ValueError(f"Unexpected UnicodeData range end at U+{cp:04X}")
            start, range_name, range_category = pending_range
            if range_category != category:
                raise ValueError(f"Category mismatch in U+{start:04X}..U+{cp:04X}")
            assigned_ranges.append((start, cp, category))
            if range_name == "Hangul Syllable":
                kind = "hangul"
            elif range_name.startswith("CJK Ideograph"):
                kind = "cjk"
            elif range_name.startswith("Tangut Ideograph"):
                kind = "tangut"
            else:
                kind = None
            if kind:
                algorithmic_ranges.append([start, cp, kind])
            pending_range = None
            continue

        assigned_ranges.append((cp, cp, category))
        if raw_name and not (raw_name.startswith("<") and raw_name.endswith(">")):
            explicit_names[hex_cp(cp)] = raw_name
        elif category == "Cc":
            alias = primary_aliases.get(cp)
            # Field 10 is UnicodeData's historical Unicode 1.0 name.
            fallback = fields[10].strip() if len(fields) > 10 else ""
            if alias:
                explicit_names[hex_cp(cp)] = alias[1]
            elif fallback:
                explicit_names[hex_cp(cp)] = fallback.upper()

    if pending_range is not None:
        raise ValueError(f"Unclosed UnicodeData range beginning at U+{pending_range[0]:04X}")

    # Fill gaps as Cn, then merge adjacent runs. This yields a compact complete
    # General_Category lookup, including unassigned code points and noncharacters.
    category_ranges: list[list[object]] = []
    cursor = 0
    for start, end, category in assigned_ranges:
        if start > cursor:
            _append_range(category_ranges, cursor, start - 1, "Cn")
        _append_range(category_ranges, start, end, category)
        cursor = end + 1
    if cursor <= 0x10FFFF:
        _append_range(category_ranges, cursor, 0x10FFFF, "Cn")

    blocks: list[list[object]] = []
    for line in blocks_data.decode("utf-8").splitlines():
        content = line.split("#", 1)[0].strip()
        if not content:
            continue
        code_range, name = (part.strip() for part in content.split(";", 1))
        start_text, end_text = code_range.split("..")
        blocks.append([int(start_text, 16), int(end_text, 16), name])

    ages: list[list[object]] = []
    for line in age_data.decode("utf-8").splitlines():
        content = line.split("#", 1)[0].strip()
        if not content:
            continue
        code_range, age = (part.strip() for part in content.split(";", 1))
        if ".." in code_range:
            start_text, end_text = code_range.split("..")
        else:
            start_text = end_text = code_range
        ages.append([int(start_text, 16), int(end_text, 16), age])
    ages.sort(key=lambda item: item[0])
    compact_ages: list[list[object]] = []
    for start, end, age in ages:
        if compact_ages and start <= compact_ages[-1][1]:
            raise ValueError(f"Overlapping DerivedAge range at U+{start:04X}")
        if compact_ages and compact_ages[-1][2] == age and compact_ages[-1][1] + 1 == start:
            compact_ages[-1][1] = end
        else:
            compact_ages.append([start, end, age])

    payload = {
        "version": VERSION,
        "sourceHashes": {
            "UnicodeData.txt": hashlib.sha256(unicode_data).hexdigest(),
            "NameAliases.txt": hashlib.sha256(aliases_data).hexdigest(),
            "Blocks.txt": hashlib.sha256(blocks_data).hexdigest(),
            "DerivedAge.txt": hashlib.sha256(age_data).hexdigest(),
        },
        "names": explicit_names,
        "algorithmicNameRanges": algorithmic_ranges,
        "categories": category_ranges,
        "blocks": blocks,
        "ages": compact_ages,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"Unicode names: {len(explicit_names):,}; algorithmic ranges: {len(algorithmic_ranges)}; category ranges: {len(category_ranges):,}; blocks: {len(blocks):,}; age ranges: {len(compact_ages):,}")
    print("SHA-256:")
    for name, digest in payload["sourceHashes"].items():
        print(f"  {name}: {digest}")


def _append_range(target: list[list[object]], start: int, end: int, category: str) -> None:
    if start > end:
        return
    if target and target[-1][2] == category and target[-1][1] + 1 == start:
        target[-1][1] = end
    else:
        target.append([start, end, category])


if __name__ == "__main__":
    main()
