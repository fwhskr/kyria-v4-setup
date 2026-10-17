"""Generate the keyboard-language tables the Kyria shows typed characters from.

The computer, not the keyboard, decides which character a key types. These
tables ask the system's own keyboard library (libxkbcommon, the one Hyprland
uses) what each key types in each supported language, for plain, Shift, AltGr
and Shift+AltGr. Letters are shown uppercase; a dead key shows its accent.
Output: layout_tables.h in the keypress_hlc keymap.
"""
import ctypes
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEYMAP = ROOT / 'firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc'

# Index = layout id the computer helper sends. 0 is the fallback.
LAYOUTS = [
    ('us', '', 'English (US)'),
    ('ee', '', 'Estonian'),
    ('ee', 'nodeadkeys', 'Estonian (no dead keys)'),
]

# USB HID usage -> Linux evdev key code (linux/drivers/hid/hid-input.c).
TYPING_KEYS = {
    **{0x04 + i: code for i, code in enumerate(
        [30, 48, 46, 32, 18, 33, 34, 35, 23, 36, 37, 38, 50,
         49, 24, 25, 16, 19, 31, 20, 22, 47, 17, 45, 21, 44])},
    **{0x1E + i: 2 + i for i in range(10)},
    0x2D: 12, 0x2E: 13, 0x2F: 26, 0x30: 27, 0x31: 43, 0x32: 43, 0x33: 39,
    0x34: 40, 0x35: 41, 0x36: 51, 0x37: 52, 0x38: 53, 0x64: 86,
}
KEYPAD_KEYS = {
    0x54: 98, 0x55: 55, 0x56: 74, 0x57: 78, 0x59: 79, 0x5A: 80, 0x5B: 81,
    0x5C: 75, 0x5D: 76, 0x5E: 77, 0x5F: 71, 0x60: 72, 0x61: 73, 0x62: 82,
    0x63: 83, 0x67: 117, 0x85: 121,
}
EVDEV_SHIFT, EVDEV_ALTGR, EVDEV_NUMLOCK = 42, 100, 69

# A dead key types nothing by itself; show the accent it adds.
DEAD_KEYS = {
    'dead_grave': '`', 'dead_acute': '´', 'dead_circumflex': '^', 'dead_tilde': '~',
    'dead_macron': '¯', 'dead_breve': '˘', 'dead_abovedot': '˙', 'dead_diaeresis': '¨',
    'dead_abovering': '˚', 'dead_doubleacute': '˝', 'dead_caron': 'ˇ',
    'dead_cedilla': '¸', 'dead_ogonek': '˛',
}


class _RuleNames(ctypes.Structure):
    _fields_ = [(name, ctypes.c_char_p) for name in ('rules', 'model', 'layout', 'variant', 'options')]


def _xkb():
    lib = ctypes.CDLL('libxkbcommon.so.0')
    lib.xkb_context_new.restype = ctypes.c_void_p
    lib.xkb_keymap_new_from_names.restype = ctypes.c_void_p
    lib.xkb_keymap_new_from_names.argtypes = [ctypes.c_void_p, ctypes.POINTER(_RuleNames), ctypes.c_int]
    lib.xkb_state_new.restype = ctypes.c_void_p
    lib.xkb_state_new.argtypes = [ctypes.c_void_p]
    lib.xkb_state_unref.argtypes = [ctypes.c_void_p]
    lib.xkb_state_update_key.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int]
    lib.xkb_state_key_get_one_sym.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    lib.xkb_state_key_get_one_sym.restype = ctypes.c_uint32
    lib.xkb_keysym_to_utf32.argtypes = [ctypes.c_uint32]
    lib.xkb_keysym_to_utf32.restype = ctypes.c_uint32
    lib.xkb_keysym_get_name.argtypes = [ctypes.c_uint32, ctypes.c_char_p, ctypes.c_size_t]
    return lib


def display_form(char):
    """Letters always show uppercase, when that is a single Latin capital."""
    upper = char.upper()
    if (unicodedata.category(char) == 'Ll' and len(upper) == 1
            and 'LATIN' in unicodedata.name(upper, '')):
        return upper
    return char


def _symbol(lib, state, evdev):
    sym = lib.xkb_state_key_get_one_sym(state, evdev + 8)
    code = lib.xkb_keysym_to_utf32(sym)
    if code >= 0x20 and code != 0x7F:
        return display_form(chr(code))
    name = ctypes.create_string_buffer(64)
    lib.xkb_keysym_get_name(sym, name, 64)
    return DEAD_KEYS.get(name.value.decode())  # None: nothing displayable


def tables():
    """{layout index: {hid: [plain, shift, altgr, shift+altgr]}}, has_altgr list."""
    lib = _xkb()
    context = lib.xkb_context_new(0)
    result, has_altgr = [], []
    for layout, variant, _ in LAYOUTS:
        names = _RuleNames(b'evdev', b'pc105', layout.encode(), variant.encode(), None)
        keymap = lib.xkb_keymap_new_from_names(context, ctypes.byref(names), 0)
        assert keymap, f'unknown keyboard layout {layout}({variant})'
        table = {}
        for hid, evdev in TYPING_KEYS.items():
            levels = []
            for shift, altgr in ((0, 0), (1, 0), (0, 1), (1, 1)):
                state = lib.xkb_state_new(keymap)
                if shift:
                    lib.xkb_state_update_key(state, EVDEV_SHIFT + 8, 1)
                if altgr:
                    lib.xkb_state_update_key(state, EVDEV_ALTGR + 8, 1)
                levels.append(_symbol(lib, state, evdev))
                lib.xkb_state_unref(state)
            table[hid] = levels
        # Keypad: Num Lock on, as the computer starts it; Shift is ignored.
        state = lib.xkb_state_new(keymap)
        lib.xkb_state_update_key(state, EVDEV_NUMLOCK + 8, 1)
        lib.xkb_state_update_key(state, EVDEV_NUMLOCK + 8, 0)
        for hid, evdev in KEYPAD_KEYS.items():
            table[hid] = [_symbol(lib, state, evdev)] * 4
        lib.xkb_state_unref(state)
        result.append(table)
        has_altgr.append(any(levels[2] != levels[0] for hid, levels in table.items()
                             if hid in TYPING_KEYS))
    return result, has_altgr


def characters():
    """Every character any supported layout can show."""
    found = set()
    for table in tables()[0]:
        for levels in table.values():
            found.update(level for level in levels if level)
    return found


def _c_string(text):
    if text is None:
        return '0'
    return '"' + ''.join(f'\\x{b:02x}' for b in text.encode()) + '"'


def write_header():
    layout_tables, has_altgr = tables()
    keys = sorted({**TYPING_KEYS, **KEYPAD_KEYS})
    lines = [
        '// SPDX-License-Identifier: GPL-2.0-or-later',
        '// Generated by generate_layouts.py from the system keyboard library (libxkbcommon).',
        '// What each key types per keyboard language: plain, Shift, AltGr, Shift+AltGr.',
        '// Strings are UTF-8 display forms (letters uppercase, dead keys as accents);',
        '// 0 means the key types nothing that can be shown.',
        '#pragma once',
        '#include <stdbool.h>',
        '#include <stdint.h>',
        '',
        f'#define KEY_LAYOUT_COUNT {len(LAYOUTS)}',
        f'#define KEY_TABLE_SIZE {len(keys)}',
        '',
        '// HID usage -> table row + 1 (0: not a typing key).',
        'static const uint8_t key_table_row[256] = {',
    ]
    lines += [f'    [0x{hid:02x}] = {row + 1},' for row, hid in enumerate(keys)]
    lines += ['};', '', 'static const bool key_layout_has_altgr[KEY_LAYOUT_COUNT] = {',
              '    ' + ', '.join('true' if flag else 'false' for flag in has_altgr), '};', '']
    lines.append('static const char *const key_table[KEY_LAYOUT_COUNT][KEY_TABLE_SIZE][4] = {')
    for (*_, name), table in zip(LAYOUTS, layout_tables, strict=True):
        lines.append(f'    {{ // {name}')
        for hid in keys:
            levels = ', '.join(_c_string(level) for level in table[hid])
            shown = ' '.join(level or '-' for level in table[hid])
            lines.append(f'        {{{levels}}}, // 0x{hid:02x} {shown}')
        lines.append('    },')
    lines += ['};', '']
    (KEYMAP / 'layout_tables.h').write_text('\n'.join(lines))
    return keys


if __name__ == '__main__':
    print(f'{len(write_header())} keys x {len(LAYOUTS)} layouts; '
          f'{len(characters())} distinct characters')
