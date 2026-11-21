#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

try:
    from . import kyria_hid
except ImportError:
    import kyria_hid

REPO = Path(__file__).resolve().parent.parent
LIMIT = 1024 * 1024


class StudioServer(ThreadingHTTPServer):
    def __init__(self, address, root, layouts):
        super().__init__(address, StudioHandler)
        self.root = Path(root).resolve()
        self.layouts = Path(layouts)
        self.hid_lock = threading.Lock()
        self.backups = REPO / "backups" / "before-write"


class StudioHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def respond(self, status, body, content_type="application/json"):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, message):
        self.respond(status, {"error": message})

    def allowed(self, check_origin=False):
        port = self.server.server_port
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host_headers = self.headers.get_all("Host", [])
        origins = self.headers.get_all("Origin", [])
        if len(host_headers) != 1 or host_headers[0] not in hosts:
            self.error(403, "Forbidden host")
            return False
        if check_origin and (len(origins) > 1 or (origins and origins[0] not in {f"http://{host}" for host in hosts})):
            self.error(403, "Forbidden origin")
            return False
        return True

    def do_GET(self):
        if not self.allowed():
            return
        path = urlsplit(self.path).path
        if path == "/api/keyboard":
            self.keyboard("read")
            return
        if path == "/api/layout":
            try:
                vil = (self.server.layouts / "kyria.vil").read_bytes().decode("utf-8")
            except FileNotFoundError:
                self.error(404, "Layout not found")
                return
            try:
                meta = json.loads((self.server.layouts / "kyria.studio.json").read_text(encoding="utf-8"))
            except (OSError, ValueError, UnicodeError):
                meta = None
            self.respond(200, {"vil": vil, "meta": meta, "path": "layouts/kyria.vil"})
            return
        try:
            target = (self.server.root / unquote(path).lstrip("/")).resolve()
            if not target.is_relative_to(self.server.root):
                self.error(403, "Forbidden path")
                return
            if target == self.server.root:
                target = target / "index.html"
            data = target.read_bytes()
        except (OSError, ValueError):
            self.error(404, "File not found")
            return
        content_type = {".js": "text/javascript", ".woff2": "font/woff2"}.get(target.suffix.lower())
        self.respond(200, data, content_type or mimetypes.guess_type(target.name)[0] or "application/octet-stream")

    def keyboard(self, action, payload=None):
        if not self.server.hid_lock.acquire(blocking=False):
            self.error(409, "busy")
            return
        try:
            with kyria_hid.connect() as device:
                keyboard = kyria_hid.Keyboard(device)
                if action == "read":
                    result = keyboard.read()
                elif action == "write":
                    result = keyboard.write(payload, self.server.backups)
                else:
                    result = keyboard.unlock(payload.get("action"))
            self.respond(200, result)
        except kyria_hid.KeyboardError as exc:
            if action == "read":
                self.respond(200, {"connected": False, "error": str(exc)})
            else:
                self.respond(exc.status, {"error": str(exc), **exc.extra})
        except (OSError, ValueError) as exc:
            if action == "read":
                self.respond(200, {"connected": False, "error": "Cannot read keyboard"})
            else:
                self.error(500, "Keyboard operation failed")
        finally:
            self.server.hid_lock.release()

    def do_POST(self):
        if not self.allowed(check_origin=True):
            return
        path = urlsplit(self.path).path
        if path not in ("/api/keyboard/write", "/api/keyboard/unlock"):
            self.error(405, "Method not allowed")
            return
        if self.headers.get_content_type() != "application/json":
            self.error(415, "Expected application/json")
            return
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or self.headers.get("Transfer-Encoding"):
            self.error(400, "Invalid Content-Length")
            return
        size = int(lengths[0])
        if size > LIMIT:
            self.close_connection = True
            self.error(413, "Body too large")
            return
        try:
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError
        except (ValueError, UnicodeError, RecursionError):
            self.error(400, "Invalid keyboard payload")
            return
        self.keyboard("write" if path.endswith("/write") else "unlock", payload)

    def do_PUT(self):
        if not self.allowed(check_origin=True):
            return
        if urlsplit(self.path).path != "/api/layout":
            self.error(404, "Not found")
            return
        if self.headers.get_content_type() != "application/json":
            self.error(415, "Expected application/json")
            return
        try:
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1 or not lengths[0].isascii() or not lengths[0].isdigit() or self.headers.get("Transfer-Encoding"):
                raise ValueError
            size = int(lengths[0])
        except ValueError:
            self.error(400, "Invalid Content-Length")
            return
        if size > LIMIT:
            # Read (and drop) a bounded body first so the client sees the 413 instead of a reset.
            remaining = min(size, 16 * LIMIT)
            while remaining > 0:
                chunk = self.rfile.read(min(65536, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
            self.close_connection = True
            self.error(413, "Body too large")
            return
        try:
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            if not isinstance(payload, dict) or not isinstance(payload.get("vil"), str) or not isinstance(payload.get("meta"), dict):
                raise ValueError
            vil = json.loads(payload["vil"])
            if not isinstance(vil, dict) or not isinstance(vil.get("layout"), list):
                raise ValueError
            files = {
                "kyria.vil": payload["vil"].encode("utf-8"),
                "kyria.studio.json": (json.dumps(payload["meta"], indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
            }
        except (ValueError, UnicodeError, RecursionError):
            self.error(400, "Invalid layout")
            return
        pending = []
        try:
            self.server.layouts.mkdir(parents=True, exist_ok=True)
            for name, data in files.items():
                with tempfile.NamedTemporaryFile(dir=self.server.layouts, delete=False) as temp:
                    pending.append(temp.name)
                    os.fchmod(temp.fileno(), 0o644)  # tracked files, not private temp files
                    temp.write(data)
                    temp.flush()
                    os.fsync(temp.fileno())
            for name, temp in zip(files, pending):
                os.replace(temp, self.server.layouts / name)
        except OSError:
            self.error(500, "Could not save layout")
            return
        finally:
            for temp in pending:
                if os.path.exists(temp):
                    os.unlink(temp)
        self.respond(200, {"ok": True, "path": "layouts/kyria.vil"})

    def __getattr__(self, name):
        if name.startswith("do_"):
            return self.method_not_allowed
        raise AttributeError(name)

    def method_not_allowed(self):
        if self.allowed():
            self.error(405, "Method not allowed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("KYRIA_STUDIO_PORT", "8737")))
    parser.add_argument("--layouts", type=Path, default=REPO / "layouts")
    parser.add_argument("--root", type=Path, default=REPO / "keymap-studio")
    args = parser.parse_args()
    with StudioServer(("127.0.0.1", args.port), args.root, args.layouts) as server:
        print(f"Keymap Studio: http://127.0.0.1:{server.server_port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
