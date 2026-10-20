# How to run Phase 0 with Claude Code

## 1. Set up (PowerShell)
```powershell
cd C:\projects
# unzip wizarding-game.zip here, so you get C:\projects\wizarding-game
cd wizarding-game
git init
code .
claude
```
You'll need Node.js 20 or newer and Chrome.

## 2. First prompt: understand before building
Paste this:

> Read CLAUDE.md and every document it lists, in order. Don't write any code yet. Reply with:
> 1. A 10-line summary of Phase 0 in your own words.
> 2. Anything in the spec that is ambiguous, contradictory, risky, or likely to fail on my machine (Windows, Chrome, integrated graphics).
> 3. Your plan for T0: the files, the FR/AC items it covers, and the commands you'll run.
> Then wait for my OK.

Fix the spec with it **before** T0 if it finds real problems. A wrong spec costs more than a slow start.

## 3. Each task
Switch to plan mode (Shift+Tab), then paste:

> Start T<n> from docs/phase-0/TASKS.md. Show me your plan first: files to create or change, the FR/AC items covered, the tests you'll write, and any design decision I should weigh in on.

After you approve, it builds, tests, updates `PROGRESS.md` and `DECISIONS.md`, commits, and stops with verification steps.



## 5. When something feels off
- **Feel problems** (jittery trail, missed pinches, wrong spells):
  > Open the debug overlay data for this problem and tell me which number in tuning.ts to change and why, before changing anything.
- **Scope creep:**
  > Is this in the Phase 0 spec? If not, note it in docs/LATER.md and leave it out.
- **A long session:** start a fresh Claude Code session per task or two. `CLAUDE.md`, `PROGRESS.md` and `DECISIONS.md` carry the context forward.
