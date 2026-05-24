# HTTPS Setup

Both Docker stacks (server and streaming) expose services over HTTPS via Nginx TLS proxy containers. HTTP ports remain open alongside HTTPS so nothing breaks during development.

## Port Mapping

| Service | HTTP | HTTPS |
|---------|------|-------|
| Frontend | 5173 | **443** |
| Flask API | 8080 | **8443** |
| Grafana | 3000 | **3443** |
| MediaMTX HLS | 8888 | **18888** |
| MediaMTX WebRTC | 8889 | **18889** |

## First-Time Setup (Local Dev)

Generate a self-signed certificate before starting the containers:

```bash
bash certs/generate-dev-cert.sh
```

This writes `certs/cert.pem` and `certs/key.pem`. These files are gitignored — every developer runs this once after cloning.

**Trusting the cert (to avoid browser warnings):**

- **macOS:** Open `certs/cert.pem` in Finder → Keychain Access opens → set to "Always Trust"
- **Linux:** `sudo cp certs/cert.pem /usr/local/share/ca-certificates/horizon-data.crt && sudo update-ca-certificates`
- **Windows:** `certutil -addstore Root certs\cert.pem`

If you skip this step, browsers will show a security warning but HTTPS will still work (click "Proceed anyway" or use `curl -k`).

## Starting the Stacks

```bash
# Server stack (frontend + API + Grafana)
cd server
docker compose up --build

# Streaming stack (MediaMTX HLS + WebRTC)
cd streaming
docker compose up -d
```

## Access URLs

After both stacks are running:

| Service | URL |
|---------|-----|
| Frontend | https://localhost |
| Flask API | https://localhost:8443 |
| Grafana | https://localhost:3443 |
| HLS stream | https://localhost:18888/telescope-camera/index.m3u8 |
| WebRTC (WHEP) | https://localhost:18889/telescope-camera/whep |

## Switching to a Real Domain

When a domain is available, swap in a real certificate — no code changes required.

### 1. Obtain a certificate

Using [Let's Encrypt](https://letsencrypt.org/) (recommended, free):

```bash
# Install Certbot
sudo apt install certbot   # Debian/Ubuntu
brew install certbot       # macOS

# Issue cert for your domain (server must be publicly reachable on port 80)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Cert files are written to `/etc/letsencrypt/live/yourdomain.com/`.

### 2. Replace the cert files

```bash
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   certs/key.pem
```

### 3. Update environment variables

In `server/docker-compose.yml`, update these values to use your real domain:

```yaml
# frontend build arg
args:
  VITE_API_URL: https://api.yourdomain.com:8443

# api environment
CORS_ORIGINS: "https://yourdomain.com,https://www.yourdomain.com"
```

If you serve the API on a subdomain (recommended for production), also update `MEDIAMTX_RTSP_URL` and any stream URLs stored in the database via the admin UI.

### 4. Rebuild and restart

```bash
cd server
docker compose up --build
```

### 5. Set up automatic cert renewal

Let's Encrypt certs expire every 90 days. Add a cron job to renew and copy:

```cron
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/horizon-data/certs/cert.pem && \
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   /path/to/horizon-data/certs/key.pem && \
  docker compose -f /path/to/horizon-data/server/docker-compose.yml restart nginx-proxy
```

## Architecture

```
Browser
  │
  ├── https://yourdomain.com:443  ──►  nginx-proxy:443  ──►  frontend:80
  ├── https://yourdomain.com:8443 ──►  nginx-proxy:8443 ──►  api:8080
  ├── https://yourdomain.com:3443 ──►  nginx-proxy:3443 ──►  otel-lgtm:3000
  │
  ├── https://stream.yourdomain.com:18888 ──►  nginx-proxy:18888 ──►  mediamtx:8888  (HLS)
  └── https://stream.yourdomain.com:18889 ──►  nginx-proxy:18889 ──►  mediamtx:8889  (WebRTC)
```

TLS is terminated at the Nginx proxy. All internal container-to-container traffic stays HTTP on the Docker bridge network. To replace the cert, update the files in `certs/` and restart the `nginx-proxy` container — no other containers need to restart.
