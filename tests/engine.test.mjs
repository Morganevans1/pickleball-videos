import { test } from 'node:test';
import assert from 'node:assert/strict';

import { trajectory, flyToGround, BALL_R, MPH, netHeight, COURT } from '../src/engine/physics.js';
import { solveShot } from '../src/engine/solver.js';
import { makeProfile, travelTime, travelDistance, paceFor } from '../src/engine/ratings.js';
import { launchSet } from '../src/engine/launches.js';
import { DEFAULT_STATE, solveStudentShot, analyse, profilesFor } from '../src/engine/scenario.js';
import { movePlan, LEVELS } from '../src/engine/recovery.js';
import { describeDirection } from '../src/engine/narrate.js';

const DEG = Math.PI / 180;

test('ball bounce meets the official drop test (30–34 in from 78 in)', () => {
  const tr = trajectory(78 / 12, 1e-4, -Math.PI / 2 + 1e-3, 0, { dtOut: 0.005 });
  let peak = 0;
  for (let i = tr.bounceIdx; i < tr.t.length; i++) peak = Math.max(peak, tr.z[i]);
  const inches = (peak - BALL_R) * 12;
  assert.ok(inches >= 30 && inches <= 34, `bounced ${inches.toFixed(1)} in`);
});

// Lands in the far kitchen (0 < d − dNet ≤ 7) and clears the net?
function landsInKitchen(z0, mph, thetaDeg, dNet) {
  let zNet = NaN;
  const r = flyToGround(z0, mph * MPH, thetaDeg * DEG, 0, 40, 4, (pd, pz, d, z) => {
    if (pd < dNet && d >= dNet) zNet = pz + ((dNet - pd) / (d - pd)) * (z - pz);
  });
  return zNet > netHeight(0) + BALL_R && r.landD > dNet && r.landD - dNet <= COURT.kitchen;
}

test('a low ball 2 ft off the net cannot be driven into the kitchen at 50 mph', () => {
  for (let th = -60; th <= 70; th += 0.5) assert.equal(landsInKitchen(1.5, 50, th, 2), false, `θ=${th}`);
  // ...but a soft ball can.
  const s = solveShot({ x: 0, y: -2, z: 1.5 }, { x: 0, y: 5 }, 0.3, 0);
  assert.ok(s.ok && s.mph < 20, `needed ${s.mph}`);
});

test('an overhead from the same spot can be hit into the kitchen at 50 mph', () => {
  let found = false;
  for (let th = -80; th <= 0 && !found; th += 0.5) found = landsInKitchen(8, 50, th, 2);
  assert.ok(found);
});

test('the shot solver hits its target and net clearance', () => {
  const cases = [
    [{ x: 0, y: -20, z: 2.5 }, { x: -5, y: 18 }, 1.0, 1500],
    [{ x: 3, y: -7, z: 1 }, { x: -4, y: 4.5 }, 0.5, -300],
    [{ x: 0, y: -6, z: 2 }, { x: 0, y: 19 }, 9, 800],
  ];
  for (const [c, t, clear, spin] of cases) {
    const s = solveShot(c, t, clear, spin);
    assert.ok(s.ok);
    assert.ok(Math.hypot(s.path.landX - t.x, s.path.landY - t.y) < 0.25, 'landing');
    assert.ok(Math.abs(s.clearance - clear) < 0.08, `clearance ${s.clearance}`);
  }
});

test('the middle of the court is easier to hit than the corners', () => {
  const set = launchSet({ x: 0, y: 18, z: 2.5 }, makeProfile(4.0));
  const best = (cond) => {
    let m = 0;
    for (let i = 0; i < set.ok.length; i++) if (set.ok[i] && cond(set.landX[i], set.landY[i])) m = Math.max(m, set.pSucc[i]);
    return m;
  };
  const centre = best((x, y) => Math.abs(x) < 2 && y < -10 && y > -14);
  const corner = best((x, y) => x < -8.5 && y < -20.5);
  assert.ok(centre > 0.9 && corner < centre - 0.2, `centre ${centre}, corner ${corner}`);
});

test('better players hit corners more reliably', () => {
  const corner = (r) => {
    const set = launchSet({ x: 0, y: 18, z: 2.5 }, makeProfile(r));
    let m = 0;
    for (let i = 0; i < set.ok.length; i++) if (set.ok[i] && set.landX[i] < -8.5 && set.landY[i] < -20.5) m = Math.max(m, set.pSucc[i]);
    return m;
  };
  assert.ok(corner(6.0) > corner(3.0));
});

test('movement model is consistent', () => {
  const p = makeProfile(4.0);
  for (const d of [1, 4, 9, 15]) assert.ok(Math.abs(travelDistance(travelTime(d, p), p) - d) < 1e-6);
  assert.ok(makeProfile(6.0).topSpeed > makeProfile(3.0).topSpeed);
  assert.equal(paceFor(30, 0.5, p).level.key, 'impossible');
  assert.equal(paceFor(2, 2, p).level.key, 'walk');
});

test('symmetric rally recovers to the middle', () => {
  const st = structuredClone(DEFAULT_STATE);
  Object.assign(st, { student: { x: 0, y: -18, z: 2.5 }, opponent: { x: 0, y: 19 }, target: { x: 0, y: 17 }, clearance: 2 });
  const shot = solveStudentShot(st);
  const an = analyse(st, shot);
  assert.equal(an.outcome, 'rally');
  const plan = movePlan(an.rec, 0);
  assert.ok(Math.abs(plan.ideal.x) < 1.5, `ideal x ${plan.ideal.x}`);
});

test('a crosscourt shot pulls recovery towards the bisector', () => {
  // Opponent hits from the student's left (−x) corner: recover left of centre.
  const st = structuredClone(DEFAULT_STATE);
  const an = analyse(st, solveStudentShot(st));
  assert.equal(an.outcome, 'rally');
  assert.ok(an.main.x < -5);
  const plan = movePlan(an.rec, LEVELS - 1);
  assert.ok(plan.ideal.x < st.student.x, `ideal x ${plan.ideal.x}`);
});

test('ceiling, recovery spot and pace agree with each other', () => {
  for (const mv of [2.5, 4.0, 6.0]) {
    const st = { ...structuredClone(DEFAULT_STATE), linkMove: false, studentMove: mv };
    const an = analyse(st, solveStudentShot(st, profilesFor(st)));
    const rec = an.rec;
    for (let L = 0; L < LEVELS; L++) {
      const plan = movePlan(rec, L);
      if (L <= rec.ceiling) {
        assert.ok(plan.reachableIdeal, `move ${mv} level ${L} should be reachable`);
        assert.notEqual(plan.idealPace.level.key, 'impossible');
      } else if (L === rec.ceiling + 1) {
        assert.equal(plan.reachableIdeal, false, `move ${mv} level ${L} should be out of reach`);
      }
    }
  }
});

test('directions are from the student’s point of view', () => {
  assert.equal(describeDirection(-3, 0), '3 ft to your left');
  assert.equal(describeDirection(0, 5), '5 ft forward');
  assert.equal(describeDirection(2, -4), '4 ft back and 2 ft to your right');
});

// ---------------------------------------------------------------- doubles

import { teamPlan, replyOwners } from '../src/engine/team.js';

const dinkState = (target, extra = {}) => ({
  ...structuredClone(DEFAULT_STATE), format: 'doubles',
  student: { x: 4, y: -7.6, z: 1.0 }, partner: { x: -4, y: -7.6, z: 1.0 },
  opponent: { x: -4, y: 7.8 }, opponent2: { x: 4, y: 7.8 },
  shotId: 'dink', target, clearance: 0.5, ...extra,
});
const runDoubles = (st) => analyse(st, solveStudentShot(st, profilesFor(st)), profilesFor(st));

test('doubles: partners keep their own sides', () => {
  const an = runDoubles(dinkState({ x: -4, y: 4.5 }));
  assert.equal(an.outcome, 'rally');
  for (let L = 0; L < LEVELS; L += 5) {
    const { plans } = teamPlan(an.rec, L);
    assert.ok(plans[0].target.x > 0 && plans[1].target.x < 0, `level ${L}`);
  }
});

test('doubles: the team shifts together towards a wide ball', () => {
  const sumX = (an) => { const { plans } = teamPlan(an.rec, 5); return plans[0].target.x + plans[1].target.x; };
  const right = runDoubles(dinkState({ x: 8, y: 4.5 }));
  const left = runDoubles(dinkState({ x: -8, y: 4.5 }));
  assert.ok(sumX(right) > sumX(left), `right ${sumX(right)}, left ${sumX(left)}`);
});

test('doubles: both players share the work and little goes uncovered', () => {
  const an = runDoubles(dinkState({ x: -4, y: 4.5 }));
  const { plans } = teamPlan(an.rec, 5);
  const own = replyOwners(an.rec, plans[0].target, plans[1].target);
  const count = (k) => own.filter((o) => o === k).length;
  assert.ok(count(0) > own.length * 0.2 && count(1) > own.length * 0.2, `you ${count(0)}, partner ${count(1)}`);
  assert.ok(count(-1) < own.length * 0.1, `uncovered ${count(-1)}`);
});

test('doubles: the partner can be the hitter', () => {
  const st = dinkState({ x: 4, y: 4.5 }, { hitter: 'partner' });
  const shot = solveStudentShot(st, profilesFor(st));
  assert.ok(shot.ok);
  assert.equal(shot.path.x[0], st.partner.x);
  assert.equal(runDoubles(st).outcome, 'rally');
});

test('doubles: either opponent can play the ball', () => {
  const toLeft = runDoubles(dinkState({ x: -6, y: 4.5 }));
  const toRight = runDoubles(dinkState({ x: 6, y: 4.5 }));
  assert.equal(toLeft.main.who, 0);   // opponent A stands at x = -4
  assert.equal(toRight.main.who, 1);  // opponent B stands at x = +4
});
