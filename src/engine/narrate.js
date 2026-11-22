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
  return `They ${contactWords(analysis)}, ${zoneName(m.y).replace('the ', 'their ')}, ${r1(m.t)} s after you hit.`;
}

// Say whether bouncing is the rule, the only option, or a choice.
function contactWords(analysis) {
  const m = analysis.main;
  if (analysis.mustBounce) return 'must let it bounce (two-bounce rule) and will take it';
  if (m.kind === 'bounce' && !analysis.couldVolley) return 'cannot reach it in the air and will take it after the bounce';
  return `will most likely take it ${m.kind === 'volley' ? 'on the volley' : 'after the bounce'}`;
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

// ---------------------------------------------------------------- doubles

const sideOf = (x) => (Math.abs(x) < 2 ? 'in the middle' : x < 0 ? 'on your left' : 'on your right');

export function doublesOpponentSummary(analysis) {
  if (analysis.outcome !== 'rally') return opponentSummary(analysis);
  const m = analysis.main;
  const who = m.who === 0 ? 'Opponent A' : 'Opponent B';
  return `${who} (${sideOf(m.x)}) ${contactWords(analysis)}, ${zoneName(m.y).replace('the ', 'their ')}, ${r1(m.t)} s after the hit.`;
}

function moveWords(plan) {
  const d = describeDirection(plan.target.x - plan.start.x, plan.target.y - plan.start.y);
  if (plan.dist < 1) return 'hold your spot';
  const steps = plan.pace.steps;
  return `${d} (${steps <= 0 ? 'a half step' : `${steps} step${steps === 1 ? '' : 's'}`}, ${plan.pace.level.label.toLowerCase()})`;
}

/**
 * @param tp      teamPlan() result
 * @param shares  { you, partner, call } shares of likely replies (0–1)
 */
export function doublesMoveSummary(tp, shares) {
  const [you, partner] = tp.plans;
  const pct = Math.round(tp.getBack * 100);
  const youTxt = you.dist < 1 ? 'Hold your spot' : `Move ${moveWords(you)}`;
  const partnerTxt = partner.dist < 1 ? 'your partner holds theirs' : `your partner moves ${moveWords(partner).replace(/to your (left|right)/g, 'to the $1')}`;
  let t = tp.made
    ? `${youTxt}; ${partnerTxt}. Together you return ${pct}% of their likely replies.`
    : `The best pair of spots is out of reach in time. ${youTxt}; ${partnerTxt}. That still returns ${pct}% of their likely replies.`;
  if (shares) {
    const y = Math.round(shares.you * 100), p = Math.round(shares.partner * 100);
    t += ` You take about ${y}% of them, your partner ${p}%.`;
    if (shares.call >= 0.06) t += ` About ${Math.round(shares.call * 100)}% land in the yellow "call it" area, where you are equally well placed: decide early who takes them, and say it out loud.`;
  }
  return t;
}
