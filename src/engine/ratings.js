// Player profiles by rating (2.5 – 7.5, pro from 6.0).
//
// Every number here is a starting estimate for coaches to tune. Ratings set two
// groups of values: movement (reaction, speed) and execution (aim/pace error,
// power, spin). Movement can be set separately from skill.

export const RATING_MIN = 2.5;
export const RATING_MAX = 7.5;
export const PRO_RATING = 6.0;

// rating, reaction s, lateral top speed ft/s, aim error deg (1 sd),
// pace error (fraction, 1 sd), max drive mph, max topspin rpm
const TABLE = [
  [2.5, 0.40, 8.0, 4.0, 0.15, 30, 800],
  [3.5, 0.33, 10.0, 3.0, 0.11, 38, 1200],
  [4.5, 0.28, 12.0, 2.2, 0.08, 45, 1600],
  [5.5, 0.24, 14.0, 1.6, 0.06, 52, 2000],
  [6.0, 0.22, 15.0, 1.3, 0.05, 55, 2200],
  [7.0, 0.20, 16.0, 1.0, 0.04, 60, 2500],
  [7.5, 0.19, 17.0, 0.9, 0.035, 62, 2700],
];

export const RATING_TABLE = TABLE.map(([rating, reaction, topSpeed, aimErr, paceErr, maxDrive, maxTopspin]) => ({
  rating, reaction, topSpeed, aimErr, paceErr, maxDrive, maxTopspin,
}));

function interp(r, col) {
  const x = Math.max(RATING_MIN, Math.min(RATING_MAX, r));
  for (let i = 1; i < TABLE.length; i++) {
    if (x <= TABLE[i][0]) {
      const [r0, r1] = [TABLE[i - 1][0], TABLE[i][0]];
      const f = (x - r0) / (r1 - r0);
      return TABLE[i - 1][col] + f * (TABLE[i][col] - TABLE[i - 1][col]);
    }
  }
  return TABLE[TABLE.length - 1][col];
}

export function ratingLabel(r) {
  return r >= PRO_RATING ? `${r.toFixed(1)} Pro` : r.toFixed(1);
}

/**
 * Build a player profile. `movement` defaults to the skill rating.
 */
export function makeProfile(skill, movement = skill) {
  const topSpeed = interp(movement, 2);
  return {
    skill, movement,
    reaction: interp(movement, 1),
    topSpeed,
    accel: topSpeed / 0.45,           // reaches top speed in ~0.45 s
    reach: 4.0,                       // body centre to paddle with a lunge, ft
    stepLength: 2.5,                  // a shuffle step, ft
    followThrough: 0.2,               // s after contact before recovery starts
    aimErr: interp(skill, 3),
    paceErr: interp(skill, 4),
    maxDrive: interp(skill, 5),
    maxTopspin: interp(skill, 6),
    maxBackspin: 0.7 * interp(skill, 6),
  };
}

/** Time (s) to cover `dist` ft from a standing start, no reaction included. */
export function travelTime(dist, p) {
  if (dist <= 0) return 0;
  const tAcc = p.topSpeed / p.accel;
  const dAcc = 0.5 * p.accel * tAcc * tAcc;
  if (dist <= dAcc) return Math.sqrt((2 * dist) / p.accel);
  return tAcc + (dist - dAcc) / p.topSpeed;
}

/** Distance (ft) coverable in time t from a standing start. */
export function travelDistance(t, p) {
  if (t <= 0) return 0;
  const tAcc = p.topSpeed / p.accel;
  if (t <= tAcc) return 0.5 * p.accel * t * t;
  return 0.5 * p.accel * tAcc * tAcc + (t - tAcc) * p.topSpeed;
}

export const PACE_LEVELS = [
  { max: 0.001, label: 'Stay', key: 'stay' },
  { max: 0.35, label: 'Walk', key: 'walk' },
  { max: 0.6, label: 'Jog', key: 'jog' },
  { max: 0.85, label: 'Shuffle hard', key: 'shuffle' },
  { max: 1.0, label: 'Sprint', key: 'sprint' },
  { max: Infinity, label: 'Not possible', key: 'impossible' },
];

/**
 * How hard the move is: fastest possible travel time divided by the time
 * available. Over 1 means it cannot be done.
 */
export function paceFor(dist, timeAvailable, p) {
  const need = travelTime(dist, p);
  const intensity = dist < 0.5 ? 0 : need / Math.max(timeAvailable, 1e-3);
  const level = PACE_LEVELS.find((l) => intensity <= l.max);
  return {
    intensity,
    level,
    steps: Math.round(dist / p.stepLength),
    avgSpeed: dist / Math.max(timeAvailable, 1e-3),
    need,
  };
}
