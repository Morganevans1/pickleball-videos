# Find Your Bounce — :30 spot

A 30-second spot for Bounce Pickleball, built entirely in code. Every frame is drawn on an HTML canvas, the cast is illustrated with a posable character rig, and the music and sound effects are synthesized in Python. The logo, colors (sky blue `#11ACDB`, gold `#C9A84C`, slate `#4F758B`, navy `#0B1728`), fonts (Jost and Outfit) and the "Precision courts. Vibrant community." line all come from bouncepb.com.

| File | Use |
|---|---|
| `FindYourBounce_30_web.mp4` | Main copy: 1080p30 at about 8 Mbps, audio at −16 LUFS. |
| `FindYourBounce_30_broadcast.mp4` | High-bitrate master: up to 20 Mbps, Rec.709, audio at −24 LKFS / −2 dBTP. |
| `cast-study/` | The approved character lineup, pose sheet and motion test. |

## Story (120 BPM; one beat = 0.5 s)

| Time | Beat |
|---|---|
| 0:00–0:03 | **The Drop.** A single ball falls onto a dark court. One *pock*, then silence. |
| 0:03–0:08 | The beat forms from ball hits, one per cut: contact, tape, line, spin, kitchen, follow-through. It speeds up into a white flash. |
| 0:08–0:10 | **SOFT.** Marge and Tasha trade dinks. |
| 0:10–0:12 | **FAST.** Kenji and Dev in a hands battle. |
| 0:12–0:14 | **FIRST-TIMERS.** Jess serves into the net ("happens to everyone"), then lands the next one. |
| 0:14–0:16 | **LIFERS.** Walt and Marge rally while a long exposure of every shot they've ever hit builds up and a counter runs past 10,000. |
| 0:16–0:18 | **EVERYBODY.** One player becomes 4, then 16, then 64, all swinging on the beat. |
| 0:18–0:20 | **PRECISION COURTS. VIBRANT COMMUNITY.** Real club footage, then the club lounge photo. |
| 0:20–0:25 | Dev and Tasha's rally builds to a pop-up. Time freezes and the music cuts. *Everybody's got a bounce.* |
| 0:25–0:30 | The ball flies in along the logo's own comet streak and lands in the "B". The logo bursts out from it, the cast pops up to celebrate, and the settling bounces play the sonic logo. *Come find yours.* · bouncepb.com |

## How it's built

- `timeline.js` is the single source of truth for every cut and every ball impact. Both the picture and the sound read it, so each hit is frame-accurate.
- `characters.js` is the cast.
  - Each player is a 2D skeleton (spine, neck, shoulders, elbows, wrists, hips, knees, ankles) dressed in flat-vector clothing, hair and accessories.
  - Poses are joint angles, so swings blend smoothly. Ball paths are computed from each player's actual paddle position at the moment of contact.
- `scenes.js` is the canvas renderer. Each scene is a pure function of time, so frames render in any order and in parallel.
- `audio.py` places a hit sound at every impact in the timeline and builds the track around it.
  - The hit sound is a synthesized pickleball *pock* blended with a real hit sampled from the club footage.
  - The track itself is kick, clap, hats, an off-beat bass, pads and plucks.
  - The sonic logo is the ball settling, with each hop pitched up a C major arpeggio.
- `render.js` drives headless Chromium through Playwright. `build.sh` runs everything: frames in 4 parallel segments, then grain, Rec.709 conversion and two-pass loudness normalization.

```bash
./build.sh                # full render, about 3-4 minutes on 4 cores
SKIP_RENDER=1 ./build.sh  # re-encode and remix only
node render.js stills /tmp/stills 9.0 16.7 27.9                  # preview single frames
PAGE='character-study.html#poses' node render.js stills /tmp/cast 0  # the cast sheets
```

Requires Node with Playwright (Chromium), Python 3 with numpy and scipy, and ffmpeg. The build extracts the footage frames from `../OS_1.mp4`.

## Assets

- `assets/brand/`: the Bounce logo and "B" mark, from bouncepb.com.
- `assets/photos/community.jpg`: the lounge photo, from bouncepb.com.
- `assets/fonts/`: Jost and Outfit, under the SIL Open Font License (license files included).

## Notes

- The on-screen lines ("Everybody's got a bounce." / "Come find yours.") can also be recorded as VO. The mix leaves space for it.
- The club footage shows JOOLA court signage.
