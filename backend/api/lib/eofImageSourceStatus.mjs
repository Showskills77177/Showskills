/**
 * Image-source status for EOF Production hub GET.
 * Kept separate from eofSceneImages.mjs so listing jobs does not import ffmpeg.
 */
import { isEofApImagesConfigured } from './eofApImages.mjs'
import { isEofSerpApiConfigured, getEofSerpApiLastAttempt } from './eofSerpApiImages.mjs'
import { isEofOxylabsConfigured } from './eofOxylabsImages.mjs'
import { isEofGoogleCseConfigured } from './eofGoogleImages.mjs'
import { isEofPinterestApiConfigured } from './eofPinterestImages.mjs'
import { isEofGrokImagineConfigured } from './eofGrokImagineImages.mjs'
import { isEofFreeGenConfigured } from './eofFreeGenImages.mjs'
import {
  normalizeEofImageProvider,
  eofImageProviderConfigurationNote,
} from './eofImageProviderSettings.mjs'

export function isEofPexelsConfigured() {
  return Boolean((process.env.PEXELS_API_KEY || process.env.EOF_PEXELS_API_KEY || '').trim())
}

export function eofImageSourceStatus() {
  return {
    ap: isEofApImagesConfigured(),
    serpapi: isEofSerpApiConfigured(),
    oxylabs: isEofOxylabsConfigured(),
    google: isEofGoogleCseConfigured(),
    pexels: isEofPexelsConfigured(),
    pinterestApi: isEofPinterestApiConfigured(),
    pinterestPinUrl: true,
    wikimedia: true,
    grokImagine: isEofGrokImagineConfigured(),
    freeGen: isEofFreeGenConfigured(),
    serpapiLastAttempt: getEofSerpApiLastAttempt(),
  }
}

export function eofImagesConfigurationNote(preferredProvider = 'auto') {
  const { ap, serpapi, oxylabs, google, pexels, pinterestApi } = eofImageSourceStatus()
  const preferred = normalizeEofImageProvider(preferredProvider)
  const providerNote = eofImageProviderConfigurationNote(preferred)
  if (providerNote) return providerNote
  if (ap || google || pexels || pinterestApi || serpapi || oxylabs) {
    return pinterestApi && !ap && !google && !pexels && !serpapi && !oxylabs
      ? 'Pinterest token is set, but pin search needs Pinterest app approval. Add SERPAPI_API_KEY for Google Images hit-rate.'
      : null
  }
  return 'No SerpAPI/AP/CSE/Pexels keys — falling back to Wikidata + Wikimedia Commons (Oxylabs is opt-in only).'
}
