# Find Your Bounce — :30 spot

A 30-second spot for Bounce indoor pickleball clubs, built entirely in code. Every frame is drawn on an HTML canvas, and the music and sound effects are synthesized in Python.

| File | Use |
|---|---|
| `FindYourBounce_30_broadcast.mp4` | Broadcast master: 1920×1080, 30p, H.264 at up to 20 Mbps, Rec.709, AAC 48 kHz stereo at **−24 LKFS / −2 dBTP** (ATSC A/85). Audio fades out before the last frame. |
| `FindYourBounce_30_web.mp4` | Web, social and review copy: same picture at about 8 Mbps, audio at −16 LUFS. |

## Story (120 BPM; one beat = 0.5 s)

| Time | Beat |
|---|---|
| 0:00–0:03 | **The Drop.** A single ball falls onto a dark court. One *pock*, then silence. |
| 0:03–0:08 | The beat forms from ball hits, one per cut: contact, tape, line, spin, kitchen, follow-through. It speeds up into a white flash. |
| 0:08–0:16 | The drop, then four kinetic-type beats: **SOFT.** (top-down dinks), **FAST.** (hands battle), **FIRST-TIMERS.** (serve into the net, then one that lands), **LIFERS.** (an endless rally line). |
| 0:16–0:20 | **EVERYBODY.** One court splits into 64, then real footage from the club: *Courts built for pickleball. Only pickleball.* |
| 0:20–0:25 | The rally builds to a pop-up. Time freezes and the music cuts. *Everybody's got a bounce.* |
| 0:25–0:30 | The ball lands and the shockwave reveals the logo, with the ball as the "O". The settling bounces play the sonic logo. *Come find yours.* · bouncepb.com |

## How it's built

- `timeline.js` is the single source of truth for every cut and every ball impact. Both the picture and the sound read it, so each hit is frame-accurate.
- `scenes.js` is the canvas renderer. Each scene is a pure function of time, so frames render in any order and in parallel.
- `audio.py` places a hit sound at every impact in the timeline and builds the track around it.
  - The hit sound is a synthesized pickleball *pock* blended with a real hit sampled from the club footage.
  - The track itself is kick, clap, hats, an off-beat bass, pads and plucks.
  - The hang is a held breath of near-silence.
  - The sonic logo is the ball settling, with each hop pitched up a C major arpeggio.
- `render.js` drives headless Chromium through Playwright.
- `build.sh` runs everything: frames in 4 parallel segments, then grain, Rec.709 conversion and two-pass loudness normalization.

```bash
./build.sh                # full render, about 4 minutes on 4 cores
SKIP_RENDER=1 ./build.sh  # re-encode and remix only
node render.js stills /tmp/stills 2.0 8.7 27.9   # preview single frames
```

Requires Node with Playwright (Chromium), Python 3 with numpy and scipy, and ffmpeg. The build extracts the footage frames from `../OS_1.mp4`.

## Before air

- **Logo:** the **BOUNCE wordmark is a placeholder** set in Inter Display Black. Swap in the real logo files.
- **Voiceover:** the on-screen lines ("Everybody's got a bounce." / "Come find yours.") can be recorded as VO. The mix leaves space for it in the hang and on the end card.
- **Claims and URL:** confirm the copy claims with the client: *Indoor · year-round*, *Courts built for pickleball. Only pickleball.*, and the URL.
- **Footage:** the clip shows JOOLA court signage, so clear it with JOOLA or treat JOOLA as a partner.
