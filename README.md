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

## Deploy to Cloudflare Workers

Requires Node.js and a Cloudflare account.

1. Sign in (opens a browser):

   ```powershell
   npx wrangler login
   ```

2. Store the Roboflow key as a secret. Type the key when prompted; do not put it
   on the command line:

   ```powershell
   npx wrangler secret put ROBOFLOW_API_KEY
   ```

3. Deploy:

   ```powershell
   npx wrangler deploy
   ```

4. In Supabase, go to Authentication > URL Configuration and add the deployed
   `https://guadahealth.<your-subdomain>.workers.dev` address.

`src/worker.js` serves the site and relays transcription requests to Roboflow.
It only accepts requests from users signed in to the app. `.assetsignore` keeps
private files (`.env`, `server.py`, `supabase/`, `Prescription-Images/`) off the
website.

To test the Cloudflare version locally, put the same `ROBOFLOW_API_KEY=...` line
in a `.dev.vars` file (git-ignored) and run `npx wrangler dev`.

## Database

Run `supabase/storage-policies.sql`, then `supabase/schema.sql`, in the Supabase
SQL Editor.
