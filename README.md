# Recovery Coach (singles and doubles)

A physics-based coaching board for pickleball. Set up a moment in a rally, pick the shot, and
the app works out every reply the other side is likely to hit back, and where you (and your
partner) should be to handle it.

It is built for **coaches** (explain positioning in seconds, then check it stuck with a quiz)
and for **players** (learn where to be before you need it, worked out for your level and speed).

## How to use it

The app has a built-in guide: a welcome on first open, a 1-minute tour of the real controls,
and a legend of every mark on the court. Open any of them from the **?** button.

1. **Set up the moment.** Drag the players on the court. You are teal; in doubles your partner
   is pale with a teal ring; opponents are coral. Drag the yellow target to aim the shot.
2. **Pick a shot**: drive, drop, dink, lob, reset, speed-up or overhead. In the side view, drag
   the round handle to set contact height and the yellow diamond to set net clearance.
3. **Step through the rally**: 1 Incoming, 2 Your shot, 3 Their options, 4 Your move. Or press
   **Play** to watch it in slow motion.
4. **Slide the ambition** from *Get it back* to *Attack*. The recovery spot moves. The dashed
   ceiling line marks the highest level that can be reached in time.
5. **Read the numbers**: time to move, distance, steps, the pace needed (Walk → Not possible)
   and the share of likely replies returned. The note underneath says the same in plain words.
6. **Quiz with Predict mode**: the answer is hidden, the player taps where they would recover,
   then reveals how close they were.

### Doubles

Switch **Singles | Doubles** next to the app name.

- A partner and a second opponent appear, each with their own rating slider.
- **You hit / Partner hits** chooses who plays the shot, so you can ask "your partner just hit
  that, where do *you* go?"
- Either opponent may play the ball. Whoever has the better contact takes it.
- The app places **both** of you: a reply counts as covered if either of you can handle it.
- **Who covers what** tints the landing areas by who takes them: you, your partner, *call it*
  (either could), or open.
- Tap your dot or your partner's (or use the **You | Partner** switch) to see that player's numbers
  and move.

## Opening it

- **Tablet or laptop, no install:** open `dist/recovery-coach.html` in a browser. It is one
  self-contained file that also works offline (fonts fall back to system fonts).
- **Developing:** serve the repo folder with any static server and open `index.html`.

## How the model works

| Part | File | What it does |
|---|---|---|
| Ball flight | `src/engine/physics.js` | Gravity, drag (perforated-ball Cd 0.40), Magnus lift from topspin/backspin, spin decay, bounce with friction. Bounce tuned to the official 78" drop test (30–34"). Net 34" centre, 36" posts. |
| Shot solver | `src/engine/solver.js` | Launch speed and angle that land on a target with a chosen net clearance. |
| Ratings | `src/engine/ratings.js` | 2.5–7.5 (Pro from 6.0): reaction, lateral speed, aim and pace error, max drive speed, max topspin. **All values are starting estimates to tune.** |
| Every possible shot | `src/engine/launches.js` | Flies a grid of speed × angle × spin, sweeps every direction, and blurs "clears the net and lands in" by the player's error to get each shot's success chance. |
| Opponent | `src/engine/opponent.js` | Contact options (kitchen and two-bounce rules), the preferred contact, and the replies of a "plays the percentages" opponent. With someone at the net, they avoid balls that would sit up to be attacked. |
| Next-shot quality | `src/engine/quality.js` | How many reliable, punishing options a player has from a given contact height and depth. |
| Recovery (singles) | `src/engine/recovery.js` | For every spot, the chance of handling each reply. Higher ambition means arriving earlier and taking the ball where your next shot is strong. Each foot of running costs a little. |
| Recovery (doubles) | `src/engine/team.js` | The best pair of spots: a reply is covered if either player can handle it. Found by placing one player, then the other, until both settle. Also works out who covers which replies. |
| Guide | `src/guide.js` | Welcome cards, spotlight tour and legend. |

Run the checks with `npm test`, and rebuild the single file with `npm run build`.

## Known simplifications

- Spin is topspin/backspin only (no sidespin), so every shot stays in one vertical plane.
- The incoming ball is drawn for context; it does not yet change what can be hit back.
- Opponents "play the percentages"; they do not yet aim for gaps. An adversarial mode is planned.
- In doubles, the model assumes partners never both go for a ball or both leave it. The
  *call it* zones show where that risk is.
