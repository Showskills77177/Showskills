# Eyes Of Football — background music beds

Default Shorts bed registry lives in `backend/api/lib/eofMusicTracks.mjs` (`EOF_DEFAULT_MUSIC_BEDS`).

| Slot | File | Status |
|------|------|--------|
| Neutral (default) | `default-neutral.mp3` | Placeholder stub |
| Upbeat / Calm | `default-upbeat.mp3` / `default-calm.mp3` | Empty optional slots |
| Champions Rise | `champions-rise.mp3` | Platform bed |
| Build Different (Inst) | `build-different-inst.mp3` | Platform bed |
| Built Different (No Lead Vocal) | `built-different-no-vocal.mp3` | Platform bed |
| Champion Mind | `champion-mind.mp3` | Platform bed |
| Dream Chaser (No Lead Vocal) | `dream-chaser-no-vocal.mp3` | Platform bed |
| Eternal | `eternal.mp3` | Platform bed |
| Let's Go | `lets-go.mp3` | Platform bed |
| My Lane | `my-lane.mp3` | Platform bed |
| My Lane (Lyrics) | `my-lane-lyrics.mp3` | Platform bed |
| My Lane (No Lead Vocal) | `my-lane-no-vocal.mp3` | Platform bed |
| Rise Up | `rise-up.mp3` | Platform bed |
| This Is My Moment 1 / 2 | `this-is-my-moment-1.mp3` / `…-2.mp3` | Platform beds |

**Do not** put Spotify, YouTube Music, or other copyrighted chart tracks here. Use only cleared / royalty-safe beds that you own rights to use on YouTube.

## Production mixer

In **Production → Music bed · mixer** you can:

1. Pick a track
2. Drag the YouTube-style segment handles (which part of the song)
3. Preview the segment
4. **Remix music bed** (or Build Short) so that clip loops under the VO

## Register / seed

```bash
npm run seed:eof-music
```

Optional env: `EOF_MUSIC_BEDS_JSON` — JSON array of `{ title, mood, publicUrl, isDefault?, licenseNote? }`.
