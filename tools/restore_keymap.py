"""Compare the keyboard with backups/; --apply restores the keymap, macros and settings.

Restoring needs Vial's unlock: the script asks you to hold B and J (the unlock
keys in firmware/.../keypress_hlc/config.h) and locks the keyboard again after.
It never sends a reset or bootloader command.
"""
import argparse
import json
import time
from importlib import import_module
from pathlib import Path

hid = import_module('hid')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    backups = Path(__file__).resolve().parent.parent / 'backups'
    saved = json.loads((backups / 'live-keymap.json').read_text())
    extra = json.loads((backups / 'live-settings.json').read_text())
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

        if request([0xFE, 0])[:12].hex() != saved['vial_identity'][:24]:
            raise SystemExit('Vial identity mismatch; no changes made')
        if request([0x11])[1] != saved['layers']:
            raise SystemExit('Layer count mismatch; no changes made')
        if int.from_bytes(request([0x0D])[1:3], 'big') != len(bytes.fromhex(saved['macros'])):
            raise SystemExit('Macro capacity mismatch; no changes made')
        if request([0xFE, 0])[:12].hex() != extra['vial_identity'][:24]:
            raise SystemExit('Settings backup identity mismatch; no changes made')
        if list(request([0xFE, 0x0D, 0])[:4]) != extra['dynamic_counts']:
            raise SystemExit('Dynamic entry capacity mismatch; no changes made')
        unlocked_here = False
        if args.apply and not request([0xFE, 5])[0]:
            request([0xFE, 6])  # start Vial unlock
            print('Hold B and J on the keyboard until told to release (30 s)...', flush=True)
            deadline = time.monotonic() + 30
            while not request([0xFE, 7])[0]:
                if time.monotonic() > deadline:
                    request([0xFE, 8])
                    raise SystemExit('Not unlocked within 30 s; no changes made')
                time.sleep(0.12)
            unlocked_here = True
            print('Unlocked: release B and J.', flush=True)
        try:
            restore(args, request, saved, extra)
        finally:
            if unlocked_here:
                request([0xFE, 8])  # lock again
                print('Keyboard locked again.')


def restore(args, request, saved, extra):
    for name, read_command, write_command in [('keymap', 0x12, 0x13), ('macros', 0x0E, 0x0F)]:
        expected = bytes.fromhex(saved[name])
        different = 0
        for offset in range(0, len(expected), 28):
            block = expected[offset:offset + 28]
            header = [offset >> 8, offset & 255, len(block)]
            reply = request([read_command] + header)
            if reply[:4] != bytes([read_command] + header):
                raise RuntimeError('Unexpected read response')
            if reply[4:4 + len(block)] != block:
                different += 1
                if args.apply:
                    request([write_command] + header + list(block))
                    verified = request([read_command] + header)
                    if verified[4:4 + len(block)] != block:
                        raise RuntimeError(f'{name} verification failed at byte {offset}')
        print(f'{name}: {different} differing blocks' + (' restored and verified' if args.apply else ' (read-only)'))
    different_settings = 0

    def compare(read, expected, extract, writes):
        nonlocal different_settings
        if extract(request(read)) != expected:
            different_settings += 1
            if args.apply:
                for write in writes:
                    request(write)
                if extract(request(read)) != expected:
                    raise RuntimeError(f'Settings readback failed for {read}')

    layout = bytes.fromhex(extra['layout_options'])
    compare([0x02, 0x02], layout, lambda r: r[2:6], [[0x03, 0x02] + list(layout)])
    for kind, entries in enumerate(extra['dynamic']):
        for index, value in enumerate(entries):
            data = bytes.fromhex(value)
            compare([0xFE, 0x0D, kind * 2 + 1, index], data,
                    lambda r, size=len(data): r[1:1 + size],
                    [[0xFE, 0x0D, kind * 2 + 2, index] + list(data)])
    for setting, value in extra['qmk_settings'].items():
        ident = int(setting)
        data = bytes.fromhex(value)
        compare([0xFE, 0x0A, ident & 255, ident >> 8], data, lambda r: r,
                [[0xFE, 0x0B, ident & 255, ident >> 8] + list(data[1:29])])
    for layer, encoders in enumerate(extra['encoders']):
        for index, value in enumerate(encoders):
            data = bytes.fromhex(value)
            compare([0xFE, 3, layer, index], data, lambda r: r[:4],
                    [[0xFE, 4, layer, index, direction] + list(data[direction * 2:direction * 2 + 2])
                     for direction in range(2)])
    print(f'Vial settings: {different_settings} differences' +
          (' restored and verified' if args.apply else ' (read-only)'))
    if args.apply:
        print('Restoration complete; no reset or bootloader command was sent.')


if __name__ == '__main__':
    main()
