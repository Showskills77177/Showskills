# Eyes Of Football — background music beds

Default Shorts bed registry lives in `backend/api/lib/eofMusicTracks.mjs` (`EOF_DEFAULT_MUSIC_BEDS`).

| Slot | File | Status |
|------|------|--------|
| Neutral (default) | `default-neutral.mp3` | Placeholder stub ships for pipeline testing |
| Dramatic | `default-dramatic.mp3` | Placeholder stub ships for pipeline testing |
| Upbeat | `default-upbeat.mp3` | Empty slot — drop your cleared track here |
| Calm | `default-calm.mp3` | Empty slot — drop your cleared track here |

**Do not** put Spotify, YouTube Music, or other copyrighted chart tracks here. Use only cleared / royalty-safe beds (e.g. YouTube Audio Library) that you own rights to use on YouTube.

## Replace placeholders with your cleared beds

1. In **YouTube Studio** go to **Audio library**.
2. Download royalty-free tracks you like (MP3).
3. Overwrite / add files in this folder using the names above.
4. Register in admin: **Eyes of Football → Music → Register track**  
   Or run: `npm run seed:eof-music`

Optional env: `EOF_MUSIC_BEDS_JSON` — JSON array of `{ title, mood, publicUrl, isDefault?, licenseNote? }` to override the registry without a code change.

Tracks are mixed **under** narration at low volume during **Production → Build Short**. After a Short is built, use **Remix music bed** to swap beds without re-fetching images.
