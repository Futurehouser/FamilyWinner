"""Genera el icono de FamilyWinner: un abanico de cartas con una familia dibujada.

Salidas: build/icon.png (1024), build/icon.ico y, si existe android/, los mipmaps.
Uso: python scripts/make_icon.py
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024
SS = 4  # supermuestreo para bordes suaves

FELT = (15, 81, 50)
FELT_LIGHT = (28, 128, 80)
GOLD = (224, 165, 38)
CARD = (255, 250, 240)
INK = (43, 33, 24)
FAMILY = [(192, 57, 43), (36, 113, 163), (46, 139, 87)]  # padre, madre, hijo


def rounded_card(size, radius, border, fill, border_col):
    w, h = size
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=border_col)
    d.rounded_rectangle([border, border, w - 1 - border, h - 1 - border], radius=radius - border, fill=fill)
    return im


def person(d, cx, top, scale, col):
    head_r = 34 * scale
    d.ellipse([cx - head_r, top, cx + head_r, top + 2 * head_r], fill=col)
    body_w = 62 * scale
    body_top = top + 2 * head_r + 8 * scale
    d.rounded_rectangle([cx - body_w, body_top, cx + body_w, body_top + 120 * scale], radius=int(48 * scale), fill=col)


def draw_front(w, h, k):
    card = rounded_card((w, h), 40 * k, 14 * k, CARD, GOLD)
    d = ImageDraw.Draw(card)
    # familia: padre, madre e hijo
    base = h * 0.30
    person(d, w * 0.30, base, 1.0 * k, FAMILY[0])
    person(d, w * 0.70, base, 1.0 * k, FAMILY[1])
    person(d, w * 0.50, base + 95 * k, 0.72 * k, FAMILY[2])
    # corazón arriba
    cx, cy, r = w / 2, h * 0.16, 30 * k
    d.ellipse([cx - r * 1.9, cy - r, cx, cy + r * 0.9], fill=GOLD)
    d.ellipse([cx, cy - r, cx + r * 1.9, cy + r * 0.9], fill=GOLD)
    d.polygon([(cx - r * 1.82, cy + r * 0.2), (cx + r * 1.82, cy + r * 0.2), (cx, cy + r * 2.1)], fill=GOLD)
    # tres puntos (tres generaciones) abajo
    for i, col in enumerate(FAMILY):
        x = w / 2 + (i - 1) * 46 * k
        y = h * 0.89
        d.ellipse([x - 13 * k, y - 13 * k, x + 13 * k, y + 13 * k], fill=col)
    return card


def make_master(transparent_bg=False, content_scale=1.0):
    k = SS
    size = S * k
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if not transparent_bg:
        bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(bg)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=220 * k, fill=FELT)
        # brillo radial sencillo
        glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for i in range(40):
            r = size * (0.62 - i * 0.012)
            a = int(4 + i * 1.2)
            gd.ellipse([size / 2 - r, size * 0.42 - r, size / 2 + r, size * 0.42 + r], fill=FELT_LIGHT + (a,))
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=220 * k, fill=255)
        bg.alpha_composite(Image.composite(glow, Image.new('RGBA', (size, size)), mask))
        img.alpha_composite(bg)

    ck = k * content_scale
    cw, ch = int(430 * ck), int(620 * ck)
    cx, cy = size / 2, size / 2 + 30 * ck
    # cartas traseras en abanico
    back_cols = [(36, 113, 163), (192, 57, 43)]
    for ang, col in [(-24, back_cols[0]), (24, back_cols[1])]:
        c = rounded_card((cw, ch), int(40 * ck), int(14 * ck), col, CARD)
        cd = ImageDraw.Draw(c)
        inset = 40 * ck
        cd.rounded_rectangle([inset, inset, cw - inset, ch - inset], radius=int(24 * ck), outline=CARD, width=int(8 * ck))
        r = c.rotate(ang, resample=Image.BICUBIC, expand=True)
        dx = math.sin(math.radians(ang)) * 150 * ck
        img.alpha_composite(r, (int(cx - r.width / 2 - dx), int(cy - r.height / 2 + 20 * ck)))
    # sombra + carta frontal
    front = draw_front(cw, ch, ck)
    shadow = Image.new('RGBA', front.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([0, 0, cw - 1, ch - 1], radius=int(40 * ck), fill=(0, 0, 0, 90))
    img.alpha_composite(shadow, (int(cx - cw / 2 + 14 * ck), int(cy - ch / 2 + 22 * ck)))
    img.alpha_composite(front, (int(cx - cw / 2), int(cy - ch / 2)))
    return img.resize((S, S), Image.LANCZOS)


def main():
    build = os.path.join(ROOT, 'build')
    os.makedirs(build, exist_ok=True)
    icon = make_master()
    icon.save(os.path.join(build, 'icon.png'))
    icon.save(os.path.join(build, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    # icono adaptativo de Android: primer plano dentro de la zona segura (~66%)
    fg = make_master(transparent_bg=True, content_scale=0.62)
    fg.save(os.path.join(build, 'icon-foreground.png'))

    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if os.path.isdir(res):
        dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
        for name, f in dens.items():
            d = os.path.join(res, 'mipmap-' + name)
            os.makedirs(d, exist_ok=True)
            n = int(48 * f)
            icon.resize((n, n), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
            round_mask = Image.new('L', (n, n), 0)
            ImageDraw.Draw(round_mask).ellipse([0, 0, n - 1, n - 1], fill=255)
            full = make_square_bg(n)
            full.alpha_composite(fg.resize((n, n), Image.LANCZOS))
            rnd = Image.new('RGBA', (n, n), (0, 0, 0, 0))
            rnd.paste(full, (0, 0), round_mask)
            rnd.save(os.path.join(d, 'ic_launcher_round.png'))
            m = int(108 * f)
            fg.resize((m, m), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
        values = os.path.join(res, 'values')
        os.makedirs(values, exist_ok=True)
        with open(os.path.join(values, 'ic_launcher_background.xml'), 'w', encoding='utf-8') as fh:
            fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                     '    <color name="ic_launcher_background">#0F5132</color>\n</resources>\n')
    print('Iconos generados')


def make_square_bg(n):
    return Image.new('RGBA', (n, n), FELT + (255,))


if __name__ == '__main__':
    main()
