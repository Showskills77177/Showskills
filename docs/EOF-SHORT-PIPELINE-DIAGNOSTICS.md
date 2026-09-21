# Eyes Of Football — Short Pipeline Diagnostics Plan

Operational diagnostics for the **EOF Production Short pipeline** (script → TTS → stills → ffmpeg 9:16 → quality gate → YouTube).

> **Scope:** This plan targets the EOF Production Shorts system (admin Production studio + daily cron), not competition kick-up uploads. Pipeline code currently lives on the EOF production/staging lineage (e.g. `cursor/debug-eof-klopp-cucurella-1660`); it is not on `main` until merged.

---

## 1. Goals

| Goal | What “good” looks like |
|------|-------------------------|
| **Triage fast** | Any failed Short can be classified in &lt;5 minutes to a stage + dependency |
| **Separate infra vs content** | Isolate kills / missing keys vs bad stills / gate blocks |
| **Protect spend** | Detect SerpAPI / ElevenLabs / LLM burn before rebuild loops |
| **Keep auto-publish honest** | Daily cron failures leave a clear `last_status` + job `error_message` |
| **Avoid zombie builds** | Jobs never sit in `rendering` / `rendering_video` past the stale window without a fail |

---

## 2. Pipeline map (diagnostic spine)

```
draft → scripting → ready_script → rendering → rendered
                                      ↓
                              rendering_video → video_rendered → published
                                      ↓
                                   failed
```

| Stage | Status(es) | Work | Primary deps | Log tag / signal |
|-------|------------|------|--------------|------------------|
| A. Script | `scripting` → `ready_script` | Desk research + LLM draft + adapt-to-scenes | Anthropic/Groq/(xAI), NewsData/Guardian/RSS | `[eof-production]`, script provider notes on hub GET |
| B. Preflight gate | before spend | Caption/timing/music/layout checks | `EOF_SHORT_QUALITY_*` | `quality_gate_json` phase `preflight` |
| C. Audio | `rendering` | Per-scene TTS + music mix | Edge TTS or ElevenLabs, ffmpeg, music catalog | progress `stage=tts\|mix`; `mixed_audio` artifact |
| D. Stills | early `rendering_video` | Serp → (opt Oxylabs) → AI gen → Wikimedia… | `SERPAPI_API_KEY`, image provider settings | `serpapi` probe + `serpapiLastAttempt` |
| E. Stills gate | before encode | Placeholder / clickbait checks | quality gate | phase `stills` |
| F. Video encode | `rendering_video` | Scene clips + captions + mux 9:16 | ffmpeg-static, ZapCap optional | progress `stage=video\|mux` |
| G. Post gate | before auto-publish | Heuristics (+ optional vision) | `EOF_SHORT_QUALITY_VISION` | phase `post`; Slack webhook optional |
| H. Publish | `published` | Resumable YouTube upload / schedule | YouTube OAuth + Data API | `/api/admin/eyes-of-football` youtube block |
| I. Daily / overnight | cron | Full build or script-only drafts | `CRON_SECRET`, scheduler settings | `eof_scheduler_*` / script-maker `last_status` |

**Host model (no Redis/S3 for Shorts):**

- Vercel serverless, `maxDuration` 300s
- **Pro:** `waitUntil` + chunked continue-build (audio isolate → video isolate)
- **Hobby/slim:** ≤4 scenes, hard cuts, continue-build self-fetch with `CRON_SECRET`
- Durable media: **Postgres base64** (`video_base64`, `mixed_audio_base64`, `scene_images_base64_json`) — `/tmp` is ephemeral

---

## 3. First 5 minutes — triage checklist

Use this every time a Short is stuck or failed.

### 3.1 Open the hub (config health)

`GET /api/admin/eof-production` (admin session)

Confirm at a glance:

1. **`ffmpegAvailable`** — if false, video stage cannot run (`FFMPEG_PATH` / ffmpeg-static)
2. **`scriptProviders` + `scriptBillingNote`** — at least one of Anthropic / Groq (or OpenAI/xAI)
3. **`serpapi` / `oxylabs` / `pinterest` probes** — `ok` vs `configured` but failing
4. **`imageSources` + `imagesNote`** — no Serp → Wikimedia-only (placeholder risk)
5. **`buildMode` / `buildModeEnvForced`** — Hobby vs Pro; `EOF_FORCE_SLIM=1` overrides UI
6. **`elevenLabsConfigured`** — only required if voice preset is Brian / ElevenLabs
7. **`captionEngine` / ZapCap** — optional; local burn-in is default

Also: `GET /api/admin/eyes-of-football` → `youtube.isReadyToPublish`, OAuth client, refresh token.

### 3.2 Inspect the job row

From hub `jobs[]` or DB `eof_production_jobs`:

| Field | Use |
|-------|-----|
| `status` | Which stage died |
| `error_message` | Human fail reason (stale timeout, quality gate, provider error) |
| `render_progress_json` | `stage`, `sceneIndex`, `percent`, `startedAt`, heartbeat |
| `quality_gate_json` | Latest gate phase + `reasons` / `checks` |
| `quality_gate_history_json` | Trail across rebuilds |
| Artifact flags | Has mixed audio? video? stills? (prefer DB base64 over disk) |

### 3.3 Classify in one sentence

Pick exactly one primary class:

| Class | Typical status / message | Next section |
|-------|--------------------------|--------------|
| **Config missing** | Script AI / Serp / YouTube not ready | §5.1 |
| **Isolate / timeout** | “Render stuck / timed out after Ns”, zombie `rendering_*` | §5.2 |
| **Provider quota/billing** | Serp 429, ElevenLabs 401/402, LLM 402 | §5.3 |
| **Quality gate block** | Gate `blocked` / `EofQualityGateBlockedError` | §5.4 |
| **Encode / artifact** | ffmpeg fail, oversized MP4, missing video after “success” | §5.5 |
| **Publish / OAuth** | Upload fail, callback 404, not ready to publish | §5.6 |
| **Cron / scheduler** | Daily Short or Script Maker `last_status=error` | §5.7 |

---

## 4. Observability inventory (what exists today)

| Signal | Where | Use for |
|--------|-------|---------|
| Job status + `error_message` | DB / admin Production panel | Primary user-facing failure |
| `render_progress_json` | DB; UI progress bar | Stage + ETA + heartbeat for stale logic |
| Stale render sweep | `failStaleEofProductionRenders` on hub GET | Auto-fail dead isolates |
| Hub diagnostics payload | `GET /api/admin/eof-production` | Provider/ffmpeg/build-mode health |
| YouTube setup (masked) | `GET /api/admin/eyes-of-football` | Publish readiness |
| Quality gate + history | Job columns; optional Slack | Auto-publish blocks |
| `console.*` with `[eof-production]` | Vercel function logs | Deep dive per request / continue-build |
| Scheduler `last_status` / `last_error` | Scheduler + script-maker settings tables | Cron health |
| Local `/api/health` | Express only | Not EOF-specific |
| Tests / CLI | `npm run test:eof-production`, `render:eof`, `scripts/test-eof-video-pipeline.mjs` | Repro offline |

**Gaps to close (see §7):** no Sentry/OTel, no structured per-stage metrics, no single “diagnostics” export endpoint, no alert on Serp quota before rebuild.

---

## 5. Failure playbooks (short pipeline)

### 5.1 Config / provider readiness

**Symptoms:** Adapt/script fails immediately; stills all Wikimedia placeholders; publish disabled.

**Checks:**

1. Hub `scriptBillingNote` / `scriptProviders` — need `ANTHROPIC_API_KEY` or `GROQ_API_KEY`
2. `SERPAPI_API_KEY` present and probe `ok` (primary stills)
3. `OXYLABS_ENABLED=1` only when trial/account valid — otherwise expect 401 noise
4. YouTube: client id/secret + refresh token; callback must be `/api/youtube-oauth-callback` (multi-segment paths 404 on Vercel)
5. Staging gate: production studio may be staging-site locked — confirm deploy branch / `VERCEL_GIT_COMMIT_REF`

**Fix:** Set env → redeploy → re-check hub GET before Rebuild.

### 5.2 Isolate budget / stuck `rendering_*`

**Symptoms:** Job sits on “Building…”; later auto-fails with timeout; or poll kills a live encode.

**Checks:**

1. `buildMode` — Pro vs Hobby; scene count (Hobby caps ≤4)
2. Progress heartbeat age vs windows (~300s Pro max age; quiet kill ~90–120s without HB)
3. Vercel logs for `continue step=audio|video`, `waitUntil unavailable`, `continue hop not scheduled`
4. Confirm continue-build auth (`CRON_SECRET`) on slim path

**Actions:**

- Do **not** Rebuild while progress is advancing
- If truly dead: Cancel / wait for stale fail → Rebuild **once**
- Prefer Pro + chunked continue for longer Cucurella-class Shorts
- If fails after successful mux: verify durable `video_base64` write (disk `/tmp` is not truth)

### 5.3 Quota / billing burn

**Symptoms:** Empty stills after Serp; ElevenLabs errors; LLM 402; rebuild burns credits repeatedly.

**Checks:**

| Provider | Signal | Guardrail |
|----------|--------|-----------|
| SerpAPI | probe fail / `serpapiLastAttempt` | Stop rebuild loops; clear avoid-key poison history on intentional Rebuild |
| ElevenLabs | 401/402; concurrency | Prefer Edge presets; concurrency hard-cap 2; durable mix saves avoid re-TTS on continue |
| Anthropic/Groq/xAI | clear “no provider” / billing errors | Fix keys before Adapt |
| Oxylabs | 401 when enabled | Set `OXYLABS_ENABLED=0` unless paid |

**Rule:** One failed paid pass → diagnose → fix config → single Rebuild. Never click Rebuild in a loop.

### 5.4 Quality gate blocks

**Phases:** `preflight` → `stills` → `post`

**Symptoms:** Build stops before images/TTS; or video renders but auto-publish blocked; Slack webhook (if set).

**Checks:**

1. `quality_gate_json.phase`, `pass`, `blocked`, `reasons[]`, `checks[]`
2. Env: `EOF_SHORT_QUALITY_GATE`, `EOF_SHORT_QUALITY_MAX_PLACEHOLDER`, `EOF_SHORT_QUALITY_VISION`
3. Manual vs auto: manual builds may allow more placeholders; daily cron uses `qualityGateMode: 'auto'`

**Actions:**

- Preflight fail → fix script/captions/layout, don’t spend Serp/TTS
- Stills fail → change image provider / queries / clear poisoned avoid keys; reduce placeholders
- Post fail → review overlays/captions/placeholders; do not force-publish until gate passes (auto path)

### 5.5 Encode / artifacts

**Symptoms:** Audio OK, video missing; double captions; MP4 too large for DB; ffmpeg note on hub.

**Checks:**

1. `ffmpegAvailable`
2. Artifact flags: mixed audio present, `video_base64` present (not only `/tmp/...`)
3. Logs around mux / recompress (~12MB base64 DB ceiling)
4. Caption engine: local drawtext vs ZapCap

**Actions:** Prefer DB artifacts on continue/remux; recompress if oversize; avoid remuxing from warm-instance disk alone.

### 5.6 YouTube publish

**Symptoms:** `video_rendered` but not `published`; upload errors; analytics empty.

**Checks:**

1. `youtube.isReadyToPublish` on eyes-of-football admin
2. Project queue row in `eof_youtube_projects`
3. OAuth refresh token validity; quota on Data API
4. Thumbnail generation errors (non-fatal vs blocking — confirm from logs)

**Actions:** Re-auth if refresh invalid; retry upload once; schedule vs immediate publish settings.

### 5.7 Daily Short + overnight Script Maker

**Symptoms:** No morning Short; drafts missing; cron 401.

**Checks:**

1. Vercel cron: `0 9 * * *` (daily Short), `0 23 * * *` (script maker) → `/api/eof-daily-cron` (and script-maker alias)
2. `Authorization: Bearer CRON_SECRET` (or platform cron header) accepted
3. Scheduler settings `last_status` / `last_error` / last job id
4. Same playbooks §5.1–5.6 for the spawned job

---

## 6. Standard diagnostic runbook (copy/paste)

### 6.1 Production incident — one Short

```
1. Admin → Eyes Of Football → Production → open failing job
2. Note: status, error_message, renderProgress.stage, qualityGate.phase
3. GET hub diagnostics (or refresh panel) → ffmpeg / script / serp / buildMode
4. Vercel → Function logs → filter [eof-production] + job id
5. Classify (§3.3) → apply playbook (§5)
6. Fix env or content → ONE Rebuild (or Cancel first if zombie)
7. Confirm video_rendered + artifacts in DB → publish if gate pass
8. Record: job id, class, root cause, env change (if any)
```

### 6.2 Pre-flight before a campaign day

```
[ ] Hub GET: ffmpegAvailable true
[ ] Script provider configured (Claude or Groq)
[ ] SerpAPI probe ok (or accepted Wikimedia-only risk)
[ ] Oxylabs disabled unless valid
[ ] Build mode Pro for long Shorts
[ ] YouTube isReadyToPublish
[ ] CRON_SECRET set; crons present in vercel.json / dashboard
[ ] Music catalog seeded
[ ] Smoke: create job → Adapt → Build Short on staging → gate pass
[ ] Optional: npm run test:eof-production locally
```

### 6.3 Offline / staging repro

```bash
# Unit + API smoke + video path (on EOF branch)
npm run test:eof-production

# Isolated stills + silent 9:16
node scripts/test-eof-video-pipeline.mjs

# Full CLI render when env keys available
npm run render:eof
```

---

## 7. Recommended diagnostics upgrades

Implement in this order (highest leverage first):

### P0 — Operator clarity (1–2 focused PRs)

1. **`GET /api/admin/eof-production/diagnostics`** (or `action=diagnostics`)  
   Single payload: env readiness (booleans only), last N failed jobs with class guess, Serp last attempt, stale counts, scheduler last run, build mode, youtube ready.
2. **Failure class on `error_message` or structured `error_code`**  
   e.g. `ISOLATE_TIMEOUT | SERP_QUOTA | TTS_BILLING | QUALITY_GATE | FFMPEG | YOUTUBE | SCRIPT_PROVIDER`.
3. **Admin UI banner** when hub probes fail (Serp/ffmpeg/script) — don’t wait for a dead Rebuild.

### P1 — Runtime safety

4. **Structured stage events** (JSON log lines): `jobId`, `stage`, `ms`, `provider`, `ok`.
5. **Rebuild guard**: UI confirm if last fail was quota/billing within 15 minutes.
6. **Artifact integrity check** after mux: require `video_base64` length &gt; 0 before `video_rendered`.

### P2 — Monitoring

7. Optional Sentry (or Logtail) on `[eof-production]` errors.
8. Slack/Discord already used for quality gate — extend to isolate timeout + cron failure.
9. Daily digest: jobs created / rendered / published / failed by class.

---

## 8. Decision tree (quick)

```
Job failed or stuck?
├─ No script providers / clear AI error → Config (§5.1)
├─ error mentions timed out / stuck / isolate → Isolate (§5.2)
├─ Serp/ElevenLabs/LLM 401/402/429 → Quota (§5.3)
├─ quality_gate blocked / reasons present → Gate (§5.4)
├─ ffmpeg false or no video_base64 after render → Encode (§5.5)
├─ video_rendered but YouTube error → Publish (§5.6)
└─ Cron last_status error, no manual job → Scheduler (§5.7)
```

---

## 9. Key code pointers (EOF branch)

| Area | Path |
|------|------|
| Status / progress helpers | `shared/eofProduction.mjs` |
| Hub + actions | `backend/api/admin/eof-production.js` |
| Job CRUD + stale sweep | `backend/api/lib/eofProductionJobs.mjs` |
| Full / continue build | `backend/api/lib/eofProductionRenderRunner.mjs` |
| TTS + mix | `backend/api/lib/eofProductionRender.mjs` |
| Stills + ffmpeg | `backend/api/lib/eofProductionRenderVideo.mjs` |
| Quality gate | `backend/api/lib/eofShortQualityGate.mjs` |
| Image source status | `backend/api/lib/eofImageSourceStatus.mjs` |
| Daily scheduler | `backend/api/lib/eofDailyScheduler.mjs` |
| Cron entry | `backend/api/eof-daily-cron.js` |
| YouTube admin | `backend/api/admin/eyes-of-football.js` |
| Admin UI | `src/pages/admin/eof/EofProductionPanel.jsx` |

---

## 10. Success criteria for this plan

- On-call can name the **failing stage** and **dependency** without reading the whole codebase.
- No rebuild loops on billing/quota failures.
- Zombie `rendering_*` jobs either heartbeat or auto-fail within the documented stale window.
- Daily cron misses leave a scheduler `last_error` that maps to a playbook section.
- Pre-campaign checklist (§6.2) is runnable in under 15 minutes on staging.
