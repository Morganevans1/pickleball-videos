#!/usr/bin/env python3
"""Soundtrack for "The Bounce Machine" (:30).

Every impact the animation produces is a cue in out/cues.json (exported from the page with
`node render.js cues out/cues.json`). This places a sound at exactly that time and builds a
120 BPM track around the chain reaction. Synth building blocks are shared with ../find-your-bounce.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'find-your-bounce'))
import audio as A  # noqa: E402  (pock, bounce, kick, clap, hat, crash, pads, filters, reverb …)

SR, DUR = A.SR, 30.0
A.N = N = int(SR * DUR)
BEAT = 0.5
RNG = np.random.default_rng(11)
tt, filt, declick, mtof = A.tt, A.filt, A.declick, A.mtof
cues = json.load(open(sys.argv[1] if len(sys.argv) > 1 else HERE / 'out' / 'cues.json'))


def modes(parts, d, click=0.0, seed=0):
    r = np.random.default_rng(seed)
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * f * t + r.random() * 6.28) * np.exp(-t / tau) for f, a, tau in parts)
    if click:
        s += click * filt(r.standard_normal(len(t)), 'highpass', 2500) * np.exp(-t / 0.002)
    return declick(s / np.abs(s).max())


def roof_bonk(seed):
    s = modes([(212, 1.0, 0.32), (507, 0.6, 0.22), (835, 0.45, 0.15), (1340, 0.3, 0.09), (2210, 0.18, 0.05)], 1.0, 0.6, seed)
    p = A.pock(seed, 0.8)
    s[:len(p)] += 0.6 * p
    return s / np.abs(s).max()


def desk_bell(seed):
    f = 2350
    return modes([(f, 1.0, 1.1), (f * 2.76, 0.45, 0.5), (f * 5.4, 0.2, 0.22), (f * 0.5, 0.12, 0.6)], 2.0, 0.5, seed)


def marimba(midi, seed):
    f = mtof(midi)
    s = modes([(f, 1.0, 0.42), (f * 4, 0.28, 0.07), (f * 9.9, 0.06, 0.02)], 0.8, 0.25, seed)
    p = A.pock(seed, 0.5, real=False)
    s[:len(p)] += 0.25 * p
    return s / np.abs(s).max()


def clink(seed):
    s = np.zeros(int(0.5 * SR))
    for k in range(4):  # several cups
        c = modes([(3100 + 300 * k, 1.0, 0.09), (4700 + 250 * k, 0.7, 0.06), (6300, 0.4, 0.04), (8100, 0.25, 0.02)], 0.25, 0.4, seed + k)
        i0 = int((0.012 + 0.03 * k) * SR); s[i0:i0 + len(c)] += c * (1 - 0.15 * k)
    return s / np.abs(s).max()


def rail_tick(seed):
    return modes([(2850, 1.0, 0.02), (5150, 0.6, 0.012), (1200, 0.3, 0.03)], 0.12, 0.5, seed)


def boing(seed):
    t = tt(0.7)
    f = 140 * (1 + 0.25 * np.sin(2 * np.pi * 22 * t) * np.exp(-t / 0.18))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    s += 0.5 * A.filt(np.random.default_rng(seed).standard_normal(len(t)), 'lowpass', 500) * np.exp(-t / 0.03)
    p = A.pock(seed, 0.9); s[:len(p)] += 0.7 * p
    return declick(s / np.abs(s).max())


def clang(seed):
    return modes([(310, 1.0, 0.55), (873, 0.7, 0.35), (1517, 0.5, 0.22), (2380, 0.35, 0.12), (3710, 0.2, 0.06)], 1.4, 0.8, seed)


def cheer(seed, d=2.6):
    r = np.random.default_rng(seed)
    t = tt(d)
    out = np.zeros(len(t))
    for v in range(14):  # a small crowd: formant-ish noise voices + a few "woo" glides
        lo = 350 + r.random() * 500
        voice = filt(r.standard_normal(len(t)), 'bandpass', [lo, lo * (2.2 + r.random())])
        st = r.random() * 0.25
        env = np.clip((t - st) / 0.12, 0, 1) * np.exp(-np.clip(t - st - 0.5, 0, None) / (0.6 + r.random() * 0.6))
        out += voice * env * (0.5 + r.random())
        if v % 3 == 0:
            f0 = 280 + r.random() * 200
            f = f0 * (1 + 0.6 * np.clip((t - st) / 0.35, 0, 1)) * (1 + 0.02 * np.sin(2 * np.pi * 5.5 * t))
            woo = filt(A.saw(1.0, t, 0, 1) * 0 + np.sin(2 * np.pi * np.cumsum(f) / SR), 'lowpass', 1800)
            out += 0.35 * woo * env
    for k in range(10):  # scattered claps
        c = A.clap(int(r.integers(1e6)))
        i0 = int((0.15 + r.random() * (d - 0.8)) * SR); n = min(len(c), len(out) - i0)
        out[i0:i0 + n] += 0.5 * c[:n] * (1 - i0 / len(out))
    return declick(out / np.abs(out).max())


def billow(seed):
    t = tt(1.4)
    n = filt(np.random.default_rng(seed).standard_normal(len(t)), 'lowpass', 900)
    return n * np.sin(np.pi * t / 1.4) ** 2 * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))


def birds(seed):
    r = np.random.default_rng(seed)
    t = tt(0.25)
    f = 3200 + 1400 * np.sin(np.pi * t / 0.25) * (1 if r.random() < 0.5 else -0.5)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.25) ** 2


STEP_NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95]


def main():
    sfx, verb, drums, bass, pad, plk = (A.Bus() for _ in range(6))
    pan_of = lambda x: float(np.clip((x - 18.5) / 22, -0.8, 0.8)) if x is not None else 0.0
    for i, c in enumerate(cues):
        t0, ty, x = c['t'], c['type'], c.get('x'); seed = 3000 + i; pan = pan_of(x); g = 1.0
        if ty == 'roof': s, g = roof_bonk(seed), 1.0
        elif ty == 'bell': s, g = desk_bell(seed), 0.8
        elif ty == 'step': s, g = marimba(STEP_NOTES[c.get('note', 0) % len(STEP_NOTES)], seed), 0.55
        elif ty == 'bounce': s, g = A.bounce(seed), c.get('gain', 0.75)
        elif ty == 'pock': s, g = A.pock(seed), 0.95
        elif ty == 'frame': s, g = A.frame_hit(seed), 0.9
        elif ty == 'clink': s, g = clink(seed), 0.75
        elif ty == 'tick': s, g = rail_tick(seed), 0.45
        elif ty == 'boing': s, g = boing(seed), 0.9
        elif ty == 'clang': s, g = clang(seed), 0.9
        elif ty == 'cheer': s, g = cheer(seed), 0.42 * c.get('gain', 1)
        elif ty == 'billow': s, g = billow(seed), 0.5
        elif ty == 'whoosh': d = c.get('dur', 0.8); s, g = A.whoosh(d, 300, 5000, seed, 0.85), 0.35; t0 -= d * 0.3
        elif ty == 'big':
            s = A.pock(seed, 1.25)
            tb = tt(2.4); boom = np.sin(2 * np.pi * np.cumsum(46 + 70 * np.exp(-tb / 0.05)) / SR) * np.exp(-tb / 1.0)
            sfx.add(declick(boom), t0, 0, 1.1); sfx.add(A.crash(seed), t0, 0, 0.26); verb.add(A.crash(seed), t0, 0, 0.15)
            g = 1.1
        else:
            continue
        sfx.add(s, t0, pan, g)
        verb.add(s, t0, pan, g * (0.5 if ty in ('step', 'bell', 'clink', 'big', 'roof') else 0.2))
    # the avalanche rattle bed (dozens of small bounces under the timed ones)
    for k in range(70):
        t0 = 12.95 + RNG.random() * 3.8 * RNG.random() ** 0.5
        sfx.add(A.bounce(7000 + k), t0, RNG.uniform(-0.7, 0.4), 0.12 + 0.2 * RNG.random() * np.exp(-(t0 - 13) / 2))
    # outdoor ambience for the opening
    tA = tt(DUR)
    wind = filt(RNG.standard_normal(N), 'lowpass', 350) * 0.02 * np.interp(tA, [0, 0.3, 1.8, 2.6], [0, 1, 1, 0])
    sfx.x += np.vstack([wind, np.roll(wind, 1500)])
    for t0 in (0.25, 0.55, 0.62, 1.05):
        sfx.add(birds(int(t0 * 100)), t0, 0.5, 0.06)

    # ---------------- music
    CH = A.CHORDS
    def bar_pad(t0, ch, d=2.0, g=0.07, lp=2300, att=0.04):
        for m in CH[ch][0]:
            pad.add(filt(A.pad_note(m, d, att=att), 'lowpass', lp), t0, 0, g)
    # opening swell + stairs bed
    for m in CH['Cmaj7'][0]:
        s = A.pad_note(m, 4.4, att=1.6, rel=0.6); pad.add(filt(s, 'lowpass', 1200), 1.2, 0, 0.05)
    for k in np.arange(3.5, 6.0, BEAT / 2):
        drums.add(A.hat(int(k * 100)), k, 0.3, 0.05)
    # groove (6-17.5): kick from 6.0, claps + bass from 8.0, plucks during the relay and the avalanche
    sections = [(6.0, 'Am9'), (8.0, 'Fmaj9'), (10.0, 'Cmaj7'), (12.0, 'G6'), (14.0, 'Am9'), (16.0, 'Fmaj9')]
    kicks = []
    for bt0, ch in sections:
        bar_pad(bt0, ch, g=0.06 if bt0 < 8 else 0.075)
        voicing, root, tones = CH[ch]
        for b in range(4):
            bt = bt0 + b * BEAT
            if bt >= 17.5: break
            drums.add(A.kick(), bt, 0, 0.62 if bt >= 8 else 0.45); kicks.append(bt)
            if bt >= 8:
                if b in (1, 3): drums.add(A.clap(int(bt * 10)), bt, 0, 0.3); verb.add(A.clap(int(bt * 10)), bt, 0, 0.1)
                bass.add(A.bass_note(root, 0.19), bt + BEAT / 2, 0, 0.4)
            for s16 in range(4):
                ht = bt + s16 * BEAT / 4
                drums.add(A.hat(int(ht * 1000), s16 == 2), ht, 0.25, 0.09 if s16 == 2 else 0.045)
        if bt0 >= 10:
            pat = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
            for s16 in range(16):
                pt = bt0 + s16 * BEAT / 4
                if pt >= 17.5: break
                plk.add(A.pluck(tones[pat[s16]] + (12 if s16 % 8 == 7 else 0), int(pt * 100)), pt, -0.3 if s16 % 2 else 0.3, 0.09)
    drums.add(A.crash(3), 12.75, 0.4, 0.22)
    # the lob (17.5-20.5): drums drop out, the chord hangs, a riser builds to the landing
    bar_pad(17.5, 'Gsus', d=3.0, g=0.075, lp=1600, att=0.6)
    bass.add(A.bass_note(43, 2.8), 17.5, 0, 0.35)
    tr = tt(3.0); riser = A.whoosh(3.0, 250, 6500, 88, 0.985) + 0.2 * np.sin(2 * np.pi * np.cumsum(200 * 2 ** (tr * 1.4)) / SR) * (tr / 3) ** 2
    drums.add(riser, 17.5, 0, 0.16)
    # the hands battle (20.5-22.75): drums back, claps accelerate
    bar_pad(20.5, 'Am9', d=2.25, g=0.07)
    for bt in np.arange(20.5, 22.75, BEAT):
        drums.add(A.kick(), bt, 0, 0.62); kicks.append(bt)
        bass.add(A.bass_note(45, 0.19), bt + BEAT / 2, 0, 0.4)
    roll = list(np.arange(21.0, 22.0, BEAT / 2)) + list(np.arange(22.0, 22.75, BEAT / 4))
    for j, k in enumerate(roll):
        drums.add(A.clap(400 + j), k, 0, 0.12 + 0.18 * (k - 21) / 1.75)
    # the pop-up hang (22.75-25.0): a held breath, then the smash
    for m, gg in ((76, 0.02), (83, 0.012), (88, 0.014)):
        t = tt(2.3); s = np.sin(2 * np.pi * mtof(m) * t) * np.interp(t, [0, 0.4, 1.9, 2.3], [0, 1, 1, 0])
        pad.add(s, 22.8, 0, gg)
    # the "B" (25.0): big chord, bass, sonic logo
    for m in CH['Cmaj9'][0]:
        s = filt(A.pad_note(m, 2.8, att=0.01, rel=1.4), 'lowpass', 3200); pad.add(s, 25.0, 0, 0.075); verb.add(s, 25.0, 0, 0.05)
    bass.add(A.bass_note(36, 3.0) * np.exp(-tt(3.06) / 1.3), 25.0, 0, 0.5)
    drums.add(A.kick(), 25.0, 0, 0.9)
    for k, (tn, m) in enumerate(zip([25.7, 26.05, 26.3, 26.48, 26.6], [79, 84, 88, 91, 96])):
        s = A.settle_note(m, 600 + k); sfx.add(s, tn, 0, 0.5 - k * 0.07); verb.add(s, tn, 0, 0.3)

    # sidechain, reverb, master
    duck = np.ones(N); tn = np.arange(N) / SR
    for k in kicks:
        i0 = int(k * SR); seg = tn[i0:i0 + int(0.4 * SR)] - k
        duck[i0:i0 + len(seg)] = np.minimum(duck[i0:i0 + len(seg)], 1 - 0.55 * np.exp(-seg / 0.11))
    pad.x *= duck; bass.x *= duck
    bass.x = np.vstack([filt(bass.x[0], 'lowpass', 1100), filt(bass.x[1], 'lowpass', 1100)])
    irL, irR = A.make_ir(1.8)
    vs = verb.x + 0.04 * drums.x + 0.1 * pad.x
    rev = np.vstack([fftconvolve(vs[0], irL)[:N], fftconvolve(vs[1], irR)[:N]])
    mix = sfx.x * 1.35 + drums.x * 0.85 + bass.x * 0.85 + pad.x * 1.0 + plk.x * 0.85 + rev * 0.3
    mix = np.vstack([filt(mix[0], 'highpass', 28), filt(mix[1], 'highpass', 28)])
    mix *= np.interp(tn, [0, 28.7, 29.6, DUR], [1, 1, 0, 0])
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)
    mix /= np.abs(mix).max() / 0.89
    out = sys.argv[2] if len(sys.argv) > 2 else str(HERE / 'out' / 'soundtrack.wav')
    wavfile.write(out, SR, mix.T.astype(np.float32))
    print('wrote', out)


if __name__ == '__main__':
    main()
