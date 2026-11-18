# Recovery Coach (singles)

A physics-based coaching board for pickleball. Set up a ball coming to your
student, pick the shot they hit, and the app shows:

1. **Incoming**: how the ball arrives (in the air or after the bounce) and the contact height.
2. **Your shot**: the real flight of the shot (speed, net clearance, where it lands).
3. **Their options**: where and when the opponent can play it, every reply they are likely to
   hit back, the most likely one and the most dangerous one.
4. **Your move**: the recovery heat map, the spot to recover to, the steps and the pace needed
   to get there in time.

The **ambition slider** on the right runs from *Get it back* (just get a paddle on the reply) to
*Attack* (arrive early, feet set, and take the ball where you have strong options). As it moves,
the recovery spot and the pace gauge update. The dashed **Your ceiling** line marks the
highest level this student can actually reach in time.

**Predict mode** hides the answer: the student taps where they think they should recover, then
reveals how close they were and whether they could have got there.

## Opening it

- **Tablet or laptop, no install:** open `dist/recovery-coach.html` in a browser. It is one
  self-contained file that also works offline (fonts fall back to system fonts).
- **Developing:** serve the repo folder with any static server and open `index.html`
  (it loads the ES modules in `src/` directly).

## How the model works

| Part | File | What it does |
|---|---|---|
| Ball flight | `src/engine/physics.js` | Gravity, drag (perforated-ball Cd 0.40), Magnus lift from topspin/backspin, spin decay, bounce with friction. Bounce tuned to the official 78" drop test (30–34"). Net 34" centre, 36" posts. |
| Shot solver | `src/engine/solver.js` | Finds the launch speed and angle that land on a target with a chosen net clearance. Shot library: drive, drop, dink, lob, reset, speed-up, overhead. |
| Ratings | `src/engine/ratings.js` | 2.5–7.5 (Pro from 6.0): reaction, lateral speed, aim and pace error, max drive speed, max topspin. Movement can be set apart from skill. **All values are starting estimates to tune.** |
| Every possible shot | `src/engine/launches.js` | Flies a grid of speed × angle × spin once per contact height, sweeps every direction, and blurs "clears the net and lands in" by the player's error to get each shot's success chance (the ease map). |
| Opponent | `src/engine/opponent.js` | Contact options along your shot (kitchen and two-bounce rules apply), their preferred contact point, and the reply set of a "plays the percentages" opponent. |
| Next-shot quality | `src/engine/quality.js` | Uses the same engine: how many reliable, punishing options the student has from a given contact height and depth. |
| Recovery | `src/engine/recovery.js` | For every spot on your side, the chance of handling each reply. At higher ambition you must be there earlier (up to 0.45 s early) and take it where your next shot is strong. Each foot of running costs a little, so the app does not send you further than needed. |

Run the checks with `npm test`, and rebuild the single file with `npm run build`.

## Known simplifications

- Spin is topspin/backspin only (no sidespin), so every shot stays in one vertical plane.
- The incoming ball is drawn for context; it does not yet change what the student can hit back.
- The opponent always "plays the percentages". An adversarial mode is planned.
- Singles only. Doubles and video-based movement measurement come later.
