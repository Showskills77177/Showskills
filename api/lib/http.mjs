export function parseJsonBody(req) {
  const b = req.body
  if (b == null) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  if (typeof b === 'object') return b
  return {}
}

/** Vercel / Node often leave `req.body` empty; read the stream if needed. */
export async function readJsonBody(req) {
  const b = req.body
  if (b !== undefined && b !== null) {
    if (typeof b === 'string') {
      try {
        return JSON.parse(b)
      } catch {
        return {}
      }
    }
    if (Buffer.isBuffer(b)) {
      try {
        return JSON.parse(b.toString('utf8'))
      } catch {
        return {}
      }
    }
    // Non-empty object: treat as parsed JSON. Empty `{}` may mean "not parsed" — try stream below.
    if (typeof b === 'object' && !Array.isArray(b) && Object.keys(b).length > 0) return b
  }
  if (typeof req.on !== 'function') return {}
  if (req.readableEnded) return {}
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks.map((x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)))).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

export function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}
