#!/usr/bin/env python3
"""Bubu ile İngilizce — resim atlaslarını üretir.

index.html içindeki bütün emojileri bulur, Microsoft Fluent Emoji 3D (MIT) görsellerinden art/a<N>.webp
atlaslarını oluşturur ve index.html'deki ART haritasını günceller. Böylece resimler her cihazda aynı görünür.

Kullanım:  pip install pillow regex
           npm pack @lobehub/fluent-emoji-3d && tar xzf lobehub-fluent-emoji-3d-*.tgz
           python3 tools/make-art.py package/assets
"""
import json, os, sys, regex
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, '..', 'index.html')
OUT = os.path.join(HERE, '..', 'art')
CELL, COLS = 192, 8

def main(assets):
    s = open(HTML, encoding='utf-8').read()
    body = s[:s.index('const ART = ')] + s[s.index('/*END-ART*/'):]
    ems = sorted(set(regex.findall(r'(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)', body)))
    files = set(os.listdir(assets))
    found = []
    for e in ems:
        cps = [f'{ord(c):x}' for c in e]
        for name in ('-'.join(cps), '-'.join(c for c in cps if c != 'fe0f')):
            if name + '.webp' in files: found.append((e, name + '.webp')); break
    os.makedirs(OUT, exist_ok=True)
    per = COLS * COLS
    amap = {}
    for si in range((len(found) + per - 1) // per):
        sheet = Image.new('RGBA', (CELL * COLS, CELL * COLS), (0, 0, 0, 0))
        for k, (e, f) in enumerate(found[si * per:(si + 1) * per]):
            im = Image.open(os.path.join(assets, f)).convert('RGBA').resize((CELL - 8, CELL - 8), Image.LANCZOS)
            x, y = k % COLS, k // COLS
            sheet.paste(im, (x * CELL + 4, y * CELL + 4))
            amap[e.replace('️', '')] = [si, x, y]
        sheet.save(os.path.join(OUT, f'a{si}.webp'), 'WEBP', quality=84, method=6)
    a, b = s.index('const ART = '), s.index('/*END-ART*/')
    s = s[:a] + 'const ART = ' + json.dumps(amap, ensure_ascii=False, separators=(',', ':')) + ';' + s[b:]
    open(HTML, 'w', encoding='utf-8').write(s)
    print(len(found), 'resim,', len(ems) - len(found), 'eksik;', sorted(os.listdir(OUT)), [os.path.getsize(os.path.join(OUT, f)) // 1024 for f in sorted(os.listdir(OUT))], 'KB')

if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(sys.argv[1])
