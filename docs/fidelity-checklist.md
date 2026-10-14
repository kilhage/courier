# World 1-1 gameplay checklist (SMB3, NES)

Use this for manual play-testing and as a backlog for future automated scenarios. Physics numbers live
in `physics-spec.md` and are checked by the harness, so they are only cross-referenced here.

**Status column:**
* **SOURCED**: a public source states it (URL given).
* **SOURCED (derived)**: I worked it out from a sourced constant. The reasoning is in the note.
* **GUESSED**: no source found. Treat it as a placeholder, verify it on real hardware or an emulator, then upgrade it.
* **CONFLICT**: sources disagree. The note says which way to lean.

**How to verify column:**
* **H**: covered by the Playwright harness today.
* **M**: manual play-test against a reference (NES / NSO emulator or a longplay video).
* **H\***: could become a harness scenario once the build exposes course data (see report.md, "Next steps").

Main references:
* [MW] = <https://www.mariowiki.com/World_1-1_(Super_Mario_Bros._3)>
* [FD] = <https://mario.fandom.com/wiki/World_1-1_(Super_Mario_Bros._3)>
* [GOAL] = <https://www.mariowiki.com/Goal_(Super_Mario_Bros._3)>
* [SW] = <https://strategywiki.org/wiki/Super_Mario_Bros._3/Enemies>
* [DIS] = Southbird disassembly, pinned commit `09b1bd8`, <https://github.com/captainsouthbird/smb3/tree/09b1bd81a788de8ceec664a34094e84ddb463117>
* [DC] = <https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3>

No sprites, music or level data may be copied. Re-draw and re-compose everything. Layout must be
rebuilt by eye from public maps or your own play, never extracted from a ROM.

---

## A. Course frame

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| A1 | Course is World 1-1, the first course of Grass Land, plains theme with semisolid "colorful" platforms and pipes | SOURCED | [MW] | M |
| A2 | Time limit starts at **300** | SOURCED | [MW], [FD] | M / H\* |
| A3 | One timer unit lasts **41 frames** (≈0.68 s), so 300 units last ≈205 real seconds. Timer stops while Mario is in a pipe | SOURCED (derived, medium) | [DIS prg026 L2714](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg026.asm#L2714): reload $28, decrement-then-test. Assumes the routine runs once per frame | H\* |
| A4 | Timer reaching 000 kills Mario | SOURCED | [DIS prg008 L867-L881](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L867) (time-up branch calls Player_Die) | M |
| A5 | Background music is the "Ground BGM". Use an original or licensed track, never the ripped one | SOURCED (name only) | [MW] | M |
| A6 | Falling into a bottomless pit kills Mario | SOURCED | [MW] mentions bottomless pits; [DIS prg008 L846-L857](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L846) ("Fall in a pit and die" → Player_Die) | M |
| A7 | Fixed 60 Hz simulation step, not tied to the display refresh rate | SOURCED | 60.0988 Hz NTSC, [nesdev](https://forums.nesdev.org/viewtopic.php?t=25364) | H (determinism test) |

## B. Start area

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| B1 | Mario starts near some ? Blocks with a single Goomba walking toward him | SOURCED | [FD] | M |
| B2 | First area contains semisolid platforms, Goombas, a Koopa Troopa and a pipe with a Venus Fire Trap (red on NES; a normal Piranha Plant only in the GBA remake) | SOURCED | [MW], [FD] | M |
| B3 | Two ? Blocks here: one Super Mushroom, one Super Leaf. One sits **on the ground** and needs a thrown/kicked Koopa shell to hit it | SOURCED | [MW] | M |
| B4 | A Super Mushroom emerges as a **Super Leaf** if Mario is already Super | SOURCED | [MW] Items table, [FD] | M |
| B5 | Japanese guide hint: "take the Leaf from the **6th ? Block**, then fly to the sky bonus" | SOURCED | [MW] profile (Kodansha manga guide). Ordering of ? Blocks is not otherwise documented | M |

## C. Enemies (counts on NES/SNES)

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| C1 | Goomba × 4 | SOURCED | [MW] Enemies table | H\* |
| C2 | Red Para-Goomba × 1, on the flat stretch with two Goombas after the start area | SOURCED | [MW] | H\* |
| C3 | Green Koopa Troopa × 1 | SOURCED | [MW] | H\* |
| C4 | Red Koopa Troopa × 2 (red Koopas turn at ledges, green walk off) | SOURCED | [MW] counts; ledge behaviour [SW] | H\* |
| C5 | Green Koopa Paratroopa × 3 (NES/SNES; GBA has 2), hopping, on the platforms below the cloud area | SOURCED | [MW], [FD] | H\* |
| C6 | Venus Fire Trap × 1 (red, NES/SNES) | SOURCED | [MW] | H\* |
| C7 | Green Piranha Plant: is it present on NES or only in the GBA remake? | **CONFLICT** | [MW] table lists "1 (green, up)" next to "(GBA only)" ambiguously, while its layout text mentions Piranha Plants after the pit. [FD] also says "Piranha Plants". Lean toward **present on NES** and check against a longplay | M |
| C8 | Goomba / Koopa walk at **0.5 px/frame** | SOURCED | spec `e.walker_vx` ([DIS prg004 L3994](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg004.asm#L3994)), medium | **H** |
| C9 | Stomping a Goomba squashes it, gives 100 pts and bounces Mario at −4 px/frame. Holding A bounces much higher | SOURCED | spec `s.*` | **H** |
| C10 | Consecutive stomps without landing: 100, 200, 400, 800, 1000, 2000, 4000, 8000, then 1UP each | SOURCED | [SW]; [DIS smb3.asm L2134](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L2134) | H (first value only), M |
| C11 | Touching an enemy from the side or below hurts Mario, unless he already killed something this airtime | SOURCED | spec `s.stomp_condition` | **H** (side contact) |
| C12 | Stomping a Koopa Troopa leaves a shell. Touching or kicking the shell sends it at **3 px/frame** (plus half of Mario's speed when kicked forward). Shells kill other enemies and hit blocks | SOURCED (medium) | [DIS prg000 L2794](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L2794); [SW] (shell uses) | M / H\* |
| C13 | Holding B while touching a shell picks it up. Releasing B kicks it | SOURCED | [DIS prg000 ObjState_Held](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L2810) ("If Player is NOT holding B button, jump to Player_KickObject") | M |
| C14 | Stomping a Para-Goomba / Paratroopa removes its wings first (walks as a normal Goomba / Koopa) | SOURCED (general SMB3 rule) | [SW] (stated for giant Paratroopas; same family). Medium | M |
| C15 | Venus Fire Trap: rise and fire timing, number of fireballs, aim | GUESSED | Not researched. Measure from footage | M |
| C16 | Goomba spawns when the camera reaches it, and does not respawn while on screen | GUESSED | Not researched | M |

## D. Blocks and objects

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| D1 | Objects present: ? Block, Brick, Cloud Block, Ground, Pipe, Semisolid Platform, Switch Block (P Switch), White Block, Wood Block | SOURCED | [MW] Objects list | M |
| D2 | A stack of Brick Blocks, one of which holds a **P Switch** | SOURCED | [MW] | M |
| D3 | Pressing the P Switch turns the bricks into coins **temporarily**. 18 coins can be collected this way | SOURCED | [MW] (coin note), [FD] ("temporarily") | M |
| D4 | P Switch duration and its music change | GUESSED | Not researched | M |
| D5 | Raccoon Mario can tail-swipe the correct brick from the side without breaking the others | SOURCED | [MW] coin note | M |
| D6 | Small Mario bumping a brick only bumps it. Super Mario breaks it | GUESSED (standard SMB3 behaviour, not sourced here) | — | M |
| D7 | Bumping a block from below defeats or flips an enemy standing on it | SOURCED | [TASVideos GR](https://tasvideos.org/GameResources/NES/SuperMarioBros3) (block-bump section: Goomba defeated, Koopa flips, mushroom hops) | M |
| D8 | Semisolid platforms: Mario can jump up through them and land on top | SOURCED (existence) / GUESSED (exact pass-through rules) | [MW] | M |
| D9 | The "very tall pipe" near the end has an interrupted part that Mario jumps through | SOURCED | [MW] | M |

## E. Items and coins

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| E1 | 57 coins in total: 34 in open air, 5 from ? Blocks, 18 from P-Switch bricks | SOURCED | [MW] | H\* |
| E2 | Super Mushroom × 3 / Super Leaf × 3 (which one appears depends on Mario's form) | SOURCED | [MW] | M |
| E3 | 1-Up Mushroom × 1, in a ? Block in the sky cloud area | SOURCED | [MW] | M |
| E4 | Super Mushroom moves at **1 px/frame**. Its initial direction depends on Mario's X | SOURCED (medium) | [DIS prg001 L1723](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg001.asm#L1723) | H\* |
| E5 | Super Leaf drifts down side to side (pattern, speed) | GUESSED | Not researched | M |
| E6 | Small → Super on Mushroom. Super → Raccoon on Leaf. Small + Leaf → Raccoon | GUESSED (standard; not sourced here) | — | M |
| E7 | When hit, any powered form drops to **Super Mario** in the North American release (Small in the Japanese release) | SOURCED | [DC] | M |
| E8 | Post-hit invulnerability length | GUESSED | Not researched. The game uses 120 frames as a placeholder | M |

## F. Secrets

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| F1 | On the flat ground with the Goombas, Raccoon Mario with a full P-meter can fly up to a secret **cloud area** with coins and a ? Block holding a 1-Up | SOURCED | [MW], [FD] | M |
| F2 | Flying further reaches the top of the tall pipe. Inside is a bonus room with coins forming a large **"3"** | SOURCED | [MW], [FD] | M |
| F3 | The pipe out of the "3" room exits near the end of the level (it is the pipe just before the goal) | SOURCED | [MW], [FD] | M |
| F4 | P-meter physics needed for F1: full after ~94 frames of Right+B from rest, needs ground and |vx| ≥ 2.5 px/frame | SOURCED | spec `p.*` | **H** |

## G. Goal

| # | Check | Status | Source / note | Verify |
|---|---|---|---|---|
| G1 | Goal is a box at the far right, in a dark area, cycling Mushroom / Flower / Star cards | SOURCED | [GOAL]; dark goal area [FD] | M |
| G2 | Touching it awards the card shown at that moment and displays "COURSE CLEAR! YOU GOT A CARD" | SOURCED | [GOAL] | M |
| G3 | The roulette starts when the goal is approached. A full-P run hitting it at 45° usually gets a Star | SOURCED | [GOAL] | M |
| G4 | Cards are kept across courses. Three cards → extra life. Three identical → firework: Mushroom 2UP, Flower 3UP, Star 5UP | SOURCED | [GOAL] | M |
| G5 | After the card, Mario walks off to the right automatically (end-of-level run-off) | SOURCED (existence) | [DIS smb3.asm L1609](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L1609) `Player_EndLevel` run-off counter | M |
| G6 | Remaining time converts to score at **50 points per timer unit** | SOURCED (derived, medium) | [DIS prg000 L609](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L609) `TimeBonus_Score` "500 and 50" (500 per tens digit, 50 per ones digit). Score is stored ÷10 per [DC RAM map](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3:RAM_map) | M |
| G7 | Card roulette cycle speed (frames per card) | GUESSED | Not researched | M |

## H. Player feel (physics cross-reference, all automated)

| # | Check | Status | Verify |
|---|---|---|---|
| H1 | Walk 1.5, run 2.5, P-run 3.5 px/frame | SOURCED | **H** |
| H2 | Acceleration 14/16 subpx/frame², skid 2, friction 10/16 (small) and 14/16 (big), no air friction | SOURCED | **H** |
| H3 | Standing jump ≈70.7 px held / ≈20.6 px tapped; P-speed jump ≈100.4 px | SOURCED (derived) | **H** |
| H4 | Fall cap 4 px/frame; gravity 1 (held, rising fast) or 5 | SOURCED | **H** |
| H5 | P-meter 8 frames/arrow up, 24 down, first drop 16 frames after stopping | SOURCED | **H** |
| H6 | Holding A through a landing does not re-jump | SOURCED | **H** |
| H7 | Raccoon flight and tail wag (needed for F1/F2) | out of physics-spec scope. Constants exist in [DIS smb3.asm L3564-3565](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3564) (tail-wag vy $10, fly vy −$18) but are **not** verified | M |

---

**Counts:** 63 items in total.
* SOURCED, including derived items and the H rows: 52.
* GUESSED: 8 (C15, C16, D4, D6, E5, E6, E8, G7).
* Partly guessed: 1 (D8: sourced existence, guessed pass-through rules).
* CONFLICT: 1 (C7).
* Out of physics-spec scope and unverified: 1 (H7).

Before shipping 1-1, every guessed item should become SOURCED, either by direct emulator measurement or
from a frame-counted longplay.
