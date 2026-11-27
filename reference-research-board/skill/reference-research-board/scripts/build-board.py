#!/usr/bin/env python3
"""Fill the board template with a board-data.json and write the page.

Usage: python3 build-board.py <board-data.json> <out.html>

Checks the data first and stops with a clear message if something is wrong,
so a broken board is never published.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "template", "board.html")
KINDS = {"website", "product", "video", "social", "image"}
MIN_CARDS = 5
LANGS = {"en", "he"}
LONG_LINE = 40  # words; a text card shows about one sentence (copyright)
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")  # ids go into HTML attributes and store paths
SAFE_IMG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")  # a plain file name inside refs/, never a path


def fail(msg):
    sys.exit("build-board: " + msg)


def check(data, out_dir):
    for key in ("title", "question", "parts", "refs"):
        if not data.get(key):
            fail(f"board-data is missing '{key}'")
    part_ids = [p.get("id") for p in data["parts"]]
    for pid in part_ids:
        if not isinstance(pid, str) or not SAFE_ID.fullmatch(pid):
            fail(f"part id {pid!r} may only use letters, digits, '-' and '_'")
    if len(set(part_ids)) != len(part_ids):
        fail("two parts share an id")
    if os.path.islink(os.path.join(out_dir, "refs")):
        fail("refs/ is a link; it must be a real folder inside the topic folder")
    ref_ids = set()
    missing_imgs = []
    long_lines = []
    for r in data["refs"]:
        for key in ("id", "part", "site", "url", "steal"):
            if not r.get(key):
                fail(f"ref {r.get('id', '?')} is missing '{key}'")
        if not isinstance(r["id"], str) or not SAFE_ID.fullmatch(r["id"]):
            fail(f"ref id {r['id']!r} may only use letters, digits, '-' and '_'")
        if not re.match(r"^https?://", str(r["url"]), re.I):
            fail(f"ref {r['id']} url must start with http:// or https://")
        for key in ("img", "img2"):
            if r.get(key) and (not isinstance(r[key], str) or not SAFE_IMG.fullmatch(r[key]) or ".." in r[key]):
                fail(f"ref {r['id']} {key} {r[key]!r} must be a plain file name inside refs/ (no folders, no '..')")
        # A card shows a picture (`img`, visual and sourced modes) or a line of writing (`line`, text mode).
        if bool(r.get("img")) == bool(r.get("line")):
            fail(f"ref {r['id']} has {'both' if r.get('img') else 'neither'} 'img' {'and' if r.get('img') else 'nor'} 'line'; give exactly one")
        if r.get("line"):
            if r.get("img2"):
                fail(f"ref {r['id']} has a 'line', so it cannot have 'img2'")
            if r.get("lang", "en") not in LANGS:
                fail(f"ref {r['id']} has lang '{r['lang']}', expected one of {sorted(LANGS)}")
            if len(r["line"].split()) > LONG_LINE:
                long_lines.append(r["id"])
        if r["id"] in ref_ids:
            fail(f"ref id {r['id']} is used twice")
        ref_ids.add(r["id"])
        if r["part"] not in part_ids:
            fail(f"ref {r['id']} points at unknown part '{r['part']}'")
        if r.get("kind") and r["kind"] not in KINDS:
            fail(f"ref {r['id']} has kind '{r['kind']}', expected one of {sorted(KINDS)}")
        for key in ("img", "img2"):
            if r.get(key) and os.path.lexists(os.path.join(out_dir, "refs", r[key])) and not os.path.isfile(os.path.join(out_dir, "refs", r[key])):
                fail(f"ref {r['id']} {key} {r[key]!r} is not a file")
            if r.get(key) and os.path.islink(os.path.join(out_dir, "refs", r[key])):
                fail(f"ref {r['id']} {key} {r[key]!r} is a link; only real files inside refs/ are published")
            if r.get(key) and not os.path.exists(os.path.join(out_dir, "refs", r[key])):
                missing_imgs.append(r[key])
    for p in data["parts"]:
        if not any(r["part"] == p["id"] for r in data["refs"]):
            fail(f"part '{p['id']}' has no references")
    # One image, one card (SKILL.md 4b): the same picture on two cards pads a board.
    seen = {}
    for r in data["refs"]:
        for key in ("img", "img2"):
            if r.get(key):
                if r[key] in seen and seen[r[key]] != r["id"]:
                    fail(f"image {r[key]} is on two cards ({seen[r[key]]} and {r['id']}); one image, one card")
                seen[r[key]] = r["id"]
    # Abort rule (SKILL.md 4b): a picture board needs at least 5 cards that passed the final gate.
    pictures = [r for r in data["refs"] if r.get("img")]
    if pictures and len(pictures) < MIN_CARDS:
        fail(f"only {len(pictures)} picture cards; the final gate needs at least {MIN_CARDS}. Do not build: tell the user what passed and why the rest failed")
    return missing_imgs, long_lines


def main():
    if len(sys.argv) != 3:
        fail("usage: build-board.py <board-data.json> <out.html>")
    data_path, out_path = sys.argv[1], sys.argv[2]
    try:
        with open(data_path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read {data_path}: {e}")
    if not isinstance(data, dict):
        fail("board-data must be one JSON object")
    out_dir = os.path.dirname(os.path.abspath(out_path))
    missing, long_lines = check(data, out_dir)
    with open(TEMPLATE, encoding="utf-8") as f:
        page = f.read()
    title = str(data["title"]).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # "<" written as \u003c keeps the JSON valid and stops it from closing the <script> it sits in.
    blob = json.dumps(data, ensure_ascii=False, indent=1).replace("<", "\\u003c")
    # Data first: the title sits above the data in the template, so a title can never land inside it.
    page = page.replace("__BOARD_DATA__", blob, 1).replace("__TITLE__", title, 1)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    imgs = sorted({r[k] for r in data["refs"] for k in ("img", "img2") if r.get(k)} - set(missing))
    lines = sum(1 for r in data["refs"] if r.get("line"))
    print(f"Wrote {out_path}: {len(data['parts'])} parts, {len(data['refs'])} references, {len(imgs)} images, {lines} lines.")
    if long_lines:
        print(f"Long lines (over {LONG_LINE} words, cut to about one sentence): " + ", ".join(long_lines))
    if missing:
        print("Missing images (cards will say 'No capture'): " + ", ".join(sorted(set(missing))))
    # The publish call needs every image listed in `files`.
    print("FILES_JSON=" + json.dumps({"refs/" + i: "refs/" + i for i in imgs}))


if __name__ == "__main__":
    main()
