// Runs a whole coaching scenario: incoming ball → student's shot →
// opponent's options → recovery.

import { COURT, heightAt } from './physics.js';
import { makeProfile } from './ratings.js';
import { solveShot, shotById, shotSpin } from './solver.js';
import { contactOptions, chooseContacts, buildReplies } from './opponent.js';
import { optionsTable } from './quality.js';
import { analyseRecovery } from './recovery.js';
import { analyseTeam } from './team.js';

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
  // Doubles
  format: 'singles',    // 'singles' | 'doubles'
  hitter: 'you',        // 'you' | 'partner': who plays our shot in doubles
  partner: { x: -5, y: -19, z: 2.0 },
  opponent2: { x: 5, y: 19 },
  partnerSkill: 4.0,
  opp2Skill: 4.0,
};

export const isDoubles = (state) => state.format === 'doubles';
export const partnerHits = (state) => isDoubles(state) && state.hitter === 'partner';
/** The player on the student's team who plays the shot. */
export const hitterOf = (state) => (partnerHits(state) ? state.partner : state.student);

export function profilesFor(state) {
  return {
    student: makeProfile(state.studentSkill, state.linkMove ? state.studentSkill : state.studentMove),
    opponent: makeProfile(state.oppSkill),
    partner: makeProfile(state.partnerSkill ?? 4),
    opponent2: makeProfile(state.opp2Skill ?? 4),
  };
}

/**
 * Doubles positions built from a singles scenario: each player gets a
 * partner side by side on the other half of their court.
 */
export function withDoublesPositions(state) {
  const side = (p) => {
    const x = p.x >= 0 ? Math.max(p.x - 8.5, -6) : Math.min(p.x + 8.5, 6);
    return Math.abs(x - p.x) < 5 ? (p.x >= 0 ? -5 : 5) : x;
  };
  return {
    ...state,
    partner: { x: side(state.student), y: state.student.y, z: 2.0 },
    opponent2: { x: side(state.opponent), y: state.opponent.y },
  };
}

/** How the incoming ball arrives: volley or after the bounce. */
export function incomingKind(state) {
  if (state.rule === 'return') return 'bounce';
  if (state.incoming !== 'auto') return state.incoming;
  const depth = -hitterOf(state).y;
  return depth >= COURT.kitchen && depth <= 12 ? 'volley' : 'bounce';
}

/**
 * Plausible incoming ball from the opponent to the student's contact point.
 * It is context for the picture; the student's shot does not depend on it.
 */
export function solveIncoming(state) {
  const from = { x: state.opponent.x, y: state.opponent.y, z: 2.6 };
  const to = hitterOf(state);
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
  const hp = partnerHits(state) ? profiles.partner : profiles.student;
  const spin = shotSpin(shot, hp);
  const h = hitterOf(state);
  const contact = { x: h.x, y: h.y, z: h.z };
  const sol = solveShot(contact, state.target, state.clearance, spin);
  if (!sol.ok) return { ok: false, shot };
  const tooFast = sol.mph > hp.maxDrive * 1.05;
  return { ...sol, shot, tooFast };
}

// A player this close to the net (ft) can attack balls that sit up.
const NET_PRESSURE_DEPTH = 11;

const qualityFor = (skill) => optionsTable(makeProfile(Math.round(skill * 2) / 2));

/** Slow part: opponent options, replies and recovery. */
export function analyse(state, shotSol, profiles = profilesFor(state)) {
  if (isDoubles(state)) return analyseDoubles(state, shotSol, profiles);
  const opts = contactOptions(shotSol.path, state.opponent, profiles.opponent, +1, { mustBounce: state.rule === 'return' });
  if (opts.out) return { outcome: 'out' };
  const contacts = chooseContacts(opts.cands);
  if (!contacts.length) return { outcome: 'winner' };
  const netPressure = Math.abs(state.student.y) <= NET_PRESSURE_DEPTH;
  const { replies, density } = buildReplies(contacts, profiles.opponent, undefined, { netPressure });
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

/**
 * Doubles: either opponent may play the ball (whoever has the better
 * contact), and the student's team recovers as a pair.
 */
function analyseDoubles(state, shotSol, profiles) {
  const mustBounce = state.rule === 'return';
  const receivers = [
    { id: 0, pos: state.opponent, profile: profiles.opponent },
    { id: 1, pos: state.opponent2, profile: profiles.opponent2 },
  ];
  let out = false;
  const groups = receivers.map((r) => {
    const o = contactOptions(shotSol.path, r.pos, r.profile, +1, { mustBounce });
    out = out || o.out;
    const picks = chooseContacts(o.cands);
    const bestScore = picks.reduce((m, c) => Math.max(m, c.score), 0);
    return { ...r, picks, bestScore, cands: o.cands };
  });
  if (out) return { outcome: 'out' };
  const live = groups.filter((g) => g.picks.length);
  if (!live.length) return { outcome: 'winner' };
  // Share the ball between the two opponents by how good their contact is.
  const ws = live.map((g) => Math.exp(g.bestScore / 0.08));
  const tot = ws.reduce((a, b) => a + b, 0);
  const contacts = [];
  live.forEach((g, i) => {
    const gw = ws[i] / tot;
    if (gw < 0.15) return;
    for (const c of g.picks) contacts.push({ ...c, w: c.w * gw, who: g.id, profile: g.profile });
  });
  const cw = contacts.reduce((a, c) => a + c.w, 0);
  contacts.forEach((c) => { c.w /= cw; });

  const netPressure = Math.min(Math.abs(state.student.y), Math.abs(state.partner.y)) <= NET_PRESSURE_DEPTH;
  const { replies, density } = buildReplies(contacts, profiles.opponent, 150, { netPressure });
  if (!replies.length) return { outcome: 'forced-error', contacts };
  const main = contacts.reduce((a, b) => (b.w > a.w ? b : a));
  const earliest = contacts.filter((c) => c.w >= 0.3).reduce((a, b) => (b.t < a.t ? b : a), main);
  const youHit = !partnerHits(state);
  // The hitter needs their follow-through; the other player only needs to read the shot.
  const lag = (hits, p) => (hits ? p.followThrough : 0.1);
  const players = [
    { profile: profiles.student, start: { x: state.student.x, y: state.student.y }, quality: qualityFor(state.studentSkill) },
    { profile: profiles.partner, start: { x: state.partner.x, y: state.partner.y }, quality: qualityFor(state.partnerSkill) },
  ];
  players[0].tMove = Math.max(0, earliest.t - lag(youHit, profiles.student));
  players[1].tMove = Math.max(0, earliest.t - lag(!youHit, profiles.partner));
  const rec = analyseTeam({ replies, players });
  rec.timeAvail = earliest.t;
  return { outcome: 'rally', doubles: true, contacts, main, replies, density, rec };
}

