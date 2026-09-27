#!/usr/bin/env python3
"""Generate search-index.json for the Rest Science site (sleep-optimization).

Scans articles/*.html and writes one JSON entry per article:
  { "title": <h1, else <title>>, "url": "articles/<slug>.html",
    "excerpt": first ~160 chars of the lede/first paragraph,
    "headings": [h2 texts] }
"""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ARTICLES_DIR = ROOT / "articles"
OUT = ROOT / "search-index.json"


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in_title_tag = False
        self.title_tag = ""
        self.h1 = ""
        self._in_h1 = False
        self.h2s = []
        self._in_h2 = False
        self._h2_buf = []
        self.paragraphs = []
        self._in_p = False
        self._p_buf = []
        self._p_class = ""
        self.lede = ""
        self._skip = 0  # script/style depth

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        if tag == "title":
            self._in_title_tag = True
        if tag == "h1":
            self._in_h1 = True
        if tag == "h2":
            self._in_h2 = True
            self._h2_buf = []
        if tag == "p":
            self._in_p = True
            self._p_buf = []
            self._p_class = dict(attrs).get("class", "")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        if tag == "title":
            self._in_title_tag = False
        if tag == "h1":
            self._in_h1 = False
        if tag == "h2":
            self._in_h2 = False
            text = "".join(self._h2_buf).strip()
            if text:
                self.h2s.append(text)
        if tag == "p":
            self._in_p = False
            text = re.sub(r"\s+", " ", "".join(self._p_buf)).strip()
            if text:
                self.paragraphs.append((self._p_class, text))
                if "lede" in self._p_class.split() and not self.lede:
                    self.lede = text

    def handle_data(self, data):
        if self._skip:
            return
        if self._in_title_tag:
            self.title_tag += data
        if self._in_h1:
            self.h1 += data
        if self._in_h2:
            self._h2_buf.append(data)
        if self._in_p:
            self._p_buf.append(data)


def main():
    entries = []
    for path in sorted(ARTICLES_DIR.glob("*.html")):
        parser = ArticleParser()
        parser.feed(path.read_text(encoding="utf-8"))

        title = parser.h1.strip() or parser.title_tag.split("|")[0].strip()
        excerpt_src = parser.lede or (parser.paragraphs[0][1] if parser.paragraphs else "")
        excerpt = excerpt_src[:160].rstrip()
        if len(excerpt_src) > 160:
            excerpt = excerpt[:157].rstrip() + "..."

        entries.append({
            "title": title,
            "url": f"articles/{path.name}",
            "excerpt": excerpt,
            "headings": parser.h2s,
        })

    OUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # --- validation ---
    data = json.loads(OUT.read_text(encoding="utf-8"))
    assert isinstance(data, list) and data, "index must be a non-empty list"
    for entry in data:
        assert all(k in entry for k in ("title", "url", "excerpt", "headings")), entry
        local = ROOT / entry["url"]
        assert local.is_file(), f"URL does not resolve to a file: {entry['url']}"

    print(f"Wrote {OUT} with {len(data)} entries; all URLs resolve to real files.")


if __name__ == "__main__":
    main()
