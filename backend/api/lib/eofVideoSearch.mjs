import { ytDlpSearchMetadata } from './eofYtDlp.mjs'
import { buildEofVideoSearchQueries, rankEofVideoCandidates } from '../../../shared/eofVideoFootage.mjs'

/**
 * The "Searcher": builds our own query strategy on top of yt-dlp's free
 * `ytsearchN:` metadata search (no extra API key/cost), then ranks results
 * with our copyright-risk + relevance heuristics. No downloads happen here —
 * this is discovery only.
 *
 * @param {{ subject: string, sceneCaption?: string, topic?: string, maxQueries?: number, perQuery?: number }} input
 * @returns {Promise<Array<object>>} ranked, deduped candidates (best first)
 */
export async function searchEofVideoCandidates({
  subject,
  sceneCaption = '',
  topic = '',
  maxQueries = 3,
  perQuery = 6,
} = {}) {
  const queries = buildEofVideoSearchQueries({ subject, sceneCaption, topic }).slice(0, maxQueries)
  if (!queries.length) return []

  const byId = new Map()
  for (const q of queries) {
    let hits = []
    try {
      hits = await ytDlpSearchMetadata(q, { maxResults: perQuery })
    } catch {
      continue // one bad query shouldn't sink the whole search
    }
    for (const hit of hits) {
      if (!hit?.id || byId.has(hit.id)) continue
      byId.set(hit.id, hit)
    }
  }

  const candidates = Array.from(byId.values())
  return rankEofVideoCandidates(candidates, { subject })
}
