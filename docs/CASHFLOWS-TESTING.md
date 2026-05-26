# Cashflows testing (integration / sandbox)

## The confusing portals (you are not alone)

Cashflows uses **several websites**. They are not all the same:

| What you see | URL (examples) | What it is for |
|--------------|----------------|----------------|
| **Merchant portal** | https://portal.cashflows.com/ | Day-to-day business: reports, virtual terminal, profile. This is the main back office. |
| **Live payment / config (older “secure”)** | https://secure.cashflows.com/ | Live gateway-related UI; some merchants see API / configuration here. |
| **Integration / sandbox payment UI** | https://secure-int.cashflows.com/ | Test environment UI — **not** the same as portal.cashflows.com. Many merchants only see account settings here, **not** API keys. |
| **Developer docs** | https://developer.cashflows.com/ | Test card numbers, `Luke Skywalker` name rules, error codes. |

**Virtual terminal** in portal.cashflows.com = staff manually typing card details for a phone/order payment. It is **not** used to get API keys for your website checkout.

**Embedded checkout on showskills.co.uk** needs:

- `CASHFLOWS_CONFIGURATION_ID`
- `CASHFLOWS_API_KEY`

Those must match the **gateway** you call (live vs sandbox). Cashflows often issues **separate integration credentials** — they are not automatically visible in portal.cashflows.com.

If you only have one Configuration ID + API key and they work on **live** only, you **do not have sandbox yet**.

Email: **implementations@cashflows.com**  
Ask: *“Please enable our integration (sandbox) account and tell us where to copy Configuration ID and API key for embedded checkout (payment-intents API).”*

---

## Two technical environments

| | Integration (sandbox) | Production (live) |
|---|----------------------|-------------------|
| API | `https://gateway-int.cashflows.com/` | `https://gateway.cashflows.com/` |
| Env flag | `CASHFLOWS_INTEGRATION=1` | `CASHFLOWS_INTEGRATION=0` |
| Test cards `4000…` | Yes | No — use real cards |
| Name `Luke Skywalker` | Forces success in sandbox | **Ignored** — real bank 3DS applies |

Your current `.env.local` keys are **live-only** (they fail on `gateway-int` with “record not found”).

---

## Local commands

```bash
# Live keys (.env.local, CASHFLOWS_INTEGRATION=0)
npm run dev:all

# Sandbox — only after sandbox keys are in .env.integration.local
npm run dev:integration

# Check which gateway your keys use
npm run cashflows:probe
```

After any `.env` change: **Ctrl+C** the running dev terminal, then start again. Refresh the browser with **Cmd+Shift+R**.

---

## Sandbox test card flow (only with integration keys)

1. Put sandbox **Configuration ID** and **API key** in `.env.integration.local` (not only in `.env.local`).
2. `npm run dev:integration` — must print sandbox OK, then start servers.
3. Open the **Local** URL Vite prints (e.g. http://localhost:5173).
4. Checkout:

| Field | Value |
|--------|--------|
| Card | `4000000000000002` |
| Expiry | Any future date (e.g. `12/30`) |
| CVC | `123` |
| **Name on card** | **`Luke Skywalker`** — spelling exact, not “Looks” |

5. When the **3D Secure simulator** page appears (sandbox only), click **Authentication successful**.  
   Do **not** choose “failed” or “not authenticated” — that gives *3DSecure Authentication Failed*.

### Sandbox name cheat sheet (Cashflows)

| Name | Result |
|------|--------|
| **Luke Skywalker** | Success |
| Han Solo | Challenge (extra steps) |
| Random / Lando Calrissian / blank | **3DS failed** |

---

## If you are on `dev:all` (live) right now

- Test card numbers **do not** work as in the docs.
- `Luke Skywalker` **does not** bypass your bank — you need a **real card**, **real name on card**, and approve 3DS in your banking app.
- A 3DS page on **secure-int** can still appear in some flows, but with live keys you are in **real** 3DS territory.

**You are not ready for live payment testing until sandbox works** — get integration credentials first.

---

## Useful commands

```bash
npm run cashflows:test-gateway    # test current env file keys
npm run cashflows:probe           # prints live | integration | none
npm run cashflows:test-free-api   # £0 free-verify API smoke (server must be running)
```

## Apple Pay

Safari + domain verification in Cashflows portal. Sandbox and live are configured separately.
