#!/usr/bin/env python3
"""
DårbCRÅFT server.

Serves the website and keeps the class data in one database file, so every
device on the network sees the same class. It needs nothing but the Python
that comes with Raspberry Pi OS.

    python3 server/server.py --set-password      choose the teacher password
    python3 server/server.py --set-class-code    choose the code students type to see the class
    python3 server/server.py                     run on port 8080, for a private network
    python3 server/server.py --port 80           the same, on the normal web port
    python3 server/server.py --internet          run behind a tunnel that puts the site on the internet

Who can do what:
    - Changing anything needs the teacher password.
    - Viewing the class (Home and Teams) needs the class code, if one is set.
      With no class code, anyone who can reach the site can view it. The
      --internet mode refuses to start without a class code.
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

# The lists the teacher's pages save, and the ones anyone with the class code
# may read. SERVER_KEYS are written only by the server itself, when students
# ask to use a power or vote in a poll; the teacher reads them.
DATA_KEYS = {"characters", "teams", "powers", "messages", "punishments",
             "shownMessages", "shownPlayers", "changeLog", "undoStack",
             "pictureCodes", "poll"}
PUBLIC_KEYS = {"characters", "teams", "powers"}
SERVER_KEYS = {"powerRequests", "pollVotes"}

PICTURE_COUNT = 12            # pictures a student chooses from ...
PICTURE_CODE_LENGTH = 3       # ... and how many they tap, in order
STUDENT_COOKIE = "darbyon_student"
STUDENT_SESSION_HOURS = 10    # a school day; students tap their pictures again each morning
REQUESTS_KEPT_HOURS = 24

# Only these kinds of file are ever sent to a browser.
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
}

SESSION_COOKIE = "darbyon_session"
TEACHER_SESSION_HOURS = 12
VIEWER_SESSION_HOURS = 24 * 30   # students stay signed in to view for a month
MAX_BODY_BYTES = 2 * 1024 * 1024
MIN_PASSWORD_LENGTH = 12
MIN_CLASS_CODE_LENGTH = 6
LOGIN_ATTEMPTS = 5            # wrong guesses allowed ...
LOGIN_WINDOW_SECONDS = 300    # ... in this many seconds, per device
BUSY_ATTEMPTS = 20            # after this many wrong guesses from everyone in that time ...
BUSY_DELAY_SECONDS = 2        # ... every login is slowed down by this much
LOGINS_AT_ONCE = 4            # logins checked at the same time; any more are told to wait
REQUEST_TIMEOUT_SECONDS = 30  # a connection that sends nothing for this long is dropped
BACKUPS_TO_KEEP = 14

INTERNET_MODE = False         # set by --internet

_write_lock = threading.Lock()
_failed_logins = {}           # device address -> times of recent wrong guesses
_all_failures = []            # times of recent wrong guesses from anyone
_failed_lock = threading.Lock()
_login_slots = threading.BoundedSemaphore(LOGINS_AT_ONCE)


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
        # Older databases only knew teacher sessions; add the role column if it is missing.
        columns = [row[1] for row in db.execute("PRAGMA table_info(sessions)")]
        if "role" not in columns:
            db.execute("ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher'")
        if "subject" not in columns:      # which character a student session belongs to
            db.execute("ALTER TABLE sessions ADD COLUMN subject TEXT NOT NULL DEFAULT ''")


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


def load_key(key, fallback):
    data, revs = load_state({key})
    return data.get(key, fallback), revs.get(key, 0)


def update_server_key(key, change):
    """Reads one server-written list, passes it to change(), and saves what it returns."""
    with _write_lock, connect() as db:
        row = db.execute("SELECT value, rev FROM data WHERE key = ?", (key,)).fetchone()
        value = json.loads(row[0]) if row else []
        new_value = change(value if isinstance(value, list) else [])
        db.execute("INSERT INTO data (key, value, rev) VALUES (?, ?, ?) "
                   "ON CONFLICT(key) DO UPDATE SET value = excluded.value, rev = excluded.rev",
                   (key, json.dumps(new_value), (row[1] if row else 0) + 1))


# ---- Game rules (the same rules as app.js, checked again here) -------------

def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def tidy_power(p):
    """Reads a power saved in any of the site's older formats."""
    other = [to_int(p.get(k)) for k in ("otherXp", "otherAp", "otherHp")]
    if not any(other):
        other = [to_int(p.get("otherPlayerxp") or p.get("otherPlayerXP")),
                 to_int(p.get("otherPlayerAP")), to_int(p.get("otherPlayerHP"))]
    kind = p.get("type")
    if kind not in ("team", "self"):
        kind = "team" if p.get("target") == "other" or any(other) else "self"
    cost = p.get("apCost")
    cost = max(0, to_int(cost)) if cost is not None else abs(to_int(p.get("ap") or p.get("apEffect")))
    return {"id": str(p.get("id", "")), "name": str(p.get("name", "")), "type": kind, "apCost": cost}


def class_snapshot():
    characters = [c for c in load_key("characters", [])[0] if isinstance(c, dict)]
    powers = [tidy_power(p) for p in load_key("powers", [])[0] if isinstance(p, dict) and p.get("id")]
    return characters, powers


def powers_for(character, powers):
    """A player's own powers, or every power if they have not been given any."""
    own_ids = [str(i) for i in character.get("powers") or []]
    own = [p for p in powers if p["id"] in own_ids]
    return own or powers


def find_character(characters, character_id):
    return next((c for c in characters if str(c.get("id")) == character_id), None)


def picture_code_for(character_id):
    for entry in load_key("pictureCodes", [])[0]:
        if isinstance(entry, dict) and str(entry.get("id")) == character_id:
            code = entry.get("code")
            if isinstance(code, list) and len(code) == PICTURE_CODE_LENGTH:
                return [to_int(i) for i in code]
    return None


def current_poll():
    poll = load_key("poll", [])[0]
    poll = poll[0] if poll and isinstance(poll[0], dict) else None
    if not poll or not isinstance(poll.get("options"), list):
        return None
    return poll


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


def create_session(role, subject=""):
    """
    role is 'teacher' (may change things), 'viewer' (may look) or 'student'
    (may look, and ask to use their own powers). subject is the student's
    character id.
    """
    hours = {"teacher": TEACHER_SESSION_HOURS, "student": STUDENT_SESSION_HOURS}.get(role, VIEWER_SESSION_HOURS)
    token = secrets.token_urlsafe(32)
    with _write_lock, connect() as db:
        db.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
        db.execute("INSERT INTO sessions (token_hash, expires, role, subject) VALUES (?, ?, ?, ?)",
                   (token_hash(token), time.time() + hours * 3600, role, subject))
    return token, hours * 3600


def session_info(token):
    """Returns (role, subject) for a session cookie, or (None, '')."""
    if not token:
        return None, ""
    with connect() as db:
        row = db.execute("SELECT expires, role, subject FROM sessions WHERE token_hash = ?",
                         (token_hash(token),)).fetchone()
    return (row[1], row[2]) if row and row[0] > time.time() else (None, "")


def session_role(token):
    """Returns 'teacher', 'viewer', 'student' or None for a session cookie."""
    return session_info(token)[0]


def end_session(token):
    if token:
        with _write_lock, connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(token),))


def end_all_sessions():
    with _write_lock, connect() as db:
        db.execute("DELETE FROM sessions")


def too_many_failures(address):
    """True if this device has guessed wrong too often. address may be None (unknown)."""
    if address is None:
        return False
    with _failed_lock:
        recent = [t for t in _failed_logins.get(address, []) if t > time.time() - LOGIN_WINDOW_SECONDS]
        if recent:
            _failed_logins[address] = recent
        else:
            _failed_logins.pop(address, None)
        return len(recent) >= LOGIN_ATTEMPTS


def record_failure(address):
    now = time.time()
    with _failed_lock:
        _all_failures.append(now)
        if address is not None:
            _failed_logins.setdefault(address, []).append(now)
        if len(_failed_logins) > 5000:      # never let the list grow without limit
            _failed_logins.clear()


def site_is_under_guessing():
    """True while there have been many wrong guesses from anyone recently."""
    with _failed_lock:
        _all_failures[:] = [t for t in _all_failures if t > time.time() - LOGIN_WINDOW_SECONDS]
        return len(_all_failures) >= BUSY_ATTEMPTS


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
    sys_version = ""
    protocol_version = "HTTP/1.1"
    timeout = REQUEST_TIMEOUT_SECONDS

    def log_message(self, fmt, *args):
        who = (self.device() if getattr(self, "headers", None) else None) or self.client_address[0]
        print("%s %s" % (who, fmt % args), flush=True)

    def device(self):
        """
        The address of the device making the request, used to lock out a
        device that keeps guessing. Behind a tunnel every request arrives from
        this computer itself, so the tunnel's note of the real address is used
        when there is one. Returns None when the real address cannot be known.
        """
        peer = self.client_address[0]
        if peer not in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
            return peer
        forwarded = self.headers.get("X-Forwarded-For", "")
        last = forwarded.split(",")[-1].strip()      # the entry added by the tunnel itself
        if last:
            return last[:64]
        return None if INTERNET_MODE else peer

    # -- helpers --

    def send_body(self, status, body, content_type, extra_headers=()):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Robots-Tag", "noindex, nofollow")     # keep it out of search engines
        if INTERNET_MODE:
            self.send_header("Strict-Transport-Security", "max-age=31536000")
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
        return self.cookie_value(SESSION_COOKIE)

    def role(self):
        """'teacher', 'viewer', or None when not signed in. Students show up as 'viewer' here."""
        return session_role(self.session_token())

    def student(self):
        """The character id of the student signed in on this device, or None."""
        role, subject = session_info(self.cookie_value(STUDENT_COOKIE))
        if role != "student" or not find_character(class_snapshot()[0], subject):
            return None
        return subject

    def cookie_value(self, wanted):
        for part in self.headers.get("Cookie", "").split(";"):
            name, _, value = part.strip().partition("=")
            if name == wanted:
                return value
        return None

    def cookie(self, value, seconds, name=SESSION_COOKIE):
        text = "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Strict" % (name, value, seconds)
        return ("Set-Cookie", text + ("; Secure" if INTERNET_MODE else ""))

    def read_json(self):
        """Reads the request body. Returns None (after replying) if it is unusable."""
        # Changes must come from this site's own pages, not from another website.
        # Browsers will not let another site add the X-Darbyon header. As a second
        # check, modern browsers label where a request came from (Sec-Fetch-Site);
        # for older ones the Origin must be this site's own address.
        fetch_site = self.headers.get("Sec-Fetch-Site")
        origin = self.headers.get("Origin")
        if fetch_site:
            same_site = fetch_site == "same-origin"
        elif origin:
            same_site = urlsplit(origin).netloc in (self.headers.get("Host"), self.headers.get("X-Forwarded-Host"))
        else:
            same_site = True
        if self.headers.get("X-Darbyon") != "1" or not same_site:
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
        except OSError:                     # the sender stopped part way through
            self.close_connection = True
            return None
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
        elif path == "/robots.txt":
            self.send_body(HTTPStatus.OK, b"User-agent: *\nDisallow: /\n", "text/plain; charset=utf-8")
        elif path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
        else:
            self.get_file(path)

    do_HEAD = do_GET

    def do_POST(self):
        path = urlsplit(self.path).path
        routes = {"/api/login": self.post_login, "/api/logout": self.post_logout, "/api/save": self.post_save,
                  "/api/student-login": self.post_student_login, "/api/student-logout": self.post_student_logout,
                  "/api/power-request": self.post_power_request, "/api/power-request-cancel": self.post_request_cancel,
                  "/api/vote": self.post_vote, "/api/request-resolve": self.post_request_resolve}
        if path not in routes:
            self.close_connection = True
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return
        body = self.read_json()
        if body is not None:
            routes[path](body)

    def get_state(self):
        role = self.role()
        student = None if role == "teacher" else self.student()
        if role == "teacher":
            keys = DATA_KEYS | SERVER_KEYS
        elif student:
            role, keys = "student", PUBLIC_KEYS | {"poll"} | SERVER_KEYS
        elif role == "viewer" or not get_setting("class_code"):
            role, keys = "viewer", PUBLIC_KEYS       # no class code set: anyone may look
        else:
            role, keys = "locked", set()             # must type the class code first
        data, revs = load_state(keys)
        if role == "student":
            # A student sees only their own requests and vote, and the poll only while it is open.
            requests = [r for r in data.pop("powerRequests", []) if r.get("studentId") == student]
            poll = current_poll()
            vote = next((v.get("option") for v in data.pop("pollVotes", [])
                         if poll and v.get("pollId") == poll.get("id") and v.get("studentId") == student), None)
            data["poll"] = [poll] if poll and poll.get("open") else []
            data["me"] = {"id": student, "requests": requests[-5:], "vote": vote}
        self.send_json(HTTPStatus.OK, {"server": True, "role": role, "data": data, "revs": revs})

    def needs_student(self):
        """Replies and returns None unless a student is signed in; otherwise their character id."""
        student = self.student()
        if not student:
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Tap your name and your pictures to log in first."})
        return student

    def post_student_login(self, body):
        if get_setting("class_code") and self.role() not in ("viewer", "teacher"):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Type the class code first."})
            return
        character_id = str(body.get("id", ""))[:64]
        code = body.get("code")
        device = self.device()
        if too_many_failures(device) or too_many_failures("student:" + character_id):
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS,
                           {"error": "Too many wrong tries. Wait five minutes and try again."})
            return
        expected = picture_code_for(character_id)
        if not expected:
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "You do not have a picture password yet. Ask your teacher."})
            return
        guess = [to_int(i) for i in code] if isinstance(code, list) else []
        if not hmac.compare_digest(json.dumps(guess), json.dumps(expected)):
            record_failure(device)
            record_failure("student:" + character_id)
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Those are not your pictures. Try again."})
            return
        end_session(self.cookie_value(STUDENT_COOKIE))
        token, seconds = create_session("student", character_id)
        self.send_json(HTTPStatus.OK, {"ok": True}, [self.cookie(token, seconds, STUDENT_COOKIE)])

    def post_student_logout(self, body):
        end_session(self.cookie_value(STUDENT_COOKIE))
        self.send_json(HTTPStatus.OK, {"ok": True}, [self.cookie("", 0, STUDENT_COOKIE)])

    def post_power_request(self, body):
        student = self.needs_student()
        if not student:
            return
        characters, powers = class_snapshot()
        me = find_character(characters, student)
        power = next((p for p in powers_for(me, powers) if p["id"] == str(body.get("powerId", ""))), None)
        error = None
        target = None
        if not power:
            error = "You do not have that power."
        elif to_int(me.get("ap")) < power["apCost"]:
            error = "You need %d AP for %s. You have %d." % (power["apCost"], power["name"], to_int(me.get("ap")))
        elif power["type"] == "team":
            target = find_character(characters, str(body.get("targetId", "")))
            if not me.get("team"):
                error = "You are not in a team yet, so you cannot use a team power."
            elif not target or target is me or target.get("team") != me.get("team"):
                error = "Choose a teammate for this power."
        if not error and any(r.get("studentId") == student and r.get("status") == "pending"
                             for r in load_key("powerRequests", [])[0]):
            error = "You already have a power waiting for your teacher."
        if error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": error})
            return

        request = {"id": secrets.token_hex(6), "studentId": student, "studentName": str(me.get("name", "")),
                   "powerId": power["id"], "powerName": power["name"], "apCost": power["apCost"],
                   "targetId": str(target.get("id")) if target else "",
                   "targetName": str(target.get("name", "")) if target else "",
                   "status": "pending", "created": time.time(), "resolved": None, "note": ""}

        def add(requests):
            keep_after = time.time() - REQUESTS_KEPT_HOURS * 3600
            requests = [r for r in requests if r.get("status") == "pending" or (r.get("resolved") or 0) > keep_after]
            return (requests + [request])[-200:]
        update_server_key("powerRequests", add)
        self.send_json(HTTPStatus.OK, {"ok": True, "request": request})

    def post_request_cancel(self, body):
        student = self.needs_student()
        if not student:
            return

        def cancel(requests):
            return [r for r in requests if not (r.get("studentId") == student and r.get("status") == "pending")]
        update_server_key("powerRequests", cancel)
        self.send_json(HTTPStatus.OK, {"ok": True})

    def post_request_resolve(self, body):
        """The teacher has approved or declined a request (the power itself is applied by their page)."""
        if self.role() != "teacher":
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Log in as the teacher to do this."})
            return
        request_id = str(body.get("id", ""))
        status = "approved" if body.get("approved") is True else "declined"
        note = str(body.get("note", ""))[:200]
        found = []

        def resolve(requests):
            for r in requests:
                if r.get("id") == request_id and r.get("status") == "pending":
                    r.update(status=status, resolved=time.time(), note=note)
                    found.append(r)
            return requests
        update_server_key("powerRequests", resolve)
        if found:
            self.send_json(HTTPStatus.OK, {"ok": True})
        else:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "That request has already been answered."})

    def post_vote(self, body):
        student = self.needs_student()
        if not student:
            return
        poll = current_poll()
        option = body.get("option")
        if not poll or not poll.get("open") or body.get("pollId") != poll.get("id"):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "This poll has closed."})
            return
        if not isinstance(option, int) or isinstance(option, bool) or not 0 <= option < len(poll["options"]):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Choose one of the answers."})
            return

        def vote(votes):
            votes = [v for v in votes if v.get("pollId") == poll["id"] and v.get("studentId") != student]
            return votes + [{"pollId": poll["id"], "studentId": student, "option": option}]
        update_server_key("pollVotes", vote)
        self.send_json(HTTPStatus.OK, {"ok": True})

    def post_login(self, body):
        device = self.device()
        teacher_password = get_setting("teacher_password")
        class_code = get_setting("class_code")
        guess = str(body.get("password", ""))[:200]
        if not teacher_password:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE,
                           {"error": "No teacher password has been set on the server yet."})
            return
        if too_many_failures(device):
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS,
                           {"error": "Too many wrong tries. Wait five minutes and try again."})
            return
        if not _login_slots.acquire(blocking=False):
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "The site is busy. Try again in a moment."})
            return
        try:
            if site_is_under_guessing():
                time.sleep(BUSY_DELAY_SECONDS)
            if check_password(guess, teacher_password):
                role = "teacher"
            elif class_code and check_password(guess.strip().lower(), class_code):
                role = "viewer"
            else:
                role = None
        finally:
            _login_slots.release()
        if role is None:
            record_failure(device)
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "That is not right. Check it and try again."})
            return
        token, seconds = create_session(role)
        self.send_json(HTTPStatus.OK, {"ok": True, "role": role}, [self.cookie(token, seconds)])

    def post_logout(self, body):
        end_session(self.session_token())
        self.send_json(HTTPStatus.OK, {"ok": True}, [self.cookie("", 0)])

    def post_save(self, body):
        if self.role() != "teacher":
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
    print("Use one you do not use anywhere else. Three or four random words works well.")
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


def set_class_code():
    print("Choose the class code students type to see the class (at least %d characters)." % MIN_CLASS_CODE_LENGTH)
    print("Capital letters do not matter. Do not make it the same as the teacher password.")
    teacher_password = get_setting("teacher_password")
    while True:
        code = input("Class code: ").strip().lower()
        if len(code) < MIN_CLASS_CODE_LENGTH:
            print("Too short, try again.")
            continue
        if teacher_password and check_password(code, teacher_password):
            print("That is the teacher password. Choose something different.")
            continue
        break
    set_setting("class_code", hash_password(code))
    with _write_lock, connect() as db:      # students signed in with the old code must type the new one
        db.execute("DELETE FROM sessions WHERE role = 'viewer'")
    print("Class code saved.")


def main():
    global INTERNET_MODE
    parser = argparse.ArgumentParser(description="DårbCRÅFT class site server")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default=None, help="address to listen on (default: every address, or only this computer with --internet)")
    parser.add_argument("--internet", action="store_true",
                        help="run behind a tunnel: only the tunnel can connect, and a class code is required")
    parser.add_argument("--set-password", action="store_true", help="choose the teacher password and exit")
    parser.add_argument("--set-class-code", action="store_true", help="choose the class code and exit")
    parser.add_argument("--clear-class-code", action="store_true", help="remove the class code and exit")
    parser.add_argument("--has-password", action="store_true", help="exit with 0 if a teacher password is set")
    parser.add_argument("--has-class-code", action="store_true", help="exit with 0 if a class code is set")
    args = parser.parse_args()

    init_db()
    if args.has_password:
        sys.exit(0 if get_setting("teacher_password") else 1)
    if args.has_class_code:
        sys.exit(0 if get_setting("class_code") else 1)
    if args.set_password:
        set_password()
        return
    if args.set_class_code:
        set_class_code()
        return
    if args.clear_class_code:
        with _write_lock, connect() as db:
            db.execute("DELETE FROM settings WHERE name = 'class_code'")
        print("Class code removed. Anyone who can reach the site can now view the class.")
        return

    INTERNET_MODE = args.internet
    if INTERNET_MODE and not (get_setting("teacher_password") and get_setting("class_code")):
        print("--internet needs both a teacher password and a class code. Run:\n"
              "  python3 server/server.py --set-password\n"
              "  python3 server/server.py --set-class-code", flush=True)
        sys.exit(1)
    if not get_setting("teacher_password"):
        print("No teacher password set yet. Run:  python3 server/server.py --set-password", flush=True)

    host = args.host or ("127.0.0.1" if INTERNET_MODE else "0.0.0.0")
    threading.Thread(target=backup_forever, daemon=True).start()
    server = ThreadingHTTPServer((host, args.port), Handler)
    server.daemon_threads = True
    print("DårbCRÅFT is running on %s port %d%s. Data file: %s"
          % (host, args.port, " (internet mode)" if INTERNET_MODE else "", DB_PATH), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
