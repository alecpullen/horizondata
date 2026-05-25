# Development Environment Setup

This guide covers running the Horizon Data stack locally for development.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11 | Server runtime |
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

> **Using Docker instead?** See Option B below. The Docker stack serves the frontend over HTTPS at `https://localhost` — run `bash certs/generate-dev-cert.sh` once first, then trust the cert in your browser (see `HTTPS.md`).

---

## MSW (Mock API) vs Live API

The client includes a Mock Service Worker layer that intercepts API calls. The mock state is synchronized with the backend.

| Mode | When to use |
|------|-------------|
| **Live** (default) | Normal dev — Flask server must be running |
| **Mocked** | Frontend-only work when you don't need a real backend |

**To toggle mocking:**
Mock services are toggled globally in the **System Settings** panel under **Developer Mode** inside the Admin Dashboard.
1. Log in as an Administrator (`admin` credentials).
2. Navigate to **System Settings**.
3. Toggle the **Mock API Services** and/or **Mock Telescope Hardware** settings and click save.
4. The client will automatically sync the MSW settings on page reload.


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

Then configure stream URLs in the **admin UI → System Settings**.

If your frontend is the **Vite dev server** (`http://localhost:5173`), use the HTTP ports:
- **Primary WebRTC URL**: `http://localhost:8889/telescope-camera/whep`
- **Primary HLS URL**: `http://localhost:8888/telescope-camera/index.m3u8`
- **Site WebRTC URL**: `http://localhost:8889/allsky/whep`
- **Site HLS URL**: `http://localhost:8888/allsky/index.m3u8`

If your frontend is the **Docker stack** (`https://localhost`), use the HTTPS ports (browsers require a secure context for WebRTC when the page itself is HTTPS):
- **Primary WebRTC URL**: `https://localhost:18889/telescope-camera/whep`
- **Primary HLS URL**: `https://localhost:18888/telescope-camera/index.m3u8`
- **Site WebRTC URL**: `https://localhost:18889/allsky/whep`
- **Site HLS URL**: `https://localhost:18888/allsky/index.m3u8`

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

**Grafana:** `http://localhost:3000` (HTTP) or `https://localhost:3443` (HTTPS) — login `admin` / `admin`.

> **First-time HTTPS setup:** generate a dev cert with `bash certs/generate-dev-cert.sh` before starting the Docker stack. See `HTTPS.md` for cert trust instructions per OS.

### Option C — External streaming server

Deploy `streaming/` on a separate machine. Copy `.mp4` simulator files into `streaming/` on that server, update the volume paths in `streaming/docker-compose.yml` to `./example1-video.mp4`, then run `docker compose up -d`. Configure all four stream URLs in the admin UI with that server's IP.

---

## Port Reference

HTTP ports are always available. HTTPS ports are exposed by the Nginx proxy containers when running the Docker stacks (requires `certs/` — see `HTTPS.md`).

| HTTP Port | HTTPS Port | Service | Notes |
|-----------|------------|---------|-------|
| 8080 | **8443** | Flask API | HTTPS via Docker proxy |
| 5173 | **443** | Vite / Nginx frontend | HTTPS via Docker proxy |
| 8888 | **18888** | MediaMTX HLS | HTTPS required when frontend is HTTPS |
| 8889 | **18889** | MediaMTX WebRTC (WHEP) | HTTPS required when frontend is HTTPS |
| 3000 | **3443** | Grafana | HTTPS via Docker proxy |
| 8554 | — | MediaMTX RTSP | TCP only (headless frame grabs) |
| 8890 | — | MediaMTX SRT ingest | UDP only (FFmpeg → MediaMTX) |
| 1935 | — | MediaMTX RTMP | TCP only |

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
