"""Vial raw-HID access for the Kyria Studio server."""
import json
import os
from datetime import datetime, timedelta
from importlib import import_module
from pathlib import Path

UID = 10669769700359951850
SIZES = (10, 10, 10, 6)
WIDTHS = {1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2, 7: 2, 8: 1,
          **{i: 2 for i in range(9, 20)}, 20: 1, 21: 4, 22: 1, 23: 1,
          24: 1, 25: 2, 26: 1, 27: 2}


class KeyboardError(Exception):
    def __init__(self, message, status=500, **extra):
        super().__init__(message)
        self.status = status
        self.extra = extra


def connect():
    try:
        hid = import_module('hid')
    except (ImportError, OSError) as exc:
        raise KeyboardError('hidapi Python module not available: run ./setup.sh', 503) from exc
    try:
        devices = [d for d in hid.enumerate(0x8D1D, 0x7FCE) if d['usage_page'] == 0xFF60]
        if len(devices) != 1:
            raise KeyboardError('Expected exactly one Halcyon Kyria raw HID interface', 503)
        return hid.Device(path=devices[0]['path'])
    except KeyboardError:
        raise
    except (OSError, ValueError) as exc:
        raise KeyboardError('Cannot open keyboard', 503) from exc


class Keyboard:
    def __init__(self, device):
        self.device = device

    def request(self, data):
        self.device.write(bytes([0] + data + [0] * (32 - len(data))))
        reply = bytes(self.device.read(32, timeout=1500))
        if len(reply) != 32:
            raise KeyboardError('Keyboard response timed out')
        return reply

    def buffer(self, command, size):
        result = bytearray()
        for offset in range(0, size, 28):
            header = [command, offset >> 8, offset & 255, min(28, size - offset)]
            reply = self.request(header)
            if reply[:4] != bytes(header):
                raise KeyboardError('Unexpected buffer response')
            result.extend(reply[4:4 + header[3]])
        return result.hex()

    def setting(self, ident):
        reply = self.request([0xFE, 0x0A, ident & 255, ident >> 8])
        if reply[0]:
            raise KeyboardError('Cannot read a QMK setting')
        return reply[1:].hex()

    def dynamic(self, kind, index):
        reply = self.request([0xFE, 0x0D, kind * 2 + 1, index])
        if reply[0]:
            raise KeyboardError('Cannot read a Vial dynamic entry')
        return reply[1:1 + SIZES[kind]].hex()

    def read(self):
        identity = self.request([0xFE, 0])
        protocol = int.from_bytes(identity[:4], 'little')
        layers = self.request([0x11])[1]
        if not 1 <= layers <= 32:
            raise KeyboardError('Invalid keyboard layer count')
        macro_size = int.from_bytes(self.request([0x0D])[1:3], 'big')
        counts = list(self.request([0xFE, 0x0D, 0])[:4])
        settings = {}
        previous = 0
        for _ in range(100):
            reply = self.request([0xFE, 0x09, previous & 255, previous >> 8])
            ids = [int.from_bytes(reply[i:i + 2], 'little') for i in range(0, 32, 2)]
            for ident in ids:
                if ident == 0xFFFF:
                    break
                if ident <= previous:
                    raise KeyboardError('Non-increasing settings list')
                settings[str(ident)] = self.setting(ident)
                previous = ident
            if 0xFFFF in ids:
                break
        else:
            raise KeyboardError('Settings enumeration exceeded its limit')
        return {'connected': True, 'identity': identity.hex(),
                'uidOk': int.from_bytes(identity[4:12], 'little') == UID,
                'vialProtocol': protocol, 'layers': layers, 'rows': 10, 'cols': 7,
                'unlocked': bool(self.request([0xFE, 5])[0]),
                'keymap': self.buffer(0x12, layers * 140), 'macroSize': macro_size,
                'macros': self.buffer(0x0E, macro_size), 'dynamicCounts': counts,
                'dynamic': [[self.dynamic(k, i) for i in range(n)] for k, n in enumerate(counts)],
                'encoders': [[self.request([0xFE, 3, layer, i])[:4].hex() for i in range(4)]
                             for layer in range(layers)],
                'layoutOptions': self.request([2, 2])[2:6].hex(), 'settings': settings}

    def unlock(self, action):
        if action not in ('start', 'poll', 'lock'):
            raise KeyboardError('Invalid unlock action', 400)
        if action == 'poll':
            reply = self.request([0xFE, 7])
            return {'unlocked': bool(reply[0]), 'inProgress': bool(reply[1]), 'counter': reply[2]}
        self.request([0xFE, 6 if action == 'start' else 8])
        reply = self.request([0xFE, 5])
        return {'unlocked': bool(reply[0]), 'inProgress': bool(reply[1]), 'counter': 50 if action == 'start' else 0}

    def write(self, payload, backup_dir):
        current = self.read()
        if not current['uidOk'] or current['vialProtocol'] != 6:
            raise KeyboardError('Vial identity mismatch', 409)
        if not isinstance(payload, dict) or set(payload) != {'keymap', 'macros', 'dynamic', 'encoders', 'layoutOptions', 'settings'}:
            raise KeyboardError('Invalid keyboard payload', 400)

        def decode(value, size):
            if not isinstance(value, str) or len(value) != size * 2:
                raise KeyboardError('Keyboard size or count mismatch', 409)
            try:
                data = bytes.fromhex(value)
            except ValueError as exc:
                raise KeyboardError('Invalid hex', 400) from exc
            if len(data) != size:
                raise KeyboardError('Invalid hex', 400)
            return data

        target = {'keymap': decode(payload['keymap'], len(current['keymap']) // 2)}
        if payload['macros'] is not None:
            target['macros'] = decode(payload['macros'], current['macroSize'])
            if not current['unlocked'] and b'\x01\x05\x00\x7c' in target['macros']:
                raise KeyboardError('QK_BOOT requires unlock', 400)
            if target['macros'].hex() != current['macros'] and not current['unlocked']:
                raise KeyboardError('Macro changes require unlock', 409, needUnlock=True)
        for field, sizes in [('dynamic', current['dynamicCounts']), ('encoders', [4] * current['layers'])]:
            value = payload[field]
            if value is None:
                continue
            if not isinstance(value, list) or len(value) != len(sizes) or any(not isinstance(row, list) or len(row) != n for row, n in zip(value, sizes)):
                raise KeyboardError('Keyboard size or count mismatch', 409)
            target[field] = [[decode(entry, SIZES[i] if field == 'dynamic' else 4) for entry in row] for i, row in enumerate(value)]
        if payload['layoutOptions'] is not None:
            target['layoutOptions'] = decode(payload['layoutOptions'], 4)
        if payload['settings'] is not None:
            if not isinstance(payload['settings'], dict):
                raise KeyboardError('Invalid settings', 400)
            target['settings'] = {}
            for key, value in payload['settings'].items():
                if key not in current['settings'] or not key.isascii() or not key.isdigit() or int(key) not in WIDTHS:
                    raise KeyboardError('Unknown setting', 409)
                target['settings'][key] = decode(value, WIDTHS[int(key)])

        if not current['unlocked']:
            # Inspect keycode fields, not arbitrary option or setting bytes.
            codes = [int.from_bytes(target['keymap'][i:i + 2], 'big') for i in range(0, len(target['keymap']), 2)]
            for kind, row in enumerate(target.get('dynamic', [])):
                for entry in row:
                    count = (4, 5, 2, 2)[kind]
                    codes.extend(int.from_bytes(entry[i:i + 2], 'little') for i in range(0, count * 2, 2))
            for row in target.get('encoders', []):
                for entry in row:
                    codes.extend(int.from_bytes(entry[i:i + 2], 'big') for i in (0, 2))
            if 0x7C00 in codes:
                raise KeyboardError('QK_BOOT requires unlock', 400)

        backup_dir = Path(backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now()
        path = backup_dir / (stamp.strftime('%Y%m%d-%H%M%S') + '.json')
        # Keep each snapshot even when multiple writes occur within one second.
        while path.exists():
            stamp += timedelta(seconds=1)
            path = backup_dir / (stamp.strftime('%Y%m%d-%H%M%S') + '.json')
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=2)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
        for old in sorted(backup_dir.glob('*.json'))[:-20]:
            old.unlink()
        written = dict.fromkeys(('keymap', 'macros', 'dynamic', 'encoders', 'layoutOptions', 'settings'), 0)
        for field, read_cmd, write_cmd in [('keymap', 0x12, 0x13), ('macros', 0x0E, 0x0F)]:
            if field not in target:
                continue
            old = bytes.fromhex(current[field])
            for offset in range(0, len(old), 28):
                block = target[field][offset:offset + 28]
                if block == old[offset:offset + 28]:
                    continue
                header = [offset >> 8, offset & 255, len(block)]
                self.request([write_cmd] + header + list(block))
                reply = self.request([read_cmd] + header)
                if reply[:4] != bytes([read_cmd] + header) or reply[4:4 + len(block)] != block:
                    raise KeyboardError(f'{field} readback mismatch')
                written[field] += 1
        for kind, row in enumerate(target.get('dynamic', [])):
            for index, data in enumerate(row):
                if data.hex() != current['dynamic'][kind][index]:
                    self.request([0xFE, 0x0D, kind * 2 + 2, index] + list(data))
                    if self.dynamic(kind, index) != data.hex():
                        raise KeyboardError('Dynamic readback mismatch')
                    written['dynamic'] += 1
        for layer, row in enumerate(target.get('encoders', [])):
            for index, data in enumerate(row):
                if data.hex() != current['encoders'][layer][index]:
                    for direction in range(2):
                        self.request([0xFE, 4, layer, index, direction] + list(data[direction * 2:direction * 2 + 2]))
                    if self.request([0xFE, 3, layer, index])[:4] != data:
                        raise KeyboardError('Encoder readback mismatch')
                    written['encoders'] += 1
        if 'layoutOptions' in target and target['layoutOptions'].hex() != current['layoutOptions']:
            self.request([3, 2] + list(target['layoutOptions']))
            if self.request([2, 2])[2:6] != target['layoutOptions']:
                raise KeyboardError('Layout options readback mismatch')
            written['layoutOptions'] += 1
        for key, data in target.get('settings', {}).items():
            if not bytes.fromhex(current['settings'][key]).startswith(data):
                ident = int(key)
                self.request([0xFE, 0x0B, ident & 255, ident >> 8] + list(data))
                if not bytes.fromhex(self.setting(ident)).startswith(data):
                    raise KeyboardError('Setting readback mismatch')
                written['settings'] += 1
        return {'ok': True, 'written': written, 'backup': 'backups/before-write/' + path.name}
