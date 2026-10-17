# Kyria v4 setup — run `make help` for the list of commands.
ROOT    := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PY      := $(ROOT)/.venv/bin/python
QMK_DIR := $(ROOT)/.deps/vial-qmk
TOOLBIN := $(ROOT)/.deps/toolchain/bin
KEYMAP  := firmware/keyboards/splitkb/halcyon/kyria/keymaps/keypress_hlc
BUILD   := .build
TARGET  := kyria_rev4_keypress_display
UF2     := $(BUILD)/$(TARGET).uf2
SERVICE := $(HOME)/.config/systemd/user/kyria-display.service
UDEV    := /etc/udev/rules.d/99-vial-kyria.rules

TEST_FLAGS := -std=c11 -Wall -Wextra -Werror -Itests -I$(QMK_DIR)/quantum -I$(KEYMAP) \
	-Ifirmware/users/halcyon_modules/splitkb -Ifirmware/users/halcyon_modules/splitkb/hlc_tft_display

.PHONY: help setup test assets preview firmware release flash backup check-keyboard restore \
	install-helper uninstall-helper udev clangd clean

help:
	@echo "make setup            fetch pinned tools and sources into .venv/ and .deps/"
	@echo "make test             build and run the display tests"
	@echo "make firmware         build $(UF2)"
	@echo "make flash            copy the firmware onto one half (repeat for the other half)"
	@echo "make release          keep the built firmware as release/$(TARGET).uf2"
	@echo "make restore          put backups/ (keymap, macros, settings) back on the keyboard"
	@echo "make check-keyboard   compare the keyboard with backups/ without changing it"
	@echo "make backup           save the keyboard's keymap and settings into backups/"
	@echo "make install-helper   run the screen helper now and at every login"
	@echo "make udev             once per computer: allow your user to talk to the keyboard"
	@echo "make assets           regenerate fonts, symbols and language tables"
	@echo "make preview          render images/preview.png from the real display code"

setup:
	./setup.sh

$(PY):
	@echo "Run ./setup.sh first." >&2; exit 1

$(BUILD):
	mkdir -p "$(BUILD)"

$(BUILD)/key_text_test: tests/key_text_test.c $(KEYMAP)/key_text.h $(KEYMAP)/layout_tables.h | $(BUILD)
	cc $(TEST_FLAGS) tests/key_text_test.c -o "$(BUILD)/key_text_test"

$(BUILD)/display_test: tests/display_test.c tests/*.h $(KEYMAP)/*.c $(KEYMAP)/*.h | $(BUILD)
	cc $(TEST_FLAGS) tests/display_test.c $(KEYMAP)/smooth_assets.c -o "$(BUILD)/display_test"

test: $(BUILD)/key_text_test $(BUILD)/display_test
	bash tests/run.sh "$(BUILD)"

assets: | $(PY)
	cd tools && $(PY) generate_smooth.py

preview: $(BUILD)/display_test | $(PY)
	$(BUILD)/display_test preview $(BUILD)/preview.log
	cd tools && $(PY) render_preview.py $(ROOT)/$(BUILD)/preview.log

# A private QMK config folder keeps any QMK setup elsewhere on the computer
# from choosing a different firmware source.
firmware: | $(PY) $(BUILD)
	mkdir -p .deps/qmk-config
	env XDG_CONFIG_HOME=$(ROOT)/.deps/qmk-config QMK_HOME=$(QMK_DIR) QMK_USERSPACE=$(ROOT)/firmware \
		PATH=$(TOOLBIN):$(ROOT)/.venv/bin:$$PATH \
		qmk compile -kb splitkb/halcyon/kyria/rev4 -km keypress_hlc \
		-e HLC_TFT_DISPLAY=1 -e TARGET=$(TARGET) -j 4
	mv firmware/$(TARGET).uf2 $(UF2)
	rm -f $(QMK_DIR)/$(TARGET).uf2
	@echo "Built $(UF2)"

release:
	cp $(UF2) release/$(TARGET).uf2

# Flashes the freshly built firmware if there is one, else the kept release.
FLASH_UF2 := $(firstword $(wildcard $(UF2)) release/$(TARGET).uf2)
flash: | $(PY)
	$(PY) tools/flash.py "$(FLASH_UF2)"

backup: | $(PY)
	$(PY) tools/backup_keymap.py --replace
	$(PY) tools/backup_settings.py --replace

check-keyboard: | $(PY)
	$(PY) tools/restore_keymap.py

restore: | $(PY)
	$(PY) tools/restore_keymap.py --apply

install-helper: | $(PY)
	-systemctl --user disable kyria-display.service 2>/dev/null
	mkdir -p $(dir $(SERVICE))
	rm -f $(SERVICE)
	sed 's|@ROOT@|$(ROOT)|g' host/kyria-display.service > $(SERVICE)
	systemctl --user daemon-reload
	systemctl --user enable kyria-display.service
	systemctl --user restart kyria-display.service
	@systemctl --user --no-pager status kyria-display.service | head -3

uninstall-helper:
	-systemctl --user disable --now kyria-display.service
	rm -f $(SERVICE)
	systemctl --user daemon-reload

udev:
	sudo install -m 644 host/99-vial-kyria.rules $(UDEV)
	sudo udevadm control --reload-rules
	sudo udevadm trigger --subsystem-match=hidraw
	@echo "Also make sure your user is in the 'input' group: groups | grep -w input"

# compile_commands.json for editors (clangd), for the tests and the keymap code.
clangd:
	$(PY) -c 'import json, shlex, sys; root = sys.argv[1]; flags = shlex.split(sys.argv[2]); \
		files = ["tests/key_text_test.c", "tests/display_test.c", "$(KEYMAP)/keypress_display.c"]; \
		print(json.dumps([{"directory": root, "file": f, "arguments": ["cc", *flags, "-c", f]} for f in files], indent=2))' \
		"$(ROOT)" "$(TEST_FLAGS)" > compile_commands.json

clean:
	rm -rf $(BUILD)
