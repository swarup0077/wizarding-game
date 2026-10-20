# Vision

## The game
A first-person wizarding game in the browser, inspired by Harry Potter. You learn and cast spells with **your own hand as the wand** (tracked by the webcam) and **your voice for the incantation**. Magic is a skill: how cleanly you trace the shape and say the word decides how strong the spell is.

## Locked decisions
| Decision | Choice |
|---|---|
| View | First person. Your wand hand is visible on screen. |
| Wand | Your real hand via webcam (MediaPipe). Mouse fallback for development and accessibility. |
| Casting | Pinch (thumb + index) = wand ready. Trace the shape while pinched, release to finish. |
| Voice | Required by default. Silent casting is a later unlock. Gesture-only mode exists for when the mic is unavailable. |
| Spell power | Precision: a cleaner shape and a clearer incantation make a stronger spell. Rules are per spell, so later spells can add other signals. |
| Movement (Phase 1+) | Left hand on WASD, right hand in the air. |
| Platform | Browser. Canvas 2D in Phase 0; Three.js from Phase 1. Playable from a link. |
| Quality | Very high polish where the player looks every second: wand trail, spell effects, lighting, sound. |

## Scope rule
If a feature makes the build too complex, cut it now and add it later, after the committed parts are finished. Everything is built so it can scale up without rewrites (see `ARCHITECTURE.md`).

## Roadmap
| Phase | Goal |
|---|---|
| **0, wand prototype** (current) | Webcam + glowing trail + 3 spells (Lumos, Wingardium Leviosa, Incendio) recognised by shape and voice, on a 2D practice stage. If this doesn't feel magical, nothing else matters. |
| 1, one room | 3D first-person room (Three.js + Rapier). The same 3 spells affect real 3D objects. The wand target becomes a ray into the scene. |
| 2, First Year slice | Letter → wand shop → sorting → Charms class → dungeon → troll boss. Add Alohomora, Reparo, Nox. |
| 3, more classes | Potions, Herbology, Flying. Year 2 spells, spell combos. |
| 4, social and AI | Multiplayer duels, LLM-driven characters, polish, deployment. |

## v1 (First Year) scope: committed vs later
| Area | v1, committed | Later |
|---|---|---|
| Casting | Hand wand, pinch, voice, 3 power tiers, one fizzle per spell | Unique comic miscasts, silent casting |
| Spells | Lumos/Nox, Leviosa, Alohomora, Incendio, Reparo | Year 2+ spells, combos |
| Wand shop | 5 wands; the right one is random; cosmetic only | Wand traits that affect spells |
| Sorting | Scripted questions, spoken answers matched by keyword | Free conversation with an LLM |
| Castle | 6 scenes | Moving staircases, more rooms |
| Characters | Scripted hint lines | LLM portraits and ghosts |
| Map | Simple minimap | Voice-unlocked map with named footprints |
| Fire | Burns what it touches | Spreading fire |
| Classes | Charms | Potions, Herbology, Creatures, Flying |
| Multiplayer | None | Duels with beam lock |
| Extras | House points, local saves | Collectibles, live-weather ceiling |

## IP note
This is a personal, non-commercial fan project. Do not use official logos, film music, or actor likenesses. All art, sound, and text in the game are original or CC0 (fonts: OFL), and on-screen text must not quote the books or films. The full guardrails and a pre-commit checklist are in `docs/ART_DIRECTION.md`.
