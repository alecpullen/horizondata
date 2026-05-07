# Horizon Data Web Client

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |

## Setup

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. The default `http://localhost:8080` works for local development.

3. Start the backend (from `../server` directory):
   ```bash
   python run.py
   ```

4. Start the frontend:
   ```bash
   npm run dev
   ```

### Vercel Deployment with Local Backend

To use the dev session test functionality on the Vercel-hosted frontend with your local backend:

1. **Install ngrok** (if not already installed):
   ```bash
   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Start your local backend**:
   ```bash
   cd ../server
   python run.py
   ```

3. **Create an ngrok tunnel** to your local backend:
   ```bash
   ngrok http 8080
   ```

4. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok-free.app`)

5. **Set the environment variable in Vercel**:

   Option A: Via Vercel Dashboard
   - Go to your project settings in the Vercel dashboard
   - Navigate to "Environment Variables"
   - Add `VITE_API_URL` with your ngrok HTTPS URL
   - Redeploy the project

   Option B: Via CLI
   ```bash
   vercel env add VITE_API_URL production
   # Enter your ngrok HTTPS URL when prompted
   vercel --prod
   ```

6. **Important**: The ngrok URL changes each time you restart ngrok (free tier). You'll need to update the environment variable accordingly.

### Troubleshooting

**"Failed to create test session" on Vercel**
- Check that `VITE_API_URL` is set in your Vercel project settings
- Verify your ngrok tunnel is running and the URL is current
- Check browser console for CORS errors (backend CORS settings may need adjustment)

**CORS errors**
- The backend must allow the Vercel frontend origin in its CORS configuration
- Update `CORS_ORIGINS` in your backend environment to include your Vercel deployment URL
