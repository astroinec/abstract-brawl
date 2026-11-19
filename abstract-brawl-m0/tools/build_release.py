#!/usr/bin/env python3
"""打包：生成可离线双击打开的单文件 HTML，以及源码 ZIP。
用法：python3 tools/build_release.py [版本号]
产物写到 ../release/ 下：
  abstract-brawl-m0-本地试玩-<版本>.html
  abstract-brawl-m0-source-<版本>.zip
"""
import base64
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT.parent / "release"
OUT.mkdir(exist_ok=True)
VER = sys.argv[1] if len(sys.argv) > 1 else "v0.4.0"

html = (ROOT / "index.html").read_text(encoding="utf-8")

assets = {}
for p in sorted((ROOT / "assets").glob("*.png")):
    assets[p.stem] = "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
for p in sorted((ROOT / "assets" / "fonts").glob("*.woff2")):
    assets[p.stem] = "data:font/woff2;base64," + base64.b64encode(p.read_bytes()).decode()
for p in sorted((ROOT / "assets" / "audio").glob("*.mp3")):
    assets[p.stem] = "data:audio/mpeg;base64," + base64.b64encode(p.read_bytes()).decode()
for p in sorted((ROOT / "assets").glob("*.jpg")):
    assets[p.stem] = "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()
asset_tag = "<script>window.__FG_ASSETS__ = " + json.dumps(assets) + ";</script>\n"


def inline_script(m):
    code = (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return "<script>/* " + m.group(1) + " */\n" + code + "\n</script>"


scripts = re.findall(r'<script src="([^"]+)"></script>', html)
body = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
body = body.replace("<script>/* " + scripts[0], asset_tag + "<script>/* " + scripts[0], 1)
assert 'src="src/' not in body and "__FG_ASSETS__" in body

single = OUT / ("abstract-brawl-m0-本地试玩-" + VER + ".html")
single.write_text(body, encoding="utf-8")

zpath = OUT / ("abstract-brawl-m0-source-" + VER + ".zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ROOT.rglob("*")):
        if p.is_file() and p.name != ".DS_Store" and "__pycache__" not in p.parts:
            z.write(p, pathlib.Path("abstract-brawl-m0") / p.relative_to(ROOT))

print("single:", single, single.stat().st_size, "bytes,", len(scripts), "scripts,", len(assets), "assets")
print("zip:", zpath, zpath.stat().st_size, "bytes")
