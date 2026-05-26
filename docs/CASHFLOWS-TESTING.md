# Cashflows testing (integration / sandbox)

## Two environments

| | Integration (sandbox) | Production (live) |
|---|----------------------|-------------------|
| API | `https://gateway-int.cashflows.com/` | `https://gateway.cashflows.com/` |
| Portal | https://secure-int.cashflows.com/ | https://secure.cashflows.com/ |
| Env | `CASHFLOWS_INTEGRATION=1` | `CASHFLOWS_INTEGRATION=0` |
| Credentials | **Separate** Configuration ID + API key | Live keys |

Your `.env.local` live keys work with `CASHFLOWS_INTEGRATION=0` only. Sandbox returns *“record not found”* if you use live keys with `INTEGRATION=1`.

Request sandbox access: **implementations@cashflows.com**

## Run sandbox locally

1. In **integration portal** → Configuration → API Data, copy Configuration ID + API key.
2. `cp .env.integration.local.example .env.integration.local` and paste sandbox values.
3. `npm run cashflows:test-gateway` — should print `INTEGRATION (sandbox)` and `OK`.
4. `npm run dev:integration` — starts Vite + API on sandbox.
5. Open http://localhost:5173 (or next free port) → Competitions → Pay now.

## Test cards (sandbox only)

| Field | Value |
|-------|--------|
| Visa | `4000000000000002` |
| Mastercard | `5400100400099001` |
| CVC | `123` (Amex: `1234`) |
| Expiry | any future date |
| Name | `Luke Skywalker` → success; `Han Solo` → 3DS challenge |

After Pay, you may see Cashflows **3D Secure simulator** (integration only).

## Useful commands

```bash
npm run cashflows:test-gateway          # uses .env.local + CASHFLOWS_INTEGRATION from file
CASHFLOWS_INTEGRATION=1 npm run cashflows:test-gateway
npm run dev:integration                 # sandbox dev (needs .env.integration.local)
npm run dev:all                         # normal local (your .env.local, usually live)
```

## Apple Pay in sandbox

Same as live: Safari + domain verification in portal. Embedded Apple Pay does not redirect; it opens the Apple Pay sheet in-browser.
