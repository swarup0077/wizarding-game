# Art direction

One look for everything the player sees outside the stage: an old-world wizarding style, inspired by Harry Potter, that is unmistakable at a glance yet built entirely from original or freely licensed material. The UI kit (`src/ui/`, gallery at `?dev=ui`) implements it. Every HUD element from T3 on uses the kit.

**The feeling:** a candlelit study at night. Night-blue stone behind; warm parchment, iron-gall ink and old gilt in front. Magic is light: the wand's gold, each spell's own colour. Nothing looks like an app.

## Palette
All colours are tokens in `src/ui/theme.css`; components never use raw colours.

| Family | Tokens | Use |
|---|---|---|
| Night blue | `--night-950` … `--night-700` | The stage, and anything that sits directly on it |
| Parchment | `--parchment-100` (light), `-200`, `-300` (darkest text may sit on), `--parchment-edge` | Panels, cards, notes, the letter |
| Ink | `--ink-900` (iron-gall black-brown), `--ink-700` (faded), `--ink-green` (the letter's address), `--ink-red` (start dots, P grade) | All text on parchment |
| Candle gold | `--gold-200` … `--gold-800` | Gilt frames, titles on the night stage, highlights |
| Sealing wax | `--wax-300` … `--wax-700` | Wax-seal buttons |
| Grades | `--grade-o` (antique gilt), `--grade-e` (slate blue), `--grade-a` (bronze), `--grade-p` (red ink) | Grade badges |
| House pairs (Phase 2) | scarlet / gold, green / silver, blue / bronze, yellow / black | The Sorting. Until then `--house-primary` / `--house-secondary` are neutral gold. |

**Contrast is enforced:** `src/ui/contrast.test.ts` checks every text colour against every parchment shade (WCAG AA: 4.5:1 body, 3:1 large). The green handwriting is held to the body-text bar, because script strokes are thin. A new text colour must be added to that test.

## Typography
All OFL-licensed, self-hosted in `public/fonts/` (see its README).

| Role | Font | Rules |
|---|---|---|
| Titles, spell names | Cinzel Decorative | 24 px and up. Ligatures off in titles; spell names keep them. |
| Labels, buttons | Cinzel Decorative | Uppercase, 0.08 em tracking, 13–16 px, ligatures off, bold. Check new labels at DPR 1 for legibility. |
| Body, hints | IM Fell English (regular, italic) | 16 px minimum. Its uneven, old-print letterforms are part of the look; keep body text short. |
| Handwriting | Pinyon Script, in green or brown ink | 30 px minimum; addresses and personal notes only, never instructions. |

## Materials
Procedural only: CSS gradients and SVG filters, no image files (NFR-8).
- **Parchment:** warm base, fine grain and slow stains (SVG noise, `materials.css`), darker aged edges, a slightly torn outline (`#wg-rough-edge`). The paper is its own layer, so filters never touch text.
- **Ink:** text sits in the paper; fresh ink bleeds slightly before settling.
- **Gilt:** gold gradients with brushed streaks, an inner bead moulding, original corner flourishes.
- **Hairline:** the webcam preview's default frame is quiet on purpose: a faint parchment hairline (`--line-hairline`), soft corners (`--radius-soft`) and a soft shadow (`--shadow-soft`), so the stage and the magic stay in front. The gilded portrait is a second frame style; the final choice waits for the real room backgrounds (`docs/LATER.md`).
- **Wax:** a lit dome, darker rim, irregular pour (`#wg-wax-rim`), a pressed ring and an original mark (star, or star over wand). Never a crest or letter.
- **Stone:** the stage (T1), dim and cool, so warm materials glow against it.

## Motion
Things in this world are unrolled, inked, stamped and lit. They don't slide or bounce.
- **Unroll:** panels open from their top edge (scale, then ink settles in).
- **Ink-bleed:** words appear as a soft blur that sharpens.
- **Quill:** spell shapes draw themselves in one stroke.
- **Seal stamp:** a pressed seal shrinks and darkens; hover tilts it toward the light with a glint.
- **Flicker:** candle-lit gilt (the O badge) brightens in irregular steps, never a smooth pulse.
- **Never:** slide-ins, bounces, spring overshoot, spinners, toggles that look like phone switches.
- **Performance rules:** continuous animations change only `transform` and `opacity`. SVG filters go on elements that don't animate. HUD panels are built once and shown or hidden with opacity, not recreated: a fresh filtered panel costs one dropped frame at DPR 2 (measured in T2b).
- **Reduced motion:** with `prefers-reduced-motion`, everything appears in its final state.

## Spell colour identities
Used by spellbook pages (T7) and effects (T11). The trail stays the wand's own gold for every spell.

| Spell | Light | Ink (text on parchment) | Character |
|---|---|---|---|
| Lumos | `--spell-lumos` silver-white | `--spell-lumos-ink` | Cool, clear, still |
| Wingardium Leviosa | `--spell-leviosa` pale sky | `--spell-leviosa-ink` (feather lavender) | Airy, soft, drifting |
| Incendio | `--spell-incendio` ember orange | `--spell-incendio-ink` | Hot, flickering, rising |

## Sound direction (T12)
Synthesized with Web Audio, warm and close, like instruments in a small stone room.
- Lumos: a clear bell with a slow shimmer.
- Leviosa: an airy whoosh, soft and rising.
- Incendio: a low roar (noise, low-pass sweep) with crackle.
- Fizzle: a dry "pfft" and a sputter.
- The trace shimmer follows speed, gently.
- No melodies or motifs that recall the film scores. In particular, avoid celesta or music-box waltz figures in a minor key.

## IP guardrails
This is a personal, non-commercial fan project. It may evoke the world; it must not copy it.
- **No logo lettering** and no lookalike fonts (no lightning-bolt letterforms, no "Harry P"-style fonts).
- **No crests,** house or school: seals carry original star or wand marks; house colours are colour pairs only.
- **No film music,** and nothing written to sound like it.
- **No actor likenesses,** no film stills, no traced art.
- **No book or film quotes.** Every on-screen line is written fresh, including the letter. Short spell incantations and grade names are used as game terms, not quotations.
- **The game title** is our own and still to be decided (`GAME_TITLE` in `src/ui/brand.ts`, set in T13), in our own lettering.
- **Assets:** original, CC0 or OFL only, with the licence committed next to the file.

**Checklist before committing art, sound or text:**
1. Is every asset original, CC0 or OFL, with its licence in the repo?
2. Could any lettering be mistaken for an official logo?
3. Is any line of text copied or closely paraphrased from a book or film?
4. Does any sound recall a film theme?
5. Does all text pass the contrast test (`npm test`)?
