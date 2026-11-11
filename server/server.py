#!/usr/bin/env python3
"""
DårbCRÅFT server.

Serves the website and keeps the class data in one database file, so every
device on the network sees the same class. It needs nothing but the Python
that comes with Raspberry Pi OS.

    python3 server/server.py --set-password     choose the teacher password
    python3 server/server.py                    run on port 8080
    python3 server/server.py --port 80          run on the normal web port

Anyone on the network can VIEW the class (Home and Teams).
Only someone logged in with the teacher password can CHANGE anything.
"""

import argparse
import getpass
import hashlib
import hmac
import json
import secrets
import sqlite3
import sys
import threading
import time
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

SITE_DIR = Path(__file__).resolve().parent.parent      # the folder with index.html
DATA_DIR = Path(__file__).resolve().parent / "data"    # never uploaded to GitHub
DB_PATH = DATA_DIR / "darbyon.db"
BACKUP_DIR = DATA_DIR / "backups"

# The lists the website is allowed to store, and the ones visitors may read
# without logging in.
DATA_KEYS = {"characters", "teams", "powers", "messages", "punishments",
             "shownMessages", "shownPlayers", "changeLog", "undoStack"}
PUBLIC_KEYS = {"characters", "teams", "powers"}

# Only these kinds of file are ever sent to a browser.
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
}

SESSION_COOKIE = "darbyon_session"
SESSION_HOURS = 12
MAX_BODY_BYTES = 2 * 1024 * 1024
MIN_PASSWORD_LENGTH = 8
LOGIN_ATTEMPTS = 5            # wrong passwords allowed ...
LOGIN_WINDOW_SECONDS = 300    # ... in this many seconds, per device
BACKUPS_TO_KEEP = 14

_write_lock = threading.Lock()
_failed_logins = {}           # device address -> times of recent wrong passwords
_failed_lock = threading.Lock()


# ---- Database --------------------------------------------------------------

def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute("PRAGMA journal_mode=WAL")
    return db


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Tell git to ignore everything in here, so class data can never be
    # uploaded to GitHub by accident.
    ignore = DATA_DIR / ".gitignore"
    if not ignore.exists():
        ignore.write_text("*\n")
    with connect() as db:
        db.execute("CREATE TABLE IF NOT EXISTS data ("
                   "key TEXT PRIMARY KEY, value TEXT NOT NULL, rev INTEGER NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires REAL NOT NULL)")


def get_setting(name):
    with connect() as db:
        row = db.execute("SELECT value FROM settings WHERE name = ?", (name,)).fetchone()
    return row[0] if row else None


def set_setting(name, value):
    with _write_lock, connect() as db:
        db.execute("INSERT INTO settings (name, value) VALUES (?, ?) "
                   "ON CONFLICT(name) DO UPDATE SET value = excluded.value", (name, value))


def load_state(keys):
    """Returns ({key: value}, {key: revision}) for the requested lists."""
    data, revs = {}, {}
    with connect() as db:
        for key, value, rev in db.execute("SELECT key, value, rev FROM data"):
            if key in keys:
                data[key] = json.loads(value)
                revs[key] = rev
    return data, revs


def save_changes(changes):
    """
    Saves several lists in one step. Each change carries the revision the
    browser last saw; if someone else has changed that list since, nothing is
    saved and None is returned so the browser can reload instead of
    overwriting their work.
    """
    with _write_lock, connect() as db:
        current = dict(db.execute("SELECT key, rev FROM data"))
        for key, change in changes.items():
            if current.get(key, 0) != change["rev"]:
                return None
        new_revs = {}
        for key, change in changes.items():
            rev = change["rev"] + 1
            if change["value"] is None:
                db.execute("DELETE FROM data WHERE key = ?", (key,))
                new_revs[key] = 0
            else:
                db.execute("INSERT INTO data (key, value, rev) VALUES (?, ?, ?) "
                           "ON CONFLICT(key) DO UPDATE SET value = excluded.value, rev = excluded.rev",
                           (key, json.dumps(change["value"]), rev))
                new_revs[key] = rev
        return new_revs


# ---- Passwords and sessions -----------------------------------------------

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1)
    return salt.hex() + ":" + digest.hex()


def check_password(password, stored):
    try:
        salt_hex, digest_hex = stored.split(":")
        expected = hash_password(password, bytes.fromhex(salt_hex))
    except (ValueError, AttributeError):
        return False
    return hmac.compare_digest(expected, salt_hex + ":" + digest_hex)


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session():
    token = secrets.token_urlsafe(32)
    with _write_lock, connect() as db:
        db.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
        db.execute("INSERT INTO sessions (token_hash, expires) VALUES (?, ?)",
                   (token_hash(token), time.time() + SESSION_HOURS * 3600))
    return token


def session_is_valid(token):
    if not token:
        return False
    with connect() as db:
        row = db.execute("SELECT expires FROM sessions WHERE token_hash = ?",
                         (token_hash(token),)).fetchone()
    return bool(row) and row[0] > time.time()


def end_session(token):
    if token:
        with _write_lock, connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))


def end_all_sessions():
    with _write_lock, connect() as db:
        db.execute("DELETE FROM sessions")


def too_many_failures(address):
    with _failed_lock:
        recent = [t for t in _failed_logins.get(address, []) if t > time.time() - LOGIN_WINDOW_SECONDS]
        _failed_logins[address] = recent
        return len(recent) >= LOGIN_ATTEMPTS


def record_failure(address):
    with _failed_lock:
        _failed_logins.setdefault(address, []).append(time.time())


# ---- Backups ---------------------------------------------------------------

def backup_once():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / ("darbyon-%s.db" % date.today().isoformat())
    source = connect()
    copy = sqlite3.connect(target)
    try:
        source.backup(copy)
    finally:
        copy.close()
        source.close()
    for old in sorted(BACKUP_DIR.glob("darbyon-*.db"))[:-BACKUPS_TO_KEEP]:
        old.unlink()


def backup_forever():
    """Copies the database when the server starts and then once a day."""
    while True:
        try:
            backup_once()
        except Exception as error:      # a failed backup must never stop the site
            print("Backup failed:", error, flush=True)
        time.sleep(24 * 3600)


# ---- Web requests ----------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "Darbyon"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        print("%s %s" % (self.address_string(), fmt % args), flush=True)

    # -- helpers --

    def send_body(self, status, body, content_type, extra_headers=()):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                         "frame-ancestors 'none'")
        for name, value in extra_headers:
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, status, payload, extra_headers=()):
        headers = [("Cache-Control", "no-store")] + list(extra_headers)
        self.send_body(status, json.dumps(payload).encode("utf-8"), "application/json", headers)

    def session_token(self):
        for part in self.headers.get("Cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == SESSION_COOKIE:
                return value
        return None

    def is_teacher(self):
        return session_is_valid(self.session_token())

    def read_json(self):
        """Reads the request body. Returns None (after replying) if it is unusable."""
        # Changes must come from this site's own pages, not from another website.
        origin = self.headers.get("Origin")
        if self.headers.get("X-Darbyon") != "1" or (origin and urlsplit(origin).netloc != self.headers.get("Host")):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Request refused."})
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            self.close_connection = True
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Too much data."})
            return None
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, UnicodeDecodeError):
            body = None
        if not isinstance(body, dict):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Could not read the request."})
            return None
        return body

    # -- routes --

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/api/state":
            self.get_state()
        elif path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        else:
            self.get_file(path)

    do_HEAD = do_GET

    def do_POST(self):
        path = urlsplit(self.path).path
        routes = {"/api/login": self.post_login, "/api/logout": self.post_logout, "/api/save": self.post_save}
        if path not in routes:
            self.close_connection = True
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return
        body = self.read_json()
        if body is not None:
            routes[path](body)

    def get_state(self):
        teacher = self.is_teacher()
        data, revs = load_state(DATA_KEYS if teacher else PUBLIC_KEYS)
        self.send_json(HTTPStatus.OK, {"server": True, "role": "teacher" if teacher else "guest",
                                       "data": data, "revs": revs})

    def post_login(self, body):
        address = self.client_address[0]
        stored = get_setting("teacher_password")
        if not stored:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE,
                           {"error": "No teacher password has been set on the server yet."})
        elif too_many_failures(address):
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS,
                           {"error": "Too many wrong passwords. Wait five minutes and try again."})
        elif not check_password(str(body.get("password", "")), stored):
            record_failure(address)
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Wrong password."})
        else:
            cookie = "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Strict" % (
                SESSION_COOKIE, create_session(), SESSION_HOURS * 3600)
            self.send_json(HTTPStatus.OK, {"ok": True}, [("Set-Cookie", cookie)])

    def post_logout(self, body):
        end_session(self.session_token())
        expired = "%s=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict" % SESSION_COOKIE
        self.send_json(HTTPStatus.OK, {"ok": True}, [("Set-Cookie", expired)])

    def post_save(self, body):
        if not self.is_teacher():
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Log in as the teacher to make changes."})
            return
        changes = body.get("changes")
        valid = isinstance(changes, dict) and changes and all(
            key in DATA_KEYS and isinstance(change, dict)
            and isinstance(change.get("rev"), int) and not isinstance(change.get("rev"), bool)
            and (change.get("value") is None or isinstance(change.get("value"), list))
            for key, change in changes.items())
        if not valid:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Could not understand the change."})
            return
        new_revs = save_changes(changes)
        if new_revs is None:
            self.send_json(HTTPStatus.CONFLICT, {"error": "The class was changed somewhere else."})
        else:
            self.send_json(HTTPStatus.OK, {"ok": True, "revs": new_revs})

    def get_file(self, path):
        if path.endswith("/"):
            path += "index.html"
        parts = [p for p in path.split("/") if p]
        # No hidden files, no stepping out of the site folder, nothing from server/.
        allowed = (parts and parts[0].lower() != "server"
                   and not any(p.startswith(".") or "\\" in p for p in parts))
        target = SITE_DIR.joinpath(*parts) if allowed else None
        content_type = STATIC_TYPES.get(target.suffix.lower()) if target else None
        if not content_type or not target.is_file() or SITE_DIR not in target.resolve().parents:
            self.send_body(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
            return
        cache = "public, max-age=86400" if content_type.startswith("image/") else "no-cache"
        self.send_body(HTTPStatus.OK, target.read_bytes(), content_type, [("Cache-Control", cache)])


# ---- Starting up -----------------------------------------------------------

def set_password():
    print("Choose the teacher password (at least %d characters)." % MIN_PASSWORD_LENGTH)
    print("Use one you do not use anywhere else.")
    while True:
        first = getpass.getpass("New password: ")
        if len(first) < MIN_PASSWORD_LENGTH:
            print("Too short, try again.")
            continue
        if first != getpass.getpass("Type it again: "):
            print("Those did not match, try again.")
            continue
        break
    set_setting("teacher_password", hash_password(first))
    end_all_sessions()      # anyone logged in with the old password is logged out
    print("Teacher password saved.")


def main():
    parser = argparse.ArgumentParser(description="DårbCRÅFT class site server")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--set-password", action="store_true", help="choose the teacher password and exit")
    parser.add_argument("--has-password", action="store_true", help="exit with 0 if a password is set")
    args = parser.parse_args()

    init_db()
    if args.has_password:
        sys.exit(0 if get_setting("teacher_password") else 1)
    if args.set_password:
        set_password()
        return
    if not get_setting("teacher_password"):
        print("No teacher password set yet. Run:  python3 server/server.py --set-password", flush=True)

    threading.Thread(target=backup_forever, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print("DårbCRÅFT is running on port %d. Data file: %s" % (args.port, DB_PATH), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
