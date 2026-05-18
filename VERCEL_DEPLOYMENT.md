# Ludu Leaderboard - Vercel Deployment Guide

This project saves leaderboard data in `ludu-data.json`.

## What changed

- Local `node server.js` reads and writes `ludu-data.json`.
- Vercel `api/` functions also read and write `ludu-data.json`.
- Vercel Blob is not used.
- The app requires Node.js 20 or newer.

## Deploy

1. Push the project to GitHub.
2. Import the project in Vercel.
3. Deploy with Node.js 20 or newer.

After deploying, test:

```txt
https://your-domain.vercel.app/api/data
```

Then add a player or save a game in the UI and refresh the page.

## Data file

The data file is:

```txt
ludu-data.json
```

The API helper that manages this file is:

```txt
api/_data.js
```
