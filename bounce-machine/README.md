# The Bounce Machine — :30

A chain-reaction spot set inside a cutaway of **Bounce Pickleball Malvern**, built in three.js and rendered headless. Every bounce travels through the real building.

**Output:** `BounceMachine_30.mp4` (a copy of `out/BounceMachine_30.mp4`). Run `./build.sh` to rebuild it: 1080p30, about 5–7 minutes on 4 cores.

## The chain reaction

| Time | Beat |
|---|---|
| 0:00 | Outside. A ball drops onto the roof, the roof flies off, the front walls sink and the fabric ceiling gathers away. |
| 0:03 | The ball dings the front-desk bell, hops up the side flight, across the landing and up the center flight, one note per step. |
| 0:07 | It clinks the cups on the lounge table (the sofa crowd cheers), rides the mezzanine railing, and drops into the 1–3 bay. |
| 0:10 | Relay: Tasha (court 1) to Kenji (court 2) to Dev (court 3), popping over the JOOLA barriers, which flex like pinball bumpers. Dev hits it into the ball hopper. |
| 0:13 | The hopper tips over, and 44 balls bounce across courts 7, 5, 6 and 4. This is a precomputed, deterministic physics simulation. |
| 0:17 | Marge lobs one ball the length of the building to Walt on court 10. |
| 0:21 | Walt sends it to court 9 for a hands battle (Jess and her opponent). The pop-up hangs, and Jess smashes it over courts 11–14. |
| 0:25 | The ball lands in the cut-out of the "B" on the starfield banner. The banner lights up and everyone celebrates. |
| 0:27 | End card: the logo, "Find your pickleball people.", bouncepb.com, and Malvern · Philadelphia · Baltimore. |

## Layout (from the client's input)

```
 ┌──────── BOUNCE starfield banner (end wall) ────────┐
 │    [11]     [12]     [13]     [14]                  │   courts 8-14: "EAST"
 │        [8]       [9]       [10]     ← premium bay   │
 ├──────── MEZZANINE (lounge, pro shop, high-tops) ────┤
 │   lobby: side stairs rise inward → landing →        │
 │          10 steps up the middle; FRONT DESK in front│ ◄── MAIN DOORS
 ├──────────────────────────────────────────────────────┤
 │        [3]       [2]       [1]      ← premium bay   │   courts 1-7: "WEST"
 │    [7]      [5]      [6]      [4]                   │
 └──────── BOUNCE starfield banner (end wall) ────────┘
```
Facing the desk from the main doors, courts 1–7 are on the right and 8–14 on the left, matching the check-in sign over the desk.

## Files

| File | What it is |
|---|---|
| `src/world.js` | The building at real scale (meters), using the layout above. |
| `src/people.js` | Jointed 3D players, plus a pose library. |
| `src/textures.js` | Canvas-drawn textures: the starfield banner, JOOLA panels, corrugated walls, signage. |
| `src/anim.js` | The choreography: ball flights between real paddle contact points, pose tracks for every person, reactions, the avalanche simulation, the camera path, and the sound cues. Every frame is a pure function of time. |
| `src/main.js` | Lights, cameras, the views (`#exterior`, `#cutaway`, `#close`, `#desk`, `#plan`, `#anim`) and the end card. |
| `audio.py` | The soundtrack: a sound at every cue, plus a 120 BPM score. It reuses the synth blocks in `../find-your-bounce/audio.py`. |
| `render.js` | Serves the folder locally and renders stills or video with headless Chromium (SwiftShader WebGL). |

```bash
npm install
./build.sh                                        # full spot
node render.js frames /tmp/f 3.0 12.75 25.2       # preview single moments
node render.js stills review cutaway close desk exterior plan
```

Brand assets come from bouncepb.com: the Bounce logo and mark, and the JOOLA logo card from the sponsors page. The fonts are Jost (SIL Open Font License).
