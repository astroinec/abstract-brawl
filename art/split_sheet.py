"""AI 姿势表 → 抠图 → 按透明列间隙切成单个精灵。用法：python split_sheet.py sheet.png 前缀 名字1 名字2 ..."""
import sys, json, pathlib, numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage
import os
sheet, prefix, names = sys.argv[1], sys.argv[2], sys.argv[3:]
DIL = int(os.environ.get('DILATE', '6'))  # 两个人物贴得太近时调小
OUT = pathlib.Path(__file__).parent.parent / 'abstract-brawl-m0' / 'assets'
im = Image.open(sheet).convert('RGB')
cut = remove(im, session=new_session('bria-rmbg'))
a = np.asarray(cut.getchannel('A')) > 40
lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=DIL))
objs = ndimage.find_objects(lab)
blobs = []
for i, sl in enumerate(objs):
    area = (lab[sl] == i + 1).sum()
    if area > 3000: blobs.append((sl[1].start, sl, i + 1))
blobs.sort()
print('blobs', len(blobs), [(b[1][1].start, b[1][1].stop) for b in blobs])
assert len(blobs) == len(names), 'blob count mismatch'
arr = np.asarray(cut).copy()
heights = {}
heights = {}
for (x0, sl, idx), name in zip(blobs, names):
    m = (lab == idx)
    piece = arr.copy(); piece[..., 3] = np.where(m, piece[..., 3], 0)
    p = Image.fromarray(piece).crop((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    bb = p.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox(); p = p.crop(bb)
    heights[name] = p.height
    if p.height > 520: p = p.resize((round(p.width * 520 / p.height), 520), Image.LANCZOS)
    p.save(OUT / (prefix + name + '.png'), optimize=True); print(prefix + name, p.size)
cred = OUT / 'CREDITS.json'; c = json.loads(cred.read_text())
for name in names: c[prefix + name] = {'source': 'AI 重绘（参考网络二创形象）', 'sheet': pathlib.Path(sheet).name, 'sheet_h': heights[name]}
print('heights', heights)
cred.write_text(json.dumps(c, ensure_ascii=False, indent=1))
