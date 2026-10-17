// Copyright 2024 splitkb.com (support@splitkb.com)
// SPDX-License-Identifier: GPL-2.0-or-later

#pragma once

#define VIAL_KEYBOARD_UID {0xEA, 0x55, 0x2E, 0xF9, 0x02, 0xA3, 0x12, 0x94}

#define VIAL_UNLOCK_COMBO_ROWS { 0, 5 }
#define VIAL_UNLOCK_COMBO_COLS { 1, 1 }

// Increase the EEPROM size for layout options
#define VIA_EEPROM_LAYOUT_OPTIONS_SIZE 2

#define RGB_MATRIX_FRAMEBUFFER_EFFECTS
#define RGB_MATRIX_KEYPRESSES

#define DYNAMIC_KEYMAP_LAYER_COUNT 8

#define HALCYON_LEGACY

#define SPLIT_TRANSACTION_IDS_USER KEYPRESS_DISPLAY_SYNC

#undef MATRIX_ROWS
#define MATRIX_ROWS 10
#define LAYOUT_split_3x6_5_hlc(k0G, k0F, k0E, k0D, k0C, k0B, k5B, k5C, k5D, k5E, k5F, k5G, k1G, k1F, k1E, k1D, k1C, k1B, k6B, k6C, k6D, k6E, k6F, k6G, k2G, k2F, k2E, k2D, k2C, k2B, k3D, k2A, k7A, k8D, k7B, k7C, k7D, k7E, k7F, k7G, k3E, k3C, k3B, k3F, k3A, k8A, k8F, k8B, k8C, k8E, k4A, k4B, k4C, k4D, k4E, k9A, k9B, k9C, k9D, k9E) { \
    {KC_NO, k0B, k0C, k0D, k0E, k0F, k0G}, \
    {KC_NO, k1B, k1C, k1D, k1E, k1F, k1G}, \
    {k2A, k2B, k2C, k2D, k2E, k2F, k2G}, \
    {k3A, k3B, k3C, k3D, k3E, k3F, KC_NO}, \
    {k4A, k4B, k4C, k4D, k4E, KC_NO, KC_NO}, \
    {KC_NO, k5B, k5C, k5D, k5E, k5F, k5G}, \
    {KC_NO, k6B, k6C, k6D, k6E, k6F, k6G}, \
    {k7A, k7B, k7C, k7D, k7E, k7F, k7G}, \
    {k8A, k8B, k8C, k8D, k8E, k8F, KC_NO}, \
    {k9A, k9B, k9C, k9D, k9E, KC_NO, KC_NO} \
}
