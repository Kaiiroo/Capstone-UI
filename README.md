# GuadaHealth / PRESCRIBE-AID

## Run locally (Python)

1. Create a `.env` file in the project folder (it is git-ignored):

   ```
   ROBOFLOW_API_KEY=your-roboflow-key
   ```

2. Start the server and open http://localhost:8000:

   ```powershell
   python server.py
   ```

`python -m http.server` will not work: transcription needs the `/api/roboflow`
endpoint in `server.py`. Restart the server after editing `server.py`.

## Deploy to Cloudflare Pages

Live site: https://guadahealth.pages.dev

Requires Node.js and access to the Cloudflare account that owns the
`guadahealth` Pages project.

1. Sign in (opens a browser):

   ```powershell
   npx wrangler login
   ```

2. Build and deploy:

   ```powershell
   node scripts/build.mjs
   npx wrangler pages deploy --branch main
   ```

`scripts/build.mjs` copies only the public site (HTML, `styles.css`, `assets/`,
`js/`) into `dist/`, so `.env`, `server.py`, `supabase/` and
`Prescription-Images/` are never uploaded. `functions/api/roboflow.js` relays
transcription requests to Roboflow and only accepts users signed in to the app.

The Roboflow key is stored as a Pages secret. To change it, run this and type the
key when prompted (never put it on the command line):

```powershell
npx wrangler pages secret put ROBOFLOW_API_KEY --project-name guadahealth
```

In Supabase, Authentication > URL Configuration must list
`https://guadahealth.pages.dev`.

To test the Cloudflare version locally, put the same `ROBOFLOW_API_KEY=...` line
in a `.dev.vars` file (git-ignored), build, and run `npx wrangler pages dev`.

## Database

Run `supabase/storage-policies.sql`, then `supabase/schema.sql`, in the Supabase
SQL Editor.
