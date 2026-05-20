/** Read unparsed request body (required for Stripe webhook signature verification). */
export async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8')
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf8')
  }
  if (typeof req.on !== 'function') return Buffer.alloc(0)
  if (req.readableEnded) return Buffer.alloc(0)
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      resolve(Buffer.concat(chunks.map((x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)))))
    })
    req.on('error', reject)
  })
}
