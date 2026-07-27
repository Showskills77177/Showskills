# Railway EOF video worker (staging only)

Runs Serp + ffmpeg for Eyes Of Football Shorts on a long-lived host so Vercel
does not hit the ~300s / weak-CPU wall. **Do not** attach `showskills.co.uk`.

## Architecture

1. Admin **Build Short** on staging (Vercel) → TTS + mix audio → Postgres  
2. Vercel POSTs `EOF_WORKER_URL/eof-worker/render` with `EOF_WORKER_SECRET`  
3. Railway encodes video → writes `video_base64` to the **same** Postgres  
4. Staging UI polls until `video_rendered`

If `EOF_WORKER_URL` is unset, behaviour is unchanged (Vercel encode).

## Railway service

1. New service from GitHub `Showskills77177/Showskills`
2. Branch: **`staging`** (not `main`)
3. No custom domain — use **Generate Domain** (`*.up.railway.app`)
4. Start command (also in `railway.toml`): `node scripts/eof-railway-worker.mjs`

## Variables on Railway

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` or `POSTGRES_URL` | Yes | **Same** Neon/Postgres as Vercel staging |
| `EOF_WORKER_SECRET` | Yes | Long random string; must match Vercel |
| `SERPAPI_API_KEY` | Recommended | Same as staging for stills |
| `PORT` | Auto | Railway sets this |
| `VERCEL` / `VERCEL_ENV` | **Must be unset** | So encodes use the full profile |
| `SQLITE_PATH` | **Unset** | Would bypass Postgres |

Optional image keys: same as staging (`OXYLABS_*`, `PEXELS_API_KEY`, etc.).  
ElevenLabs is **not** required on Railway (audio already mixed on Vercel).

## Variables on Vercel staging

| Variable | Required | Notes |
|----------|----------|--------|
| `EOF_WORKER_URL` | Yes | `https://your-service.up.railway.app` (no trailing slash) |
| `EOF_WORKER_SECRET` | Yes | Same value as Railway |
| `EOF_STALE_WORKER_MAX_AGE_SEC` | Optional | Default `900` when worker URL is set |

Redeploy Vercel staging after setting these.

## Smoke test

```bash
curl -sS https://YOUR.up.railway.app/health
curl -sS -X POST https://YOUR.up.railway.app/eof-worker/render \
  -H "Authorization: Bearer $EOF_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"<staging-job-id>","forceFreshImages":true}'
```

Expect `202` then watch the job reach `video_rendered` in EOF Production.
