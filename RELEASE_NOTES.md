# Release Notes

## Version 1.1.0 - Seasons, Ranking, And All-Time Performance

This release upgrades Ludu Leaderboard from a simple match tracker into a season-based scoreboard with weighted rankings and better history views.

## New Features

### 10-Match Seasons

- Each season contains 10 matches.
- The app shows current progress, such as `Season 1 - Match 8 of 10`.
- When match 10 is saved, the season is completed automatically.
- The final leaderboard for that season is saved into Season History.
- A new season starts automatically.

### Season History

- Completed seasons are saved.
- Each previous season can be expanded or collapsed.
- Season results show:
  - Rank
  - Player
  - Total matches
  - Total points
  - Average point
  - Lost count

### Current Leaderboard

The Current Leaderboard now includes:

- Total Matches Played
- Wins
- Total Points
- Average Point
- Lost Count

The leaderboard is still based on total points for the current season.

Sort order:

1. Higher total points
2. Higher wins
3. Lower lost count
4. Player name alphabetically

The 1st-place row is highlighted in deep green. The 2nd-place row is highlighted in light green.

### Ranking

Ranking is separate from the leaderboard.

Ranking uses this score:

```txt
RankingScore = (TotalPoints / MatchesPlayed) * (1 - LostCount / MatchesPlayed) * min(1, MatchesPlayed / 10)
```

What this means:

- `TotalPoints / MatchesPlayed` measures average performance.
- `1 - LostCount / MatchesPlayed` penalizes frequent 4th-place finishes.
- `min(1, MatchesPlayed / 10)` reduces the score for players with fewer than 10 matches.

This helps compare players more fairly when they have played different numbers of matches.

If a player has not played any matches, their ranking score is `0`.

Ranking sort order:

1. Higher ranking score
2. Higher total points
3. Lower lost count
4. Player name alphabetically

### All Time Ranking

All Time Ranking uses the same ranking score formula, but it uses every saved game from all seasons.

Use it to compare long-term player performance.

### Optional Lottery

The random turn-order lottery is now optional.

- You can run lottery before saving a match.
- Or you can skip lottery and enter results directly.
- Game History shows `Lottery not used` when a match was saved without lottery.

### Game History Pagination

Game History now shows 5 matches per page by default.

Available page limits:

```txt
5, 10, 20, 50
```

Pagination controls include:

- Previous
- Next
- Page numbers

## Data And Migration

The app still uses JSON file storage locally and Vercel Blob storage in production.

Old data is supported. A legacy file with only:

```txt
players
games
```

is automatically converted into the new current season structure.

Stored production data supports:

- Players
- Current season
- Current season matches
- Game history
- Season history

Calculated API response data includes:

- Current leaderboard
- Current ranking
- All Time Ranking
- Season progress

## Deployment Notes

Production storage uses a private Vercel Blob object:

```txt
ludu-data.json
```

To upload local data into Vercel Blob:

```bash
npm run seed:blob
```

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for the complete setup guide.
