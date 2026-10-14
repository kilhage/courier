# SMB3 (NES) World 1-1 physics spec

Machine-readable twin: [`physics-spec.json`](physics-spec.json). The harness reads its numbers from
that file. If the two ever disagree, the JSON wins and this file is wrong.

* **Scope:** small and Super Mario on flat ground in World 1-1: walk and run, acceleration and
  deceleration, jump (held and tapped), gravity, the P-meter, and stomp/bounce. Raccoon flight, slopes,
  water and ice are out of scope except where noted.
* **Units:**
  * Velocities are in **subpx/frame = 1/16 pixel per frame**. This is SMB3's own 4.4 fixed-point
    format: high nibble = whole pixels, low nibble = sixteenths. Example: `40` = 2.5 px/frame.
    px/frame equivalents are given next to each value.
  * Accelerations are in subpx/frame per frame.
  * Time is in NTSC frames (60.0988 Hz).
  * Positions are in pixels, with y growing downward.
* **Confidence labels:**
  * **high**: read from a disassembly constant or code path and consistent with an independent source,
    or a trivially direct constant.
  * **medium**: has one source, depends on my reading of routine order or counter phase, or was derived
    by simulation.
  * **low**: a guess.
* **Every number has a source URL** in the tables below. Disassembly links point at a pinned commit of the
  public Southbird disassembly on GitHub. Only constant values and behaviour are restated here. No code
  or ROM bytes are copied into this project.

> ⚠️ **SMB1 numbers do not carry over.** SMB1 stores vertical speed as whole pixels plus a 1/256
> fraction. Its gravity depends on the jump (e.g. 0x30 rising vs 0xA8 falling) and it clamps falls at
> 5 px/frame ([Data Crystal SMB1 notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros.:Notes)).
> SMB1 acceleration has three magnitudes and doubles when Mario faces away from his motion
> ([TASVideos #5862](https://tasvideos.org/5862S)). SMB3 instead uses:
> * 4.4 fixed-point velocities,
> * two gravity values (1 or 5),
> * a 4 px/frame fall cap,
> * one acceleration rate gated by a 16-frame counter.
>
> SMB1 and SMB3 share the 1.5 / 2.5 px/frame walk and run caps, which makes the mix-up easy to miss.

---

## 0. Frame order (timing): affects every measurement

| id | value | source | conf. |
|---|---|---|---|
| `t.frame_rate` | 60.0988 frames/s (NTSC) | [nesdev forum (quotes the NESdev wiki)](https://forums.nesdev.org/viewtopic.php?t=25364) | high |
| `v.order` | Each frame runs these steps in order: apply X velocity → apply Y velocity (fall clamp first) → horizontal control → jump/gravity → P-meter → floor collision → timer decrements → enemies/stomp | [disassembly prg008 L1839](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L1839) (and L924-940); [TASVideos #8578](https://tasvideos.org/8578S) ("velocities are applied 1 frame late") | medium |

Consequences:
* Velocity computed in frame N moves Mario in frame N+1.
* On the take-off frame Mario does not move yet, but gravity is already applied once.
* A stomp sets the bounce velocity after gravity has run, so there is no gravity on the stomp frame.

## 1. Horizontal: speed caps and acceleration

| id | value | px/frame | sources | conf. |
|---|---|---|---|---|
| `h.walk_max` | **24** | 1.5 | [disasm smb3.asm L3559](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3559) `PLAYER_TOPWALKSPEED=$18`; [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "18" (hex); [TASVideos GR](https://tasvideos.org/GameResources/NES/SuperMarioBros3) "24" | high |
| `h.run_max` | **40** (B held, P not full; ground **and air**) | 2.5 | [disasm L3560](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3560); Data Crystal "28" (hex); TASVideos GR "40" | high |
| `h.pspeed_max` | **56** (B held, P full) | 3.5 | [disasm L3561](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3561); Data Crystal "38" (hex); TASVideos GR "56" | high |
| `h.abs_max` | 64 hard clamp (only slopes/slides reach it) | 4.0 | [disasm prg008 L6850](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L6850); TASVideos GR says 63 (see C6) | medium |
| `h.accel_counter` | Global counter stepped once per frame as `W = ((W & 0xF0) - 0x90) & 0xFF`, giving a **16-frame cycle** | — | [disasm prg008 L340](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L340), [L2491](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2491); [TASVideos #6274](https://tasvideos.org/6274S) ("acceleration framerules") | medium |
| `h.accel_normal` | **+1 on exactly 14 of every 16 frames** (avg **0.875** subpx/frame²) when pressing toward the motion and below the cap. Same for small/big/fire/raccoon, same with or without B, same in the air | 0.0547 px/frame² avg | [disasm XAccelMain L1141 / PseudoFrac L1167](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L1141) (whole 0, pseudo-fraction $E0); [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "around 1 per frame"; [nitsuja, TASVideos forum](https://tasvideos.org/Forum/Posts/134896) "Holding B makes absolutely no difference to the rate" | **high** (14/16 ratio); medium (which 2 frames skip, phase) |

How the 14/16 works: each frame the engine adds the pseudo-fraction ($E0) to `W` and uses the carry
as +1 or +0. For 14 of the 16 possible `W` values ($20…$F0) the sum overflows. Leftward motion uses
the 8-bit negation and also gets 14 of 16. Any **16 consecutive frames** therefore gain exactly 14,
whatever the phase. The harness only asserts on such windows.

## 2. Deceleration

| id | value | sources | conf. |
|---|---|---|---|
| `d.skid` | **exactly −2 per frame** when pressing opposite to motion, until the sign flips. All forms, **ground and air** | [disasm L1141](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L1141) (skid column: 2, fraction 0); nitsuja (B irrelevant) | high |
| `d.friction_small` | no L/R on the ground, **small** Mario: −1 on **10 of 16** frames (avg 0.625). Also applies on the ground when above the current cap (e.g. B released at 40 while still holding Right) | [disasm PseudoFrac L1167](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L1167) (small = $60) | medium |
| `d.friction_big` | same rule for Super/Fire/Raccoon: −1 on **14 of 16** frames (avg 0.875). **Big Mario stops faster than small Mario** | same table (big = $20) | medium |
| `d.no_air_friction` | In the air, no input means no slowdown. Above the cap in the air (e.g. B released mid-jump) also means no slowdown | [disasm GroundHControl L2320](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2320) | high |

## 3. Vertical: jump and gravity

| id | value | px/frame | sources | conf. |
|---|---|---|---|---|
| `v.jump_vy` | **−56** take-off velocity, same for every form. Needs a **new** A press on the ground | −3.5 | [disasm L3563](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3563) `PLAYER_JUMP=-$38`; [Data Crystal RAM map](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3:RAM_map) "(C8) Initial velocity"; Data Crystal Notes $AC5A | high |
| `v.jump_speed_bonus` | subtract `[0,2,4,8]` indexed by `|vx|>>4`: standing −56, walking (24) −58, running (40) −60, P-speed (56) −64 | — | [disasm L1204](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L1204); [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "table 00,02,04,08" | high |
| `v.gravity_held` | **+1** per frame while airborne, A held **and** vy < −32 (applied on the take-off frame too) | — | [Data Crystal Notes $ACA1](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes); [disasm L2644](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2644) | high |
| `v.gravity` | **+5** per frame otherwise (A released, or vy ≥ −32, or falling) | — | Data Crystal Notes; [Data Crystal RAM map](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3:RAM_map) "(05) Mario falling gravity"; disasm L2644 | high |
| `v.gravity_threshold` | **−32**: light gravity only while vy < −32 | −2.0 | Data Crystal Notes `CMP #$E0`; disasm `CMP #-$20` | high |
| `v.fall_cap` | vy is clamped to **64 before moving**, so Mario falls at most **4 px/frame**. The end-of-frame readout can show up to 69 | 4.0 | [disasm prg024 L21](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg024.asm#L21) `FALLRATE_MAX=$40`; Data Crystal Notes "effective value is 45 (hex)"; [TASVideos #8578](https://tasvideos.org/8578S) "nominal 69, actually 64" | high |
| `v.new_press_required` | Holding A through a landing does not re-jump | — | [disasm L2548](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2548) (take-off reads newly-pressed input, gravity reads held input) | high |

**Derived jump numbers.** These were computed by stepping the rules above frame by frame in a script independent of the game.
The harness then re-measured the same numbers from the running game and they matched.
All of these are **medium** confidence because they inherit the `v.order` reading. Tolerance in the harness is ±1 px.

| case (small or big, identical) | height (feet rise) | apex frame | airtime |
|---|---|---|---|
| standing, A held | **70.69 px** (≈4.4 blocks) | 30 | 54 frames |
| walking 24, A held | **77.75 px** | — | — |
| running 40, A held | **85.06 px** | — | — |
| P-speed 56, A held | **100.44 px** (≈6.3 blocks) | — | — |
| standing, A only on take-off frame (tap) | **20.63 px** | — | — |

## 4. P-meter

| id | value | sources | conf. |
|---|---|---|---|
| `p.levels` | 7 levels (6 arrows + P). Power is a 7-bit shift register: gain = shift in a 1, loss = shift right; `$7F` = full | [disasm smb3.asm L977](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L977), [prg008 L981](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L981) | high |
| `p.run_condition` | Gaining needs **on ground + B held + |vx| ≥ 40** at the start of the frame. In the air the meter only drains (unless the P-jump timer runs) | [disasm L2320](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2320); [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "abs($BD) >= 28 (hex)" | high |
| `p.gain_period` | **1 arrow / 8 frames**. The first arrow comes on the first qualifying frame | [disasm L981](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L981) (reload 8); Data Crystal "cycles from 7"; [Randil](https://tasvideos.org/Forum/Posts/150713) "7 on ground" | high |
| `p.loss_period` | **1 arrow / 24 frames** when not qualifying | [disasm prg008 L981](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L981) (reload $18); [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "from 23"; [Randil](https://tasvideos.org/Forum/Posts/150713) "23 in mid-air" | high |
| `p.full_hold` | At full power while running, the timer is re-armed to 16 every frame (shows 0F). So the first loss comes 16 frames after Mario stops qualifying, and later losses every 24 | [disasm prg008 L981](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L981) (reload $10); [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "LOCKED to the value 0F" | high |
| `p.pjump_timer` | Jumping with a full meter starts a 256-frame timer ($80, decremented every other frame) that keeps the meter full in the air. Small/big lose it on landing | [Data Crystal Notes](https://datacrystal.tcrf.net/wiki/Super_Mario_Bros._3/Notes) "set to 80 and decrements every other frame"; [disasm L2596](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg008.asm#L2596) | high |

Derived: holding Right+B from a standstill, |vx| reaches 40 around frame 46. The meter is full **48 frames
after the first arrow**, which is frame ≈94. P-speed 56 is reached around frame 113 (medium, ±2 frames).

## 5. Stomp and bounce

| id | value | sources | conf. |
|---|---|---|---|
| `s.bounce_vy` | **vy = −64** (−4 px/frame) on a stomp. Normal gravity rules follow, so **holding A bounces much higher** | [disasm prg000 L3940](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L3940) | high |
| `s.stomp_condition` | A stomp needs vy ≥ 0, **or** an enemy already killed since last landing. Rising into an enemy otherwise hurts Mario | [disasm prg000 L3809](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L3809) | high |
| `s.stomp_window` | Player_Y must be ≥19 px above the enemy Y. With a 32-px player frame this means the feet may be at most ~13 px below a 16-px enemy's top | [disasm prg000 L3809](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L3809) (`LDY #19`) | medium (frame-height interpretation is mine) |
| `s.chain` | 100, 200, 400, 800, 1000, 2000, 4000, 8000, then 1UP for each further stomp. Resets on landing | [disasm smb3.asm L2134](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L2134); [StrategyWiki](https://strategywiki.org/wiki/Super_Mario_Bros._3/Enemies) | high |

Derived bounce height above the stomp point (medium): **27.63 px** with A released, **104.44 px** with A held.

## 6. Enemies and items relevant to 1-1 (supporting values)

| id | value | sources | conf. |
|---|---|---|---|
| `e.walker_vx` | 8 (0.5 px/frame). Shared by the Goomba / Koopa / Para-Goomba ground-walk group | [disasm prg004 L3994](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg004.asm#L3994) | medium |
| `e.object_gravity` | 3 per frame, max 64 (standard object mover; many enemies have their own) | [disasm smb3.asm L3571](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/smb3.asm#L3571) | medium |
| `e.shell_kick_vx` | 48 (3 px/frame), plus Mario's vx/2 when kicked in his direction of travel | [disasm prg000 L2794](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg000.asm#L2794) | medium |
| `e.mushroom_vx` | 16 (1 px/frame). Initial direction depends on Mario's X | [disasm prg001 L1723](https://github.com/captainsouthbird/smb3/blob/09b1bd81a788de8ceec664a34094e84ddb463117/PRG/prg001.asm#L1723) | medium |

---

## Conflicts

Every disagreement I found is listed here, including notation mismatches that only *look* like conflicts.
None was resolved silently.

### C1: Horizontal acceleration (Data Crystal vs TASVideos)
* **Data Crystal Notes:** velocity rises "at around 1 per frame". The exact increment is marked *to-do*.
* **TASVideos:**
  * Submission #6274 talks about "acceleration framerules" that must line up, which means the rate is *not* a flat 1/frame.
  * nitsuja says B does not change the rate.
* **Chosen:**
  * Normal acceleration: **+1 on 14 of every 16 frames** (0.875 avg).
  * Skid: exactly 2/frame.
  * Friction: 10/16 (small) or 14/16 (big).
* **Why:** the disassembly shows a whole part of 0 plus a carry from pseudo-fraction $E0 added to a
  16-step global counter. That mechanism reconciles both sources:
  * "around 1" is the 0.875 average, rounded;
  * the "framerule" is the 16-frame counter.

  A literal 1/frame would reach walk speed in 24 frames instead of ≈28. The harness catches this
  (`[horizontal]` acceleration tests).

### C2: Speed caps "18/28/38" vs "24/40/56"
* **Not a real conflict.** Data Crystal writes hex ($18/$28/$38), TASVideos writes decimal, and the disassembly agrees.
* **Chosen:** 24/40/56.
* **Why list it:** someone reading "18" as decimal would build a Mario that is 25% too slow.

### C3: Terminal fall velocity 64 vs 69
* **The sources:**
  * Data Crystal: "max $40 … effective value is 45 (hex)".
  * TASVideos #8578: "nominal 69, actually 64".
  * Disassembly: clamp to $40, then move, then add gravity.
* **Chosen:** at most 4 px/frame of displacement. The velocity readout may show 69.
* **Why:** all three agree once frame order is taken into account. The harness asserts on displacement.

### C4: P-meter timer 7/23 vs 8/24, and $55D vs $515
* **The sources:**
  * Data Crystal says the timer cycles from 7 (gain) and 23 (loss).
  * nitsuja first named $55D.
  * Randil corrected this to $0515, with "7 on ground, 23 in mid-air".
* **Chosen:** periods of **8 / 24 frames**, at address $0515.
* **Why:**
  * The disassembly reloads 8 / 24 and decrements in the same frame, so RAM reads 7 / 23.
  * "Mid-air 23" is the drain timer, because the run flag cannot be set in the air.

### C5: What $E0 means
* **The sources:**
  * The Data Crystal RAM map calls `(E0)` the "Default upward velocity for jumps".
  * The Notes page and the disassembly use it as the compare operand for the light-gravity threshold (−32).
* **Chosen:** −32 is the threshold. Take-off is −56 minus the speed bonus.

### C6: Absolute X cap 63 vs 64
* **The sources:**
  * The TASVideos table says "Sliding 63" (its "Flying 23 = 1.958 px/frame" row is internally inconsistent: 23/16 = 1.4375).
  * The disassembly clamps at 64.
* **Chosen:** 64, at **medium** confidence.
* **Impact:** not reachable on flat 1-1 ground and not tested.

### C7: Acceleration-counter address $55C vs $55D
* **The sources:**
  * TASVideos #6274 says "acceleration framerules ($55d)".
  * The disassembly puts the counter that feeds the carry at $055C; $055D is a 7→0 counter.
* **Status:** unresolved. It does not change any number in the spec, and an emulator RAM watch would settle it.

---

## What the harness checks

Each section has at least one test. See `harness/tests/physics.spec.js` and `docs/VERIFICATION.md`.

| section | tests |
|---|---|
| timing / contract | API shape; identical scripts → identical traces |
| horizontal | walk cap; run cap; P-speed cap; 14-per-16 acceleration (right, left, every window); B-independence |
| deceleration | skid ground; skid air; small friction; big friction; over-cap decay; no air friction |
| vertical | 4 jump heights; apex and airtime; tap height; speed bonus; new-press rule; form-independence; gravity sequences; fall cap |
| pmeter | charge condition; 8-frame gain; 48 frames to full; 16-then-24 drain |
| stomp | −64 bounce, first chain score, enemy state; bounce heights (held and released); side contact hurts |
| enemies | Goomba 0.5 px/frame |

**Not tested (no deterministic scenario yet):** `h.abs_max`, `p.pjump_timer` duration, the full `s.chain`
beyond the first value, `s.stomp_window` edges, shells and mushrooms.
