"""Read the keymap and macros from the keyboard into backups/live-keymap.json.

Only reads; never sends keymap writes or a bootloader command. An existing
backup is replaced only with --replace (git keeps the previous version).
"""
import json
import sys
from importlib import import_module
from pathlib import Path

# hidapi binding from the project's Python environment (.venv, made by setup.sh).
hid = import_module('hid')

DEST = Path(__file__).resolve().parent.parent / 'backups' / 'live-keymap.json'

def main():
    if DEST.exists() and '--replace' not in sys.argv[1:]:
        raise SystemExit(f'{DEST} exists; add --replace to update it')
    devices = [d for d in hid.enumerate(0x8D1D, 0x7FCE) if d['usage_page'] == 0xFF60]
    if len(devices) != 1:
        raise SystemExit('Expected exactly one Halcyon Kyria raw HID interface')
    with hid.Device(path=devices[0]['path']) as device:
        def request(data):
            device.write(bytes([0] + data + [0] * (32 - len(data))))
            result = device.read(32, timeout=1500)
            if len(result) != 32:
                raise RuntimeError('Keyboard response timed out')
            return result
        identity = request([0xFE, 0])
        layers = request([0x11])[1]
        # The connected legacy Vial definition uses 10 rows and 7 columns.
        def read_buffer(command, size):
            data = bytearray()
            for offset in range(0, size, 28):
                count = min(28, size - offset)
                reply = request([command, offset >> 8, offset & 255, count])
                if reply[:4] != bytes([command, offset >> 8, offset & 255, count]):
                    raise RuntimeError('Unexpected buffer response')
                data.extend(reply[4:4 + count])
            return data.hex()
        macro_size = int.from_bytes(request([0x0D])[1:3], 'big')
        result = {
            'vial_identity': identity.hex(), 'layers': layers, 'rows': 10, 'cols': 7,
            'keymap': read_buffer(0x12, layers * 10 * 7 * 2),
            'macros': read_buffer(0x0E, macro_size),
        }
    DEST.write_text(json.dumps(result, indent=2) + '\n')
    DEST.chmod(0o600)
    print(f'Backed up {layers} layers and {macro_size} macro bytes to {DEST}')

if __name__ == '__main__':
    main()
