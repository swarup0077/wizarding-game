# Later

Ideas and features deliberately kept out of the current phase (the scope rule in `CLAUDE.md`). Add an entry instead of building it.

| Idea | Why it waits | Earliest phase |
|---|---|---|
| Web Worker for hand detection | Only needed if render fps drops below 55 (see T4's measurements). **Constraint (found in the first spec review, confirmed against tasks-vision 1.1.1 in T4):** MediaPipe's loader runs the wasm glue with `importScripts()` inside a worker, which exists only in **classic** workers, while Vite's dev server serves workers only as ES modules. In 1.1.1, a module worker's `importScripts` throws `TypeError` and the loader falls back to `import()` (or `self.import`), which can only load the `_module_` wasm variant (`FilesetResolver.forVisionTasks(path, true)`; not copied to `public/` until needed). Untested. Plan for a separately built classic worker, or test the module path first in both `npm run dev` and the build | When measured |
| Whisper speech recognition | Works in all browsers and offline, but heavy | 4 |
| Unique comic miscast per spell | Polish after the core loop is solid | 2 |
| Mic volume (RMS) as an optional power signal | Needs a second audio stream, an AnalyserNode and per-session normalization. Only for spells where force makes sense; never required | 2–3 |
| Gesture velocity as a power signal | Data is already logged in Phase 0. Add per spell where controlled speed should matter (e.g. duel spells) | 3–4 |
| $P / $Q for multi-stroke runes | Only if rune-style spells are added. Plugs in as another `GestureRecognizer` | If needed |
| Howler.js for audio files | Only when real recorded sounds replace the synthesized ones | 1+ |
| Safari support | The reviewer uses Chrome on Mac. Safari's speech recognition and camera behaviour differ and would need their own testing | 1+ |
| Camera picker (several cameras) | Phase 0 uses the browser's default user-facing camera. A picker needs `enumerateDevices`, a saved `deviceId`, and handling for a camera that disappears | 1+ |
| Final webcam preview frame style | Minimal is the default and the gilded portrait stays as a second style (`previewFrame`). Choose the final one, or a new style (one CSS block plus its name in `PREVIEW_FRAMES`), once it can be judged against the real room backgrounds | 1–2 |
| Reduced detection rate while no hand is seen (about 10 Hz, back to full rate when a hand appears) | Proposed in T4 as option (a) and skipped: the Web Worker removes the main-thread cost, so this is now only a heat and battery saving (detection with no hand in view runs the costly palm search every frame: 19–31 ms on Iris Xe). A small change to the detect scheduler | When laptop heat or battery life matters |
