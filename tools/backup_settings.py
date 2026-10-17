"""Read Vial settings, combos, tap dances and overrides into backups/live-settings.json.

Only reads from the keyboard. An existing backup is replaced only with
--replace (git keeps the previous version).
"""
import json
import sys
from importlib import import_module
from pathlib import Path

hid = import_module('hid')


def main():
    dest = Path(__file__).resolve().parent.parent / 'backups/live-settings.json'
    if dest.exists() and '--replace' not in sys.argv[1:]:
        raise SystemExit(f'{dest} exists; add --replace to update it')
    devices = [d for d in hid.enumerate(0x8D1D, 0x7FCE) if d['usage_page'] == 0xFF60]
    if len(devices) != 1:
        raise SystemExit('Expected exactly one Halcyon Kyria raw HID interface')
    with hid.Device(path=devices[0]['path']) as device:
        def request(data):
            device.write(bytes([0] + data + [0] * (32 - len(data))))
            reply = device.read(32, timeout=1500)
            if len(reply) != 32:
                raise RuntimeError('Keyboard response timed out')
            return reply

        saved = {'vial_identity': request([0xFE, 0]).hex()}
        saved['layout_options'] = request([0x02, 0x02])[2:6].hex()
        counts = list(request([0xFE, 0x0D, 0])[:4])
        saved['dynamic_counts'] = counts
        saved['dynamic'] = []
        for kind, (count, size) in enumerate(zip(counts, [10, 10, 10, 6], strict=True)):
            entries = []
            for index in range(count):
                reply = request([0xFE, 0x0D, kind * 2 + 1, index])
                if reply[0] != 0:
                    raise RuntimeError('Cannot read a Vial dynamic entry')
                entries.append(reply[1:1 + size].hex())
            saved['dynamic'].append(entries)
        settings = {}
        previous = 0
        for _ in range(100):
            reply = request([0xFE, 0x09, previous & 255, previous >> 8])
            ids = [int.from_bytes(reply[i:i + 2], 'little') for i in range(0, 32, 2)]
            for setting in ids:
                if setting == 0xFFFF:
                    break
                if setting <= previous:
                    raise RuntimeError('Non-increasing settings list')
                value = request([0xFE, 0x0A, setting & 255, setting >> 8])
                if value[0] != 0:
                    raise RuntimeError('Cannot read a QMK setting')
                settings[str(setting)] = value.hex()
                previous = setting
            if 0xFFFF in ids:
                break
        else:
            raise RuntimeError('Settings enumeration exceeded its limit')
        saved['qmk_settings'] = settings
        # Four logical encoders are defined by the legacy Halcyon keymap.
        saved['encoders'] = [[request([0xFE, 3, layer, index])[:4].hex()
                              for index in range(4)] for layer in range(8)]
    dest.write_text(json.dumps(saved, indent=2) + '\n')
    dest.chmod(0o600)
    print(f'Backed up {len(settings)} settings and dynamic entry counts {counts}')


if __name__ == '__main__':
    main()
