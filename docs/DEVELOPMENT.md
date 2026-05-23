# Development Environment Setup

This guide covers running the Horizon Data stack locally for development.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.13+ | Server runtime |
| Node.js | 18+ | Client build |
| Docker + Compose | any recent | Video streams only (optional for most work) |

---

## One-Time Setup

### 1. Server (Flask)

```bash
cd server/
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Copy the environment file and fill in your credentials:

```bash
cp .env.example .env
# Edit .env — at minimum set DB_* and CORS_ORIGINS
```

### 2. Client (React + Vite)

```bash
cd client/
npm install
```

---

## Running the Dev Servers

Both servers must be running for the app to work. Open two terminals.

### Terminal 1 — Flask API (port 8080)

**Important:** always run Python through the venv. The system Python does not have the project packages.

```bash
cd server/

# bash/zsh
source .venv/bin/activate
python run.py

# fish
source .venv/bin/activate.fish
python run.py

# Or without activating (any shell)
.venv/bin/python run.py
```

The API is ready when you see:
```
* Serving Flask app 'app'
* Debug mode: on
```

### Terminal 2 — Vite client (port 5173)

```bash
cd client/
npm run dev
```

Open `http://localhost:5173`.

---

## MSW (Mock API) vs Live API

The client includes a Mock Service Worker layer that intercepts API calls. Whether it is active is controlled by a `localStorage` flag — it is **off by default**, meaning the client talks to the real Flask server at `http://localhost:8080`.

| Mode | When to use |
|------|-------------|
| **Live** (default) | Normal dev — Flask server must be running |
| **Mocked** | Frontend-only work when you don't need a real backend |

**To toggle in the browser:**

```js
// In DevTools console — enable mocks
localStorage.setItem('msw-enabled', 'true')
location.reload()

// Disable mocks (default)
localStorage.setItem('msw-enabled', 'false')
location.reload()
```

Mock credentials when MSW is enabled:

| Role | Email | Password |
|------|-------|----------|
| Teacher | `teacher@latrobe.edu.au` | `password123` |
| Student | `student@latrobe.edu.au` | `password123` |

---

## Full Functionality — Video Streams (Docker)

The streaming stack (MediaMTX relay + FFmpeg simulators) is a separate Docker Compose project in `streaming/`. It runs independently of the Flask API and frontend.

### Option A — Streaming only (typical for dev)

```bash
cd streaming/
docker compose up
```

Then configure stream URLs in the **admin UI → System Settings**:
- **Primary WebRTC URL**: `http://localhost:8889/telescope-camera/whep`
- **Primary HLS URL**: `http://localhost:8888/telescope-camera/index.m3u8`
- **Site WebRTC URL**: `http://localhost:8889/allsky/whep`
- **Site HLS URL**: `http://localhost:8888/allsky/index.m3u8`

Add to `server/.env` for headless frame grabs:
```
MEDIAMTX_RTSP_URL=rtsp://localhost:8554/telescope-camera
```

### Option B — Full containerised stack

Run both Docker Compose projects:
```bash
cd streaming/ && docker compose up -d
cd server/ && docker compose up --build
```

When the API runs inside Docker, use `host.docker.internal`:
```
MEDIAMTX_RTSP_URL=rtsp://host.docker.internal:8554/telescope-camera
```

**Grafana:** `http://localhost:3000` — login `admin` / `admin`.

### Option C — External streaming server

Deploy `streaming/` on a separate machine. Copy `.mp4` simulator files into `streaming/` on that server, update the volume paths in `streaming/docker-compose.yml` to `./example1-video.mp4`, then run `docker compose up -d`. Configure all four stream URLs in the admin UI with that server's IP.

---

## Port Reference

| Port | Service | Protocol |
|------|---------|----------|
| 8080 | Flask API | HTTP |
| 5173 | Vite / Nginx frontend | HTTP |
| 8554 | MediaMTX RTSP | TCP |
| 8888 | MediaMTX HLS | HTTP |
| 8889 | MediaMTX WebRTC (WHEP) | HTTP / UDP |
| 8890 | MediaMTX SRT ingest | UDP |
| 1935 | MediaMTX RTMP | TCP |
| 3000 | Grafana | HTTP |

---

## Environment Variables

All variables are loaded from `server/.env`. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` | Flask port |
| `FLASK_DEBUG` | `True` | Hot-reload |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `DB_HOST` | — | Neon PostgreSQL host |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `ALPACA_BASE` | — | ASCOM Alpaca telescope endpoint |
| `THINGSPEAK_CHANNEL_ID` | `270748` | ThingSpeak weather channel |
| `CAPTURES_DIR` | `./captures` | Where snapshot images are written |

---

## Common Issues

**`ModuleNotFoundError: No module named 'dotenv'`**
The venv is not active. Use `.venv/bin/python run.py` instead of `python run.py`.

**`Port 8080 is in use`**
Another Flask process is still running. Find and kill it:
```bash
# Linux / macOS
lsof -ti :8080 | xargs kill
```

**`Port 5173 is in use` — Vite picks a higher port**
A previous Vite process is still running. Kill it the same way (`lsof -ti :5173 | xargs kill`) or just use the port Vite chose — it prints the actual URL on startup.

**Video streams not loading**
The streaming stack is not running. Start it with `docker compose up` from `streaming/`. Then set the stream URLs in the admin UI (see "Full Functionality — Video Streams" above).

**CORS errors in the browser**
The client origin is not in `CORS_ORIGINS` in `server/.env`. Add it (e.g. `http://localhost:5174`) and restart Flask.
