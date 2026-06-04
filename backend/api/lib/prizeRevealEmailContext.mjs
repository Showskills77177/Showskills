import { buildPrizeRevealUrl } from '../../../shared/prizeReveal.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import { ensureQuizResumeToken } from './quizResumeToken.mjs'
import { resolveSiteUrl } from './resendConfig.mjs'
import { getTicketPrizeRevealEligibility } from './prizeRevealAuth.mjs'

/** Link for qualified post-quiz emails — main draw, all answers correct, not yet viewed. */
export async function prizeRevealUrlForTicket(ticketId, competition) {
  const comp = String(competition || DRAW_COMPETITION_SLUG).trim()
  if (!ticketId || comp !== DRAW_COMPETITION_SLUG) return ''

  const { qualified, alreadyViewed } = await getTicketPrizeRevealEligibility(ticketId, comp)
  if (!qualified || alreadyViewed) return ''

  const token = await ensureQuizResumeToken(ticketId)
  if (!token) return ''
  return buildPrizeRevealUrl(resolveSiteUrl(), token)
}
