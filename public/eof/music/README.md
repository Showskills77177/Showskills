# Eyes Of Football — background music beds

Placeholder beds (`default-neutral.mp3`, `default-dramatic.mp3`) ship for local/staging renders so Build Short works without extra setup. Replace them with real tracks before publishing to YouTube.

1. In **YouTube Studio** go to **Audio library**.
2. Download royalty-free tracks you like (MP3).
3. Overwrite files here, e.g.:
   - `default-neutral.mp3` — general narration (mark as **default** in admin)
   - `default-dramatic.mp3` — facts / records / hype

4. Register in admin: **Eyes of Football → Music → Register track**  
   Or run: `npm run seed:eof-music`

Tracks are mixed **under** narration at low volume during **Production → Build Short**.

**License:** YouTube Audio Library tracks are for use on YouTube. Do not use in off-platform ads without checking each track’s terms. Placeholder noise beds are only for pipeline testing.
