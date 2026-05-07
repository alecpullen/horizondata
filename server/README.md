# Horizon Data Backend Server

Python Flask API server for managing telescope sessions, weather data, and student connections.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_HOST` | Host to bind the server | `127.0.0.1` |
| `PORT` | Port to listen on | `8080` |
| `FLASK_DEBUG` | Enable debug mode | `True` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://127.0.0.1:5173,...` |

## Quick Start

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the server**:
   ```bash
   python run.py
   ```

## Using with Vercel Frontend

When the frontend is deployed on Vercel but you want to use your local backend for testing:

1. **Update `.env` to include your Vercel URL**:
   ```bash
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-app.vercel.app
   ```

2. **Use ngrok to expose your local backend**:
   ```bash
   ngrok http 8080
   ```

3. **Set the ngrok URL in Vercel** as `VITE_API_URL` (see client README)

4. **Important CORS note**: The frontend on Vercel makes requests TO the ngrok URL.
    The `Origin` header will be your Vercel URL, which must be in `CORS_ORIGINS`.

## API Endpoints

### Sessions

- `POST /api/sessions` - Create a new session
- `GET /api/sessions/<id>` - Get session details
- `POST /api/sessions/<id>/start` - Start a session
- `POST /api/sessions/<id>/end` - End a session
- `POST /api/sessions/join` - Student joins a session
- `POST /api/sessions/<id>/leave` - Student leaves a session
- `GET /api/sessions/<id>/roster` - Get student roster
- `POST /api/sessions/validate` - Validate join code

See `app/routes/sessions.py` for full documentation.
