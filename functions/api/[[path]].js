/**
 * Proxy /api/* from Cloudflare Pages → Vercel (same-origin for the SPA).
 * Keeps credentials:include cookies working without CORS rewrites.
 *
 * Dashboard secret/var: VERCEL_API_ORIGIN = https://<vercel-staging-host> (no trailing slash)
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-proto',
  'x-real-ip',
])

function apiOrigin(env) {
  return String(env.VERCEL_API_ORIGIN || '')
    .trim()
    .replace(/\/$/, '')
}

function targetUrl(origin, request, params) {
  const incoming = new URL(request.url)
  const parts = params.path
  const suffix = Array.isArray(parts) ? parts.filter(Boolean).join('/') : parts ? String(parts) : ''
  const path = suffix ? `/api/${suffix}` : '/api'
  return `${origin}${path}${incoming.search}`
}

function forwardHeaders(request, originHost) {
  const headers = new Headers()
  for (const [key, value] of request.headers) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    headers.set(key, value)
  }
  headers.set('host', originHost)
  const url = new URL(request.url)
  headers.set('x-forwarded-host', url.host)
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
  return headers
}

export async function onRequest(context) {
  const { request, env, params } = context
  const origin = apiOrigin(env)
  if (!origin) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'VERCEL_API_ORIGIN is not set on this Cloudflare Pages project. Set it to your Vercel staging URL (no trailing slash).',
      }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
    )
  }

  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'VERCEL_API_ORIGIN is not a valid URL.' }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
    )
  }

  const init = {
    method: request.method,
    headers: forwardHeaders(request, originHost),
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    // Required for streaming request bodies in the Workers runtime.
    init.duplex = 'half'
  }

  const upstream = await fetch(targetUrl(origin, request, params), init)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}
