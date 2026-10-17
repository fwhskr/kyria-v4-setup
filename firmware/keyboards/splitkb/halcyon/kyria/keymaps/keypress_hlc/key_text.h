// SPDX-License-Identifier: GPL-2.0-or-later
#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "keycodes.h"
#include "layout_tables.h"

// QMK's encoded modifier masks use the low four bits plus a right-hand flag.
static inline const char *modifier_symbol(uint8_t encoded) {
    switch (encoded & 15) {
        case 1: return "@CTRL";
        case 2: return "@SHIFT";
        case 4: return "@ALT";
        case 8: return "@GUI";
        default: return "@MODS";
    }
}

// Display text for a key, after QMK has resolved the layer and tap/hold action.
// Typing keys show what the computer's keyboard language types (UTF-8, letters
// uppercase). @ tokens are drawn as large symbols. Returns 0 only for keys with
// no action (KC_NO, KC_TRNS), so the previous key stays on screen.
static inline const char *key_text(uint16_t keycode, bool shift, bool altgr, uint8_t layout,
                                   bool num_lock) {
    if (layout >= KEY_LAYOUT_COUNT) layout = 0;
    const bool keypad = (keycode >= KC_KP_1 && keycode <= KC_KP_DOT);
    if (keypad && !num_lock) {
        // With Num Lock off the number pad moves the cursor instead.
        static const char *const navigation[] = {
            "@END", "@DOWN", "@PGDN", "@LEFT", "@KEY", "@RIGHT",
            "@HOME", "@UP", "@PGUP", "@INSERT", "@DELETE"};
        return navigation[keycode - KC_KP_1];
    }
    if (keycode < 256 && key_table_row[keycode]) {
        const uint8_t level = (shift ? 1 : 0) | (altgr && key_layout_has_altgr[layout] ? 2 : 0);
        const char *text = key_table[layout][key_table_row[keycode] - 1][level];
        return text ? text : "@KEY";
    }
    if ((keycode >= KC_F1 && keycode <= KC_F12) || (keycode >= KC_F13 && keycode <= KC_F24)) {
        static const char *const functions[] = {
            "@F1", "@F2", "@F3", "@F4", "@F5", "@F6", "@F7", "@F8",
            "@F9", "@F10", "@F11", "@F12", "@F13", "@F14", "@F15", "@F16",
            "@F17", "@F18", "@F19", "@F20", "@F21", "@F22", "@F23", "@F24"
        };
        return functions[keycode <= KC_F12 ? keycode - KC_F1 : keycode - KC_F13 + 12];
    }
    if (IS_QK_MOMENTARY(keycode) || IS_QK_TO(keycode) || IS_QK_DEF_LAYER(keycode) ||
        IS_QK_TOGGLE_LAYER(keycode) || IS_QK_ONE_SHOT_LAYER(keycode) ||
        IS_QK_LAYER_TAP_TOGGLE(keycode) || IS_QK_PERSISTENT_DEF_LAYER(keycode)) return "@LAYER";
    if (keycode >= QK_RGB_MATRIX_ON && keycode <= QK_RGB_MATRIX_SPEED_DOWN) return "@LIGHT";
    switch (keycode) {
        case KC_SPC: return "@SPACE";
        case KC_ENT: case KC_PENT: return "@ENTER";
        case KC_BSPC: return "@BKSP";
        case KC_TAB: return "@TAB";
        case KC_ESC: return "@ESC";
        case KC_DEL: return "@DELETE";
        case KC_LEFT: return "@LEFT";
        case KC_RGHT: return "@RIGHT";
        case KC_UP: return "@UP";
        case KC_DOWN: return "@DOWN";
        case KC_HOME: return "@HOME";
        case KC_END: return "@END";
        case KC_PGUP: return "@PGUP";
        case KC_PGDN: return "@PGDN";
        case KC_INS: return "@INSERT";
        case KC_PSCR: return "@PRINT";
        case KC_PAUS: return "@PAUSE";
        case KC_CAPS: case KC_LCAP: return "@CAPS";
        case KC_NUM: case KC_LNUM: return "@NUM";
        case KC_SCRL: case KC_LSCR: return "@SCROLL";
        case KC_LCTL: case KC_RCTL: return "@CTRL";
        case KC_LSFT: case KC_RSFT: return "@SHIFT";
        case KC_LALT: case KC_RALT: return "@ALT";
        case KC_LGUI: case KC_RGUI: return "@GUI";
        case KC_APP: case KC_MENU: return "@MENU";
        case KC_MUTE: return "@MUTE";
        case KC_VOLU: return "@VOLUP";
        case KC_VOLD: return "@VOLDOWN";
        case KC_MPLY: return "@PLAY";
        case KC_MSTP: case KC_STOP: return "@STOP";
        case KC_MNXT: case KC_MFFD: return "@NEXT";
        case KC_MPRV: case KC_MRWD: return "@PREV";
        case KC_SYSTEM_POWER: case KC_SYSTEM_WAKE: return "@POWER";
        case KC_SYSTEM_SLEEP: return "@SLEEP";
        case KC_NO: case KC_TRNS: return 0;
        // Unrecognized firmware actions still acknowledge the physical press.
        default: return "@KEY";
    }
}
