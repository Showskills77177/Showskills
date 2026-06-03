import { COMPETITION_SHIRT_GIVEAWAY } from '../../shared/freeEntryLimits.mjs'
import { usePublicCompetition } from './usePublicCompetition'

/** Public legacy shirt giveaway — entry periods and countdown from admin. */
export function useShirtGiveawayCompetition() {
  return usePublicCompetition(COMPETITION_SHIRT_GIVEAWAY)
}
