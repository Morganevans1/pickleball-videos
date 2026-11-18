// Ball-flight physics for a pickleball.
//
// Units: feet, seconds, radians. Spin is given in rpm at the API edges.
// Court frame: x runs across the court (the student's right is +x),
// y runs along it (net at y = 0, the student's side is y < 0), z is up.
//
// Spin is limited to topspin / backspin (axis horizontal and perpendicular to
// the direction of travel). With that restriction drag, Magnus lift and the
// bounce all act inside the vertical plane of the shot, so every trajectory is
// a 2D curve (distance along the ground d, height z) that we rotate into place.

export const G = 32.174;                 // ft/s^2
export const MPH = 1.46667;              // ft/s per mph
export const RPM = Math.PI / 30;         // rad/s per rpm

export const COURT = {
  halfW: 10,          // sideline at x = ±10
  halfL: 22,          // baseline at y = ±22
  kitchen: 7,         // non-volley line at y = ±7
  postX: 11,          // net posts 1 ft outside the sidelines
  netCenter: 34 / 12, // 34" at the centre
  netPost: 36 / 12,   // 36" at the posts
};

export const BALL_R = 1.45 / 12;         // 2.9" diameter

// Air and ball constants (slug-ft-s). Pickleballs have holes and a high drag
// coefficient compared with solid balls, which is why hard shots die quickly.
const RHO = 0.002377;                    // slug/ft^3, sea level
const MASS = 0.026 / 14.5939;            // 26 g in slugs
const AREA = Math.PI * BALL_R * BALL_R;
export const CD = 0.40;
const K_AIR = (0.5 * RHO * AREA) / MASS; // 1/ft
const K_DRAG = K_AIR * CD;
const SPIN_DECAY_TAU = 3.0;              // s, spin e-folding time in flight
const MU_COURT = 0.45;                   // ball-court sliding friction

export const SIM_DT = 0.01;

/** Net tape height (ft) at crossing position x. */
export function netHeight(x) {
  const a = Math.min(Math.abs(x), COURT.postX) / COURT.postX;
  return COURT.netCenter + (COURT.netPost - COURT.netCenter) * a * a;
}

function liftCoef(S) {
  return S <= 1e-9 ? 0 : 1 / (2 + 1 / S);
}

// Acceleration in the shot plane. omega > 0 is topspin (Magnus pushes down
// when moving forward), omega < 0 is backspin.
function accel(u, w, omega, out) {
  const v = Math.sqrt(u * u + w * w) + 1e-9;
  let ax = -K_DRAG * v * u;
  let az = -K_DRAG * v * w - G;
  if (omega !== 0) {
    const S = (BALL_R * Math.abs(omega)) / v;
    const f = K_AIR * liftCoef(S) * v * (omega > 0 ? 1 : -1);
    ax += f * w;
    az += f * -u;
  }
  out[0] = ax;
  out[1] = az;
}

const _a1 = [0, 0], _a2 = [0, 0], _a3 = [0, 0], _a4 = [0, 0];

// One RK4 step of (d, z, u, w) in place. Spin is held constant over the step.
function rk4(s, omega, dt) {
  const [, , u, w] = s;
  accel(u, w, omega, _a1);
  const u2 = u + 0.5 * dt * _a1[0], w2 = w + 0.5 * dt * _a1[1];
  accel(u2, w2, omega, _a2);
  const u3 = u + 0.5 * dt * _a2[0], w3 = w + 0.5 * dt * _a2[1];
  accel(u3, w3, omega, _a3);
  const u4 = u + dt * _a3[0], w4 = w + dt * _a3[1];
  accel(u4, w4, omega, _a4);
  s[0] += (dt / 6) * (u + 2 * u2 + 2 * u3 + u4);
  s[1] += (dt / 6) * (w + 2 * w2 + 2 * w3 + w4);
  s[2] += (dt / 6) * (_a1[0] + 2 * _a2[0] + 2 * _a3[0] + _a4[0]);
  s[3] += (dt / 6) * (_a1[1] + 2 * _a2[1] + 2 * _a3[1] + _a4[1]);
}

/** Coefficient of restitution falls slightly with impact speed. */
export function restitution(wImpact) {
  return Math.max(0.45, Math.min(0.7, 0.76 - 0.004 * Math.abs(wImpact)));
}

/**
 * Bounce off the court. Hollow-sphere friction model: the ball slides until
 * friction either runs out or brings the contact point to rolling.
 * Returns [u, w, omega] after the bounce.
 */
export function bounce(u, w, omega) {
  const e = restitution(w);
  const wOut = -e * w;
  const slip = u - BALL_R * omega;          // contact-point speed
  const maxDu = MU_COURT * (1 + e) * Math.abs(w);
  let du;
  if (Math.abs(slip) <= 2.5 * maxDu) du = -slip / 2.5; // reaches rolling
  else du = -Math.sign(slip) * maxDu;                   // slides throughout
  const uOut = u + du;
  const omegaOut = omega - (1.5 * du) / BALL_R;
  return [uOut, wOut, omegaOut];
}

/**
 * Launch velocity components from speed (ft/s) and elevation (rad).
 */
export function launch(v0, theta) {
  return [v0 * Math.cos(theta), v0 * Math.sin(theta)];
}

/**
 * Fly until the first ground contact (or until d > dMax / t > tMax).
 * Calls onSample(d, z, t) every step if given. Used by fast probes.
 * Returns { landD, landT, u, w, omega } at first contact, or landD = NaN if
 * the ball never came down within the limits.
 */
export function flyToGround(z0, v0, theta, omegaRpm, dMax = 60, tMax = 4, onStep = null) {
  const [u0, w0] = launch(v0, theta);
  const s = [0, z0, u0, w0];
  let omega = omegaRpm * RPM;
  const decay = Math.exp(-SIM_DT / SPIN_DECAY_TAU);
  let t = 0;
  let pd = 0, pz = z0;
  while (t < tMax && s[0] <= dMax) {
    pd = s[0]; pz = s[1];
    rk4(s, omega, SIM_DT);
    omega *= decay;
    t += SIM_DT;
    if (onStep) onStep(pd, pz, s[0], s[1], t);
    if (s[1] <= BALL_R && s[3] < 0) {
      const f = (pz - BALL_R) / (pz - s[1] || 1e-9);
      return { landD: pd + f * (s[0] - pd), landT: t - SIM_DT + f * SIM_DT, u: s[2], w: s[3], omega };
    }
  }
  return { landD: NaN, landT: NaN, u: s[2], w: s[3], omega };
}

/**
 * Full trajectory in the shot plane including one bounce, sampled every
 * `dtOut` seconds. Stops at the second ground contact, at tMax, or when the
 * ball has gone dMax along the ground.
 * Returns { t, d, z, speed (Float32Arrays), bounceIdx, landD, landT, land2D }.
 */
export function trajectory(z0, v0, theta, omegaRpm, opts = {}) {
  const { dtOut = 0.02, tMax = 4, dMax = 70, bounces = 1 } = opts;
  const [u0, w0] = launch(v0, theta);
  const s = [0, z0, u0, w0];
  let omega = omegaRpm * RPM;
  const decay = Math.exp(-SIM_DT / SPIN_DECAY_TAU);
  const T = [0], D = [0], Z = [z0], V = [v0];
  let t = 0, nextOut = dtOut, nb = 0;
  let bounceIdx = -1, landD = NaN, landT = NaN, land2D = NaN;
  while (t < tMax && s[0] <= dMax) {
    const pd = s[0], pz = s[1];
    rk4(s, omega, SIM_DT);
    omega *= decay;
    t += SIM_DT;
    if (s[1] <= BALL_R && s[3] < 0) {
      const f = (pz - BALL_R) / (pz - s[1] || 1e-9);
      const bd = pd + f * (s[0] - pd), bt = t - SIM_DT + f * SIM_DT;
      T.push(bt); D.push(bd); Z.push(BALL_R); V.push(Math.hypot(s[2], s[3]));
      nb++;
      if (nb === 1) { landD = bd; landT = bt; bounceIdx = T.length - 1; }
      else { land2D = bd; break; }
      if (nb > bounces) break;
      const [ub, wb, ob] = bounce(s[2], s[3], omega);
      s[0] = bd; s[1] = BALL_R + 1e-4; s[2] = ub; s[3] = wb; omega = ob;
      t = bt; nextOut = bt + dtOut;
      continue;
    }
    if (t >= nextOut - 1e-9) {
      T.push(t); D.push(s[0]); Z.push(s[1]); V.push(Math.hypot(s[2], s[3]));
      nextOut += dtOut;
    }
  }
  return {
    t: Float32Array.from(T), d: Float32Array.from(D), z: Float32Array.from(Z),
    speed: Float32Array.from(V), bounceIdx, landD, landT, land2D,
  };
}

/** Interpolate the height of a sampled trajectory at ground distance dq (first pass). */
export function heightAt(traj, dq) {
  const { d, z } = traj;
  const end = traj.bounceIdx >= 0 ? traj.bounceIdx : d.length - 1;
  for (let i = 1; i <= end; i++) {
    if (d[i] >= dq) {
      const f = (dq - d[i - 1]) / (d[i] - d[i - 1] || 1e-9);
      return { z: z[i - 1] + f * (z[i] - z[i - 1]), t: traj.t[i - 1] + f * (traj.t[i] - traj.t[i - 1]) };
    }
  }
  return null;
}

/** Simple on-court tests in the court frame. */
export function inCourt(x, y, side) {
  // side = +1 for the far (opponent) half, -1 for the near (student) half.
  if (Math.abs(x) > COURT.halfW) return false;
  return side > 0 ? y > 0 && y <= COURT.halfL : y < 0 && y >= -COURT.halfL;
}
