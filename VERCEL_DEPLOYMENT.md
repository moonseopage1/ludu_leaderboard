# Ludu Leaderboard - Vercel Deployment Guide

## Setup

1. **Initialize Git** (if not already done):

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub**:
   - Create a repo on GitHub
   - Push your code:
     ```bash
     git remote add origin <your-repo-url>
     git branch -M main
     git push -u origin main
     ```

3. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repo
   - Click "Deploy"

## Important Notes

### Why It Wasn't Working Before

On Vercel, **serverless functions** are used instead of persistent Express servers:

- Your local `server.js` runs continuously
- Vercel's `api/` folder contains **stateless functions** that respond to requests
- Each request is independent and starts fresh

### API Endpoints

All requests automatically route to the `/api` functions:

- `GET /api/data` → `api/data.js`
- `POST /api/player` → `api/player.js`
- `POST /api/game` → `api/game.js`
- `DELETE /api/reset` → `api/reset.js`

### Data Storage

⚠️ **Important**: On Vercel, **serverless storage is temporary**. Files created during execution are deleted after the function completes.

**Solutions for persistent data:**

1. **MongoDB Atlas** (Free tier available)
2. **Supabase** (PostgreSQL, free tier)
3. **Firebase** (Realtime database)
4. **Vercel KV** (Redis)

### Testing Locally

Before deploying, test your API endpoints:

```bash
# Terminal 1: Start the server
node server.js

# Terminal 2: Test an endpoint
curl http://localhost:4000/api/data

# Test adding a player
curl -X POST http://localhost:4000/api/player \
  -H "Content-Type: application/json" \
  -d '{"name":"TestPlayer"}'
```

## Troubleshooting

### Frontend shows but backend doesn't work

1. **Check CORS headers**: ✅ Already added in updated files
2. **Verify API routes**: Go to `https://your-domain.vercel.app/api/data` in browser
3. **Check function logs**: Go to Vercel Dashboard → Deployments → Logs

### Data not persisting

This is expected! Use a database solution from the list above.

## Next Steps

1. Add a database for persistent storage
2. Update `api/_data.js` to query the database instead of local files
3. Test all endpoints after deployment
