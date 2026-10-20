# Wizarding game: rules for Claude Code

## What this is
A first-person, browser-based wizarding game inspired by Harry Potter. The player's real hand (seen by the webcam) is the wand, and their voice says the incantation. It is built in phases. **We are in Phase 0: the wand prototype.**

Before writing any code, read, in this order:
1. `docs/VISION.md`: the big picture and locked decisions
2. `docs/ARCHITECTURE.md`: layers, folders, event contracts, extension points
3. `docs/phase-0/SPEC.md`: what Phase 0 must do (requirements FR-x, acceptance criteria AC-x)
4. `docs/phase-0/TASKS.md`: the ordered task list you work through

## Non-negotiables
1. **Scope rule.** Build only what the current phase spec asks for. If something would make the build much more complex, stop and propose moving it to a later phase. Never add features "while you're there".
2. **Everything must scale.** Follow the extension points in `docs/ARCHITECTURE.md`: spells are data, layers talk through typed events, input is abstracted. A future feature should mean new files or data, not edits scattered across the codebase.
3. **High quality bar.** Tracking ≥ 25 fps, rendering ≥ 55 fps, no visible jitter, no console errors, and every failure shows a plain-language message plus a fallback.
4. **Layer boundaries.**
   - Perception never imports presentation.
   - Recognition never knows what a spell's effect is.
   - Scenes never call MediaPipe or the speech API directly.
   - Layers communicate only through the event bus.

## Stack
- TypeScript (strict), Vite, Vitest, ESLint and Prettier. UI is vanilla TS with HTML/CSS (no React).
- `@mediapipe/tasks-vision` (HandLandmarker), browser `SpeechRecognition` / `webkitSpeechRecognition`, Canvas 2D for Phase 0 visuals, Web Audio for sound.
- **Do not add any other dependency** without asking me first and explaining why.

## Environment
- Windows laptop with integrated graphics only (no dedicated GPU). Target browser is Chrome; Edge is second.
- The deployed build must also work in Chrome on macOS (Retina, DPR 2): the reviewer opens it from a link. Safari is not supported.
- Voice recognition needs internet: Chrome sends audio to Google's speech service.
- Scripts: `npm run dev`, `npm test`, `npm run build`, `npm run lint`, `npm run typecheck`.

## How we work (spec-driven)
- Work on one task from `docs/phase-0/TASKS.md` at a time, in order.
- **Start every task in plan mode.** List the files you will create or change and why, name the FR/AC items the task covers, then wait for my OK.
- After each task:
  1. Run `npm run typecheck && npm run lint && npm test`.
  2. Update `docs/PROGRESS.md`: what was done, how to verify it manually, any measured numbers.
  3. Add any design decision to `docs/DECISIONS.md` (decision, alternatives, why).
  4. Commit with the message `T<n>: <summary>`.
  5. **Stop** and tell me exactly how to verify the task in the browser.
- Explain non-obvious design decisions in plain language. I need to understand the code, not just have it.
- If a requirement is ambiguous or the spec seems wrong, ask instead of guessing.
- Every pure module (filters, recognizers, matchers, fusion, registries) gets Vitest unit tests. Keep browser-only code (camera, mic, canvas) thin so the logic stays testable.

## Code style
- Small files (aim for under 250 lines), one responsibility each. Named exports only, no default exports.
- All tunable numbers live in `src/config/tuning.ts`. No magic numbers inline.
- Perception and recognition use normalized coordinates in [0,1] (origin top-left, mirrored like a selfie). Screen pixels appear only in presentation. Convert to square units (x × aspect) before measuring a shape, distance or speed (see `docs/ARCHITECTURE.md`).
- No `any`. Every exported function gets a one-line doc comment.
