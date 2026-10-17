#pragma once
// Host-test stand-in for Quantum Painter: only the calls the display code uses.
#include <stdbool.h>
#include <stdint.h>
#define HSV_BLACK 0, 0, 0
#define QUANTUM_PAINTER_NUM_IMAGES 8 // quantum/painter/qp.h defaults
#define QUANTUM_PAINTER_NUM_FONTS 4
typedef void *painter_device_t;
typedef struct painter_image_desc_t { uint16_t width; uint16_t height; uint16_t frame_count; } painter_image_desc_t;
typedef const painter_image_desc_t *painter_image_handle_t;
painter_image_handle_t qp_load_image_mem(const void *buffer);
bool qp_close_image(painter_image_handle_t image);
bool qp_drawimage_recolor(painter_device_t device, uint16_t x, uint16_t y, painter_image_handle_t image,
                          uint8_t hue_fg, uint8_t sat_fg, uint8_t val_fg,
                          uint8_t hue_bg, uint8_t sat_bg, uint8_t val_bg);
typedef struct painter_font_desc_t { uint8_t line_height; uint8_t cell; } painter_font_desc_t;
typedef const painter_font_desc_t *painter_font_handle_t;
painter_font_handle_t qp_load_font_mem(const void *buffer);
int16_t qp_textwidth(painter_font_handle_t font, const char *str);
int16_t qp_drawtext_recolor(painter_device_t device, uint16_t x, uint16_t y, painter_font_handle_t font,
                            const char *str, uint8_t hue_fg, uint8_t sat_fg, uint8_t val_fg,
                            uint8_t hue_bg, uint8_t sat_bg, uint8_t val_bg);
void qp_rect(painter_device_t d, uint16_t l, uint16_t t, uint16_t r, uint16_t b,
             uint8_t h, uint8_t s, uint8_t v, bool fill);
void qp_flush(painter_device_t d);
