# Design decisions

Each entry: the decision, the alternatives, and why. Add new ones at the bottom as `D-<n>`.

## D-001: Browser game, Canvas 2D for Phase 0
- **Alternatives:** Unity; Three.js from day one.
- **Why:** It's playable from a link with no install. Phase 0 is about the feel of casting, so 2D keeps it simple. Three.js arrives in Phase 1, and only the presentation layer changes.

## D-002: Pinch to cast
- **Alternatives:** always tracing; a fist to start; dwell time.
- **Why:** Normal hand movement must never cast. A pinch is a clear, low-effort on/off switch that MediaPipe detects reliably.

## D-003: Wand point = midpoint of thumb tip and index tip
- **Alternatives:** index tip only; switching between the two on pinch.
- **Why:** A single definition means the point never jumps when a pinch starts or ends.

## D-004: Orientation-sensitive $1 recognizer (superseded by D-009)
- **Alternatives:** standard $1 (rotation-invariant); a trained ML classifier.
- **Why:** Direction carries meaning (a flick up is not a flick down). $1 needs no training data, runs in microseconds, and can learn personal templates from 5 samples.

## D-005: Trace collection lives in recognition, not perception
- **Alternatives:** perception builds traces.
- **Why:** Perception stays a dumb "where is the wand, is it pinched" layer, so the mouse source and any future input device produce traces for free.

## D-006: Browser speech recognition with a gesture-only fallback
- **Alternatives:** Whisper in the browser; a cloud speech API.
- **Why:** It costs nothing and needs no setup. It requires Chrome/Edge and internet; Whisper comes later for all browsers and offline play.

## D-007: Synthesized sound (Web Audio), no audio files
- **Alternatives:** CC0 sound packs.
- **Why:** No asset management in Phase 0, and every sound can be tuned in code. Packs can replace it later behind the same `SfxApi`.

## D-008: Talking alone never casts
- **Alternatives:** voice-only casting.
- **Why:** The game must ignore normal conversation. Casting needs a trace; voice confirms it and adds power.

## D-009: Protractor primary, $1 baseline, chosen by benchmark
- **Alternatives:** $1 only; $P point-cloud.
- **Why:** Protractor computes the best rotation in closed form instead of searching, so it stays fast as templates per spell and spell counts grow. Its original evaluation matched or beat $1, but our gestures and webcam noise are what matter. Both sit behind one interface, and the benchmark on real recorded samples decides in T14.

## D-010: $P rejected for v1
- **Alternatives:** $P / $Q point-cloud recognizers.
- **Why:** Point clouds throw away stroke order and direction, which our spells depend on (swish *then* flick). Multi-stroke runes aren't in the design; if they ever are, $P becomes another `GestureRecognizer` and the benchmark judges it.

## D-011: Interim speech confirms, never rejects
- **Alternatives:** act on interim results fully; finals only (slower).
- **Why:** Interim text keeps casts fast but changes as you speak. Letting it confirm a gesture that already agrees is safe; letting it trigger a mismatch fizzle is not.

## D-012: Power = precision, defined per spell as data
- **Alternatives:** mic volume (RMS) + gesture velocity as the main power input.
- **Why:**
  - It fits the game's idea that magic is a skill.
  - Raw volume depends on mic gain and distance, and makes the player shout, which is a problem in a hostel or late at night.
  - Rewarding speed encourages flailing, which also hurts recognition at 25–30 fps tracking.
  - Velocity is already logged; velocity, volume or hold-time can join later as extra signals with per-spell weights, without touching the quality logic.

## D-013: Smoothing only on the wand point; pinch uses raw landmarks
- **Alternatives:** filter everything.
- **Why:** The wand point needs smoothness; the pinch needs instant response. Hysteresis handles pinch noise without adding lag.
