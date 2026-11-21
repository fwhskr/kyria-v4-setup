import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from tools.studio_server import StudioServer


class StudioServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.root = base / "static"
        self.layouts = base / "layouts"
        self.root.mkdir()
        self.layouts.mkdir()
        (self.root / "index.html").write_text("<h1>Studio</h1>", encoding="utf-8")
        (self.root / "app.js").write_text("const ready = true;", encoding="utf-8")
        self.server = StudioServer(("127.0.0.1", 0), self.root, self.layouts)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            conn.request(method, path, body, headers or {})
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def put(self, body, headers=None):
        return self.request("PUT", "/api/layout", body, headers or {"Content-Type": "application/json"})

    def test_static_files_no_store(self):
        for path, text, content_type in [("/", b"<h1>Studio</h1>", "text/html"), ("/app.js", b"const ready = true;", "text/javascript")]:
            with self.subTest(path=path):
                status, headers, body = self.request("GET", path)
                self.assertEqual((status, body), (200, text))
                self.assertEqual(headers["Cache-Control"], "no-store")
                self.assertTrue(headers["Content-Type"].startswith(content_type))

    def test_traversal_and_directories_refused(self):
        (self.root.parent / "secret").write_text("private", encoding="utf-8")
        (self.root / "dir").mkdir()
        for path in ["/../secret", "/%2e%2e/secret", "/dir"]:
            with self.subTest(path=path):
                status, headers, body = self.request("GET", path)
                self.assertIn(status, (403, 404))
                self.assertNotIn(b"private", body)
                self.assertEqual(headers["Cache-Control"], "no-store")

    def test_get_layout_exact_text_and_meta(self):
        vil = '{\r\n  "layout": [["Õ"]]\r\n}\r\n'
        meta = {"schema": 1, "keyLabels": {"0:0:0": "õ"}}
        (self.layouts / "kyria.vil").write_bytes(vil.encode())
        (self.layouts / "kyria.studio.json").write_text(json.dumps(meta), encoding="utf-8")
        status, headers, body = self.request("GET", "/api/layout")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(json.loads(body), {"vil": vil, "meta": meta, "path": "layouts/kyria.vil"})
        (self.layouts / "kyria.studio.json").write_text("broken", encoding="utf-8")
        self.assertIsNone(json.loads(self.request("GET", "/api/layout")[2])["meta"])
        (self.layouts / "kyria.studio.json").unlink()
        self.assertIsNone(json.loads(self.request("GET", "/api/layout")[2])["meta"])

    def test_missing_layout(self):
        status, headers, body = self.request("GET", "/api/layout")
        self.assertEqual(status, 404)
        self.assertIn("error", json.loads(body))
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_put_atomic_files_and_exact_vil(self):
        vil = '{\r\n "layout": [["Õ"]], "other": true\r\n}\n'
        meta = {"schema": 1, "keyLabels": {"0:0:0": "õ"}}
        replaced = []
        real_replace = os.replace

        def replace(src, dst):
            self.assertEqual(Path(src).parent, self.layouts)
            self.assertTrue(Path(src).is_file())
            replaced.append(Path(dst).name)
            real_replace(src, dst)

        with patch("tools.studio_server.os.replace", side_effect=replace):
            status, _, body = self.put(json.dumps({"vil": vil, "meta": meta}).encode())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"ok": True, "path": "layouts/kyria.vil"})
        self.assertEqual(replaced, ["kyria.vil", "kyria.studio.json"])
        self.assertEqual((self.layouts / "kyria.vil").read_bytes(), vil.encode())
        self.assertEqual((self.layouts / "kyria.studio.json").read_bytes(), (json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode())
        self.assertEqual(sorted(p.name for p in self.layouts.iterdir()), sorted(replaced))

    def test_invalid_payloads(self):
        payloads = [b"{", b"[]", json.dumps({"vil": "[]", "meta": {}}).encode(), json.dumps({"vil": '{"layout": {}}', "meta": {}}).encode(), json.dumps({"vil": '{"layout": []}', "meta": []}).encode()]
        for body in payloads:
            with self.subTest(body=body):
                status, _, result = self.put(body)
                self.assertEqual(status, 400)
                self.assertIn("error", json.loads(result))
        self.assertEqual(list(self.layouts.iterdir()), [])

    def test_oversize(self):
        status, _, body = self.put(b"x" * (1024 * 1024 + 1))
        self.assertEqual(status, 413)
        self.assertIn("error", json.loads(body))

    def test_wrong_content_type(self):
        status, _, _ = self.put(b"{}", {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)

    def test_host_rejected(self):
        for host in ["evil.example", "localhost:1", "127.0.0.1"]:
            with self.subTest(host=host):
                status, _, _ = self.request("GET", "/", headers={"Host": host})
                self.assertEqual(status, 403)

    def test_origin_rejected_on_put(self):
        status, _, _ = self.put(b"{}", {"Content-Type": "application/json", "Origin": "http://evil.example"})
        self.assertEqual(status, 403)
        self.assertEqual(list(self.layouts.iterdir()), [])

    def test_other_methods(self):
        for method in ["POST", "DELETE", "PATCH", "OPTIONS", "HEAD", "CUSTOM"]:
            with self.subTest(method=method):
                status, headers, _ = self.request(method, "/api/layout")
                self.assertEqual(status, 405)
                self.assertEqual(headers["Cache-Control"], "no-store")


if __name__ == "__main__":
    unittest.main()
