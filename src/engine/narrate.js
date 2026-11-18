// Plain-language coach's note for the current scenario.

import { COURT } from './physics.js';

const r1 = (v) => Math.round(v * 10) / 10;
const ft = (v) => `${Math.round(v)} ft`;

export function describeDirection(dx, dy) {
  // The student faces +y; their left is −x.
  const parts = [];
  if (Math.abs(dy) >= 1) parts.push(dy > 0 ? `${ft(Math.abs(dy))} forward` : `${ft(Math.abs(dy))} back`);
  if (Math.abs(dx) >= 1) parts.push(dx < 0 ? `${ft(Math.abs(dx))} to your left` : `${ft(Math.abs(dx))} to your right`);
  return parts.length ? parts.join(' and ') : 'where you are';
}

export function zoneName(y) {
  const d = Math.abs(y);
  if (d < COURT.kitchen) return 'in the kitchen';
  if (d < COURT.kitchen + 1.5) return 'at the kitchen line';
  if (d < 17) return 'in the transition zone';
  if (d <= COURT.halfL) return 'near the baseline';
  return 'behind the baseline';
}

export function shotSummary(shot) {
  const s = shot.shot.name.toLowerCase();
  const lane = Math.abs(shot.hx) < 0.12 ? 'down the middle' : ((shot.path.landX < 0) === (shot.path.x[0] < 0) ? 'down the line' : 'crosscourt');
  return `Your ${s} leaves at ${Math.round(shot.mph)} mph, clears the net by ${r1(shot.clearance)} ft and lands ${zoneName(shot.path.landY).replace('in the ', 'in their ').replace('near the', 'near their').replace('at the', 'at their')}, ${lane}.`;
}

export function opponentSummary(analysis) {
  if (analysis.outcome === 'winner') return 'They cannot get a paddle on it in time. Winner.';
  if (analysis.outcome === 'out') return 'This lands out. A smart opponent lets it go.';
  if (analysis.outcome === 'forced-error') return 'They can reach it, but have no reliable reply. Expect an error.';
  const m = analysis.main;
  const how = m.kind === 'volley' ? 'on the volley' : 'after the bounce';
  return `They will most likely take it ${how}, ${zoneName(m.y).replace('the ', 'their ')}, ${r1(m.t)} s after you hit.`;
}

export function moveSummary(plan, L, levels) {
  const dx = plan.target.x - plan.start.x, dy = plan.target.y - plan.start.y;
  const dir = describeDirection(dx, dy);
  const pct = Math.round(plan.getBack * 100);
  const steps = plan.pace.steps;
  const stepsTxt = steps <= 0 ? 'no steps needed' : `${steps} shuffle step${steps === 1 ? '' : 's'}`;
  const goal = L === 0 ? 'to get the ball back' : L === levels - 1 ? 'to attack the reply' : 'for this level';
  if (plan.reachableIdeal) {
    if (plan.dist < 1) return `Hold your ground and split-step ${goal}: you return ${pct}% of their likely replies from here.`;
    const gain = Math.round((plan.targetLevel - plan.stayLevel) * 100);
    const stay = gain >= 1 ? ` Staying put would cost about ${gain}% at this level.` : '';
    return `Recover ${dir} ${goal}: ${stepsTxt}, ${plan.pace.level.label.toLowerCase()} pace. From there you return ${pct}% of their likely replies.${stay}`;
  }
  const idealDir = describeDirection(plan.ideal.x - plan.start.x, plan.ideal.y - plan.start.y);
  return `The ideal spot (${idealDir}) is out of reach in ${r1(plan.tMove)} s. Get as far as ${dir}: you still return ${pct}% of their likely replies.`;
}
