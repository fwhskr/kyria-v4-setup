// SPDX-License-Identifier: GPL-2.0-or-later
//
// Both Kyria screens, Lumi Earth colours on black:
//   left:  layer number (large), layer name, keyboard language
//   right: last key (large), held modifiers, logged-in user name
// The computer helper (host/kyria_display_helper.py) supplies the user name,
// keyboard language and layer names over raw HID; without it the left screen
// falls back to built-in layer names and the language/user rows stay empty.
#include "quantum.h"
#include "transactions.h"
#include "split_util.h"
#include "via.h"
#include "hlc_tft_display/hlc_tft_display.h"
#include "key_text.h"
#include "smooth_assets.h"

// Everything the screens show, kept on both halves. The USB half collects it
// (keys from the matrix, the rest from the computer) and copies each changed
// field to the other half.
enum display_field {
    FIELD_KEY,        // last key: one UTF-8 character or an @SYMBOL token
    FIELD_LAYOUT,     // byte 0: keyboard language table (layout_tables.h)
    FIELD_USER,       // logged-in user name
    FIELD_LANGUAGE,   // keyboard language name
    FIELD_LAYER_NAME, // + layer: names for layers 0-7
    FIELD_COUNT = FIELD_LAYER_NAME + 8,
};
#define FIELD_SIZE 24 // bytes incl. the final 0; one field per split message
static char fields[FIELD_COUNT][FIELD_SIZE];

typedef struct {
    uint8_t field;
    char    text[FIELD_SIZE];
} field_message_t;

// Raw HID command from the computer: [command, field, UTF-8 text..., 0].
// VIA and Vial pass unknown command ids here; theirs stop at 0x13 and 0xFE.
#define DISPLAY_HID_COMMAND 0x4B

// Names for the current layout's layers, used until the computer sends its own.
static const char *const default_layer_names[8] = {
    "Colemak", "Dvorak", "Gaming", "Nav", "Numbers", "Function", "Adjust", ""};

#define ROW_MAX_WIDTH (LCD_WIDTH - 2) // monospace cells keep their own side space

static void field_sync_handler(uint8_t in_size, const void *data, uint8_t out_size, void *out) {
    (void)out_size;
    (void)out;
    const field_message_t *message = data;
    if (in_size != sizeof(*message) || message->field >= FIELD_COUNT) return;
    memcpy(fields[message->field], message->text, FIELD_SIZE);
    fields[message->field][FIELD_SIZE - 1] = '\0';
}

// Stores text, cut to the field at a whole UTF-8 character.
static void set_field(uint8_t field, const char *text, size_t length) {
    char value[FIELD_SIZE] = {0};
    if (length > FIELD_SIZE - 1) {
        length = FIELD_SIZE - 1;
        while (length && ((uint8_t)text[length] & 0xC0) == 0x80) --length;
    }
    memcpy(value, text, length);
    memcpy(fields[field], value, FIELD_SIZE);
}

void raw_hid_receive_kb(uint8_t *data, uint8_t length) {
    if (length < 3 || data[0] != DISPLAY_HID_COMMAND) {
        data[0] = id_unhandled;
        return;
    }
    const uint8_t field = data[1];
    if (field == FIELD_KEY || field >= FIELD_COUNT) {
        data[2] = 1; // refused
        return;
    }
    uint8_t text_length = 0;
    while (text_length < length - 2 && data[2 + text_length]) ++text_length;
    set_field(field, (const char *)data + 2, text_length);
    if (field == FIELD_LAYOUT) fields[FIELD_LAYOUT][0] = data[2];
    data[2] = 0; // accepted
}

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    if (!record->event.pressed) return true;
    const char *modifier = NULL;
    if (IS_QK_MOD_TAP(keycode) && !record->tap.count) {
        modifier = modifier_symbol(QK_MOD_TAP_GET_MODS(keycode));
    } else if (IS_QK_ONE_SHOT_MOD(keycode)) {
        modifier = modifier_symbol(QK_ONE_SHOT_MOD_GET_MODS(keycode));
    } else if (IS_QK_LAYER_MOD(keycode)) {
        modifier = modifier_symbol(QK_LAYER_MOD_GET_MODS(keycode));
    }
    if (modifier) {
        set_field(FIELD_KEY, modifier, strlen(modifier));
        return true;
    }
    if (IS_QK_MOD_TAP(keycode)) {
        keycode = QK_MOD_TAP_GET_TAP_KEYCODE(keycode);
    } else if (IS_QK_LAYER_TAP(keycode)) {
        keycode = record->tap.count ? QK_LAYER_TAP_GET_TAP_KEYCODE(keycode) : QK_MOMENTARY;
    }
    uint8_t mods = get_mods() | get_weak_mods() | get_oneshot_mods();
    if (IS_QK_MODS(keycode)) {
        uint8_t encoded = QK_MODS_GET_MODS(keycode);
        mods |= (encoded & 0x10) ? (encoded & 0x0F) << 4 : encoded;
        keycode = QK_MODS_GET_BASIC_KEYCODE(keycode);
    }
    const char *text = key_text(keycode, mods & MOD_MASK_SHIFT, mods & MOD_BIT(KC_RALT),
                                (uint8_t)fields[FIELD_LAYOUT][0],
                                host_keyboard_led_state().num_lock);
    if (text) set_field(FIELD_KEY, text, strlen(text));
    return true;
}

bool module_post_init_user(void) {
    transaction_register_rpc(KEYPRESS_DISPLAY_SYNC, field_sync_handler);
    return true;
}

bool module_housekeeping_task_user(void) {
    // The USB half sends one changed field per 25 ms, the last key first. A
    // failed send is retried; a full refresh each second covers a half that
    // restarted or reconnected.
    static char     sent[FIELD_COUNT][FIELD_SIZE];
    static bool     sent_valid[FIELD_COUNT];
    static uint32_t last_attempt;
    static uint32_t last_refresh;
    if (!is_keyboard_master() || !is_transport_connected() ||
        timer_elapsed32(last_attempt) < 25) return true;
    if (timer_elapsed32(last_refresh) >= 1000) {
        memset(sent_valid, 0, sizeof(sent_valid));
        last_refresh = timer_read32();
    }
    for (uint8_t field = 0; field < FIELD_COUNT; ++field) {
        if (sent_valid[field] && !memcmp(sent[field], fields[field], FIELD_SIZE)) continue;
        last_attempt = timer_read32();
        field_message_t message = {.field = field};
        memcpy(message.text, fields[field], FIELD_SIZE);
        if (transaction_rpc_send(KEYPRESS_DISPLAY_SYNC, sizeof(message), &message)) {
            memcpy(sent[field], message.text, FIELD_SIZE);
            sent_valid[field] = true;
        }
        break;
    }
    return true;
}

static const uint8_t colour_main[3] = {HSV_LUMI_MAIN};
static const uint8_t colour_row1[3] = {HSV_LUMI_ROW1};
static const uint8_t colour_row2[3] = {HSV_LUMI_ROW2};
static painter_font_handle_t row_large, row_small;

// Draws an anti-aliased image horizontally centred. The fade runs to black of
// the same hue and saturation, so soft edges never shift colour.
static void draw_image(const uint8_t *data, bool centre_in_area, int16_t top) {
    painter_image_handle_t image = qp_load_image_mem(data);
    if (!image) return;
    const int16_t x = (LCD_WIDTH - (int16_t)image->width) / 2;
    const int16_t y = centre_in_area ? (SMOOTH_GLYPH_AREA - (int16_t)image->height) / 2 : top;
    qp_drawimage_recolor(lcd_surface, x, y, image, colour_main[0], colour_main[1], colour_main[2],
                         colour_main[0], colour_main[1], 0);
    qp_close_image(image);
}

// The code point of a text holding exactly one UTF-8 character, else 0.
static uint32_t single_code_point(const char *text) {
    const uint8_t *s = (const uint8_t *)text;
    uint32_t code;
    uint8_t  extra;
    if (s[0] < 0x80) code = s[0], extra = 0;
    else if ((s[0] & 0xE0) == 0xC0) code = s[0] & 0x1F, extra = 1;
    else if ((s[0] & 0xF0) == 0xE0) code = s[0] & 0x0F, extra = 2;
    else if ((s[0] & 0xF8) == 0xF0) code = s[0] & 0x07, extra = 3;
    else return 0;
    for (uint8_t i = 1; i <= extra; ++i) {
        if ((s[i] & 0xC0) != 0x80) return 0;
        code = code << 6 | (s[i] & 0x3F);
    }
    return s[extra + 1] ? 0 : code;
}

// The large character or symbol for a key's display text.
static void draw_large(const char *text) {
    if (!text[0]) return;
    if (text[0] == '@' && text[1]) {
        for (uint8_t i = 0; i < SMOOTH_SYMBOL_COUNT; ++i) {
            if (!strcmp(text, smooth_symbols[i].name)) {
                draw_image(smooth_symbols[i].image, true, 0);
                return;
            }
        }
        return;
    }
    const uint32_t code = single_code_point(text);
    uint16_t low = 0, high = SMOOTH_CHAR_COUNT;
    while (code && low < high) {
        const uint16_t middle = (low + high) / 2;
        if (smooth_chars[middle].code < code) low = middle + 1;
        else high = middle;
    }
    if (code && low < SMOOTH_CHAR_COUNT && smooth_chars[low].code == code) {
        draw_image(smooth_chars[low].image, false, SMOOTH_CAP_TOP + smooth_chars[low].top);
    }
}

// One centred text row: the larger font if it fits, else the smaller one;
// `brief` (if given) is tried in the smaller font before shortening with "…".
static void draw_row(int16_t top, const char *text, const char *brief, const uint8_t colour[3]) {
    if (!text[0]) return;
    if (!row_large) row_large = qp_load_font_mem(row_font_large);
    if (!row_small) row_small = qp_load_font_mem(row_font_small);
    if (!row_large || !row_small) return;
    char shown[40];
    painter_font_handle_t font = row_large;
    int16_t ascent = ROW_LARGE_ASCENT;
    snprintf(shown, sizeof(shown), "%s", text);
    if (qp_textwidth(font, shown) > ROW_MAX_WIDTH) {
        font = row_small;
        ascent = ROW_SMALL_ASCENT;
        if (brief && qp_textwidth(font, shown) > ROW_MAX_WIDTH) snprintf(shown, sizeof(shown), "%s", brief);
    }
    char   stem[sizeof(shown)];
    size_t length = strlen(shown);
    memcpy(stem, shown, length + 1);
    while (length && qp_textwidth(font, shown) > ROW_MAX_WIDTH) {
        // Drop one whole UTF-8 character (and any space before it), add "…".
        do --length; while (length && ((uint8_t)stem[length] & 0xC0) == 0x80);
        while (length && stem[length - 1] == ' ') --length;
        if (length + 4 > sizeof(shown)) continue; // no room for "…" yet
        memcpy(shown, stem, length);
        memcpy(shown + length, "\xe2\x80\xa6", 4);
    }
    const int16_t width = qp_textwidth(font, shown);
    qp_drawtext_recolor(lcd_surface, (LCD_WIDTH - width) / 2, top + ROW_LARGE_ASCENT - ascent, font,
                        shown, colour[0], colour[1], colour[2], colour[0], colour[1], 0);
}

// Held modifier names in the usual order. Right Alt is AltGr when the
// keyboard language has AltGr characters. Ctrl+Shift+Alt is "Meh" and all four
// are "Hyper", as QMK's own one-key shortcuts for them are called.
static void modifier_names(char *out, size_t size, uint8_t mods, bool altgr, bool brief) {
    const bool alt = mods & (altgr ? MOD_BIT(KC_LALT) : MOD_MASK_ALT);
    const bool held[] = {mods & MOD_MASK_CTRL, mods & MOD_MASK_SHIFT, alt,
                         altgr && (mods & MOD_BIT(KC_RALT)), mods & MOD_MASK_GUI};
    static const char *const names[][2] = {
        {"Ctrl", "Ctl"}, {"Shift", "Sft"}, {"Alt", "Alt"}, {"AltGr", "AGr"}, {"Super", "Sup"}};
    const char *combined = NULL;
    uint8_t     skip     = 0; // modifiers already named by `combined`
    if (held[0] && held[1] && held[2]) {
        combined = held[4] ? "Hyper" : "Meh";
        skip     = held[4] ? 0x17 : 0x07; // Ctrl, Shift, Alt (and Super) bits below
    }
    out[0] = '\0';
    if (combined) snprintf(out, size, "%s", combined);
    for (uint8_t i = 0; i < sizeof(held); ++i) {
        if (!held[i] || (skip & (1 << i))) continue;
        const size_t used = strlen(out);
        snprintf(out + used, size - used, "%s%s", used ? " " : "", names[i][brief]);
    }
}

static void draw_left(uint8_t layer) {
    qp_rect(lcd_surface, 0, 0, LCD_WIDTH - 1, LCD_HEIGHT - 1, HSV_BLACK, true);
    const char number[2] = {layer < 8 ? (char)('0' + layer) : '?', '\0'};
    draw_large(number);
    const char *name = "";
    if (layer < 8) name = fields[FIELD_LAYER_NAME + layer][0] ? fields[FIELD_LAYER_NAME + layer]
                                                              : default_layer_names[layer];
    draw_row(ROW1_TOP, name, NULL, colour_row1);
    draw_row(ROW2_TOP, fields[FIELD_LANGUAGE], NULL, colour_row2);
}

static void draw_right(uint8_t mods) {
    qp_rect(lcd_surface, 0, 0, LCD_WIDTH - 1, LCD_HEIGHT - 1, HSV_BLACK, true);
    draw_large(fields[FIELD_KEY]);
    uint8_t layout = (uint8_t)fields[FIELD_LAYOUT][0];
    const bool altgr = key_layout_has_altgr[layout < KEY_LAYOUT_COUNT ? layout : 0];
    char full[32], brief[24];
    modifier_names(full, sizeof(full), mods, altgr, false);
    modifier_names(brief, sizeof(brief), mods, altgr, true);
    draw_row(ROW1_TOP, full, brief, colour_row1);
    draw_row(ROW2_TOP, fields[FIELD_USER], NULL, colour_row2);
}

bool display_module_housekeeping_task_user(bool second_display) {
    (void)second_display;
    // The physical side, not which half has USB, decides the content.
    // Returning false replaces the stock screensaver and status screen.
    static bool    initialized;
    static char    shown[FIELD_COUNT][FIELD_SIZE];
    static uint8_t shown_layer, shown_mods;
    const uint8_t  layer = get_highest_layer(layer_state | default_layer_state);
    const uint8_t  mods  = get_mods() | get_oneshot_mods();

    if (is_keyboard_left()) {
        if (!initialized || layer != shown_layer ||
            memcmp(shown[FIELD_LANGUAGE], fields[FIELD_LANGUAGE], FIELD_SIZE * (FIELD_COUNT - FIELD_LANGUAGE))) {
            draw_left(layer);
        }
    } else if (!initialized || mods != shown_mods || memcmp(shown, fields, FIELD_SIZE * FIELD_LANGUAGE)) {
        draw_right(mods);
    }
    memcpy(shown, fields, sizeof(shown));
    shown_layer = layer;
    shown_mods  = mods;
    initialized = true;
    qp_surface_draw(lcd_surface, lcd, 0, 0, 0);
    qp_flush(lcd);
    return false;
}
