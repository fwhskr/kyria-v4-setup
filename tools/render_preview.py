"""Render the screens the firmware code draws, from the host test's draw log.

Uses the exact image and font bytes compiled into the firmware
(smooth_assets.c), the positions the real display code chose, and Quantum
Painter's colour rules: 16 steps from the colour down to black of the same hue,
QMK's HSV-to-RGB conversion, and the panel's RGB565 precision.
Output: images/preview.png (every screen) and images/preview-pairs.png (the
two halves side by side, enlarged).
"""
import re
import sys
from pathlib import Path

from generate_smooth import KEYMAP, decode, decode_qff, qmk_hsv_to_rgb, rgb565
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'images'
SCREEN_W, SCREEN_H = 135, 240


def palette(h, s, v):
    return [rgb565(qmk_hsv_to_rgb(h, s, v * i // 15)) for i in range(16)]


def paint(panel, x, y, width, pixels, colours):
    for i, level in enumerate(pixels):
        if level:
            panel.putpixel((x + i % width, y + i // width), colours[level // 17])


def main(log_path):
    source = (KEYMAP / 'smooth_assets.c').read_text()
    assets = {name: bytes(int(x, 16) for x in re.findall(r'0x([0-9a-f]{2})', body))
              for name, body in re.findall(r'uint8_t (\w+)\[\d+\] = \{([^}]*)\}', source)}
    fonts = {size: decode_qff(assets[f'row_font_{size}']) for size in ('large', 'small')}
    screens = []
    for line in Path(log_path).read_text().splitlines():
        kind, _, rest = line.partition(' ')
        if kind == 'screen':
            screens.append(Image.new('RGB', (SCREEN_W, SCREEN_H), 'black'))
        elif kind == 'image':
            name, x, y, w, h, hue, sat, val = rest.split()
            x, y, w, h = int(x), int(y), int(w), int(h)
            pixels = decode(assets[name])
            assert len(pixels) == w * h
            paint(screens[-1], x, y, w, pixels, palette(int(hue), int(sat), int(val)))
        elif kind == 'text':
            size, x, y, hue, sat, val, text = rest.split(' ', 6)
            x, y = int(x), int(y)
            line_height, glyphs = fonts[size]
            colours = palette(int(hue), int(sat), int(val))
            for char in text:
                width, pixels = glyphs[char]
                paint(screens[-1], x, y, width, pixels, colours)
                x += width
    cols = 10
    rows = (len(screens) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 150 + 15, rows * 255 + 15), (34, 34, 34))
    for i, panel in enumerate(screens):
        sheet.paste(panel, (15 + (i % cols) * 150, 15 + (i // cols) * 255))
    sheet.save(DOCS / 'preview.png')
    # Left and right screens next to each other, as on the keyboard: the
    # test's last four screens are left screens; pair them with right screens.
    lefts, rights = screens[-4:], [screens[i] for i in (0, 7, 19, 33) if i < len(screens) - 4]
    pairs = Image.new('RGB', (len(rights) * 300 + 20, 260), (34, 34, 34))
    for n, (left, right) in enumerate(zip(lefts, rights, strict=False)):
        pairs.paste(left, (20 + n * 300, 10))
        pairs.paste(right, (20 + n * 300 + 140, 10))
    pairs.resize((pairs.width * 2, pairs.height * 2), Image.Resampling.NEAREST).save(DOCS / 'preview-pairs.png')
    print(f'{len(screens)} screens rendered to {DOCS / "preview.png"} and preview-pairs.png')


if __name__ == '__main__':
    main(sys.argv[1])
