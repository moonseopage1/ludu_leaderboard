# Ludu Leaderboard - Vercel Deployment Guide

Local development writes to `ludu-data.json` in this project folder.

Vercel deployments cannot write back into deployed project files. On Vercel, the app saves the same JSON data to a private Vercel Blob object named `ludu-data.json`.

## Fix The Live Site

1. Open the project in the Vercel dashboard.
2. Go to **Storage**.
3. Create a **Blob** store.
4. Choose **Private** access.
5. Make sure Vercel adds this environment variable:

```txt
BLOB_READ_WRITE_TOKEN
```

6. Add your write PIN in **Settings -> Environment Variables**:

```txt
LUDU_WRITE_PIN
```

7. Redeploy the project.

After redeploying, test:

```txt
https://ludu-leaderboard.vercel.app/api/data
```

Then add a player in the UI. The API will save to the private `ludu-data.json` Blob object.

## How Storage Works

- Local `npm start`: reads and writes project file `ludu-data.json`.
- Vercel with `BLOB_READ_WRITE_TOKEN`: reads and writes private Blob object `ludu-data.json`.
- Vercel without `BLOB_READ_WRITE_TOKEN`: can read the deployed seed JSON, but cannot save changes.
- `LUDU_WRITE_PIN` is required for add player, save game, and reset actions.
