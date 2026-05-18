# Ludu Leaderboard

Simple Ludu leaderboard app using:

- HTML
- Tailwind CSS CDN
- JavaScript
- Node.js Express
- JSON file storage locally
- Vercel Blob storage on Vercel

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Open:

```txt
http://localhost:4000
```

## Data Storage

Local development saves data in:

```txt
ludu-data.json
```

Local development saves data in `ludu-data.json`. Vercel deployment saves the same JSON data as a private Vercel Blob object named `ludu-data.json`. See `VERCEL_DEPLOYMENT.md`.

## Scoring

```txt
1st = 4 points
2nd = 3 points
3rd = 2 points
4th = 1 point
```
