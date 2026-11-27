// Shared timeline for "Find Your Bounce" (:30).
// Single source of truth for picture and sound: every ball impact the renderer
// animates is listed in HITS, and audio.py places a sound at exactly that time.
(function (root) {
  const FPS = 30;
  const DUR = 30;
  const BPM = 120; // one beat = 0.5 s, one bar = 2 s

  const HITS = [];
  const hit = (t, type, pan = 0, gain = 1, extra = {}) =>
    HITS.push(Object.assign({ t: +t.toFixed(5), type, pan, gain }, extra));

  // 0:00-0:03  THE DROP — one ball, one sound, silence.
  hit(2.0, 'bounce', 0.0, 1.0, { verb: 1.0 });

  // 0:03-0:07  The beat forms: one hit per cut.
  hit(3.0, 'pock', 0.15, 1.0, { verb: 0.7 });
  hit(4.0, 'tape', -0.3, 0.95, { verb: 0.6 });
  hit(5.0, 'bounce', 0.2, 0.9);
  hit(5.5, 'pock', 0.0, 0.9);
  hit(6.0, 'bounce', -0.2, 0.85);
  hit(6.45, 'swish', 0.2, 0.5);
  hit(6.5, 'pock', 0.35, 1.0);

  // 0:07-0:08  Acceleration into the drop.
  const ACCEL = [7.0, 7.25, 7.5, 7.625, 7.75, 7.8125, 7.875, 7.9375];
  ACCEL.forEach((t, i) => hit(t, 'pock', i % 2 ? 0.4 : -0.4, 0.7 + 0.03 * i));

  // 0:08-0:10  SOFT. (cross-court dinks: contact on the bar, bounce on the beat)
  const SOFT = { contacts: [8.0, 9.0, 10.0], bounces: [8.5, 9.5] };
  hit(8.0, 'pock', -0.45, 0.75); hit(8.5, 'bounce', 0.25, 0.55);
  hit(9.0, 'pock', 0.45, 0.75); hit(9.5, 'bounce', -0.25, 0.55);

  // 0:10-0:12  FAST. (hands battle, every 8th note)
  const FAST = [];
  for (let i = 0; i < 8; i++) { FAST.push(10 + i * 0.25); hit(10 + i * 0.25, 'pock', i % 2 ? 0.5 : -0.5, 0.8); }

  // 0:12-0:14  FIRST-TIMERS. (serve into the net, then one that lands)
  const FIRST = { serve1: 12.0, net: 12.5, hop1: 12.72, hop2: 12.88, serve2: 13.0, land: 13.5 };
  hit(12.0, 'pock', -0.65, 0.75); hit(12.5, 'net', 0.0, 0.85);
  hit(12.72, 'bounce', -0.05, 0.3); hit(12.88, 'bounce', -0.05, 0.14);
  hit(13.0, 'pock', -0.65, 0.8); hit(13.5, 'bounce', 0.55, 0.8);

  // 0:14-0:16  LIFERS. (a rally that never ends)
  const LIFERS = [];
  for (let i = 0; i < 8; i++) { LIFERS.push(14 + i * 0.25); hit(14 + i * 0.25, i % 2 ? 'pock' : 'bounce', -0.3 + 0.6 * (i / 7), 0.62); }

  // 0:16-0:18  EVERYBODY. (1 -> 4 -> 16 -> 64 courts)
  hit(16.0, 'bounce', 0, 0.8); hit(16.5, 'bounce', 0, 0.72);
  hit(17.0, 'bounce', -0.25, 0.66); hit(17.25, 'bounce', 0.25, 0.5);
  const WAVE = [];
  for (let d = 0; d < 15; d++) { WAVE.push(17.5 + d * 0.03); hit(17.5 + d * 0.03, 'pock', -0.85 + 1.7 * d / 14, 0.2); }
  hit(17.86, 'whoosh', 0.5, 0.55);

  // 0:20-0:22  THE RALLY — accelerating hands battle, ends in a pop-up.
  const RALLY = [20.0, 20.5, 20.75, 21.0, 21.25, 21.375, 21.5];
  RALLY.forEach((t, i) => hit(t, i === RALLY.length - 1 ? 'frame' : 'pock', i % 2 ? 0.45 : -0.45, 0.78 + 0.03 * i));

  // 0:22-0:25  THE HANG — silence.
  // 0:25-0:30  THE LAND + sonic logo (ball settles, each hop pitched).
  const LAND = 25.5;
  hit(LAND, 'big', 0, 1.0);
  const SETTLE = [26.2, 26.55, 26.8, 26.98, 27.1];
  SETTLE.forEach((t, i) => hit(t, 'settle', 0, 0.62 - i * 0.09, { note: i }));

  const SHOTS = [
    { s: 0, e: 3, scene: 'drop' },
    { s: 3, e: 4, scene: 'paddleMacro', p: { label: '01 / CONTACT' } },
    { s: 4, e: 5, scene: 'netTape', p: { label: '02 / THE TAPE' } },
    { s: 5, e: 5.5, scene: 'lineCall', p: { label: '03 / THE LINE', angle: -0.38, clay: true, seed: 3 } },
    { s: 5.5, e: 6, scene: 'ballMacro', p: { label: '04 / SPIN' } },
    { s: 6, e: 6.5, scene: 'lineCall', p: { label: '05 / THE KITCHEN', angle: 0.5, clay: false, seed: 7 } },
    { s: 6.5, e: 7, scene: 'paddleSwing', p: { label: '06 / FOLLOW-THROUGH' } },
    { s: 7, e: 8, scene: 'accel' },
    { s: 8, e: 10, scene: 'soft' },
    { s: 10, e: 12, scene: 'fast' },
    { s: 12, e: 14, scene: 'firstTimers' },
    { s: 14, e: 16, scene: 'lifers' },
    { s: 16, e: 18, scene: 'everybody' },
    { s: 18, e: 20, scene: 'builtFor' },
    { s: 20, e: 25, scene: 'climax' },
    { s: 25, e: 30, scene: 'logo' },
  ];

  const TL = { FPS, DUR, BPM, HITS, SHOTS, ACCEL, SOFT, FAST, FIRST, LIFERS, WAVE, RALLY, LAND, SETTLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
  else root.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);
