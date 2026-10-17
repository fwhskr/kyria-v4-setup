"""Tell the Kyria's screens who is logged in, the keyboard language and the layer names.

Runs in the user's desktop session (host/kyria-display.service). Sends, over
the keyboard's raw HID interface (the one Vial uses):
  - the logged-in user name               -> right screen, bottom row
  - Hyprland's active keyboard language   -> left screen, bottom row; also picks
    which characters the right screen shows for each key
  - layer names from host/layer-names.txt -> left screen, under the layer number
It only writes when the keyboard (re)connects or something changes, and it
never sends anything that changes the keymap or settings.

Usage: kyria_display_helper.py [--once]   (--once: send everything, then exit)
"""
import json
import os
import pwd
import re
import select
import socket
import sys
import time
from importlib import import_module
from pathlib import Path

# hidapi binding from the project's Python environment (.venv, made by setup.sh).
hid = import_module('hid')

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'tools'))
from generate_layouts import LAYOUTS  # noqa: E402  (same layout order as the firmware)

VID, PID, USAGE_PAGE = 0x8D1D, 0x7FCE, 0xFF60
COMMAND = 0x4B  # keypress_display.c DISPLAY_HID_COMMAND
FIELD_LAYOUT, FIELD_USER, FIELD_LANGUAGE, FIELD_LAYER_NAME = 1, 2, 3, 4
FIELD_SIZE = 24  # keypress_display.c FIELD_SIZE, including the final 0
LAYOUT_IDS = {(layout, variant): index for index, (layout, variant, _) in enumerate(LAYOUTS)}
LAYER_NAMES = HERE / 'layer-names.txt'
ROW_CHARS = set((HERE / 'row_font_chars.txt').read_text())  # what the screen fonts can draw
POLL_SECONDS = 2


def log(message):
    print(message, flush=True)


def field_text(text):
    """UTF-8 bytes the screen can draw, cut at a whole character to fit a field."""
    text = ''.join(char if char in ROW_CHARS else '?' for char in text)
    data = text.encode()
    while len(data) > FIELD_SIZE - 1:
        text = text[:-1]
        data = text.encode()
    return data


def layer_names():
    """Names from layer-names.txt: one per line in layer order; '#' lines are notes."""
    try:
        lines = LAYER_NAMES.read_text().splitlines()
    except FileNotFoundError:
        return {}
    names = [line.strip() for line in lines if not line.lstrip().startswith('#')]
    return {FIELD_LAYER_NAME + layer: field_text(names[layer] if layer < len(names) else '')
            for layer in range(8)}


class Hyprland:
    """Hyprland's active keyboard language, and its change events."""

    def __init__(self):
        self.events = None

    @staticmethod
    def directory():
        runtime = Path(os.environ.get('XDG_RUNTIME_DIR', f'/run/user/{os.getuid()}')) / 'hypr'
        signature = os.environ.get('HYPRLAND_INSTANCE_SIGNATURE')
        if signature and (runtime / signature / '.socket.sock').exists():
            return runtime / signature
        running = [path for path in runtime.glob('*') if (path / '.socket2.sock').exists()]
        return max(running, key=lambda path: path.stat().st_mtime, default=None)

    def request(self, command):
        directory = self.directory()
        if not directory:
            return None
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
            connection.settimeout(2)
            connection.connect(str(directory / '.socket.sock'))
            connection.sendall(command.encode())
            data = b''
            while chunk := connection.recv(65536):
                data += chunk
        return data.decode()

    def language(self):
        """(layout id, display name), or None without a running Hyprland."""
        try:
            reply = self.request('j/devices')
        except OSError:
            return None
        if not reply:
            return None
        keyboards = json.loads(reply).get('keyboards', [])
        keyboard = (next((k for k in keyboards if 'halcyon-kyria' in k['name']), None)
                    or next((k for k in keyboards if k.get('main')), None)
                    or (keyboards[0] if keyboards else None))
        if not keyboard:
            return None
        layouts = keyboard.get('layout', '').split(',')
        variants = keyboard.get('variant', '').split(',')
        index = keyboard.get('active_layout_index', 0)
        layout = layouts[index].strip() if index < len(layouts) else layouts[0].strip()
        variant = variants[index].strip() if index < len(variants) else ''
        # "Estonian (no dead keys)" -> "Estonian": the screen row is short.
        name = re.sub(r'\s*\(.*\)$', '', keyboard.get('active_keymap', '')).strip() or layout
        return LAYOUT_IDS.get((layout, variant), 0), name

    def connect_events(self):
        directory = self.directory()
        if not directory:
            return False
        try:
            self.events = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            self.events.connect(str(directory / '.socket2.sock'))
        except OSError:
            self.events = None
            return False
        return True

    def changed(self, timeout):
        """Waits up to `timeout` s; True if the keyboard language may have changed."""
        if not self.events and not self.connect_events():
            time.sleep(timeout)
            return False
        events = self.events
        assert events is not None
        readable, _, _ = select.select([events], [], [], timeout)
        if not readable:
            return False
        data = events.recv(65536)
        if not data:  # Hyprland restarted
            events.close()
            self.events = None
            return True
        return any(line.startswith((b'activelayout>>', b'configreloaded>>'))
                   for line in data.splitlines())


class Keyboard:
    def __init__(self):
        self.device = None
        self.accepted = {}  # field -> bytes the connected keyboard has confirmed

    def connected(self):
        if self.device:
            try:
                while self.device.read(32, timeout=0):  # drain; raises once unplugged
                    pass
                return True
            except hid.HIDException:
                self.close()
        found = [d for d in hid.enumerate(VID, PID) if d['usage_page'] == USAGE_PAGE]
        if not found:
            return False
        try:
            self.device = hid.Device(path=found[0]['path'])
        except hid.HIDException as error:
            log(f'Keyboard found but not opened: {error}')
            return False
        self.accepted = {}
        log('Keyboard connected')
        return True

    def close(self):
        if self.device:
            self.device.close()
        self.device = None
        self.accepted = {}

    def send(self, field, value):
        """True once the keyboard confirms the field; False if it can't be set."""
        device = self.device
        if device is None:
            return False
        if self.accepted.get(field) == value:
            return True
        payload = bytes([COMMAND, field]) + value + b'\0'
        try:
            device.write(b'\0' + payload.ljust(32, b'\0'))
            for _ in range(4):
                reply = device.read(32, timeout=500)
                if reply[:2] == bytes([COMMAND, field]):
                    if reply[2] == 0:
                        self.accepted[field] = value
                        return True
                    log(f'Keyboard refused field {field}')
                    return False
                if reply[:1] == b'\xff':
                    log('Keyboard firmware has no display commands')
                    return False
        except hid.HIDException as error:
            log(f'Keyboard write failed: {error}')
            self.close()
        return False


def main():
    once = '--once' in sys.argv[1:]
    keyboard, hyprland = Keyboard(), Hyprland()
    wanted = {FIELD_USER: field_text(pwd.getpwuid(os.getuid()).pw_name)}
    names_mtime, language_due = None, True
    while True:
        if language_due:
            language = hyprland.language()
            if language:
                wanted[FIELD_LAYOUT] = bytes([language[0]])
                wanted[FIELD_LANGUAGE] = field_text(language[1])
            language_due = False
        mtime = LAYER_NAMES.stat().st_mtime if LAYER_NAMES.exists() else None
        if mtime != names_mtime:
            names_mtime = mtime
            wanted.update(layer_names())
        if keyboard.connected():
            for field, value in sorted(wanted.items()):
                if not keyboard.send(field, value) and not keyboard.device:
                    break
        if once:
            sys.exit(0 if keyboard.device and all(
                keyboard.accepted.get(f) == v for f, v in wanted.items()) else 1)
        language_due = hyprland.changed(POLL_SECONDS)


if __name__ == '__main__':
    main()
