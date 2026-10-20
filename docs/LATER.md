# Later

Ideas and features deliberately kept out of the current phase (the scope rule in `CLAUDE.md`). Add an entry instead of building it.

| Idea | Why it waits | Earliest phase |
|---|---|---|
| Web Worker for hand detection | Only needed if render fps drops below 55 | When measured |
| Whisper speech recognition | Works in all browsers and offline, but heavy | 4 |
| Unique comic miscast per spell | Polish after the core loop is solid | 2 |
| Mic volume (RMS) as an optional power signal | Needs a second audio stream, an AnalyserNode and per-session normalization. Only for spells where force makes sense; never required | 2–3 |
| Gesture velocity as a power signal | Data is already logged in Phase 0. Add per spell where controlled speed should matter (e.g. duel spells) | 3–4 |
| $P / $Q for multi-stroke runes | Only if rune-style spells are added. Plugs in as another `GestureRecognizer` | If needed |
| Howler.js for audio files | Only when real recorded sounds replace the synthesized ones | 1+ |
