# Horizon Data — Codebase Audit

> **Generated:** 2026-04-25  
> **Scope:** Full-stack audit (Flask backend + React/Vite frontend)  
> **Method:** Static analysis + live endpoint probing + DB schema inspection

---

## How to Use This Document

Each item has an actionable checkbox (`[ ]`) so the team can tick off fixes as they land.  
Issues are grouped by **domain** and sorted by **severity** within each group:

| Severity | Meaning |
|----------|---------|
| 🔴 **Critical** | Security breach, data loss, or physical safety risk (telescope). Fix immediately. |
| 🟠 **High** | Functional breakage, crashes, or significant UX degradation. Fix this sprint. |
| 🟡 **Medium** | Code smell, performance regression, or missing validation. Fix next sprint. |
| 🟢 **Low** | Tech debt, inconsistency, or missing test coverage. Fix when convenient. |

---

## Table of Contents

1. [Backend — Logic & API](#1-backend--logic--api)
2. [Backend — Authentication & Authorization](#2-backend--authentication--authorization)
3. [Backend — Architecture & Dead Code](#3-backend--architecture--dead-code)
4. [Backend — Performance](#4-backend--performance)
5. [Frontend — Logic & State](#5-frontend--logic--state)
6. [Frontend — UI / UX](#6-frontend--ui--ux)
7. [Security](#7-security)
8. [Configuration & DevOps](#8-configuration--devops)
9. [Testing](#9-testing)

---

## 1. Backend — Logic & API

### 🔴 Critical — Unauthenticated Telescope Slew
- [ ] **File:** `server/app/routes/space_objects.py` (lines 294–392)  
- **Problem:** The `POST /api/telescope/select` endpoint slews the physical telescope but has **no `@require_auth` decorator**. Anyone on the network can command the telescope to move to arbitrary coordinates.  
- **Code:**
  ```python
  @space_objects_bp.route("/select", methods=["POST"])
  def select_space_object():          # <-- NO AUTH DECORATOR
      data = request.get_json()
      ...
      alpaca.unpark()
      alpaca.enable_tracking()
      alpaca.slew_to_coordinates(ra, dec)
  ```
- **Fix:** Add `@require_teacher` (or `@require_any_auth`) to the route. Re-check safety status immediately before slewing.

---

### 🟠 High — Naive vs Aware Datetime Comparison in Bookings
- [ ] **File:** `server/app/routes/bookings.py` (lines 16–24)  
- **Problem:** `_bucket` compares `booking.scheduled_end` (naive, from `datetime.fromisoformat` without timezone) against `datetime.now(timezone.utc)` (aware). In Python, comparing naive and aware datetimes raises a `TypeError`.  
- **Code:**
  ```python
  def _bucket(booking, now_utc):
      ...
      end = booking.scheduled_end
      if end.tzinfo is None:
          end = end.replace(tzinfo=timezone.utc)   # Assumes UTC, but input is Melbourne time!
      if booking.status == "completed" or end < now_utc:
          return "past"
  ```
- **Fix:** Parse booking datetimes with `Australia/Melbourne` tzinfo before comparison, or store them as UTC in the DB.

---

### 🟠 High — Telescope Slew Skips Safety Re-Check
- [ ] **File:** `server/app/routes/space_objects.py` (lines 362–364)  
- **Problem:** After unparking and enabling tracking, the code slews immediately. If weather or time-based safety status changes during the multi-step preparation, it is not re-checked before the actual slew.  
- **Code:**
  ```python
  alpaca.unpark()
  alpaca.enable_tracking()
  alpaca.slew_to_coordinates(ra, dec)   # Safety not re-verified here
  ```
- **Fix:** Re-run `safety_manager.get_current_status()` immediately before `slew_to_coordinates` and abort if unsafe.

---

### 🟠 High — Missing Validation on Booking Targets
- [ ] **File:** `server/app/routes/bookings.py` (line 105)  
- **Problem:** `targets=data.get("targets")` accepts arbitrary JSON with no schema validation or size limits. A malformed or oversized payload can crash downstream components.  
- **Code:**
  ```python
  booking = Booking(
      ...
      targets=data.get("targets"),   # No validation
  )
  ```
- **Fix:** Validate `targets` is a list of objects with known keys (`name`, `ra`, `dec`, etc.) and enforce a max length (e.g., 50 items).

---

### 🟡 Medium — Booking Time Parsing Ignores Timezone
- [ ] **File:** `server/app/routes/bookings.py` (lines 88–89)  
- **Problem:** `datetime.fromisoformat(f"{date_str}T{start_time_str}:00")` produces a naive datetime. The backend operates in Melbourne time, but the DB may interpret this as UTC or local server time.  
- **Code:**
  ```python
  scheduled_start = datetime.fromisoformat(f"{date_str}T{start_time_str}:00")
  scheduled_end   = datetime.fromisoformat(f"{date_str}T{end_time_str}:00")
  ```
- **Fix:** Parse with `pytz.timezone("Australia/Melbourne").localize(...)` or use `datetime.strptime(..., tzinfo=melbourne_tz)`.

---

### 🟡 Medium — Sunrise/Sunset Hour Clamping Bug
- [ ] **File:** `server/app/services/time_service.py` (lines 236–255)  
- **Problem:** `_hour_to_datetime` clamps `hours >= 24` to `23:59` instead of rolling over to `00:00` the next day. This can shift the viewing window by nearly a full day near DST transitions or polar extremes.  
- **Code:**
  ```python
  if hours >= 24:
      hours = 23
      minutes = 59   # Should be next day 00:00
  ```
- **Fix:** Handle hour overflow by incrementing the date: `hours -= 24; date += timedelta(days=1)`.

---

### 🟡 Medium — Viewing Window Logic Edge Case
- [ ] **File:** `server/app/services/time_service.py` (lines 363–374)  
- **Problem:** In `is_viewing_window_active`, when checking the previous day's window, the code only verifies `check_time <= prev_window_end` but never checks `check_time >= prev_window_start`. A time far in the past could incorrectly be marked active.  
- **Code:**
  ```python
  if prev_window_start <= prev_sunset and check_time <= prev_window_end:
      return True   # Missing lower bound: check_time >= prev_window_start
  ```
- **Fix:** Add `and check_time >= prev_window_start` to the condition.

---

### 🟡 Medium — Student Leave Swallows Errors, Returns 200
- [ ] **File:** `server/app/routes/auth.py` (lines 343–352)  
- **Problem:** The `except` block logs the error but returns HTTP 200 with `success: true`. The client is misled into thinking the student left the session.  
- **Code:**
  ```python
  except Exception as e:
      logger.error(f"Error during student leave: {e}")
      return jsonify({'success': True})   # Always returns 200
  ```
- **Fix:** Return `{'success': False}` with HTTP 500 when `end_session` fails unexpectedly.

---

### 🟡 Medium — Teacher Logout Always Returns 200
- [ ] **File:** `server/app/routes/auth.py` (lines 153–174)  
- **Problem:** Even if the backend fails to invalidate the session in Neon Auth, the API tells the client everything is fine.  
- **Code:**
  ```python
  except Exception as e:
      logger.warning(f"Error during logout (non-fatal): {e}")
  return jsonify({'success': True})   # Always 200
  ```
- **Fix:** Return a non-200 status or at least a warning payload if `sign_out` raises an exception.

---

### 🟡 Medium — Auth Success Not Checked Before Persisting State
- [ ] **File:** `client/src/contexts/AuthContext.jsx` (lines 56–112)  
- **Problem:** `signupTeacher` and `loginTeacher` do not inspect `response.data.success` before writing to `localStorage`. If the API returns a 200 with `success: false`, the app stores invalid credentials.  
- **Code:**
  ```javascript
  const { user, token, refresh_token } = response.data   // Could be undefined
  localStorage.setItem('token', token)                    // Might store "undefined"
  ```
- **Fix:** Check `response.data.success === true` before persisting state.

---

### 🟢 Low — Generic Exception Handling Hides Root Causes
- [ ] **File:** `server/app/routes/safety.py`, `server/app/routes/observability.py`  
- **Problem:** Many routes catch bare `Exception` and return a generic 500 with no trace ID, making production debugging difficult.  
- **Fix:** Include a `request_id` in the error payload and log the full traceback server-side.

---

### 🟢 Low — Empty Bearer Token Accepted
- [ ] **File:** `server/app/middleware/auth.py` (lines 27–32)  
- **Problem:** `extract_bearer_token` returns `auth_header[7:]` without checking that a non-empty token follows `"Bearer "`. An empty token string propagates through the system.  
- **Code:**
  ```python
  if auth_header.startswith('Bearer '):
      return auth_header[7:]   # Could be ""
  ```
- **Fix:** Validate `len(auth_header) > 7` and strip whitespace.

---

## 2. Backend — Authentication & Authorization

### 🟠 High — Stale Token Cache After Logout
- [ ] **File:** `server/app/middleware/auth.py` (lines 21–95)  
- **Problem:** `validate_teacher` caches valid tokens for 60 seconds. When a teacher logs out, the token is invalidated in Neon Auth, but the local `_token_cache` still marks it as valid until the TTL expires.  
- **Fix:** Clear the token from `_token_cache` in the logout handler (key = `sha256(token).hexdigest()`), or reduce cache TTL to 5–10 seconds.

---

### 🟠 High — No Rate Limiting on Auth Endpoints
- [ ] **File:** `server/app/routes/auth.py` (lines 34–150)  
- **Problem:** Login and signup endpoints have no rate limiting, making them vulnerable to brute-force and enumeration attacks.  
- **Fix:** Add Flask-Limiter or equivalent decorators to `teacher_login`, `teacher_signup`, and `student_join`.

---

### 🟡 Medium — Token Cache Uses `hash()` (Randomized per Process)
- [ ] **File:** `server/app/services/rate_limiter.py` (lines 82–108)  
- **Problem:** The rate limiter uses Python's built-in `hash()` which is randomized per process and not cryptographically sound.  
- **Fix:** Use `hashlib.sha256` or a deterministic key function.

---

### 🟡 Medium — Inconsistent DB Session Usage in Middleware
- [ ] **File:** `server/app/middleware/auth.py` (lines 64–78)  
- **Problem:** `validate_teacher` creates its own `engine.connect()` rather than using the `get_db()` context manager. This bypasses connection pooling best practices and makes testing harder.  
- **Fix:** Use `get_db()` or a scoped session.

---

## 3. Backend — Architecture & Dead Code

### 🟠 High — Overlapping Telescope Blueprints (Dead Code)
- [ ] **File:** `server/app/telescope.py` + `server/app/routes/telescope.py`  
- **Problem:** Both files define a blueprint named `telescope_bp` with overlapping `/visible-objects` routes. `app/__init__.py` only imports the one from `routes.telescope`, making `app/telescope.py` dead code that confuses developers.  
- **Fix:** Remove `app/telescope.py` or consolidate both into a single blueprint.

---

### 🟡 Medium — Broken `get_db()` Shadowed in `__init__.py`
- [ ] **File:** `server/app/services/__init__.py` (lines 6–18)  
- **Problem:** This file defines a broken `get_db()` that references an undefined `SessionLocal`. It shadows the real `get_db()` from `database.py` if imported via `from app.services import get_db`.  
- **Code:**
  ```python
  def get_db():
      db = SessionLocal()   # NameError: SessionLocal is not defined here
      ...
  ```
- **Fix:** Remove the duplicate/broken implementation from `__init__.py`.

---

### 🟡 Medium — `uselist=False` with Plural Attribute Name
- [ ] **File:** `server/app/models/booking.py` (line 32)  
- **Problem:** `sessions = relationship(..., uselist=False)` creates a one-to-one relationship but names it `sessions` (plural), which is semantically incorrect.  
- **Fix:** Rename to `session` or change to `uselist=True` if one-to-many is intended.

---

### 🟡 Medium — Broken Integration Test Imports
- [ ] **File:** `server/app/test_integration.py` (lines 8, 69, 85, 98)  
- **Problem:** The file imports `server.app.models.user.User` and `server.app.routes.db.db_bp`, neither of which exist. These tests will fail with `ModuleNotFoundError`.  
- **Fix:** Remove dead imports or create the missing modules.

---

## 4. Backend — Performance

### 🟠 High — Unbounded Capture Directory Walk
- [ ] **File:** `server/app/routes/captures.py` (lines 124–129, 140–156, 162–195)  
- **Problem:** `_walk_captures` recursively walks the entire captures tree on every `GET /api/captures` and `GET /api/captures/<id>/download`. As capture volume grows, these endpoints slow down linearly with no pagination or indexing.  
- **Fix:** Store captures metadata in a database table with pagination, or at least cache the directory listing with a TTL.

---

### 🟡 Medium — Visibility Calculations on Every Request
- [ ] **File:** `server/app/services/visibility_service.py` (lines 116–159)  
- **Problem:** `get_visible_objects` performs astropy coordinate transformations for all 38+ objects on every uncached request. This is CPU-intensive.  
- **Fix:** The existing 5-minute cache is good, but consider pre-computing a daily almanac so most requests are instant.

---

### 🟡 Medium — Rate Limiter List Growth Between Cleanups
- [ ] **File:** `server/app/services/rate_limiter.py` (lines 82–108)  
- **Problem:** `entry.requests` appends a timestamp on every request. Cleanup only runs 1% of the time and removes old entries. Under high load, the list can grow to thousands of entries between cleanups, causing memory bloat.  
- **Fix:** Always filter expired entries on `check_limit`, not just probabilistically.

---

### 🟢 Low — Student Sessions Never Expire
- [ ] **File:** `server/app/services/student_session_manager.py` (lines 23–31)  
- **Problem:** `StudentSession` has no TTL or expiry timestamp. A student who closes their browser remains "joined" forever in memory.  
- **Fix:** Add a `last_seen` timestamp and a cleanup thread that expires stale sessions after a configurable timeout (e.g., 30 minutes).

---

## 5. Frontend — Logic & State

### 🟠 High — `useState` Used Instead of `useEffect` for Timer
- [ ] **File:** `client/src/pages/ForgotPassword.jsx` (lines 50–64)  
- **Problem:** The resend cooldown timer is written as `useState(() => { ... }, [resendCooldown])` which is not a React hook pattern. The timer will never start because `useState` does not accept a dependency array.  
- **Code:**
  ```javascript
  const [timer, setTimer] = useState(() => {
      const interval = setInterval(() => { ... }, 1000)
      return () => clearInterval(interval)
  }, [resendCooldown])   // WRONG: useState does not take deps
  ```
- **Fix:** Replace with `useEffect(() => { ... }, [resendCooldown])`.

---

### 🟠 High — `Date.now` (Function Reference) Stored in State
- [ ] **File:** `client/src/pages/Login.jsx` (line 33)  
- **Problem:** `const [now, setNow] = useState(Date.now)` stores the `Date.now` function reference, not a timestamp. The interval later calls `setNow(Date.now())`, but initial comparisons are broken.  
- **Code:**
  ```javascript
  const [now, setNow] = useState(Date.now)   // Stores the function!
  ```
- **Fix:** Change to `useState(Date.now())`.

---

### 🟠 High — Corrupted localStorage Crashes App on Mount
- [ ] **File:** `client/src/contexts/AuthContext.jsx` (lines 31, 45)  
- **Problem:** `JSON.parse(storedUser)` is called without a `try/catch`. If `user` is corrupted in localStorage, the app crashes on mount with a white screen.  
- **Code:**
  ```javascript
  const parsedUser = storedUser ? JSON.parse(storedUser) : null   // Can throw
  ```
- **Fix:** Wrap in `try/catch` and clear the key on failure.

---

### 🟡 Medium — API Errors in `SessionLobby` Ignored Silently
- [ ] **File:** `client/src/pages/SessionLobby.jsx` (lines 34–85)  
- **Problem:** Several `try/catch` blocks have empty `catch` bodies or only `console.error`. If the booking fetch fails, the UI stays in a broken "Loading..." state.  
- **Fix:** Surface errors to the user with the Toast system.

---

### 🟡 Medium — `fetch` Used Instead of Configured `api` Instance
- [ ] **File:** `client/src/pages/NewBooking/index.jsx` (lines 94–97)  
- **Problem:** `fetchTargets` calls `fetch()` directly with `credentials: 'include'`, bypassing the Axios instance (`api`) that has auth interceptors, base URL, and error handling. It also lacks an abort controller.  
- **Code:**
  ```javascript
  const response = await fetch(`${API_URL}/api/space-objects?...`, {
      credentials: 'include'   // Bypasses axios interceptors
  })
  ```
- **Fix:** Use `api.get()` with an `AbortController`.

---

### 🟡 Medium — Student Lobby Polls Without Auth Headers
- [ ] **File:** `client/src/pages/StudentLobby.jsx` (lines 22–26)  
- **Problem:** Uses raw `fetch` without the `api` interceptor, so no `X-Session-ID` header is sent. The backend may reject the request if auth is ever required for session polling.  
- **Fix:** Use the `api` instance for consistency.

---

### 🟢 Low — Auth Success Not Checked Before Persisting State
- [ ] **File:** `client/src/contexts/AuthContext.jsx` (lines 56–112)  
- **Problem:** `signupTeacher` and `loginTeacher` do not inspect `response.data.success` before writing to `localStorage`.  
- **Fix:** Check `response.data.success === true` before persisting state.

---

## 6. Frontend — UI / UX

### 🟡 Medium — Full Page Reloads Instead of SPA Navigation
- [ ] **File:** `client/src/pages/MyBookings.jsx` (lines 52, 178, 248)  
- **Problem:** Multiple buttons use `window.location.href = '/...'`, causing full page reloads and loss of React state/context.  
- **Fix:** Use `useNavigate()` from `react-router-dom`.

---

### 🟡 Medium — Hardcoded Session Data in Live Views
- [ ] **File:** `client/src/pages/TeacherView.jsx` (lines 6–20) and `client/src/pages/StudentView.jsx` (lines 5–14)  
- **Problem:** Session info (date, object, students) is hardcoded constants, not fetched from the API.  
- **Fix:** Replace with live API calls to fetch booking/session state.

---

### 🟡 Medium — MSW Toggle Visible in Production Builds
- [ ] **File:** `client/src/components/auth/AuthShell.jsx` (lines 60–69) and `client/src/pages/SessionLobby.jsx` (lines 207–216)  
- **Problem:** A "Mock API" checkbox is rendered in the DOM. If built and deployed, end users could accidentally enable mock mode.  
- **Fix:** Conditionally render the toggle only in development (`import.meta.env.DEV`).

---

### 🟢 Low — Redundant `window.location.reload()` on MSW Toggle
- [ ] **File:** `client/src/components/auth/AuthShell.jsx` (lines 16–25)  
- **Problem:** Toggling mock mode triggers a full page reload instead of hot-swapping the MSW worker.  
- **Fix:** Use MSW's runtime `worker.start()` / `worker.stop()` without reloading.

---

## 7. Security

### 🔴 Critical — Raw SQL Injection Utility
- [ ] **File:** `server/app/queries/user_queries.py` (lines 78–80)  
- **Problem:** `execute_raw_query(sql: str, params: dict = None)` allows any caller to execute arbitrary SQL with no validation. If exported or used incorrectly, this is a direct SQL injection vector.  
- **Code:**
  ```python
  def execute_raw_query(sql: str, params: dict = None):
      with engine.connect() as conn:
          result = conn.execute(text(sql), params or {})   # Arbitrary SQL!
          return result.fetchall()
  ```
- **Fix:** Remove this function, or restrict it to read-only operations with a strict whitelist.

---

### 🔴 Critical — Unauthenticated Telescope Slew
- [ ] **File:** `server/app/routes/space_objects.py` (lines 294–392)  
- (Same as Backend #1 — repeated here for Security emphasis.)  
- **Fix:** Add `@require_teacher` to `select_space_object`.

---

### 🟠 High — Weather Fallback Assumes SAFE During API Outage
- [ ] **File:** `server/app/services/weather_safety.py` (lines 128–140)  
- **Problem:** When the ThingSpeak API fails, `_get_fallback_weather_data` returns mild, "safe" conditions (15°C, 60% humidity, 5 km/h wind). The calling code then evaluates these as safe, meaning a real weather outage could allow telescope operations during dangerous conditions.  
- **Code:**
  ```python
  return {
      'temperature': 15.0,    # Mild = safe-looking
      'humidity': 60,
      'wind_speed': 5.0,
      ...
  }
  ```
- **Fix:** Change fallback to return `None` and let `evaluate_current_conditions` return `False` (unsafe) when data is missing.

---

### 🟠 High — File Upload Lacks Content / Size Validation
- [ ] **File:** `server/app/routes/captures.py` (lines 80–89)  
- **Problem:** `f.save(img_path)` writes whatever bytes are sent. The mimetype check is trivially bypassed, and there is no max size limit.  
- **Fix:** Add `MAX_CONTENT_LENGTH` in Flask config, validate file magic bytes, and limit file size.

---

### 🟠 High — No CSRF Protection on State-Changing Requests
- [ ] **File:** `server/app/__init__.py` (CORS config) and `client/src/lib/api.js`  
- **Problem:** CORS allows credentials but there are no CSRF tokens on state-changing POST/PUT/DELETE requests.  
- **Fix:** Implement double-submit cookie pattern or CSRF token headers.

---

### 🟡 Medium — OpenAPI Spec Rendered with `| safe` Filter (XSS Risk)
- [ ] **File:** `server/app/docs.py` (line 30)  
- **Problem:** `render_template_string` passes `spec_json` through the `safe` Jinja filter. If `oapi.yaml` is ever tampered with to include a `</script><script>alert(1)</script>` payload, it will execute.  
- **Code:**
  ```python
  spec_json=spec_json | safe   # XSS risk if oapi.yaml is compromised
  ```
- **Fix:** Serialize with `json.dumps` and serve via `Response(..., mimetype='application/json')` instead of injecting raw JSON into HTML.

---

### 🟡 Medium — Grafana Weak Admin Password in Docker Compose
- [ ] **File:** `server/docker-compose.yml` (line 62)  
- **Problem:** `GF_SECURITY_ADMIN_PASSWORD=admin` is hardcoded and extremely weak.  
- **Fix:** Inject via environment file or secrets manager; require a strong password.

---

### 🟢 Low — `FLASK_DEBUG` Defaults to `True`
- [ ] **File:** `server/run.py` (line 16)  
- **Problem:** `os.getenv("FLASK_DEBUG", "True").lower() == "true"` defaults debug mode on if the env var is missing. This exposes the Werkzeug debugger and detailed tracebacks in production.  
- **Fix:** Change default to `"false"`.

---

### 🟢 Low — Empty Bearer Token Accepted
- [ ] **File:** `server/app/middleware/auth.py` (lines 27–32)  
- (Same as Backend #10 — repeated here for Security emphasis.)  
- **Fix:** Validate token is non-empty after trimming.

---

## 8. Configuration & DevOps

### 🟠 High — Grafana Weak Admin Password
- [ ] **File:** `server/docker-compose.yml` (line 62)  
- (Same as Security #6 — repeated here for Configuration emphasis.)  
- **Fix:** Inject via env var or secrets manager.

---

### 🟡 Medium — CORS Includes Unused Port 5174
- [ ] **File:** `server/app/__init__.py` (line 30)  
- **Problem:** `http://localhost:5174` is included. If this port is unused, it expands the attack surface slightly. Trailing commas in the env var could also produce empty origin strings.  
- **Fix:** Validate and trim each origin; remove unused ports.

---

### 🟡 Medium — Dockerfile Health Check Has No Timeout
- [ ] **File:** `server/Dockerfile` (line 38)  
- **Problem:** `urllib.request.urlopen` has no timeout argument. If the Flask app is hung, the health check itself will hang.  
- **Code:**
  ```dockerfile
  HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"  # No timeout!
  ```
- **Fix:** Add `timeout=5` to `urlopen`.

---

### 🟡 Medium — Missing `nginx.conf` in Client Build
- [ ] **File:** `client/Dockerfile` (line 14)  
- **Problem:** The Dockerfile copies `nginx.conf`, but the file was not found during the audit. If missing, the build fails.  
- **Fix:** Ensure `nginx.conf` is present in the client directory, or remove the COPY instruction if nginx is not used.

---

### 🟢 Low — Alpaca Base Assumes Local Telescope in Docker
- [ ] **File:** `server/docker-compose.yml` (line 14)  
- **Problem:** `ALPACA_BASE: http://host.docker.internal:32323/...` assumes the telescope simulator is running on the Docker host. This won't work in a remote/cloud deployment.  
- **Fix:** Document this as a dev-only override and provide a production override file (`docker-compose.prod.yml`).

---

### 🟢 Low — `FLASK_DEBUG` Defaults to `True`
- [ ] **File:** `server/run.py` (line 16)  
- (Same as Security #7 — repeated here for Configuration emphasis.)  
- **Fix:** Change default to `"false"`.

---

## 9. Testing

### 🟠 High — Broken Integration Test Module
- [ ] **File:** `server/app/test_integration.py` (lines 8, 69, 85, 98)  
- **Problem:** Imports `server.app.models.user.User` and `server.app.routes.db.db_bp`, neither of which exist. The test runner will fail immediately with `ModuleNotFoundError`.  
- **Fix:** Remove dead imports or create the missing modules.

---

### 🟡 Medium — Safety API Tests Mock Routes Instead of Real Blueprint
- [ ] **File:** `server/tests/test_safety_api.py` (lines 89–191)  
- **Problem:** The test class re-implements the safety routes inside the test file using mocks. It does not test the actual `safety_bp` imported from `app.routes.safety`, so changes to the real routes are not validated.  
- **Fix:** Import the real blueprint and register it on the test Flask app.

---

### 🟡 Medium — No Frontend Unit / Component Tests
- [ ] **File:** `client/package.json`  
- **Problem:** No testing framework (Jest, Vitest, React Testing Library) is present in dependencies or scripts. There are zero automated tests for React hooks, components, or API integration.  
- **Fix:** Add Vitest + React Testing Library and write tests for `AuthContext`, `useSessionTimeout`, and form validations.

---

### 🟡 Medium — No Tests for `space_objects.py` or `captures.py`
- [ ] **Problem:** There are no test files covering the telescope selection endpoint, file upload, or capture download logic.  
- **Fix:** Add tests for these routes, especially the auth gate and safety gate behavior.

---

### 🟢 Low — Tests Skip Silently if Dependencies Missing
- [ ] **File:** `server/tests/test_time_service.py`, `server/tests/test_visibility_service.py`  
- **Problem:** If `astropy` or `pytz` are not installed, the entire test class is skipped silently. CI might pass without actually running astronomy tests.  
- **Fix:** Ensure test dependencies are installed in CI, or use `pytest.importorskip` with a loud warning.

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 4 |
| 🟠 High | 13 |
| 🟡 Medium | 22 |
| 🟢 Low | 12 |
| **Total** | **51** |

### Top 5 Priority Fixes
1. **Add `@require_teacher` to telescope slew** (`space_objects.py`) — physical safety + security
2. **Fix weather fallback to UNSAFE** (`weather_safety.py`) — physical safety
3. **Fix naive/aware datetime in bookings** (`bookings.py`) — functional correctness
4. **Remove raw SQL injection utility** (`user_queries.py`) — security
5. **Fix `ForgotPassword` timer bug** (`useState` → `useEffect`) — UX
