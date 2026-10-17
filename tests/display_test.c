// Real production display code; only QMK transport and Quantum Painter are stubbed.
#include "quantum.h"
#include "qp.h"
#include "smooth_assets.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const uint8_t *data;
    int x, y, w, h;
    uint8_t fg[3], bg[3];
} draw_t;
typedef struct {
    bool large;
    int x, y, w;
    char text[48];
    uint8_t fg[3], bg[3];
} row_t;

static bool left_side, master, connected = true, send_ok = true;
static led_t leds = {.num_lock = true};
static uint8_t mods, weak_mods, oneshot;
static uint32_t now;
static int sends, clears, open_images, open_fonts, draw_count, row_count;
static draw_t draws[8];
static row_t rows[4];
static uint8_t sent_field;
static char sent_text[24];
static void (*receiver)(uint8_t, const void *, uint8_t, void *);
static FILE *preview_log;
static const uint8_t *loaded_data;
layer_state_t layer_state = 1, default_layer_state = 1;
painter_device_t lcd, lcd_surface;

uint8_t get_mods(void) { return mods; }
uint8_t get_weak_mods(void) { return weak_mods; }
uint8_t get_oneshot_mods(void) { return oneshot; }
led_t host_keyboard_led_state(void) { return leds; }
bool is_keyboard_left(void) { return left_side; }
bool is_keyboard_master(void) { return master; }
bool is_transport_connected(void) { return connected; }
uint32_t timer_read32(void) { return now; }
uint32_t timer_elapsed32(uint32_t since) { return now - since; }
uint8_t get_highest_layer(layer_state_t state) {
    uint8_t layer = 0;
    while (state >>= 1) ++layer;
    return layer;
}
void transaction_register_rpc(int id, void (*handler)(uint8_t, const void *, uint8_t, void *)) {
    assert(id == 1); receiver = handler;
}
bool transaction_rpc_send(int id, uint8_t size, const void *data) {
    assert(id == 1 && size == 25 && size <= 32);  // fits QMK's RPC buffer
    ++sends; sent_field = ((const uint8_t *)data)[0]; memcpy(sent_text, (const uint8_t *)data + 1, 24);
    return send_ok;
}
// Reads width and height from the real QGF header bytes.
painter_image_handle_t qp_load_image_mem(const void *buffer) {
    const uint8_t *b = buffer;
    assert(b[0] == 0x00 && b[1] == 0xff && b[5] == 'Q' && b[6] == 'G' && b[7] == 'F');
    painter_image_desc_t *image = malloc(sizeof(*image));
    image->width = b[17] | b[18] << 8;
    image->height = b[19] | b[20] << 8;
    image->frame_count = b[21] | b[22] << 8;
    assert(image->frame_count == 1);
    assert(++open_images <= QUANTUM_PAINTER_NUM_IMAGES);
    return image;
}
bool qp_close_image(painter_image_handle_t image) {
    free((void *)image); --open_images; return true;
}
bool qp_drawimage_recolor(painter_device_t d, uint16_t x, uint16_t y, painter_image_handle_t image,
                          uint8_t hf, uint8_t sf, uint8_t vf, uint8_t hb, uint8_t sb, uint8_t vb) {
    assert(d == lcd_surface && draw_count < 8);
    // Large characters and symbols stay on screen and above the text rows.
    assert(x + image->width <= LCD_WIDTH && y + image->height <= SMOOTH_GLYPH_AREA);
    draws[draw_count++] = (draw_t){loaded_data, x, y, image->width, image->height,
                                   {hf, sf, vf}, {hb, sb, vb}};
    return true;
}
// Reads line height and (monospace) glyph width from the real QFF bytes.
painter_font_handle_t qp_load_font_mem(const void *buffer) {
    const uint8_t *b = buffer;
    assert(b[0] == 0x00 && b[1] == 0xff && b[5] == 'Q' && b[6] == 'F' && b[7] == 'F');
    assert(b[25] == 0x01 && b[26] == 0xfe);  // ASCII glyph table follows
    painter_font_desc_t *font = malloc(sizeof(*font));
    font->line_height = b[17];
    font->cell = b[30] & 0x3F;
    assert(++open_fonts <= QUANTUM_PAINTER_NUM_FONTS);
    return font;
}
static int code_points(const char *s) {
    int n = 0;
    for (; *s; ++s) n += ((uint8_t)*s & 0xC0) != 0x80;
    return n;
}
int16_t qp_textwidth(painter_font_handle_t font, const char *str) {
    return code_points(str) * font->cell;
}
int16_t qp_drawtext_recolor(painter_device_t d, uint16_t x, uint16_t y, painter_font_handle_t font,
                            const char *str, uint8_t hf, uint8_t sf, uint8_t vf,
                            uint8_t hb, uint8_t sb, uint8_t vb) {
    const int width = qp_textwidth(font, str);
    assert(d == lcd_surface && row_count < 4);
    // Rows stay on screen, below the large character.
    assert(x + width <= LCD_WIDTH && y >= SMOOTH_GLYPH_AREA && y + font->line_height <= LCD_HEIGHT);
    row_t *row = &rows[row_count++];
    *row = (row_t){font->line_height == ROW_LARGE_LINE, x, y, width, "", {hf, sf, vf}, {hb, sb, vb}};
    snprintf(row->text, sizeof(row->text), "%s", str);
    return width;
}
void qp_rect(painter_device_t d, uint16_t l, uint16_t t, uint16_t r, uint16_t b,
             uint8_t h, uint8_t s, uint8_t v, bool fill) {
    // Only whole-screen clears to black.
    assert(d == lcd_surface && fill && !l && !t && r == LCD_WIDTH - 1 && b == LCD_HEIGHT - 1);
    assert(!h && !s && !v);
    ++clears; draw_count = 0; row_count = 0;
}
void qp_flush(painter_device_t d) { (void)d; }
void qp_surface_draw(painter_device_t s, painter_device_t t, uint16_t x, uint16_t y, bool all) {
    (void)s; (void)t; (void)x; (void)y; (void)all;
}

// Capture which asset bytes each load refers to.
#define qp_load_image_mem(data) (loaded_data = (const uint8_t *)(data), qp_load_image_mem(data))
#include "../firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc/keypress_display.c"
#undef qp_load_image_mem

enum { US, ESTONIAN, ESTONIAN_NO_DEAD };
static const uint8_t main_colour[3] = {HSV_LUMI_MAIN}, row1_colour[3] = {HSV_LUMI_ROW1},
                     row2_colour[3] = {HSV_LUMI_ROW2};

static void press(uint16_t code, bool pressed, uint8_t taps) {
    keyrecord_t record = {.event.pressed = pressed, .tap.count = taps};
    assert(process_record_user(code, &record));
}
static void show(void) {
    assert(!display_module_housekeeping_task_user(false));
    assert(open_images == 0);  // every image handle is released again
}
// Sends one raw HID report from the computer; returns the keyboard's reply.
static uint8_t host_send(uint8_t command, uint8_t field, const char *text) {
    uint8_t report[32] = {command, field};
    memcpy(report + 2, text, strlen(text) + 1 < 30 ? strlen(text) + 1 : 30);
    raw_hid_receive_kb(report, sizeof(report));
    return report[0] == id_unhandled ? 0xFF : report[2];
}
static void host_layout(uint8_t layout) {
    uint8_t report[32] = {DISPLAY_HID_COMMAND, FIELD_LAYOUT, layout};
    raw_hid_receive_kb(report, sizeof(report));
    assert(report[0] == DISPLAY_HID_COMMAND && report[2] == 0);
}
static void expect_colour(const uint8_t fg[3], const uint8_t bg[3], const uint8_t colour[3]) {
    assert(!memcmp(fg, colour, 3));
    // Fade to black of the same hue and saturation: no colour fringes.
    assert(bg[0] == colour[0] && bg[1] == colour[1] && bg[2] == 0);
}
static void expect_hcentre(int x, int w) {
    int margin = (LCD_WIDTH - x - w) - x;
    assert(margin >= 0 && margin <= 1 && x >= 1);
}
static const draw_t *only_draw(void) {
    assert(draw_count == 1);
    expect_colour(draws[0].fg, draws[0].bg, main_colour);
    expect_hcentre(draws[0].x, draws[0].w);
    return &draws[0];
}
static const smooth_char_t *find(uint32_t code) {
    for (int i = 0; i < SMOOTH_CHAR_COUNT; ++i)
        if (smooth_chars[i].code == code) return &smooth_chars[i];
    return NULL;
}
static void expect_text(const char *text) {
    const smooth_char_t *c = find(single_code_point(text));
    assert(c);
    const draw_t *d = only_draw();
    assert(d->data == c->image);
    // The capital-letter band sits at the same place for every character.
    assert(d->y - c->top == SMOOTH_CAP_TOP);
}
static void expect_symbol(const char *name) {
    const uint8_t *image = NULL;
    for (int i = 0; i < SMOOTH_SYMBOL_COUNT; ++i)
        if (!strcmp(name, smooth_symbols[i].name)) image = smooth_symbols[i].image;
    assert(image);
    const draw_t *d = only_draw();
    assert(d->data == image);
    int margin = (SMOOTH_GLYPH_AREA - d->y - d->h) - d->y;
    assert(margin >= 0 && margin <= 1);
}
static const row_t *row_at(int top) {
    for (int i = 0; i < row_count; ++i) {
        const row_t *row = &rows[i];
        // Both fonts share the row's baseline.
        int baseline = row->y + (row->large ? ROW_LARGE_ASCENT : ROW_SMALL_ASCENT);
        if (baseline == top + ROW_LARGE_ASCENT) return row;
    }
    return NULL;
}
static void expect_row(int top, const char *text, bool large, const uint8_t colour[3]) {
    const row_t *row = row_at(top);
    if (!text) { assert(!row); return; }
    if (!row || strcmp(row->text, text) || row->large != large) {
        printf("row %d: got '%s' (%s), want '%s' (%s)\n", top, row ? row->text : "(none)",
               row && row->large ? "large" : "small", text, large ? "large" : "small");
        fflush(stdout);
        assert(false);
    }
    expect_hcentre(row->x, row->w);
    expect_colour(row->fg, row->bg, colour);
}
static const char *asset_name(const uint8_t *data, char *out, size_t size) {
    for (int i = 0; i < SMOOTH_CHAR_COUNT; ++i)
        if (smooth_chars[i].image == data) { snprintf(out, size, "char_%04x", smooth_chars[i].code); return out; }
    for (int i = 0; i < SMOOTH_SYMBOL_COUNT; ++i)
        if (smooth_symbols[i].image == data) {
            snprintf(out, size, "sym_%s", smooth_symbols[i].name + 1);
            for (char *p = out; *p; ++p) if (*p >= 'A' && *p <= 'Z') *p += 'a' - 'A';
            return out;
        }
    assert(false);
    return NULL;
}
static void log_screen(void) {
    if (!preview_log) return;
    fprintf(preview_log, "screen\n");
    for (int i = 0; i < draw_count; ++i) {
        const draw_t *d = &draws[i];
        char name[24];
        fprintf(preview_log, "image %s %d %d %d %d %u %u %u\n", asset_name(d->data, name, sizeof(name)),
                d->x, d->y, d->w, d->h, d->fg[0], d->fg[1], d->fg[2]);
    }
    for (int i = 0; i < row_count; ++i) {
        const row_t *r = &rows[i];
        fprintf(preview_log, "text %s %d %d %u %u %u %s\n", r->large ? "large" : "small",
                r->x, r->y, r->fg[0], r->fg[1], r->fg[2], r->text);
    }
}

int main(int argc, char **argv) {
    assert(argc == 2 || argc == 3);
    module_post_init_user();
    if (!strcmp(argv[1], "left-master")) {
        left_side = master = true;
        press(KC_A, true, 0); now = 30; module_housekeeping_task_user(); show();
        assert(sends == 1 && sent_field == FIELD_KEY && !strcmp(sent_text, "A"));
        // Left shows the layer number and name, never the key.
        assert(draw_count == 1 && draws[0].data == find('0')->image);
        expect_row(ROW1_TOP, "Colemak", true, row1_colour);
        expect_row(ROW2_TOP, NULL, true, row2_colour);  // no computer helper yet
    } else if (!strcmp(argv[1], "right-master")) {
        master = true; press(KC_B, true, 0); show(); expect_text("B");
        expect_row(ROW1_TOP, NULL, true, row1_colour);
        expect_row(ROW2_TOP, NULL, true, row2_colour);
        now = 30; module_housekeeping_task_user(); assert(sends == 1);
        show(); assert(clears == 1);  // nothing changed: no redraw
        layer_state = 2; show(); assert(clears == 1);  // layer is the left screen's
        mods = MOD_BIT_LSHIFT; show(); assert(clears == 2);
        expect_text("B"); expect_row(ROW1_TOP, "Shift", true, row1_colour);
    } else if (!strcmp(argv[1], "receiver")) {
        uint8_t message[25] = {FIELD_KEY, 'X'};
        receiver(sizeof(message), message, 0, NULL); show(); expect_text("X");
        receiver(1, "y", 0, NULL); show(); expect_text("X");  // malformed: ignored
        message[0] = FIELD_USER; memcpy(message + 1, "alex", 5);
        receiver(sizeof(message), message, 0, NULL); show();
        expect_row(ROW2_TOP, "alex", true, row2_colour);
        message[0] = FIELD_COUNT; receiver(sizeof(message), message, 0, NULL);  // ignored
    } else if (!strcmp(argv[1], "retry")) {
        left_side = master = true; press(KC_C, true, 0);
        now = 30; send_ok = false; module_housekeeping_task_user(); assert(sends == 1);
        now = 60; send_ok = true; module_housekeeping_task_user(); assert(sends == 2);
        assert(sent_field == FIELD_KEY && !strcmp(sent_text, "C"));
        // The remaining fields follow one per 25 ms, then everything is current.
        for (int i = 0; i < FIELD_COUNT - 1; ++i) { now += 25; module_housekeeping_task_user(); }
        assert(sends == 1 + FIELD_COUNT);
        now += 25; module_housekeeping_task_user(); assert(sends == 1 + FIELD_COUNT);
        // A new key goes out at once, ahead of anything else.
        press(KC_D, true, 0); now += 25; module_housekeeping_task_user();
        assert(sent_field == FIELD_KEY && !strcmp(sent_text, "D"));
        connected = false; now = 1100; module_housekeeping_task_user(); int before = sends;
        assert(sends == before);
        connected = true; module_housekeeping_task_user(); assert(sends == before + 1);
        assert(sent_field == FIELD_KEY);  // refresh starts again from the key
    } else if (!strcmp(argv[1], "modifiers")) {
        press(KC_A, true, 0); show(); expect_text("A");
        press(KC_B, false, 0); show(); expect_text("A");
        mods = 2; press(KC_A, true, 0); show(); expect_text("A");
        leds.caps_lock = true; press(KC_A, true, 0); show(); expect_text("A");
        mods = 0; leds.caps_lock = false;
        press(QK_MODS | (0x12 << 8) | KC_1, true, 0); show(); expect_text("!");
        press(QK_MOD_TAP | (1 << 8) | KC_B, true, 0); show(); expect_symbol("@CTRL");
        press(QK_MOD_TAP | KC_B, true, 1); show(); expect_text("B");
        press(QK_LAYER_TAP | KC_C, true, 0); show(); expect_symbol("@LAYER");
        press(QK_LAYER_TAP | KC_C, true, 1); show(); expect_text("C");
        weak_mods = 2; press(KC_2, true, 0); show(); expect_text("@");
        weak_mods = 0; oneshot = 2; press(KC_3, true, 0); show(); expect_text("#");
        // Held modifier names, in order; one-shot counts as held.
        expect_row(ROW1_TOP, "Shift", true, row1_colour);
        oneshot = 0; mods = MOD_BIT_LCTRL; show(); expect_row(ROW1_TOP, "Ctrl", true, row1_colour);
        mods = MOD_BIT_RGUI; show(); expect_row(ROW1_TOP, "Super", true, row1_colour);
        mods = MOD_BIT_RALT; show(); expect_row(ROW1_TOP, "Alt", true, row1_colour);  // US: no AltGr
        mods = MOD_BIT_LCTRL | MOD_BIT_RSHIFT; show();
        expect_row(ROW1_TOP, "Ctrl Shift", false, row1_colour);  // smaller to fit
        mods = MOD_BIT_LCTRL | MOD_BIT_LALT | MOD_BIT_LGUI; show();
        expect_row(ROW1_TOP, "Ctl Alt Sup", false, row1_colour);  // short names
        mods = MOD_BIT_LCTRL | MOD_BIT_LSHIFT | MOD_BIT_LALT; show();
        expect_row(ROW1_TOP, "Meh", true, row1_colour);
        mods = 0xFF; show(); expect_row(ROW1_TOP, "Hyper", true, row1_colour);
        mods = 0; show(); expect_row(ROW1_TOP, NULL, true, row1_colour);
    } else if (!strcmp(argv[1], "special-keys")) {
        const uint16_t codes[] = {KC_LCTL, KC_RCTL, KC_LALT, KC_RALT,
            KC_LGUI, KC_RGUI, KC_LSFT, KC_RSFT, KC_ENT, KC_TAB, KC_SPC,
            KC_BSPC, KC_DEL, KC_LEFT, KC_RGHT, KC_UP, KC_DOWN, KC_CAPS,
            KC_F1, KC_F12, KC_F24, KC_MUTE, KC_VOLU, KC_MPLY, QK_MOMENTARY};
        const char *const names[] = {"@CTRL", "@CTRL", "@ALT", "@ALT",
            "@GUI", "@GUI", "@SHIFT", "@SHIFT", "@ENTER", "@TAB", "@SPACE",
            "@BKSP", "@DELETE", "@LEFT", "@RIGHT", "@UP", "@DOWN", "@CAPS",
            "@F1", "@F12", "@F24", "@MUTE", "@VOLUP", "@PLAY", "@LAYER"};
        for (size_t i = 0; i < sizeof(codes) / sizeof(codes[0]); ++i) {
            press(codes[i], true, 0); show(); expect_symbol(names[i]);
        }
        press(QK_ONE_SHOT_MOD | 4, true, 0); show(); expect_symbol("@ALT");
        press(QK_LAYER_MOD | 8, true, 0); show(); expect_symbol("@GUI");
        press(QK_MOD_TAP | (13 << 8) | KC_NO, true, 0); show(); expect_symbol("@MODS");
        leds.num_lock = false; press(KC_KP_7, true, 0); show(); expect_symbol("@HOME");
        leds.num_lock = true; press(KC_KP_7, true, 0); show(); expect_text("7");
    } else if (!strcmp(argv[1], "every-key")) {
        // Every basic key, in every language and Shift/AltGr level, shows exactly
        // one real character or symbol (the character table has them all).
        for (uint8_t layout = 0; layout < KEY_LAYOUT_COUNT; ++layout) {
            host_layout(layout);
            for (unsigned code = 2; code < 256; ++code) {
                for (unsigned level = 0; level < 4; ++level) {
                    mods = (level & 1 ? MOD_BIT_LSHIFT : 0) | (level & 2 ? MOD_BIT_RALT : 0);
                    const char *text = key_text(code, level & 1, level & 2, layout, true);
                    press(code, true, 0); show();
                    if (text[0] == '@' && text[1]) expect_symbol(text);
                    else expect_text(text);
                }
            }
        }
    } else if (!strcmp(argv[1], "active-keymap")) {
        const uint16_t codes[] = {0x0004,0x0005,0x0006,0x0007,0x0008,0x0009,0x000a,0x000b,
            0x000c,0x000d,0x000e,0x000f,0x0010,0x0011,0x0012,0x0013,0x0014,0x0015,
            0x0016,0x0017,0x0018,0x0019,0x001a,0x001b,0x001c,0x001d,0x001e,0x001f,
            0x0020,0x0021,0x0022,0x0023,0x0024,0x0025,0x0026,0x0027,0x0028,0x002a,
            0x002b,0x002c,0x002d,0x002e,0x002f,0x0030,0x0031,0x0033,0x0034,0x0035,
            0x0036,0x0037,0x0038,0x0039,0x003a,0x003b,0x003c,0x003d,0x003e,0x003f,
            0x0040,0x0041,0x0042,0x0043,0x0044,0x0045,0x0046,0x0047,0x0048,0x0049,
            0x004a,0x004b,0x004c,0x004d,0x004e,0x004f,0x0050,0x0051,0x0052,0x0065,
            0x00a8,0x00a9,0x00aa,0x00ab,0x00ac,0x00ae,0x00e0,0x00e1,0x00e2,0x00e3,
            0x00e4,0x00e5,0x00e6,0x00e7,0x021e,0x021f,0x0220,0x0221,0x0222,0x0223,
            0x0224,0x0225,0x0226,0x0227,0x022d,0x022e,0x022f,0x0230,0x0231,0x0233,
            0x0235,0x0238,0x2129,0x2428,0x2d00,0x312d,0x3134,0x5048,0x5222,0x5223,
            0x5224,0x5225,0x5226,0x5240,0x5241,0x5242,0x7842,0x7843,0x7844,0x7845,
            0x7846,0x7847,0x7848,0x7849,0x784a};
        for (uint8_t layout = 0; layout < KEY_LAYOUT_COUNT; ++layout) {
            host_layout(layout);
            for (size_t i = 0; i < sizeof(codes) / sizeof(codes[0]); ++i) {
                for (uint8_t taps = 0; taps < 2; ++taps) {
                    press(codes[i], true, taps); show();
                    // Every action in the saved layout draws exactly one real image.
                    assert(strcmp(fields[FIELD_KEY], "@KEY") && draw_count == 1);
                }
            }
        }
    } else if (!strcmp(argv[1], "all-glyphs")) {
        for (int i = 0; i < SMOOTH_CHAR_COUNT; ++i) {
            uint8_t message[25] = {FIELD_KEY};
            uint32_t c = smooth_chars[i].code;
            // Encode as UTF-8, as key_text produces it.
            if (c < 0x80) message[1] = c;
            else if (c < 0x800) message[1] = 0xC0 | c >> 6, message[2] = 0x80 | (c & 0x3F);
            else message[1] = 0xE0 | c >> 12, message[2] = 0x80 | ((c >> 6) & 0x3F), message[3] = 0x80 | (c & 0x3F);
            receiver(sizeof(message), message, 0, NULL); show();
            expect_text((const char *)message + 1);
        }
        for (int i = 0; i < SMOOTH_SYMBOL_COUNT; ++i) {
            uint8_t message[25] = {FIELD_KEY};
            memcpy(message + 1, smooth_symbols[i].name, strlen(smooth_symbols[i].name));
            receiver(sizeof(message), message, 0, NULL); show();
            expect_symbol(smooth_symbols[i].name);
        }
    } else if (!strcmp(argv[1], "left-layout")) {
        left_side = true; show();
        assert(draw_count == 1);
        const draw_t *number = &draws[0];
        assert(number->data == find('0')->image);
        expect_hcentre(number->x, number->w); expect_colour(number->fg, number->bg, main_colour);
        // Same font, size and position as the right screen's characters.
        assert(number->y - find('0')->top == SMOOTH_CAP_TOP);
        expect_row(ROW1_TOP, "Colemak", true, row1_colour);
        layer_state = 1 << 3; show();
        assert(draws[0].data == find('3')->image);
        expect_row(ROW1_TOP, "Nav", true, row1_colour);
        layer_state = 1 << 9; show();
        assert(draws[0].data == find('?')->image);
        expect_row(ROW1_TOP, NULL, true, row1_colour);
        layer_state = 1 << 7; show(); expect_row(ROW1_TOP, NULL, true, row1_colour);
        // Lock lights no longer show anywhere.
        leds.caps_lock = true; leds.scroll_lock = true; int before = clears; show();
        assert(clears == before);
    } else if (!strcmp(argv[1], "host")) {
        master = true;
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_USER, "alex") == 0);
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_LANGUAGE, "Estonian") == 0);
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_LAYER_NAME + 3, "Navigation") == 0);
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_KEY, "Z") == 1);       // refused
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_COUNT, "Z") == 1);     // refused
        assert(host_send(0x07, 0, "") == 0xFF);                             // VIA custom: not ours
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_USER, "a-very-long-user-name-here") == 0);
        assert(!strcmp(fields[FIELD_USER], "a-very-long-user-name-h"));     // kept to 23 bytes
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_USER, "ÕÕÕÕÕÕÕÕÕÕÕÕ") == 0);
        assert(!strcmp(fields[FIELD_USER], "ÕÕÕÕÕÕÕÕÕÕÕ"));  // whole characters only
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_USER, "alex") == 0);
        show(); expect_row(ROW2_TOP, "alex", true, row2_colour);
        // Estonian: keys show what Estonian types; right Alt is AltGr.
        host_layout(ESTONIAN);
        press(KC_SCLN, true, 0); show(); expect_text("Ö");
        mods = MOD_BIT_RALT; press(KC_E, true, 0); show(); expect_text("€");
        expect_row(ROW1_TOP, "AltGr", true, row1_colour);
        mods = MOD_BIT_RALT | MOD_BIT_LSHIFT; press(KC_Z, true, 0); show(); expect_text("Ž");
        expect_row(ROW1_TOP, "Shift AltGr", false, row1_colour);
        mods = MOD_HYPR | MOD_BIT_RALT; show(); expect_row(ROW1_TOP, "Hyper AltGr", false, row1_colour);
        mods = 0; host_layout(US); press(KC_SCLN, true, 0); show(); expect_text(";");
        host_layout(200); press(KC_LBRC, true, 0); show(); expect_text("[");  // unknown: US
        // Left: the computer's layer name and language.
        left_side = true; master = false; layer_state = 1 << 3; show();
        expect_row(ROW1_TOP, "Navigation", false, row1_colour);
        expect_row(ROW2_TOP, "Estonian", true, row2_colour);
        // An empty name from the computer falls back to the built-in one.
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_LAYER_NAME + 3, "") == 0);
        show(); expect_row(ROW1_TOP, "Nav", true, row1_colour);
    } else if (!strcmp(argv[1], "row-fit")) {
        left_side = true;
        const char *names[] = {"ABCDEFGHI", "ABCDEFGHIJ", "ABCDEFGHIJKL", "ABCDEFGHIJKLM", "ÕÄÖÜŠŽõäöüš"};
        const char *want[] = {"ABCDEFGHI", "ABCDEFGHIJ", "ABCDEFGHIJKL", "ABCDEFGHIJK…", "ÕÄÖÜŠŽõäöüš"};
        const bool large[] = {true, false, false, false, false};
        for (int i = 0; i < 5; ++i) {
            assert(host_send(DISPLAY_HID_COMMAND, FIELD_LAYER_NAME, names[i]) == 0);
            show(); expect_row(ROW1_TOP, want[i], large[i], row1_colour);
        }
        assert(host_send(DISPLAY_HID_COMMAND, FIELD_LAYER_NAME, "Navigation layer") == 0);
        show(); expect_row(ROW1_TOP, "Navigation…", false, row1_colour);  // no space before "…"
    } else if (!strcmp(argv[1], "preview")) {
        assert(argc == 3);
        preview_log = fopen(argv[2], "w"); assert(preview_log);
        host_send(DISPLAY_HID_COMMAND, FIELD_USER, "alex");
        host_send(DISPLAY_HID_COMMAND, FIELD_LANGUAGE, "Estonian");
        host_layout(ESTONIAN_NO_DEAD);
        const struct { uint16_t code; uint8_t mods; } keys[] = {
            {KC_A, 0}, {KC_W, 0}, {KC_G, 0}, {KC_SCLN, 0}, {KC_LBRC, 0}, {KC_RBRC, 0},
            {KC_QUOT, 0}, {KC_S, MOD_BIT_RALT}, {KC_E, MOD_BIT_RALT}, {KC_2, MOD_BIT_LSHIFT},
            {KC_0, 0}, {KC_7, 0}, {KC_DOT, 0}, {KC_COMM, 0}, {KC_MINS, MOD_BIT_LSHIFT},
            {KC_LCTL, MOD_BIT_LCTRL}, {KC_LALT, MOD_BIT_LALT}, {KC_LGUI, MOD_BIT_LGUI},
            {KC_LSFT, MOD_BIT_LSHIFT}, {KC_C, MOD_BIT_LCTRL | MOD_BIT_LSHIFT},
            {KC_ENT, 0}, {KC_BSPC, 0}, {KC_TAB, 0}, {KC_SPC, 0}, {KC_ESC, 0},
            {KC_LEFT, 0}, {KC_UP, 0}, {KC_MPLY, 0}, {KC_VOLU, 0}, {KC_F5, 0}, {KC_F12, 0},
            {KC_I, MOD_BIT_RALT}, {KC_GRV, 0}, {KC_U, MOD_BIT_RALT | MOD_BIT_LSHIFT}};
        for (size_t i = 0; i < sizeof(keys) / sizeof(keys[0]); ++i) {
            mods = keys[i].mods; press(keys[i].code, true, 0); show(); log_screen();
        }
        mods = 0;
        // The left half starts from its own state (in the test both halves share it).
        left_side = true; layer_state = 1u << 9; show();
        const struct { uint8_t layer; const char *language; } left[] = {
            {0, "Estonian"}, {3, "Estonian"}, {5, "English"}, {6, ""}};
        for (size_t i = 0; i < sizeof(left) / sizeof(left[0]); ++i) {
            host_send(DISPLAY_HID_COMMAND, FIELD_LANGUAGE, left[i].language);
            layer_state = 1u << left[i].layer; show(); log_screen();
        }
        assert(fclose(preview_log) == 0);
    } else { assert(false); }
    printf("Display behavior %s: PASS\n", argv[1]);
}
