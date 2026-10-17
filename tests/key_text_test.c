#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc/key_text.h"

enum { US, ESTONIAN, ESTONIAN_NO_DEAD };

static void expect(uint16_t code, bool shift, bool altgr, uint8_t layout, const char *text) {
    const char *got = key_text(code, shift, altgr, layout, true);
    if (!got || strcmp(got, text)) {
        printf("key 0x%04x shift=%d altgr=%d layout=%u: got '%s', want '%s'\n",
               code, shift, altgr, layout, got ? got : "(none)", text);
        assert(false);
    }
}

int main(void) {
    // Letters are always uppercase, in every language and with Shift.
    for (uint8_t layout = 0; layout < KEY_LAYOUT_COUNT; ++layout) {
        for (unsigned letter = 0; letter < 26; ++letter) {
            const char want[2] = {(char)('A' + letter), 0};
            expect(KC_A + letter, false, false, layout, want);
            expect(KC_A + letter, true, false, layout, want);
        }
    }
    // US: digits, their Shift symbols and punctuation.
    for (int i = 0; i < 10; ++i) {
        const char plain[2] = {"1234567890"[i], 0}, shifted[2] = {"!@#$%^&*()"[i], 0};
        expect(KC_1 + i, false, false, US, plain);
        expect(KC_1 + i, true, false, US, shifted);
    }
    const uint16_t punctuation[] = {KC_MINS, KC_EQL, KC_LBRC, KC_RBRC, KC_BSLS,
        KC_SCLN, KC_QUOT, KC_GRV, KC_COMM, KC_DOT, KC_SLSH};
    for (int i = 0; i < 11; ++i) {
        const char plain[2] = {"-=[]\\;'`,./"[i], 0}, shifted[2] = {"_+{}|:\"~<>?"[i], 0};
        expect(punctuation[i], false, false, US, plain);
        expect(punctuation[i], true, false, US, shifted);
        expect(punctuation[i], false, true, US, plain);  // US has no AltGr level
    }
    // Estonian: the keys type Estonian letters and symbols.
    expect(KC_LBRC, false, false, ESTONIAN, "Ü");
    expect(KC_RBRC, false, false, ESTONIAN, "Õ");
    expect(KC_SCLN, false, false, ESTONIAN, "Ö");
    expect(KC_QUOT, true, false, ESTONIAN, "Ä");
    expect(KC_2, true, false, ESTONIAN, "\"");
    expect(KC_7, true, false, ESTONIAN, "/");
    expect(KC_SLSH, false, false, ESTONIAN, "-");
    expect(KC_E, false, true, ESTONIAN, "€");
    expect(KC_S, false, true, ESTONIAN, "Š");   // AltGr letters are uppercase too
    expect(KC_Z, true, true, ESTONIAN, "Ž");
    expect(KC_2, false, true, ESTONIAN, "@");
    expect(KC_7, false, true, ESTONIAN, "{");
    expect(KC_GRV, false, false, ESTONIAN, "ˇ");  // dead key shows its accent
    expect(KC_EQL, false, false, ESTONIAN, "´");
    expect(KC_GRV, false, false, ESTONIAN_NO_DEAD, "^");
    expect(KC_SLSH, false, true, ESTONIAN_NO_DEAD, "…");
    expect(KC_J, false, true, ESTONIAN, "@KEY");  // hook accent: nothing to show
    // Number pad follows Num Lock.
    expect(KC_KP_7, false, false, US, "7");
    expect(KC_KP_SLASH, false, false, ESTONIAN, "/");
    assert(!strcmp(key_text(KC_KP_7, false, false, US, false), "@HOME"));
    assert(!strcmp(key_text(KC_KP_DOT, false, false, US, false), "@DELETE"));
    // Unknown layout falls back to US.
    expect(KC_LBRC, false, false, 200, "[");
    // Non-typing keys are symbols in every language.
    expect(KC_ENT, false, false, ESTONIAN, "@ENTER");
    expect(KC_SPC, false, false, US, "@SPACE");
    expect(KC_BSPC, false, false, US, "@BKSP");
    expect(KC_LSFT, true, false, US, "@SHIFT");
    expect(KC_RCTL, false, false, US, "@CTRL");
    expect(KC_RALT, false, true, ESTONIAN, "@ALT");
    expect(KC_RGUI, false, false, US, "@GUI");
    expect(QK_MOMENTARY, false, false, US, "@LAYER");
    for (uint8_t layout = 0; layout < KEY_LAYOUT_COUNT; ++layout)
        for (unsigned code = 2; code < 256; ++code)
            for (unsigned level = 0; level < 4; ++level)
                assert(key_text(code, level & 1, level & 2, layout, level & 1));
    for (unsigned code = KC_F1; code <= KC_F12; ++code)
        assert(key_text(code, false, false, US, true)[0] == '@');
    assert(key_text(KC_NO, false, false, US, true) == NULL);
    puts("Character mapping: PASS");
}
