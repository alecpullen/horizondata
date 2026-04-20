# Agent Memory & Quick Reference

## Repository Overview
Horizon Data - Remote Scientific Data Capture and Control (La Trobe University Capstone Project)
- **Architecture**: Full-stack (Flask backend + React/Vite frontend)
- **Primary Location**: Python/Flask server for telescope control, Node.js client for UI
- **Key Domain**: Astronomy/time services for Melbourne, Australia (critical for telescope operations)

## Critical Architecture

### Backend (Flask)
- **Entry Point**: `server/run.py` - Flask app with CORS configuration
- **App Structure**: `server/app/` with blueprints (weather, telescope, safety, docs, etc.)
- **Key Service**: `server/app/services/time_service.py` - Time calculations for Melbourne timezone
- **API Routes**: `/api/*` covers telescope, safety, visibility, captures, weather, observability
- **Telescope**: SRT-based streaming via mediamtx (SRT server on port 8890)
- **FFmpeg**: Multiple containers for telescope/allsky/telescope-view video streaming

### Frontend (React/Vite)
- **Location**: `client/`
- **Dev Server**: Port 5173 (Vite)
- **API URL**: `http://localhost:8080` (must match backend CORS origins)
- **Build**: `vite build` produces static files

### Time Service (Critical)
- **Location**: `server/app/services/time_service.py`
- **Purpose**: Melbourne timezone-aware astronomical calculations
- **Key Methods**: `get_melbourne_time()`, `is_daylight_saving_active()`, `calculate_sunrise_sunset()`, `get_viewing_window()`, `is_viewing_window_active()`
- **Dependencies**: `pytz`, `astropy`, `astral`, `opentelemetry`
- **Timezone**: `Australia/Melbourne` (handles DST transitions automatically)

## Essential Developer Commands

### Backend (Python)
```bash
# Run the Flask server
python server/run.py

# Run time service tests (requires dependencies)
pip install pytz astropy
python server/run_time_tests.py

# Or run specific test class
python -m pytest server/tests/test_time_service.py -v
```

### Frontend (Node.js)
```bash
# Install dependencies
cd client && npm install

# Development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

### Docker/Compose
```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up api  # or frontend, mediamtx, etc.
```

## Key Environment Variables

### Backend (.env or docker-compose)
- `FLASK_HOST`: 0.0.0.0 (docker) or 127.0.0.1 (local)
- `FLASK_DEBUG`: "false" (production) or "true" (dev)
- `PORT`: 8080
- `CORS_ORIGINS`: Comma-separated origins (default includes localhost:5173)
- Thingspeak API keys, telescope addresses

### Frontend (Vite)
- `VITE_API_URL`: Must point to backend (default: http://localhost:8080)

## Testing & Verification

### Test Prerequisites
- Install: `pip install pytz astropy` (required for time service tests)
- Tests located in: `server/tests/`
- Test runner: `python server/run_time_tests.py`

### Test Structure
- Unit tests for TimeService (astronomy, DST, sunrise/sunset)
- Integration tests for API endpoints
- Tests verify Melbourne timezone handling and astronomical calculations

## Common Issues & Solutions

### Time Service Dependencies Missing
**Error**: `ModuleNotFoundError` for pytz/astropy/astral
**Fix**: `pip install pytz astropy`

### Frontend API Connection Issues
**Error**: CORS errors or connection refused
**Check**: `VITE_API_URL` must match backend `CORS_ORIGINS`
**Verify**: Backend running on port 8080

### Telescope Stream Issues
**Check**: mediamtx container running, SRT stream accessible
**Verify**: `docker-compose up mediamtx` then check logs

## Important Patterns

### Melbourne Time Handling
- ALWAYS use `TimeService.get_melbourne_time()` for current time
- TimeService handles DST automatically via pytz
- All astronomical calculations use Melbourne timezone
- Test DST transitions (March/April for end, October/November for start)

### Viewing Window Logic
- Window = 1 hour after sunset to 1 hour before sunrise (next day)
- Spans midnight in winter months
- `is_viewing_window_active()` handles midnight spanning correctly

### Docker Networking
- Services communicate via `cse3cap-rsdcc` network
- Backend accessible at `http://api:8080` from other containers
- Frontend at `http://localhost:5173` on host

## Repository-Specific Conventions

### File Structure
```
├── client/              # React/Vite frontend
├── server/              # Flask backend
│   ├── app/             # Flask application
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # Business logic (time_service.py critical)
│   │   └── templates/   # Jinja templates (if any)
│   └── run.py           # Entry point
├── tests/               # Backend tests
└── README.md
```

### Development Workflow
1. Install dependencies (backend: pip, frontend: npm)
2. Start backend: `python server/run.py`
3. Start frontend: `cd client && npm run dev`
4. Run tests: `python server/run_time_tests.py`

## References
- Time Service: `server/app/services/time_service.py` (primary time calculations)
- API Routes: `server/app/routes/` (all endpoint handlers)
- Flask App: `server/app/__init__.py` (app factory pattern)
- Docker Config: `server/docker-compose.yml` (service definitions)