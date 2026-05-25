# Ludu Leaderboard

A clean Ludo leaderboard app for tracking players, matches, 10-match seasons, ranking scores, and all-time performance.

## Features

- Add saved players.
- Select 4 players for a match.
- Optional lottery for turn order.
- Enter final positions: 1st, 2nd, 3rd, and 4th.
- Current Leaderboard based on current season total points.
- Ranking based on weighted performance score.
- All Time Ranking based on every saved match across all seasons.
- Game History with pagination.
- Season History with expandable completed season results.
- Local JSON file storage.
- Private Vercel Blob storage for deployed Vercel apps.

## Install

```bash
npm install
```

## Run Locally

```bash
npm start
```

Open:

```txt
http://localhost:4000
```

## Required Environment Variables

Write actions require a PIN:

```txt
LUDU_WRITE_PIN=your-pin
```

For Vercel Blob storage:

```txt
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

Local development reads `.env` automatically.

## Data Storage

Local development saves data in:

```txt
ludu-data.json
```

Vercel deployments cannot write back to deployed project files, so production uses a private Vercel Blob object named:

```txt
ludu-data.json
```

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for setup and seeding steps.

## Scoring

Match points:

```txt
1st = 4 points
2nd = 3 points
3rd = 2 points
4th = 1 point
```

Lost Count:

```txt
Lost Count = number of times a player finished 4th
```

Average Point:

```txt
Average Point = Total Points / Matches Played
```

## Season System

- One season contains 10 matches.
- The current season progress is shown as `Season N - Match X of 10`.
- After match 10 is saved, the season is completed automatically.
- The final season leaderboard is saved into Season History.
- The app starts the next season automatically.
- Current season leaderboard and ranking reset for the next season.
- All Time Ranking continues to use every saved match.

## Current Leaderboard

The Current Leaderboard uses only matches from the current season.

Columns:

- Rank
- Player
- Total Matches Played
- Wins
- Total Points
- Average Point
- Lost Count

Sort order:

1. Higher total points
2. Higher wins
3. Lower lost count
4. Player name alphabetically

The 1st-place row is deep green. The 2nd-place row is light green.

## Ranking System

Ranking is separate from the leaderboard.

Ranking uses this formula:

```txt
RankingScore = (TotalPoints / MatchesPlayed) * (1 - LostCount / MatchesPlayed) * min(1, MatchesPlayed / 10)
```

This rewards strong average performance, penalizes 4th-place finishes, and reduces the score for players who have played fewer than 10 matches.

If a player has 0 matches:

```txt
RankingScore = 0
```

Ranking sort order:

1. Higher ranking score
2. Higher total points
3. Lower lost count
4. Player name alphabetically

## All Time Ranking

All Time Ranking uses the same `RankingScore` formula, but it calculates from every saved game across all seasons.

This means:

- Current Ranking shows current season form.
- All Time Ranking shows long-term performance.

## Game History

Game History shows saved matches newest first.

Default page size:

```txt
5 games per page
```

Available page sizes:

```txt
5, 10, 20, 50
```

## Release Notes

See [RELEASE_NOTES.md](./RELEASE_NOTES.md).
