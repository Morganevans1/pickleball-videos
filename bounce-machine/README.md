# The Bounce Machine — :30 (work in progress)

A chain-reaction spot set inside a cutaway of **Bounce Pickleball Malvern**, built in three.js and rendered headless. Every bounce travels through the real building.

**Status:** the building, the cast and the views are built, and the stills in `review/` are awaiting approval. Animation hasn't started yet.

## Layout (from the client's input)

```
 ┌──────────── BOUNCE starfield banner (end wall) ────────────┐
 │    [11]      [12]      [13]      [14]                       │
 │        [8]         [9]         [10]        ← premium bay    │
 ├──────────── MEZZANINE (upper level) ───────────────────────┤
 │  ground floor:  ▲ stairs   [ FRONT DESK ]   stairs ▲        │ ◄── MAIN DOORS
 ├─────────────────────────────────────────────────────────────┤
 │        [3]         [2]         [1]         ← premium bay    │
 │    [7]       [5]       [6]       [4]                        │
 └──────────── BOUNCE starfield banner (end wall) ────────────┘
```

## Files

| File | What it is |
|---|---|
| `src/world.js` | The building at real scale (meters), using the layout above. |
| `src/people.js` | Jointed 3D players, plus a pose library. |
| `src/textures.js` | Canvas-drawn textures: the starfield banner, JOOLA panels, corrugated walls, signage. |
| `src/main.js` | Lights, cameras, the populated club, and the views `#exterior`, `#cutaway`, `#close` and `#plan`. |
| `render.js` | Serves the folder locally and renders stills or video with headless Chromium (SwiftShader WebGL). |

```bash
npm install
node render.js stills review cutaway close exterior plan
```

Brand assets come from bouncepb.com: the Bounce logo and mark, and the JOOLA logo card from the sponsors page. The fonts are Jost (SIL Open Font License).
