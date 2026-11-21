import json
from pathlib import Path
from unittest.mock import patch

from tests.test_studio_server import StudioServerTests
from tools import kyria_hid


class FakeDevice:
    def __init__(self):
        self.keymap = bytearray(140)
        self.macros = bytearray(56)
        self.dynamic = [[bytearray(size)] for size in kyria_hid.SIZES]
        self.encoders = [[bytearray(4) for _ in range(4)]]
        self.layout = bytearray(4)
        self.settings = {7: bytearray([10, 0] + [0] * 29)}
        self.unlocked = False
        self.progress = False
        self.uid = kyria_hid.UID
        self.writes = []
        self.corrupt = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def write(self, data):
        self.command = data[1:]

    def read(self, size, timeout):
        c = self.command
        result = bytearray(32)
        if c[0] == 0xFE:
            op = c[1]
            if op == 0:
                result[:12] = (6).to_bytes(4, 'little') + self.uid.to_bytes(8, 'little')
            elif op == 3:
                result[:4] = self.encoders[c[2]][c[3]]
            elif op == 4:
                self.writes.append('encoder')
                self.encoders[c[2]][c[3]][c[4] * 2:c[4] * 2 + 2] = c[5:7]
            elif op == 5:
                result[:2] = bytes([self.unlocked, self.progress])
            elif op == 6:
                self.progress = True
            elif op == 7:
                self.unlocked, self.progress = True, False
                result[:3] = bytes([1, 0, 0])
            elif op == 8:
                self.unlocked, self.progress = False, False
            elif op == 9:
                ids = [i for i in self.settings if i > int.from_bytes(c[2:4], 'little')] + [65535] * 16
                result[:] = b''.join(i.to_bytes(2, 'little') for i in ids[:16])
            elif op == 10:
                result[1:] = self.settings[int.from_bytes(c[2:4], 'little')]
            elif op == 11:
                self.writes.append('settings')
                ident = int.from_bytes(c[2:4], 'little')
                self.settings[ident][:kyria_hid.WIDTHS[ident]] = c[4:4 + kyria_hid.WIDTHS[ident]]
            elif op == 13:
                sub = c[2]
                if sub == 0:
                    result[:4] = bytes(len(row) for row in self.dynamic)
                elif sub % 2:
                    result[1:1 + len(self.dynamic[(sub - 1) // 2][c[3]])] = self.dynamic[(sub - 1) // 2][c[3]]
                else:
                    self.writes.append('dynamic')
                    entry = self.dynamic[(sub - 2) // 2][c[3]]
                    entry[:] = c[4:4 + len(entry)]
        elif c[0] == 0x11:
            result[1] = 1
        elif c[0] == 0x0D:
            result[1:3] = len(self.macros).to_bytes(2, 'big')
        elif c[0] in (0x12, 0x13, 0x0E, 0x0F):
            offset = int.from_bytes(c[1:3], 'big')
            count = c[3]
            buf = self.keymap if c[0] in (0x12, 0x13) else self.macros
            result[:4] = c[:4]
            if c[0] in (0x13, 0x0F):
                self.writes.append('buffer')
                if not self.corrupt and (c[0] != 0x0F or self.unlocked):
                    buf[offset:offset + count] = c[4:4 + count]
            else:
                result[4:4 + count] = buf[offset:offset + count]
        elif c[0] == 2:
            result[2:6] = self.layout
        elif c[0] == 3:
            self.writes.append('layout')
            self.layout[:] = c[2:6]
        return result


class KeyboardTests(StudioServerTests):
    def setUp(self):
        super().setUp()
        self.device = FakeDevice()
        self.server.backups = Path(self.temp.name) / 'backups'
        self.patch = patch('tools.kyria_hid.connect', return_value=self.device)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def get(self):
        status, _, body = self.request('GET', '/api/keyboard')
        return status, json.loads(body)

    def post(self, endpoint, value, headers=None):
        status, _, body = self.request('POST', '/api/keyboard/' + endpoint, json.dumps(value), headers or {'Content-Type': 'application/json'})
        return status, json.loads(body)

    def payload(self):
        current = self.get()[1]
        return {'keymap': current['keymap'], 'macros': None, 'dynamic': None,
                'encoders': None, 'layoutOptions': None, 'settings': None}

    def test_get_shape_and_disconnect(self):
        status, data = self.get()
        self.assertEqual(status, 200)
        self.assertTrue(data['uidOk'])
        self.assertEqual((data['layers'], data['rows'], data['cols'], data['macroSize']), (1, 10, 7, 56))
        self.assertEqual(len(data['settings']['7']), 62)
        self.assertEqual(data['dynamicCounts'], [1, 1, 1, 1])
        payload = self.payload()
        with patch('tools.kyria_hid.connect', side_effect=kyria_hid.KeyboardError('absent', 503)):
            self.assertEqual(self.get(), (200, {'connected': False, 'error': 'absent'}))
            self.assertEqual(self.post('write', payload)[0], 503)

    def test_diff_and_readback(self):
        payload = self.payload()
        payload['keymap'] = '0004' + payload['keymap'][4:]
        status, result = self.post('write', payload)
        self.assertEqual(status, 200)
        self.assertEqual(result['written']['keymap'], 1)
        self.assertEqual(self.device.keymap[:2], b'\0\4')
        self.assertTrue((self.server.backups / Path(result['backup']).name).exists())
        self.device.corrupt = True
        payload['keymap'] = '0005' + payload['keymap'][4:]
        payload['layoutOptions'] = '01020304'
        self.assertEqual(self.post('write', payload)[0], 500)
        self.assertEqual(self.device.layout, bytes(4))

    def test_mismatch_and_locked_safety(self):
        payload = self.payload()
        for field, value in [('keymap', '00'), ('dynamic', [[], [], [], []]), ('encoders', [])]:
            bad = dict(payload, **{field: value})
            self.assertEqual(self.post('write', bad)[0], 409)
        self.device.uid = 0
        self.assertEqual(self.post('write', payload)[0], 409)
        self.device.uid = kyria_hid.UID
        payload['keymap'] = '7c00' + payload['keymap'][4:]
        self.assertEqual(self.post('write', payload)[0], 400)
        payload['keymap'] = '0000' + payload['keymap'][4:]
        payload['macros'] = '01057cff' + '00' * 52
        self.assertEqual(self.post('write', payload)[0], 400)
        self.assertEqual(self.device.writes, [])

    def test_macros_unlock_and_actions(self):
        payload = self.payload()
        payload['macros'] = '04' + '00' * 55
        status, result = self.post('write', payload)
        self.assertEqual(status, 409)
        self.assertTrue(result['needUnlock'])
        self.assertTrue(self.post('unlock', {'action': 'start'})[1]['inProgress'])
        self.assertTrue(self.post('unlock', {'action': 'poll'})[1]['unlocked'])
        self.assertEqual(self.post('write', payload)[1]['written']['macros'], 1)
        self.assertEqual(self.device.macros[0], 4)
        self.assertFalse(self.post('unlock', {'action': 'lock'})[1]['unlocked'])

    def test_other_entries_and_retention(self):
        data = self.get()[1]
        payload = self.payload()
        payload['dynamic'] = data['dynamic']
        payload['dynamic'][0][0] = '0100' + '00' * 8
        payload['encoders'] = data['encoders']
        payload['encoders'][0][0] = '00010002'
        payload['layoutOptions'] = '00000001'
        payload['settings'] = {'7': '1400'}
        self.server.backups.mkdir()
        for i in range(20):
            (self.server.backups / f'20200101-{i:06}.json').write_text('{}')
        status, result = self.post('write', payload)
        self.assertEqual(status, 200)
        self.assertEqual([result['written'][k] for k in ('dynamic', 'encoders', 'layoutOptions', 'settings')], [1, 1, 1, 1])
        self.assertEqual(len(list(self.server.backups.glob('*.json'))), 20)

    def test_busy_and_origin(self):
        with self.server.hid_lock:
            self.assertEqual(self.get(), (409, {'error': 'busy'}))
        self.assertEqual(self.request('GET', '/api/keyboard', headers={'Host': 'evil'})[0], 403)
        for endpoint in ('write', 'unlock'):
            self.assertEqual(self.post(endpoint, {}, {'Content-Type': 'application/json', 'Origin': 'http://evil'})[0], 403)
