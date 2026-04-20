# BetterAuth Implementation Plan for Horizon Data

## Overview

This plan implements a **two-tier authentication system** where:
- **Teachers** use BetterAuth via Neon Auth with persistent email/password accounts
- **Students** use ephemeral session-based identifiers that don't persist after sessions end
- **All API calls** route through the Flask backend (no direct frontend-to-Neon-Auth communication)

## Architecture

```
┌─────────────┐      ┌──────────────────────────┐      ┌─────────────┐
│   React     │ ───▶ │      Flask API           │ ───▶ │   Neon      │
│  Frontend   │      │  ┌─────────────────────┐  │      │   Auth      │
│             │      │  │ Teacher Auth        │  │      │  (Teachers) │
│             │      │  │ - BetterAuth proxy  │  │      └─────────────┘
│             │      │  │ - Token validation  │  │           │
│             │      │  └─────────────────────┘  │           ▼
│             │      │  ┌─────────────────────┐  │      ┌─────────────┐
│             │      │  │ Student Sessions    │  │      │   Neon      │
│             │      │  │ - Ephemeral IDs     │  │      │   Postgres  │
│             │      │  │ - In-memory store   │  │      │   (DB)      │
│             │ ◀─── │  └─────────────────────┘  │ ◀─── │             │
└─────────────┘      └──────────────────────────┘      └─────────────┘
```

**Authentication Types:**

| Type | Users | Storage | Duration | Method |
|------|-------|---------|----------|--------|
| **Teacher** | Teachers only | Neon Auth (`neon_auth` schema) | Persistent | BetterAuth email/password |
| **Student** | Students only | Flask in-memory / Redis | Session only | Ephemeral UUID |

## Phase 1: Neon Auth Setup (Teachers Only)

1. **Provision Neon Auth** on your database branch
   - Creates `neon_auth` schema with tables: `users`, `sessions`, `accounts`, `verifications`

2. **Environment Variables** (add to `.env`):
   ```bash
   # Database
   DATABASE_URL=postgresql://...
   
   # Neon Auth (for Flask to proxy calls)
   NEON_AUTH_URL=https://auth-<project>.neon.app
   NEON_AUTH_API_KEY=na_xxxxxxxx
   
   # Flask
   FLASK_SECRET_KEY=<random-secret-for-student-sessions>
   ```

## Phase 2: Flask Backend - New Files

### 2.1 Services

| File | Purpose |
|------|---------|
| `server/app/services/neon_auth_client.py` | HTTP client for Neon Auth API |
| `server/app/services/student_session_manager.py` | Ephemeral student session management |
| `server/app/services/rate_limiter.py` | Rate limiting for student captures |

**`neon_auth_client.py`** - Wraps BetterAuth HTTP API:
- `sign_up(email, password, name, role="teacher")`
- `sign_in(email, password)`
- `get_session(token)`
- `sign_out(token)`
- `refresh_token(refresh_token)`

**`student_session_manager.py`** - In-memory ephemeral sessions:
- `create_session(display_name: str, observation_session_id: str) -> str` (returns UUID)
- `validate_session(session_id: str) -> dict | None`
- `end_session(session_id: str)` - Called when session ends (teacher ends it)
- `kick_student(session_id: str)` - Teacher kicks individual student
- `list_participants(observation_session_id: str)` - List active students in session
- **No auto-expiry** - sessions persist until explicitly ended

**`rate_limiter.py`** - Rate limiting for student captures:
- `check_capture_limit(session_id: str) -> bool`
- Limit: e.g., 5 captures per minute per student
- Uses in-memory store with sliding window

### 2.2 Middleware

| File | Purpose |
|------|---------|
| `server/app/middleware/auth.py` | Unified auth middleware |

**Decorator: `require_auth(roles=None)`**
- Accepts `Authorization: Bearer <token>` header for teachers
- Accepts `X-Session-ID: <session-id>` header for students
- Attaches `g.user` and `g.user_type` to Flask context
- Returns 401 for invalid auth, 403 for insufficient permissions

### 2.3 Routes

| File | Purpose |
|------|---------|
| `server/app/routes/auth.py` | Proxy routes for BetterAuth + student sessions |

**Endpoints:**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/teacher/signup` | POST | None | Teacher registration |
| `/api/auth/teacher/login` | POST | None | Teacher login |
| `/api/auth/teacher/logout` | POST | Teacher | Teacher logout |
| `/api/auth/teacher/me` | GET | Teacher | Get current teacher info |
| `/api/auth/teacher/refresh` | POST | Teacher | Refresh access token |
| `/api/auth/student/join` | POST | None | Create student session (returns session_id) |
| `/api/auth/student/leave` | POST | Student | Student leaves voluntarily |
| `/api/auth/student/me` | GET | Student | Get session info |
| `/api/auth/teacher/kick` | POST | Teacher | Teacher kicks a student by session_id |
| `/api/auth/teacher/participants` | GET | Teacher | List active students in session |

## Phase 3: Protected API Integration

Apply auth decorators to existing routes:

| Blueprint Route | Required Role | Notes |
|-----------------|---------------|-------|
| `POST /api/telescope/connect` | teacher | Only teachers control telescope |
| `POST /api/telescope/slew/*` | teacher | Only teachers slew |
| `POST /api/telescope/tracking` | teacher | Only teachers set tracking |
| `POST /api/telescope/park` | teacher | Only teachers park/unpark |
| `GET /api/telescope/status` | teacher/student | Both can view |
| `GET /api/telescope/visible-objects` | teacher/student | Both can view |
| `POST /api/captures` | teacher/student | Rate limited for students |
| `GET /api/captures` | teacher/student | Both can list |
| `GET /api/safety/*` | teacher/student | Both can view |
| `GET /weather/*` | teacher/student | Both can view |

**Capture Rate Limiting:**
```python
@require_auth(roles=['teacher', 'student'])
@rate_limit_captures(max_per_minute=5)  # Only applies to students
def upload_capture():
    # If student: check rate limit
    # If teacher: no limit
    pass
```

## Phase 4: Database Schema

### `neon_auth` schema (auto-created by Neon Auth)
- `users` - Teacher accounts
- `sessions` - Teacher sessions
- `accounts`, `verifications` - Auth metadata

### Application schema (`app`)

```sql
CREATE SCHEMA IF NOT EXISTS app;

-- Observation sessions (created by teachers)
CREATE TABLE app.observation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES neon_auth.users(id),
    session_code VARCHAR(10) UNIQUE NOT NULL, -- Short code for students to join
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active', -- active, ended, cancelled
    metadata JSONB
);

-- Capture metadata with student attribution
CREATE TABLE app.captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who captured (one will be null)
    captured_by_teacher_id UUID REFERENCES neon_auth.users(id),
    captured_by_student_session_id VARCHAR(255), -- ephemeral student session ID
    
    -- Which observation session
    observation_session_id UUID REFERENCES app.observation_sessions(id),
    
    -- Capture details
    file_path VARCHAR(500) NOT NULL,
    object_name VARCHAR(255),
    coordinates JSONB, -- {ra, dec, alt, az}
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    file_size_bytes INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    
    CONSTRAINT chk_captured_by CHECK (
        (captured_by_teacher_id IS NOT NULL AND captured_by_student_session_id IS NULL) OR
        (captured_by_teacher_id IS NULL AND captured_by_student_session_id IS NOT NULL)
    )
);

-- Index for efficient student capture lookups
CREATE INDEX idx_captures_student_session ON app.captures(captured_by_student_session_id) 
WHERE captured_by_student_session_id IS NOT NULL;
```

## Phase 5: Frontend Implementation

**New Files:**

| File | Purpose |
|------|---------|
| `client/src/lib/api.js` | Axios instance with auth headers |
| `client/src/contexts/AuthContext.jsx` | Auth state provider |
| `client/src/hooks/useAuth.js` | Unified auth hook |
| `client/src/pages/TeacherLogin.jsx` | Teacher login form |
| `client/src/pages/TeacherSignup.jsx` | Teacher signup form |
| `client/src/pages/StudentJoin.jsx` | Student join lobby form |
| `client/src/components/ParticipantList.jsx` | Show active students (teacher view) |

**Auth Context API:**
```javascript
{
  // State
  userType: null | 'teacher' | 'student',
  user: null | { id, email, name } | { id, display_name },
  token: null,        // for teachers
  sessionId: null,    // for students
  isAuthenticated: false,
  
  // Actions
  loginTeacher: (email, password) => Promise<void>,
  logoutTeacher: () => Promise<void>,
  signupTeacher: (email, password, name) => Promise<void>,
  joinAsStudent: (displayName, sessionCode) => Promise<void>,
  leaveAsStudent: () => Promise<void>,
  kickStudent: (sessionId) => Promise<void>,  // teacher only
  refreshToken: () => Promise<void>,
}
```

**API Interceptor:**
```javascript
axios.interceptors.request.use((config) => {
  const { token, sessionId, userType } = authContext;
  
  if (userType === 'teacher' && token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (userType === 'student' && sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  
  return config;
});
```

## Phase 6: Student Session Lifecycle

**Flow:**

1. **Teacher creates booking** → `POST /api/bookings` creates `observation_sessions` with unique `session_code`

2. **Student visits `/join`** → Enters:
   - Display name (e.g., "Student Alex")
   - Session code (e.g., "ABC123")

3. **Backend validates** → Checks:
   - Session code exists and is `active`
   - Session hasn't ended

4. **Student session created**:
   ```python
   session_id = student_session_manager.create_session(
       display_name="Student Alex",
       observation_session_id="<uuid>"
   )
   ```

5. **Student receives session_id** → Stored in React context, sent as `X-Session-ID` header

6. **Student accesses features**:
   - View telescope status
   - View visible objects
   - **Capture images** (rate limited: 5/minute)
   - Download their captures

7. **Teacher controls session**:
   - View participant list (`/api/auth/teacher/participants`)
   - Kick individual students (`/api/auth/teacher/kick`)
   - End entire session (marks `ended_at`, kicks all students)

8. **Session ends**:
   - All student sessions deleted from memory
   - Student captures remain in DB (with `captured_by_student_session_id` for attribution)
   - Students redirected to join page

## Phase 7: Testing Checklist

| Test Case | Expected |
|-----------|----------|
| Teacher signup | Creates user in `neon_auth.users`, returns token |
| Teacher login | Returns valid token, can access protected routes |
| Invalid login | Returns 401, clear error message |
| Token refresh | Works with refresh token |
| Teacher creates session | Returns unique session code |
| Student joins with valid code | Returns session_id, can view telescope |
| Student joins with invalid code | Returns 404 |
| Student capture rate limit | Returns 429 after 5 captures in 1 minute |
| Teacher kick student | Student receives 401 on next request |
| Teacher ends session | All students kicked, captures preserved |
| Teacher views captures | Can see which student captured each image |
| Student views own captures | Filtered list of their captures only |

## Design Decisions

1. **Student session expiry**: No auto-expiry, only deleted when session ends or teacher kicks student
2. **Rate limiting**: 5 captures per minute per student (configurable)
3. **Teacher can kick students**: Yes, via `/api/auth/teacher/kick` endpoint
4. **Analytics**: Only captures with student attribution, no other tracking
