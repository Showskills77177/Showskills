/**
 * In dev, always use same-origin `/api` so Vite’s proxy is used. Calling `http://127.0.0.1:3000`
 * from `http://localhost:5173` is a different origin and breaks CORS / cookies → fetch throws.
 * Set `VITE_DEV_DIRECT_API=true` only if you intentionally bypass the proxy.
 */
const base =
  import.meta.env.DEV && import.meta.env.VITE_DEV_DIRECT_API !== 'true'
    ? ''
    : (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options
  return fetch(apiUrl(path), {
    credentials: 'include',
    /** Admin and other API GETs must not reuse a stale cached list after deletes/updates. */
    cache: 'no-store',
    ...rest,
    headers: headers ?? {},
  })
}
