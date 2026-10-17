#pragma once
#include <stdbool.h>
#include <stdint.h>
#define QK_MODS_GET_MODS(k) (((k) >> 8) & 0x1F)
#define QK_MODS_GET_BASIC_KEYCODE(k) ((k) & 0xFF)
#define QK_MOD_TAP_GET_TAP_KEYCODE(k) ((k) & 0xFF)
#define QK_MOD_TAP_GET_MODS(k) (((k) >> 8) & 0x1F)
#define QK_ONE_SHOT_MOD_GET_MODS(k) ((k) & 0x1F)
#define QK_LAYER_MOD_GET_MODS(k) ((k) & 0x1F)
#define QK_LAYER_TAP_GET_TAP_KEYCODE(k) ((k) & 0xFF)
// Umbrella header like the real quantum.h: re-exports what the display code uses.
#include "modifiers.h" // IWYU pragma: export
#include <stdio.h>      // IWYU pragma: export
#include <string.h>     // IWYU pragma: export
#define MOD_BIT(code) (1 << ((code)&0x07))
#define KEYPRESS_DISPLAY_SYNC 1
#define LCD_WIDTH 135
#define LCD_HEIGHT 240

typedef uint32_t layer_state_t;
typedef struct { struct { bool pressed; } event; struct { uint8_t count; } tap; } keyrecord_t;
typedef struct { bool num_lock, caps_lock, scroll_lock; } led_t;
extern layer_state_t layer_state, default_layer_state;
uint8_t get_mods(void);
uint8_t get_weak_mods(void);
uint8_t get_oneshot_mods(void);
led_t host_keyboard_led_state(void);
bool is_keyboard_left(void);
bool is_keyboard_master(void);
bool is_transport_connected(void);
uint32_t timer_read32(void);
uint32_t timer_elapsed32(uint32_t since);
uint8_t get_highest_layer(layer_state_t state);
