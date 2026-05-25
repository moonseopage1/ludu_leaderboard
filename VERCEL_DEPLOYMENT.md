# Ludu Leaderboard - Vercel Deployment And Blob Storage

Local development writes to `ludu-data.json` in this project folder.

Vercel deployments cannot write back into deployed project files. In production, this app reads and writes a private Vercel Blob object named `ludu-data.json`.

## Required Vercel Setup

1. Open the project in the Vercel dashboard.
2. Go to **Storage**.
3. Create or connect a **Blob** store.
4. Use **Private** access.
5. Confirm Vercel adds this environment variable to the project:

```txt
BLOB_READ_WRITE_TOKEN
```

6. Add your write PIN in **Settings -> Environment Variables**:

```txt
LUDU_WRITE_PIN=your-pin
```

7. Redeploy the project.

## Seed Local Data Into Vercel Blob

Use this when your local `ludu-data.json` has the correct data and you want production to use it.

### Option 1: Project Seed Script

1. Pull your Vercel environment variables locally, or manually add `BLOB_READ_WRITE_TOKEN` to `.env`.

```bash
vercel env pull .env
```

2. Make sure `ludu-data.json` contains the data you want in production.

3. Upload the file to Vercel Blob:

```bash
npm run seed:blob
```

The script:

- reads local `ludu-data.json`
- migrates old data into the current season format
- uploads it as private Blob object `ludu-data.json`
- overwrites the existing Blob object if one already exists

### Option 2: Vercel Blob CLI

If you prefer the Vercel CLI Blob command:

```bash
vercel blob put ludu-data.json --pathname ludu-data.json --access private --content-type application/json --allow-overwrite
```

If your CLI asks for a token, use the project `BLOB_READ_WRITE_TOKEN`.

## Verify Production Data

After uploading and redeploying, open:

```txt
https://your-project.vercel.app/api/data
```

Check that the response includes:

```txt
players
currentSeason
games
seasonHistory
leaderboard
ranking
allTimeRanking
seasonProgress
```

For your imported 8-match data, the app should show:

```txt
Season 1 - Match 8 of 10
```

## How Storage Works

- Local `npm start`: reads and writes project file `ludu-data.json`.
- Vercel with `BLOB_READ_WRITE_TOKEN`: reads and writes private Blob object `ludu-data.json`.
- Vercel without `BLOB_READ_WRITE_TOKEN`: can read the deployed seed JSON, but cannot save changes.
- `LUDU_WRITE_PIN` is required for add player, save game, and reset actions.

## Old Data Compatibility

Old data like this still works:

```json
{
  "players": ["Babu Vai", "Saidul", "Adif", "Moon"],
  "games": []
}
```

The app automatically converts it at runtime into:

```txt
players
currentSeason
games
seasonHistory
```

Derived fields such as `leaderboard`, `ranking`, `allTimeRanking`, and `seasonProgress` are calculated by the API response and do not need to be stored manually.

## Important Notes

- Do not expose `BLOB_READ_WRITE_TOKEN` in frontend code.
- Keep `LUDU_WRITE_PIN` private.
- Running `npm run seed:blob` overwrites production `ludu-data.json` in Blob storage.
- If production already has newer games, download or back up the Blob data before seeding over it.
