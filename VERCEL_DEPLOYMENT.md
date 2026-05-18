# Ludu Leaderboard - Vercel Deployment Guide

This project runs locally with `ludu-data.json`, but Vercel cannot permanently save changes to files inside the deployed project. The Vercel API functions use Vercel Blob when `BLOB_READ_WRITE_TOKEN` is available.

## What changed

- Local `node server.js` reads and writes `ludu-data.json`.
- Vercel `api/` functions read and write `ludu-data.json` in Vercel Blob.
- `@vercel/blob` was added to `package.json`.
- The app requires Node.js 20 or newer.

## Fix Vercel storage

1. Go to your project in the Vercel dashboard.
2. Open the **Storage** tab.
3. Select **Create Database**.
4. Choose **Blob**.
5. Create a **Private** Blob store.
6. Select the environments where the token should be available, usually **Production**, **Preview**, and **Development**.
7. Confirm that Vercel created the environment variable:

   ```txt
   BLOB_READ_WRITE_TOKEN
   ```

8. Redeploy the project from Vercel.

After redeploying, test:

```txt
https://your-domain.vercel.app/api/data
```

Then add a player or save a game in the UI. Refresh the page and open the app again later. The data should still be there.

## Optional local Vercel test

If you want to test Blob locally instead of local JSON file storage:

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Without `BLOB_READ_WRITE_TOKEN`, local development continues to use `ludu-data.json`.

## Troubleshooting

If data still does not save on Vercel:

- Check Vercel dashboard -> Project -> Settings -> Environment Variables.
- Make sure `BLOB_READ_WRITE_TOKEN` exists for the environment you deployed.
- Redeploy after adding the Blob store or token.
- Check Vercel dashboard -> Deployments -> your deployment -> Functions logs.
- Make sure Vercel is using Node.js 20 or newer.

## Storage note

Vercel Blob works well for this small leaderboard JSON file. If many people will save games at the same time, use a real database such as Vercel Marketplace Postgres, Neon, Supabase, or Upstash, because object-file storage can have write conflicts under heavy concurrent updates.
