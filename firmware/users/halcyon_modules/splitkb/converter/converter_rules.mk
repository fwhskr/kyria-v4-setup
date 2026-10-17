CONVERT_TO = halcyon

LTO_ENABLE := no
OLED_ENABLE := no

CONFIG_H += $(USER_PATH)/splitkb/converter/config.h

include $(USER_PATH)/splitkb/rules.mk
