/**
 * EOF Production — apply CapCut-style local FFmpeg effects on the encode path.
 * Filter graphs live in shared/eofVideoEffects.mjs; this module is the render-side helper.
 */

export {
  EOF_DEFAULT_VIDEO_EFFECTS,
  EOF_EFFECT_STACKING_RULE,
  normalizeEofVideoEffects,
  videoEffectsFilterChain,
  eofVideoEffectsActive,
  eofVideoEffectIds,
  summarizeEofVideoEffects,
  listEofVideoEffects,
  listEofEffectPresets,
  pickEofVideoEffect,
} from '../../../shared/eofVideoEffects.mjs'
