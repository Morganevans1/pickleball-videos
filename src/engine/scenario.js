// Runs a whole coaching scenario: incoming ball → student's shot →
// opponent's options → recovery.

import { COURT, heightAt } from './physics.js';
import { makeProfile } from './ratings.js';
import { solveShot, shotById, shotSpin } from './solver.js';
import { contactOptions, chooseContacts, buildReplies } from './opponent.js';
import { optionsTable } from './quality.js';
import { analyseRecovery } from './recovery.js';

export const DEFAULT_STATE = {
  student: { x: 2, y: -19, z: 2.0 },
  opponent: { x: -1, y: 20 },
  shotId: 'drive',
  target: { x: -6.5, y: 17.5 },
  clearance: 1.6,
  studentSkill: 4.0,
  studentMove: 4.0,
  linkMove: true,
  oppSkill: 4.0,
  rule: 'rally',        // 'rally' | 'return' (the student's shot is the return of serve)
  incoming: 'auto',     // 'auto' | 'volley' | 'bounce'
};

export function profilesFor(state) {
  return {
    student: makeProfile(state.studentSkill, state.linkMove ? state.studentSkill : state.studentMove),
    opponent: makeProfile(state.oppSkill),
  };
}

/** How the incoming ball arrives: volley or after the bounce. */
export function incomingKind(state) {
  if (state.rule === 'return') return 'bounce';
  if (state.incoming !== 'auto') return state.incoming;
  const depth = -state.student.y;
  return depth >= COURT.kitchen && depth <= 12 ? 'volley' : 'bounce';
}

/**
 * Plausible incoming ball from the opponent to the student's contact point.
 * It is context for the picture; the student's shot does not depend on it.
 */
export function solveIncoming(state) {
  const from = { x: state.opponent.x, y: state.opponent.y, z: 2.6 };
  const to = state.student;
  const kind = incomingKind(state);
  const D = Math.hypot(to.x - from.x, to.y - from.y);
  const hx = (to.x - from.x) / D, hy = (to.y - from.y) / D;
  const trim = (path, tEnd) => {
    let n = path.n;
    for (let i = 0; i < path.n; i++) if (path.t[i] > tEnd) { n = i; break; }
    return { ...path, n };
  };
  if (kind === 'volley') {
    const s = solveShot(from, { x: to.x, y: to.y, z: to.z }, 1.5, 500);
    if (!s.ok) return null;
    const hit = heightAt(s.traj, D);
    return { kind, path: trim(s.path, hit ? hit.t : s.path.landT), mph: s.mph };
  }
  // After the bounce: search for a bounce spot that brings the ball up
  // to the contact height at the contact point.
  const dNet = from.y / -hy;
  let best = null;
  for (let k = 0; k < 24; k++) {
    const db = dNet + 1 + ((D - 1.5 - dNet - 1) * k) / 23;
    if (db <= dNet) continue;
    const land = { x: from.x + db * hx, y: from.y + db * hy };
    const s = solveShot(from, land, 2.0, 600);
    if (!s.ok) continue;
    const { traj } = s;
    for (let i = traj.bounceIdx + 1; i < traj.t.length; i++) {
      if (traj.d[i] >= D) {
        const f = (D - traj.d[i - 1]) / (traj.d[i] - traj.d[i - 1] || 1e-9);
        const z = traj.z[i - 1] + f * (traj.z[i] - traj.z[i - 1]);
        const t = traj.t[i - 1] + f * (traj.t[i] - traj.t[i - 1]);
        const err = Math.abs(z - to.z);
        if (!best || err < best.err) best = { err, s, t };
        break;
      }
    }
  }
  if (!best) return null;
  return { kind, path: trim(best.s.path, best.t), mph: best.s.mph };
}

/** Fast part: the student's shot. */
export function solveStudentShot(state, profiles = profilesFor(state)) {
  const shot = shotById(state.shotId);
  const spin = shotSpin(shot, profiles.student);
  const contact = { x: state.student.x, y: state.student.y, z: state.student.z };
  const sol = solveShot(contact, state.target, state.clearance, spin);
  if (!sol.ok) return { ok: false, shot };
  const tooFast = sol.mph > profiles.student.maxDrive * 1.05;
  return { ...sol, shot, tooFast };
}

/** Slow part: opponent options, replies and recovery. */
export function analyse(state, shotSol, profiles = profilesFor(state)) {
  const opts = contactOptions(shotSol.path, state.opponent, profiles.opponent, +1, { mustBounce: state.rule === 'return' });
  if (opts.out) return { outcome: 'out' };
  const contacts = chooseContacts(opts.cands);
  if (!contacts.length) return { outcome: 'winner' };
  const { replies, density } = buildReplies(contacts, profiles.opponent);
  if (!replies.length) return { outcome: 'forced-error', contacts };
  const main = contacts.reduce((a, b) => (b.w > a.w ? b : a));
  const earliest = contacts.filter((c) => c.w >= 0.3).reduce((a, b) => (b.t < a.t ? b : a), main);
  // Next-shot quality depends on skill only; round it so the table is reused.
  const quality = optionsTable(makeProfile(Math.round(state.studentSkill * 2) / 2));
  const rec = analyseRecovery({
    replies, profile: profiles.student, start: { x: state.student.x, y: state.student.y },
    timeAvail: earliest.t, quality,
  });
  return { outcome: 'rally', contacts, main, replies, density, rec, cands: opts.cands };
}

