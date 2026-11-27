#!/usr/bin/env python3
"""Soundtrack for "Find Your Bounce" (:30), synthesized from timeline.js.

Every ball impact in the picture is a cue in timeline.js; this script places a
hit sound at exactly that time, then builds a 120 BPM track around it.
Output: 48 kHz stereo float WAV (unnormalized; build.sh sets broadcast loudness).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

HERE = Path(__file__).resolve().parent
SR = 48000
TL = json.loads(subprocess.check_output(
    ['node', '-e', "process.stdout.write(JSON.stringify(require('./timeline.js')))"], cwd=HERE))
DUR = float(TL['DUR'])
N = int(SR * DUR)
BEAT = 60.0 / TL['BPM']
RNG = np.random.default_rng(7)


# ---------------------------------------------------------------- utilities
def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def declick(s, ms=0.4):
    n = max(1, int(ms * SR / 1000))
    s[:n] *= np.linspace(0, 1, n)
    return s


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, t0, pan=0.0, gain=1.0):
        if sig.ndim == 1:
            th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
            sig = np.vstack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2)
        i0 = int(round(t0 * SR))
        if i0 < 0:
            sig, i0 = sig[:, -i0:], 0
        n = min(sig.shape[1], N - i0)
        if n > 0:
            self.x[:, i0:i0 + n] += gain * sig[:, :n]


def load_real_pock():
    p = HERE / 'assets' / 'real_pock.wav'
    if not p.exists():
        return None
    sr, x = wavfile.read(p)
    return x.astype(np.float64)


REAL = load_real_pock()


# ---------------------------------------------------------------- impacts
def modal(modes, d, seed, det=0.05, drop=0.03):
    r = np.random.default_rng(seed)
    t = tt(d)
    k = 1 + (r.random() - 0.5) * det
    s = np.zeros_like(t)
    for f, tau, a in modes:
        f2 = f * k * (1 - drop * np.exp(-t / 0.006))
        s += a * np.sin(2 * np.pi * np.cumsum(f2) / SR + r.random() * 6.28) * np.exp(-t / tau)
    return s, r, t


def pock(seed, bright=1.0, real=True):
    s, r, t = modal([(1180, 0.030, 1.0), (1730, 0.020, 0.55), (2650, 0.012, 0.45 * bright),
                     (3950, 0.008, 0.3 * bright), (640, 0.024, 0.45)], 0.25, seed)
    s += 1.3 * filt(r.standard_normal(len(t)), 'bandpass', [900, 7500]) * np.exp(-t / 0.0035)
    s += 0.35 * np.sin(2 * np.pi * 300 * t) * np.exp(-t / 0.012)
    s /= np.abs(s).max()
    if real and REAL is not None:
        rr = np.zeros_like(s)
        m = min(len(REAL), len(s))
        rr[:m] = REAL[:m]
        s = 0.6 * s + 0.7 * rr
        s /= np.abs(s).max()
    return declick(s)


def bounce(seed):
    s, r, t = modal([(520, 0.028, 1.0), (880, 0.02, 0.6), (1450, 0.012, 0.4), (2300, 0.007, 0.25)], 0.3, seed)
    s += 0.9 * filt(r.standard_normal(len(t)), 'lowpass', 4000) * np.exp(-t / 0.003)
    s += 0.7 * np.sin(2 * np.pi * 165 * t) * np.exp(-t / 0.02)
    return declick(s / np.abs(s).max())


def rattle(d, f_am, lp, tau, seed):
    r = np.random.default_rng(seed)
    t = tt(d)
    n = filt(r.standard_normal(len(t)), 'lowpass', lp)
    return n * (0.55 + 0.45 * np.sin(2 * np.pi * f_am * t)) * np.exp(-t / tau)


def tape(seed):
    s = 0.75 * pock(seed, 0.8)
    s = np.pad(s, (0, int(0.3 * SR) - len(s)))
    s += 0.5 * rattle(0.3, 38, 2000, 0.09, seed + 1)
    return s / np.abs(s).max()


def net_thud(seed):
    t = tt(0.4)
    s = 0.9 * np.sin(2 * np.pi * 140 * t) * np.exp(-t / 0.06)
    s += 0.8 * filt(np.random.default_rng(seed).standard_normal(len(t)), 'lowpass', 700) * np.exp(-t / 0.05)
    s += 0.6 * rattle(0.4, 31, 1600, 0.15, seed + 2)
    return declick(s / np.abs(s).max())


def frame_hit(seed):
    s, r, t = modal([(820, 0.02, 1.0), (1300, 0.012, 0.6), (2100, 0.007, 0.4)], 0.2, seed)
    s += 1.2 * filt(r.standard_normal(len(t)), 'bandpass', [1500, 8000]) * np.exp(-t / 0.002)
    return declick(s / np.abs(s).max())


def whoosh(d, f0, f1, seed, peak=0.7):
    r = np.random.default_rng(seed)
    t = tt(d)
    noise = r.standard_normal(len(t))
    bands = np.geomspace(250, 7000, 8)
    pos = np.interp(t / d, [0, 1], [np.log(f0), np.log(f1)])
    out = np.zeros_like(t)
    for i, fc in enumerate(bands):
        b = filt(noise, 'bandpass', [fc / 1.5, min(fc * 1.5, SR / 2 - 100)])
        w = np.exp(-((pos - np.log(fc)) ** 2) / 0.35)
        out += b * w
    env = np.interp(t / d, [0, peak, 1], [0, 1, 0]) ** 1.5
    return out * env / (np.abs(out * env).max() + 1e-9)


def settle_note(midi, seed):
    f = mtof(midi)
    t = tt(1.6)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.5)
    s += 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.25)
    s += 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.12)
    p = pock(seed, 0.6, real=False)
    s[:len(p)] += 0.45 * p
    return declick(s / np.abs(s).max())


# ---------------------------------------------------------------- drums & synths
def kick():
    t = tt(0.55)
    f = 46 + 115 * np.exp(-t / 0.028)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.27)
    s += 0.25 * filt(RNG.standard_normal(len(t)), 'highpass', 3000) * np.exp(-t / 0.002)
    return declick(np.tanh(1.6 * s) / np.tanh(1.6))


def clap(seed):
    r = np.random.default_rng(seed)
    t = tt(0.4)
    nz = filt(r.standard_normal(len(t)), 'bandpass', [1000, 3800])
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) / 0.006), 0)
    env += 0.55 * np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.09), 0)
    s = nz * env + 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return declick(s / np.abs(s).max())


def hat(seed, open_=False):
    r = np.random.default_rng(seed)
    t = tt(0.3 if open_ else 0.08)
    s = filt(r.standard_normal(len(t)), 'highpass', 7000, 4) * np.exp(-t / (0.07 if open_ else 0.018))
    return declick(s / np.abs(s).max())


def crash(seed):
    r = np.random.default_rng(seed)
    t = tt(2.5)
    s = filt(r.standard_normal(len(t)), 'highpass', 2500, 2) * np.exp(-t / 0.8)
    s += 0.4 * filt(r.standard_normal(len(t)), 'bandpass', [600, 2500]) * np.exp(-t / 0.3)
    return declick(s / np.abs(s).max())


def saw(f, t, cents=0.0, nh=None):
    f = f * 2 ** (cents / 1200)
    nh = nh or max(1, min(40, int(16000 / f)))
    s = np.zeros_like(t)
    ph = RNG.random() * 6.28
    for k in range(1, nh + 1):
        s += np.sin(2 * np.pi * k * f * t + k * ph) / k
    return s


def pad_note(midi, d, att=0.06, rel=0.35):
    t = tt(d + rel)
    f = mtof(midi)
    s = saw(f, t, -9) + saw(f, t, 0) + saw(f, t, 8)
    env = np.minimum(1, t / att) * np.where(t > d, np.exp(-(t - d) / (rel / 3)), 1)
    return s * env / 3


def bass_note(midi, d=0.2):
    t = tt(d + 0.06)
    f = mtof(midi)
    s = 0.55 * saw(f, t, 0, 12) + 0.9 * np.sin(2 * np.pi * f / 2 * t)
    env = np.minimum(1, t / 0.004) * np.where(t > d, np.exp(-(t - d) / 0.015), 1) * (0.7 + 0.3 * np.exp(-t / 0.08))
    return s * env


def pluck(midi, seed):
    f = mtof(midi)
    t = tt(0.5)
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.05) + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.03)
    return declick(s * np.exp(-t / 0.13))


# ---------------------------------------------------------------- arrangement
CHORDS = {  # pad voicing, bass root, pluck tones
    'Am9': ([57, 60, 64, 67, 71], 45, [69, 72, 76, 79]),
    'Fmaj9': ([53, 57, 60, 64, 67], 41, [65, 69, 72, 76]),
    'Cmaj7': ([55, 60, 64, 67, 71], 36, [67, 72, 76, 79]),
    'G6': ([55, 59, 62, 64, 69], 43, [67, 71, 74, 79]),
    'Gsus': ([55, 60, 62, 67, 74], 43, [67, 72, 74, 79]),
    'Cmaj9': ([48, 55, 60, 64, 67, 71, 74], 36, [72, 76, 79, 84]),
}
BARS = [(8, 'Am9'), (10, 'Fmaj9'), (12, 'Cmaj7'), (14, 'G6'), (16, 'Am9'), (18, 'Fmaj9'), (20, 'Gsus')]


def main():
    sfx, verb_send, drums, bass, pad, plk = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()

    # --- impacts from the shared timeline
    for i, h in enumerate(TL['HITS']):
        t0, ty, pan, g = h['t'], h['type'], h['pan'], h['gain']
        seed = 100 + i
        if ty == 'pock':
            s = pock(seed)
        elif ty == 'bounce':
            s = bounce(seed)
        elif ty == 'tape':
            s = tape(seed)
        elif ty == 'net':
            s = net_thud(seed)
        elif ty == 'frame':
            s = frame_hit(seed)
        elif ty == 'whoosh':
            s = whoosh(0.32, 300, 5000, seed, 0.85); t0 -= 0.27
        elif ty == 'swish':
            s = whoosh(0.16, 1200, 6000, seed, 0.8); t0 -= 0.12
        elif ty == 'big':
            s = pock(seed, 1.2)
            sfx.add(bounce(seed + 1), t0, 0, 0.6)
            t = tt(2.2)
            boom = np.sin(2 * np.pi * np.cumsum(48 + 60 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.9)
            sfx.add(declick(boom), t0, 0, 1.1)
            sfx.add(crash(seed), t0, 0.1, 0.22)
            verb_send.add(crash(seed), t0, 0, 0.15)
        elif ty == 'settle':
            notes = [79, 84, 88, 91, 96]
            s = settle_note(notes[h['note']], seed)
            verb_send.add(s, t0, pan, g * 0.7)
        else:
            continue
        sfx.add(s, t0, pan, g * 1.5)
        verb_send.add(s, t0, pan, g * 0.9 * h.get('verb', 0.35))

    # --- room tone through the open (barely there)
    t = tt(DUR)
    room = filt(RNG.standard_normal(N), 'lowpass', 500) * 0.006 * np.interp(t, [0, 0.6, 8, 22, 22.5, 25, 26], [0, 1, 1, 0, 1, 1, 0])
    sfx.x += np.vstack([room, np.roll(room, 2000)])

    # --- intro swell (3-8 s): dark Am9 pad brightening toward the drop
    for m in CHORDS['Am9'][0]:
        s = pad_note(m, 5.0, att=2.5, rel=0.05)
        dark, bright = filt(s, 'lowpass', 380), filt(s, 'lowpass', 2600)
        w = np.clip(np.arange(len(s)) / len(s), 0, 1) ** 2
        pad.add(dark * (1 - w) + bright * w, 3.0, 0, 0.10)
    sub = np.sin(2 * np.pi * 55 * tt(5.0)) * np.linspace(0, 1, int(5.0 * SR)) ** 2
    bass.add(sub, 3.0, 0, 0.35)

    # --- pre-drop drums
    for k in np.arange(5.0, 7.0, BEAT):
        drums.add(kick(), k, 0, 0.55 + 0.2 * (k - 5) / 2)
    for k in np.arange(6.0, 7.0, BEAT / 2):
        drums.add(hat(int(k * 100)), k, 0.3, 0.12)
    roll = list(np.arange(7.0, 7.5, BEAT / 4)) + list(np.arange(7.5, 8.0, BEAT / 8))
    for j, k in enumerate(roll):
        drums.add(clap(500 + j), k, 0, 0.12 + 0.25 * (k - 7.0))
    drums.add(whoosh(1.4, 300, 7000, 77, 0.98), 6.6, 0, 0.18)

    # --- groove (8-20 s) and build (20-22 s)
    kicks = []
    for bar_t, ch in BARS:
        voicing, root, tones = CHORDS[ch]
        breakdown = bar_t == 12
        build = bar_t == 20
        # pad
        for m in voicing:
            pad.add(filt(pad_note(m, 2.0 if not build else 2.0, att=0.04 if not build else 1.6), 'lowpass', 2300 if not build else 3500), bar_t, 0, 0.085 if not breakdown else 0.075)
        for b in range(4):
            bt = bar_t + b * BEAT
            if not breakdown and not (build and bt >= 21.5):
                drums.add(kick(), bt, 0, 0.7); kicks.append(bt)
            if b in (1, 3) and not build:
                drums.add(clap(int(bt * 10)), bt, 0, 0.36 if not breakdown else 0.26)
                verb_send.add(clap(int(bt * 10)), bt, 0, 0.12)
            if not breakdown and not build:
                bass.add(bass_note(root, 0.19), bt + BEAT / 2, 0, 0.42)
            for s16 in range(4):
                ht = bt + s16 * BEAT / 4
                if build:
                    continue
                if s16 == 2:
                    drums.add(hat(int(ht * 1000), True), ht, 0.25, 0.11)
                else:
                    drums.add(hat(int(ht * 1000)), ht, 0.25, 0.05 + (0.03 if s16 == 0 else 0))
        if build:
            bass.add(np.concatenate([bass_note(root, 1.5)]), bar_t, 0, 0.42)
        # plucks from LIFERS on
        if bar_t >= 14 and not build:
            pat = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
            for s16 in range(16):
                pt = bar_t + s16 * BEAT / 4
                m = tones[pat[s16]] + (12 if (bar_t >= 16 and s16 % 8 == 7) else 0)
                plk.add(pluck(m, int(pt * 100)), pt, -0.35 if s16 % 2 else 0.35, 0.11 + (0.04 if s16 % 4 == 0 else 0))
                verb_send.add(pluck(m, 0), pt, 0, 0.03)
    # crash on the drop and on EVERYBODY
    drums.add(crash(1), 8.0, -0.2, 0.3); verb_send.add(crash(1), 8.0, 0, 0.15)
    drums.add(crash(2), 16.0, 0.2, 0.2)
    # build: accelerating snare roll + riser, hard stop at 22.0
    roll = list(np.arange(20.0, 21.0, BEAT / 2)) + list(np.arange(21.0, 21.5, BEAT / 4)) + list(np.arange(21.5, 22.0, BEAT / 8))
    for j, k in enumerate(roll):
        drums.add(clap(900 + j), k, 0, 0.1 + 0.22 * (k - 20) / 2)
    rt_ = tt(2.0)
    riser = whoosh(2.0, 250, 7500, 88, 0.999)
    riser += 0.25 * np.sin(2 * np.pi * np.cumsum(220 * 2 ** (rt_ * 2.2)) / SR) * (rt_ / 2.0) ** 2
    drums.add(riser, 20.0, 0, 0.22)

    # --- the hang (22-25 s): a held breath
    for m, g in ((88, 0.022), (95, 0.012), (76, 0.018)):
        t = tt(3.4)
        s = np.sin(2 * np.pi * mtof(m) * t * (1 + 0.002 * np.sin(2 * np.pi * 4.5 * t)))
        s *= np.interp(t, [0, 0.8, 2.4, 3.4], [0, 1, 1, 0])
        pad.add(s, 22.15, 0, g)
    # reverse swell into the land
    rv = pock(4242, 1.2)
    tail = fftconvolve(np.pad(rv, (0, int(1.2 * SR))), make_ir(1.2)[0])[: int(1.0 * SR)]
    tail = tail[::-1] / np.abs(tail).max()
    sfx.add(tail * np.linspace(0, 1, len(tail)) ** 2, 25.5 - len(tail) / SR, 0, 0.35)

    # --- the land + end card (25.5 s)
    LAND = TL['LAND']
    for m in CHORDS['Cmaj9'][0]:
        s = filt(pad_note(m, 2.6, att=0.01, rel=1.4), 'lowpass', 3200)
        pad.add(s, LAND, 0, 0.075)
        verb_send.add(s, LAND, 0, 0.05)
    bass.add(bass_note(36, 2.8) * np.exp(-tt(2.86) / 1.2), LAND, 0, 0.5)
    drums.add(kick(), LAND, 0, 0.85)

    # --- sidechain duck for pad & bass
    duck = np.ones(N)
    tn = np.arange(N) / SR
    for k in kicks:
        i0 = int(k * SR)
        seg = tn[i0:i0 + int(0.4 * SR)] - k
        duck[i0:i0 + len(seg)] = np.minimum(duck[i0:i0 + len(seg)], 1 - 0.6 * np.exp(-seg / 0.11))
    pad.x *= duck
    bass.x[:, int(8 * SR):] *= duck[int(8 * SR):]
    bass.x = np.vstack([filt(bass.x[0], 'lowpass', 1100), filt(bass.x[1], 'lowpass', 1100)])

    # --- reverb
    irL, irR = make_ir(2.1)
    vs = verb_send.x + 0.05 * drums.x + 0.12 * pad.x
    rev = np.vstack([fftconvolve(vs[0], irL)[:N], fftconvolve(vs[1], irR)[:N]])

    mix = sfx.x * 1.0 + drums.x * 0.95 + bass.x * 0.9 + pad.x * 1.0 + plk.x * 0.9 + rev * 0.33
    mix = np.vstack([filt(mix[0], 'highpass', 28), filt(mix[1], 'highpass', 28)])
    # end the audio cleanly before the last frame (TV spots go silent ~0.5 s early)
    fade = np.interp(tn, [0, 28.6, 29.55, DUR], [1, 1, 0, 0])
    mix *= fade
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)  # soft limiter
    mix /= np.abs(mix).max() / 0.89
    out = sys.argv[1] if len(sys.argv) > 1 else str(HERE / 'out' / 'soundtrack.wav')
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(out, SR, mix.T.astype(np.float32))
    print('wrote', out, 'peak', np.abs(mix).max())


def make_ir(rt60):
    r = np.random.default_rng(int(rt60 * 1000))
    n = int(SR * rt60 * 1.1)
    t = np.arange(n) / SR
    env = np.exp(-6.91 * t / rt60) * np.minimum(1, t / 0.004)
    out = []
    for _ in range(2):
        x = r.standard_normal(n) * env
        lp = filt(x, 'lowpass', 2200)
        w = np.clip(t / (rt60 * 0.45), 0, 1)
        x = x * (1 - w) + lp * w
        x = np.concatenate([np.zeros(int(0.018 * SR)), x])
        out.append(x / np.sqrt((x ** 2).sum()))
    return out


if __name__ == '__main__':
    main()
