"""Generate the smooth (anti-aliased) display assets for both Kyria screens.

Large characters: Roboto Mono (DejaVu Sans Mono for the few characters Roboto
Mono lacks). Key symbols: Material Symbols Rounded, weight chosen so its
strokes match the letters. Text rows: Roboto Mono Quantum Painter fonts.
Colours: Lumi Earth sand (large character), leaf and mist (text rows).

Every image and font is 4-bit (16-level) and encoded by QMK's own QGF/QFF
writers, then decoded again here to prove it round-trips exactly. Screen
geometry is computed here from the real glyph extents and written to the
header, so nothing can overlap or leave the screen.
"""
import colorsys
import io
import logging
import os
import sys
from importlib import import_module
from pathlib import Path

import generate_layouts
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
# QMK's Python library lives in the Vial QMK checkout that setup.sh fetches.
QMK_HOME = Path(os.environ.get('QMK_HOME', ROOT / '.deps/vial-qmk'))
sys.path.insert(0, str(QMK_HOME / 'lib/python'))
qmk_painter = import_module('qmk.painter')
import_module('qmk.painter_qgf')  # registers the QGF image writer with PIL
qmk_qff = import_module('qmk.painter_qff')

FONTS = ROOT / 'fonts'
TEXT_FONT = FONTS / 'RobotoMono.ttf'
FALLBACK_FONT = FONTS / 'DejaVuSansMono.ttf'
ICON_FONT = FONTS / 'MaterialSymbolsRounded.ttf'
KEYMAP = ROOT / 'firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc'
SCREEN_W, SCREEN_H = 135, 240
CAP_HEIGHT = 100          # height of large capital letters and digits, in pixels
TEXT_WEIGHT = 400
ROW_CAPS = {'large': 17, 'small': 13}  # capital height of the two text-row sizes
ROW_GAP = 3               # pixels between the two text rows' line boxes
BOTTOM_MARGIN = 3
ICON_BOX = 110            # longest side of a key symbol
MAX_WIDTH = SCREEN_W - 10  # always keep at least 5 pixels each side
FORMAT = qmk_painter.valid_formats['mono16']

# Lumi Earth palette (the Lumi desktop theme's stone, sand & sage colours).
COLOURS = {
    'MAIN': 0xD0C6B4,   # sand: large character / symbol / layer number
    'ROW1': 0xAFC29B,   # leaf: layer name (left), held modifiers (right)
    'ROW2': 0xA8B9C5,   # mist: keyboard language (left), user name (right)
}

SYMBOLS = {
    'CTRL': 0xeae6, 'ALT': 0xeae8, 'GUI': 0xeae7, 'SHIFT': 0xe5f2, 'CAPS': 0xe318,
    'MODS': 0xf67b, 'ENTER': 0xe31b, 'SPACE': 0xe256, 'TAB': 0xe31c, 'BKSP': 0xe14a,
    'DELETE': (0xe14a, 'mirror'), 'ESC': 0xe879, 'LEFT': 0xe5c4, 'RIGHT': 0xe5c8,
    'UP': 0xe5d8, 'DOWN': 0xe5db, 'HOME': 0xe5dc, 'END': 0xe5dd, 'PGUP': 0xeacf,
    'PGDN': 0xead0, 'INSERT': 0xe146, 'NUM': 0xe9ef, 'SCROLL': 0xe8d5, 'MENU': 0xe5d2,
    'PRINT': 0xec08, 'PAUSE': 0xe034, 'STOP': 0xe047, 'PLAY': 0xf137, 'NEXT': 0xe044,
    'PREV': 0xe045, 'MUTE': 0xe04f, 'VOLUP': 0xe050, 'VOLDOWN': 0xe04d,
    'POWER': 0xf8c7, 'SLEEP': 0xf159, 'LIGHT': 0xe518, 'LAYER': 0xe53b, 'KEY': 0xe312,
}
# Media transport symbols read best solid, as on media players.
FILLED = {'PAUSE', 'STOP', 'PLAY', 'NEXT', 'PREV'}
# Text rows: ASCII, Latin-1 and the remaining Estonian letters. The computer
# helper replaces anything else with '?', so every row character is drawable.
ROW_CHARS = ''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(
    chr(c) for c in range(0xA1, 0x100) if c != 0xAD) + 'ŠšŽž…'


def font_spec(path, size, axes):
    return (path, size, axes)


def text_font(size, weight=TEXT_WEIGHT):
    return font_spec(TEXT_FONT, size, [weight])


def icon_font(size, weight, fill=0):
    return font_spec(ICON_FONT, size, [fill, 0, 48, weight])  # Fill, Grade, Optical size, Weight


def load(spec, scale=1):
    path, size, axes = spec
    font = ImageFont.truetype(str(path), round(size * scale))
    if axes:
        font.set_variation_by_axes(axes)
    return font


def render(spec, text, scale=4):
    """Render supersampled then downsample: smooth, accurate coverage."""
    big = load(spec, scale)
    em = int(big.size)
    canvas = Image.new('L', (em * (len(text) + 3), em * 3))
    ImageDraw.Draw(canvas).text((em, em * 2), text, font=big, fill=255, anchor='ls')
    canvas = canvas.resize((canvas.width // scale, canvas.height // scale), Image.Resampling.BOX)
    return canvas, em * 2 // scale  # image, baseline row


def _drawn(font, char):
    canvas = Image.new('L', (font.size * 3, font.size * 3))
    ImageDraw.Draw(canvas).text((font.size, font.size * 2), char, font=font, fill=255, anchor='ls')
    return canvas.tobytes()


def has_glyph(spec, char):
    """False when the font would draw its missing-glyph box (or nothing)."""
    font = load(spec)
    return _drawn(font, char) != _drawn(font, '\U0010FFFD')


VISIBLE = [255 if v >= 16 else 0 for v in range(256)]  # pixels that count as ink


def ink(image):
    box = image.point(VISIBLE).getbbox()
    assert box, 'empty glyph'
    return box


def stroke(image):
    """Typical stroke thickness: median horizontal run length of solid ink."""
    runs = []
    for y in range(image.height):
        n = 0
        for x in range(image.width + 1):
            if x < image.width and image.getpixel((x, y)) >= 128:
                n += 1
            elif n:
                runs.append(n)
                n = 0
    runs.sort()
    return runs[len(runs) // 2]


def quantize(image):
    return image.point([round(v / 17) * 17 for v in range(256)])


def size_for_cap(path, cap, axes=None):
    """Font size whose capital H is exactly `cap` pixels tall."""
    size = cap * 1.4
    for _ in range(30):
        height = ink(render(font_spec(path, size, axes), 'H')[0])
        height = height[3] - height[1]
        if height == cap:
            return size
        size *= cap / height if abs(height - cap) > 1 else (1.01 if height < cap else 0.99)
    raise AssertionError(f'cannot size {path.name} to {cap}px capitals')


def encode(image):
    data = io.BytesIO()
    image.convert('RGB').save(data, 'QGF', qmk_format=FORMAT, use_rle=True, use_deltas=False)
    raw = data.getvalue()
    assert decode(raw) == list(image.tobytes()), 'QGF round trip failed'
    return raw


def _blocks(raw):
    offset, blocks = 0, {}
    while offset < len(raw):
        kind = raw[offset]
        assert raw[offset + 1] == (~kind) & 0xFF
        length = int.from_bytes(raw[offset + 2:offset + 5], 'little')
        blocks[kind] = raw[offset + 5:offset + 5 + length]
        offset += 5 + length
    return blocks


def _unrle(data, start, count):
    """QMK run-length decoding of `count` bytes starting at `start`."""
    out, i = bytearray(), start
    while len(out) < count:
        marker = data[i]
        if marker >= 128:
            out += data[i + 1:i + 1 + marker - 127]
            i += 1 + marker - 127
        else:
            out += bytes([data[i + 1]]) * marker
            i += 2
    assert len(out) == count, 'run crosses glyph boundary'
    return bytes(out)


def _pixels(data, count):
    pixels = []
    for byte in data:
        pixels += [(byte & 15) * 17, (byte >> 4) * 17]
    return pixels[:count]


def decode(raw):
    """Independent QGF mono16 decoder used to check every encoded image."""
    blocks = _blocks(raw)
    width = int.from_bytes(blocks[0][12:14], 'little')
    height = int.from_bytes(blocks[0][14:16], 'little')
    assert blocks[2][0] == FORMAT['image_format_byte']
    data = blocks[5]
    if blocks[2][2] == 1:
        data = _unrle(data, 0, (width * height + 1) // 2)
    return _pixels(data, width * height)


def decode_qff(raw):
    """Independent QFF mono16 decoder: line height, {char: (width, pixels)}."""
    blocks = _blocks(raw)
    descriptor = blocks[0]
    assert int.from_bytes(descriptor[0:3], 'little') == 0x464651
    line_height = descriptor[12]
    has_ascii, unicode_count = descriptor[13], int.from_bytes(descriptor[14:16], 'little')
    assert descriptor[16] == FORMAT['image_format_byte']
    compressed = descriptor[18] == 1
    entries = []
    if has_ascii:
        for n in range(95):
            entries.append((chr(0x20 + n), int.from_bytes(blocks[1][n * 3:n * 3 + 3], 'little')))
    for n in range(unicode_count):
        entry = blocks[2][n * 6:n * 6 + 6]
        entries.append((chr(int.from_bytes(entry[:3], 'little')), int.from_bytes(entry[3:], 'little')))
    glyphs = {}
    for char, value in entries:
        width, offset = value & 0x3F, value >> 6
        count = width * line_height
        size = (count + 1) // 2
        data = _unrle(blocks[4], offset, size) if compressed else blocks[4][offset:offset + size]
        glyphs[char] = (width, _pixels(data, count))
    return line_height, glyphs


def qmk_hsv_to_rgb(h, s, v):
    """quantum/color.c hsv_to_rgb_nocie, as Quantum Painter converts colours."""
    if s == 0:
        return v, v, v
    region = h * 6 // 255
    remainder = ((h * 2 - region * 85) * 3) & 0xFF
    p = (v * (255 - s)) >> 8
    q = (v * (255 - ((s * remainder) >> 8))) >> 8
    t = (v * (255 - ((s * (255 - remainder)) >> 8))) >> 8
    return [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q), (v, t, p)][region]


def rgb565(rgb):
    """What the RGB565 panel shows for an RGB888 colour."""
    r, g, b = rgb
    return ((r >> 3) * 255 // 31, (g >> 2) * 255 // 63, (b >> 3) * 255 // 31)


def best_hsv(target):
    """QMK HSV whose on-panel colour is closest to an sRGB hex colour."""
    rgb = ((target >> 16) & 255, (target >> 8) & 255, target & 255)
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    best = (float('inf'), (0, 0, 0))
    for hh in range(round(h * 255) - 8, round(h * 255) + 9):
        for ss in range(max(0, round(s * 255) - 10), min(255, round(s * 255) + 11)):
            for vv in range(max(0, round(v * 255) - 6), min(255, round(v * 255) + 7)):
                shown = rgb565(qmk_hsv_to_rgb(hh % 256, ss, vv))
                error = sum((a - b) ** 2 for a, b in zip(shown, rgb, strict=True))
                if error < best[0]:
                    best = (error, (hh % 256, ss, vv))
    return best[1]


def large_glyphs():
    """Every character a key can show, sized to CAP_HEIGHT capitals."""
    main = text_font(size_for_cap(TEXT_FONT, CAP_HEIGHT, [TEXT_WEIGHT]))
    fallback = font_spec(FALLBACK_FONT, size_for_cap(FALLBACK_FONT, CAP_HEIGHT), None)
    chars = {chr(c) for c in range(33, 127) if not 'a' <= chr(c) <= 'z'}
    chars |= generate_layouts.characters()
    chars.discard(' ')
    glyphs = {}
    for char in sorted(chars):
        spec = main if has_glyph(main, char) else fallback
        assert has_glyph(spec, char), f'no font has {char!r}'
        image, baseline = render(spec, char)
        cap_top = ink(render(spec, 'H')[0])[1]
        box = ink(image)
        glyph = quantize(image.crop(box))
        assert glyph.width <= MAX_WIDTH, char
        # Vertical position relative to the top of the capital-letter band.
        glyphs[char] = (glyph, box[1] - cap_top, spec is fallback)
    return main, glyphs


def row_font(cap):
    """A monospace Quantum Painter font whose capitals are `cap` pixels tall."""
    size = size_for_cap(TEXT_FONT, cap, [TEXT_WEIGHT])
    spec = text_font(size)
    cell = round(load(spec, 1).getlength('H'))
    assert cell <= 63, 'QFF glyphs are at most 63 pixels wide'
    scale = 4
    big = load(spec, scale)
    # Tight line box from the real ink of every row character.
    tops, bottoms = [], []
    for char in ROW_CHARS.strip():
        image, baseline = render(spec, char)
        box = image.point(VISIBLE).getbbox()
        if box:
            tops.append(box[1] - baseline)
            bottoms.append(box[3] - baseline)
    ascent, descent = -min(tops), max(bottoms)
    line = ascent + descent
    order = list(dict.fromkeys(chr(c) for c in range(0x20, 0x7F))) + [
        c for c in ROW_CHARS if ord(c) > 0x7E]
    strip = Image.new('RGB', (cell * len(order), line + 1))
    for n, char in enumerate(order):
        canvas = Image.new('L', (cell * scale, line * scale))
        advance = big.getlength(char)
        ImageDraw.Draw(canvas).text(((cell * scale - advance) / 2, ascent * scale), char,
                                    font=big, fill=255, anchor='ls')
        glyph = quantize(canvas.resize((cell, line), Image.Resampling.BOX))
        strip.paste(glyph.convert('RGB'), (n * cell, 1))
        strip.putpixel((n * cell, 0), (255, 0, 255))  # glyph start marker
    font = qmk_qff.QFFFont(logging.getLogger('qff'))
    font._parse_image(strip, True, ''.join(order[95:]))
    out = io.BytesIO()
    font.save_to_qff(FORMAT, True, out)
    raw = out.getvalue()
    # Prove the encoded font holds exactly the rendered pixels.
    height, decoded = decode_qff(raw)
    assert height == line and set(decoded) == set(order)
    for n, char in enumerate(order):
        expect = strip.crop((n * cell, 1, (n + 1) * cell, line + 1)).convert('L').tobytes()
        assert decoded[char] == (cell, list(expect)), f'QFF round trip failed for {char!r}'
    return raw, ascent, line, cell, size


def main():
    generate_layouts.write_header()
    main_font, glyphs = large_glyphs()
    text_stroke = stroke(render(main_font, 'I')[0].crop(ink(render(main_font, 'I')[0])))

    # Text rows at the bottom, large size line boxes; small text shares baselines.
    rows = {name: row_font(cap) for name, cap in ROW_CAPS.items()}
    large_ascent, large_line = rows['large'][1], rows['large'][2]
    row2_top = SCREEN_H - BOTTOM_MARGIN - large_line
    row1_top = row2_top - ROW_GAP - large_line
    glyph_area = row1_top - 2  # large characters and symbols live above this

    # Centre the large characters' full extent (accents to descenders) in the area.
    extent_top = min(top for _, top, _ in glyphs.values())
    extent_bottom = max(top + image.height for image, top, _ in glyphs.values())
    cap_top = (glyph_area - (extent_bottom - extent_top)) // 2 - extent_top
    assert cap_top + extent_top >= 0, 'accents leave the screen'
    assert cap_top + extent_bottom <= glyph_area, 'descenders reach the text rows'

    assets, char_entries = {}, []
    for char, (image, top, _) in glyphs.items():
        name = f'char_{ord(char):04x}'
        assets[name] = encode(image)
        char_entries.append((ord(char), name, top))

    # Choose the icon weight whose strokes best match the letters.
    best = (float('inf'), 400)
    for weight in range(300, 701, 25):
        menu, _ = render(icon_font(128, weight), chr(0xe5d2))
        menu = menu.crop(ink(menu))
        rotated = menu.rotate(90, expand=True)  # the menu bars' thickness, measured across
        difference = abs(stroke(rotated) * ICON_BOX / max(menu.size) - text_stroke)
        if difference < best[0]:
            best = (difference, weight)
    icon_weight = best[1]

    symbol_table = {}
    for name, spec in SYMBOLS.items():
        code, transform = (spec if isinstance(spec, tuple) else (spec, None))
        image, _ = render(icon_font(160, icon_weight, 1 if name in FILLED else 0), chr(code))
        image = image.crop(ink(image))
        scale = ICON_BOX / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)),
                             Image.Resampling.LANCZOS)
        if transform == 'mirror':
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        image = quantize(image.crop(ink(image)))
        assert image.width <= MAX_WIDTH and image.height <= glyph_area, name
        symbol_table[name] = f'sym_{name.lower()}'
        assets[f'sym_{name.lower()}'] = encode(image)

    # Function keys: the same font, sized so the widest label (F24) still fits.
    f_size = main_font[1]
    while ink(render(text_font(f_size), 'F24')[0])[2] - ink(render(text_font(f_size), 'F24')[0])[0] > 115:
        f_size -= 1
    for number in range(1, 25):
        image, _ = render(text_font(f_size), f'F{number}')
        name = f'sym_f{number}'
        symbol_table[f'F{number}'] = name
        assets[name] = encode(quantize(image.crop(ink(image))))

    colours = {name: best_hsv(rgb) for name, rgb in COLOURS.items()}

    lines = ['// SPDX-License-Identifier: GPL-2.0-or-later',
             '// Generated by generate_smooth.py from Roboto Mono, DejaVu Sans Mono and',
             '// Material Symbols Rounded. 4-bit anti-aliased Quantum Painter images and fonts.',
             '#include "smooth_assets.h"', '']
    for name, raw in assets.items():
        body = ', '.join(f'0x{b:02x}' for b in raw)
        lines.append(f'static const uint8_t {name}[{len(raw)}] = {{{body}}};')
    for name, (raw, *_) in rows.items():
        body = ', '.join(f'0x{b:02x}' for b in raw)
        lines.append(f'const uint8_t row_font_{name}[{len(raw)}] = {{{body}}};')
    lines.append('')
    lines.append(f'const smooth_char_t smooth_chars[{len(char_entries)}] = {{')
    lines += [f'    {{0x{code:04x}, {name}, {top}}},' for code, name, top in sorted(char_entries)]
    lines += ['};', '']
    lines.append(f'const smooth_symbol_t smooth_symbols[{len(symbol_table)}] = {{')
    lines += [f'    {{"@{key}", {name}}},' for key, name in symbol_table.items()]
    lines += ['};', '']
    (KEYMAP / 'smooth_assets.c').write_text('\n'.join(lines))

    header = [
        '// SPDX-License-Identifier: GPL-2.0-or-later',
        '// Generated by generate_smooth.py: assets plus screen geometry and colours.',
        '#pragma once', '#include <stdint.h>', '',
        '// Large character: capital band height and its top edge on screen.',
        f'#define SMOOTH_CAP_HEIGHT {CAP_HEIGHT}',
        f'#define SMOOTH_CAP_TOP {cap_top}',
        '// Large characters and symbols stay above this row; symbols centre in it.',
        f'#define SMOOTH_GLYPH_AREA {glyph_area}',
        '// Text rows: line-box tops (large font) and the baseline within a line box.',
        f'#define ROW1_TOP {row1_top}',
        f'#define ROW2_TOP {row2_top}',
        f'#define ROW_LARGE_ASCENT {large_ascent}',
        f'#define ROW_SMALL_ASCENT {rows["small"][1]}',
        f'#define ROW_LARGE_LINE {large_line}',
        f'#define ROW_SMALL_LINE {rows["small"][2]}',
        '',
        '// Lumi Earth colours as QMK HSV (closest on the RGB565 panel).',
        *[f'#define HSV_LUMI_{name} {h}, {s}, {v}  // #{COLOURS[name]:06X}'
          for name, (h, s, v) in colours.items()],
        '',
        '// image: Quantum Painter QGF bytes. top: offset of the image\'s top edge',
        '// from the top of the capital-letter band.',
        'typedef struct { uint32_t code; const uint8_t *image; int16_t top; } smooth_char_t;',
        'typedef struct { const char *name; const uint8_t *image; } smooth_symbol_t;', '',
        f'extern const smooth_char_t smooth_chars[{len(char_entries)}];  // sorted by code',
        f'extern const smooth_symbol_t smooth_symbols[{len(symbol_table)}];',
        f'#define SMOOTH_CHAR_COUNT {len(char_entries)}',
        f'#define SMOOTH_SYMBOL_COUNT {len(symbol_table)}',
        f'extern const uint8_t row_font_large[{len(rows["large"][0])}];',
        f'extern const uint8_t row_font_small[{len(rows["small"][0])}];', '']
    (KEYMAP / 'smooth_assets.h').write_text('\n'.join(header))
    (ROOT / 'host/row_font_chars.txt').write_text(ROW_CHARS)

    total = sum(len(raw) for raw in assets.values()) + sum(len(r[0]) for r in rows.values())
    fallback = ''.join(c for c, (_, _, fb) in glyphs.items() if fb)
    print(f'Large: Roboto Mono {main_font[1]:.1f}px (caps {CAP_HEIGHT}px at y={cap_top}, '
          f'stroke {text_stroke}px), {len(glyphs)} characters, DejaVu for {fallback}; '
          f'symbols weight {icon_weight}; F-keys {f_size:.1f}px')
    print(f'Rows: large {rows["large"][4]:.1f}px cell {rows["large"][3]} line {large_line}, '
          f'small {rows["small"][4]:.1f}px cell {rows["small"][3]} line {rows["small"][2]}; '
          f'row tops {row1_top}/{row2_top}, glyph area {glyph_area}')
    print(f'Colours: {colours}; {len(assets) + 2} assets, {total} bytes, '
          'all QGF/QFF round-trips exact')


if __name__ == '__main__':
    main()
