// App wiring: state, controls, drag handling, animation.

import {
  DEFAULT_STATE, profilesFor, solveStudentShot, solveIncoming, analyse,
  isDoubles, partnerHits, hitterOf, withDoublesPositions, looksLikeReturn,
} from './engine/scenario.js';
import { SHOTS, shotById } from './engine/solver.js';
import { LEVELS, movePlan, scoreAt, replyValues } from './engine/recovery.js';
import { teamPlan, teamHeat, teamScoreAt, replyOwners, coverageZones, cellOf } from './engine/team.js';
import { travelTime, travelDistance, PRO_RATING } from './engine/ratings.js';
import {
  shotSummary, opponentSummary, moveSummary, describeDirection, zoneName,
  doublesOpponentSummary, doublesMoveSummary,
} from './engine/narrate.js';
import { BALL_R, netHeight } from './engine/physics.js';
import { readTheme, courtView, sideView, drawCourt, drawSide, posAt } from './render.js';
import { initGuide } from './guide.js';

const STORE_KEY = 'recovery-coach-v1';

const SINGLES_EXAMPLES = [
  { name: 'Deep crosscourt drive', state: {} }, // the default state
  { name: 'Third-shot drop', state: {
    student: { x: -1, y: -20, z: 1.6 }, opponent: { x: 2, y: 8.5 }, shotId: 'drop', target: { x: -1.5, y: 3.5 }, clearance: 1.2,
  } },
  { name: 'Dink exchange', state: {
    student: { x: -3, y: -7.6, z: 1.0 }, opponent: { x: 2, y: 8 }, shotId: 'dink', target: { x: 4, y: 4.5 }, clearance: 0.5,
  } },
  { name: 'Speed-up at the kitchen', state: {
    student: { x: -2, y: -7.6, z: 2.8 }, opponent: { x: 1, y: 7.8 }, shotId: 'speedup', target: { x: 2.5, y: 9.5 }, clearance: 0.4,
  } },
  { name: 'Lob over a net player', state: {
    student: { x: 1, y: -8, z: 2.2 }, opponent: { x: 0, y: 8 }, shotId: 'lob', target: { x: -3, y: 19 }, clearance: 9,
  } },
  { name: 'Overhead put-away', state: {
    student: { x: 0, y: -9, z: 7.5 }, opponent: { x: -2, y: 16 }, shotId: 'overhead', target: { x: 6, y: 12 }, clearance: 3,
  } },
  { name: 'Return of serve', state: {
    student: { x: 4, y: -21, z: 2.4 }, opponent: { x: -4, y: 21.5 }, shotId: 'drive', target: { x: -2, y: 18.5 }, clearance: 2.5, rule: 'return',
  } },
];

const NET_TEAM = { opponent: { x: -4, y: 7.8 }, opponent2: { x: 4, y: 7.8 } };
const DOUBLES_EXAMPLES = [
  { name: 'Third-shot drop', state: {
    student: { x: 4, y: -20, z: 1.6 }, partner: { x: -4, y: -20, z: 1.6 }, opponent: { x: -4, y: 8 }, opponent2: { x: 4, y: 8 },
    shotId: 'drop', target: { x: -3, y: 3.5 }, clearance: 1.2,
  } },
  { name: 'Crosscourt dink battle', state: {
    student: { x: 4, y: -7.6, z: 1.0 }, partner: { x: -4, y: -7.6, z: 1.0 }, ...NET_TEAM,
    shotId: 'dink', target: { x: -4, y: 4.5 }, clearance: 0.5,
  } },
  { name: 'Your partner dinks crosscourt', state: {
    hitter: 'partner', student: { x: 4, y: -7.6, z: 1.0 }, partner: { x: -4, y: -7.6, z: 1.0 }, ...NET_TEAM,
    shotId: 'dink', target: { x: 4, y: 4.5 }, clearance: 0.5,
  } },
  { name: 'Speed-up, all four at the net', state: {
    student: { x: -2, y: -7.6, z: 2.8 }, partner: { x: 5, y: -7.6, z: 2.0 }, opponent: { x: -4, y: 7.8 }, opponent2: { x: 3, y: 7.8 },
    shotId: 'speedup', target: { x: 3.5, y: 9 }, clearance: 0.4,
  } },
  { name: 'Return and come in', state: {
    rule: 'return', student: { x: 5, y: -21, z: 2.4 }, partner: { x: -4, y: -8, z: 2.0 }, opponent: { x: -5, y: 21.5 }, opponent2: { x: 5, y: 21 },
    shotId: 'drive', target: { x: -3, y: 19 }, clearance: 2.5,
  } },
  { name: 'Lob over the net team', state: {
    student: { x: 3, y: -7.8, z: 2.2 }, partner: { x: -4, y: -7.8, z: 2.0 }, opponent: { x: -4, y: 8 }, opponent2: { x: 4, y: 8 },
    shotId: 'lob', target: { x: -3, y: 19 }, clearance: 9,
  } },
  { name: 'Drive down the middle', state: {
    student: { x: 3, y: -19, z: 2.5 }, partner: { x: -4, y: -19, z: 2.0 }, opponent: { x: -4, y: 19 }, opponent2: { x: 4, y: 19 },
    shotId: 'drive', target: { x: 0, y: 18 }, clearance: 1.5,
  } },
];

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULT_STATE);
}
let saveTimer = 0;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, 300);
}

let state = loadState();
const ui = {
  step: 4, level: 5, mode: 'lesson', guess: null, revealed: false, focus: 0, keepRally: false,
  layers: { heat: true, fan: true, zones: true, split: true },
};
let profiles = profilesFor(state);
let shot = null, incoming = null, analysis = null, stale = true;
let plan = null, view = null, featured = { likely: -1, danger: -1 };
let drag = null, sideZMax = 10, anim = null;
let theme = readTheme();

const court = $('court'), side = $('side');
const cctx = court.getContext('2d'), sctx = side.getContext('2d');
let cv = courtView(1, 1), sv = sideView(1, 1, cv, 10);

const doubles = () => isDoubles(state);
const examples = () => (doubles() ? DOUBLES_EXAMPLES : SINGLES_EXAMPLES);

// ---------------------------------------------------------------- compute

function computeFast({ withIncoming = true } = {}) {
  profiles = profilesFor(state);
  shot = solveStudentShot(state, profiles);
  if (withIncoming) incoming = solveIncoming(state);
}

let slowTimer = 0;
function scheduleSlow(delay = 40) {
  stale = true;
  clearTimeout(slowTimer);
  $('busy').hidden = false;
  slowTimer = setTimeout(() => {
    try {
      analysis = shot && shot.ok ? analyse(state, shot, profiles) : null;
    } catch (err) {
      console.error(err);
      analysis = null;
    }
    stale = false;
    $('busy').hidden = true;
    if (ui.mode === 'predict') { ui.guess = null; ui.revealed = false; }
    derive();
    refresh();
  }, delay);
  refresh();
}

/** Turn the analysis into what the screen shows at the current level. */
function derive() {
  plan = null; view = null; featured = { likely: -1, danger: -1 };
  if (!analysis || analysis.outcome !== 'rally') return;
  const rec = analysis.rec, L = ui.level;

  if (analysis.doubles) {
    const tp = teamPlan(rec, L);
    const focus = ui.focus;
    const other = tp.plans[1 - focus].target;
    const owners = replyOwners(rec, tp.plans[0].target, tp.plans[1].target, Math.max(L, 5));
    const n = owners.length || 1;
    const shares = { you: 0, partner: 0, call: 0 };
    analysis.replies.forEach((r, i) => {
      const o = owners[i];
      if (o === 0) shares.you += r.w; else if (o === 1) shares.partner += r.w; else if (o === 2) shares.call += r.w;
    });
    const tot = analysis.replies.reduce((a, r) => a + r.w, 0) || n;
    for (const k of Object.keys(shares)) shares[k] /= tot;
    const p = tp.plans[focus];
    view = {
      plans: tp.plans, focus, tp, shares, owners,
      grid: rec.grid, heat: teamHeat(rec, L, focus, other.x, other.y),
      zones: coverageZones(analysis.replies, owners),
      reach: { x: p.start.x, y: p.start.y, r: travelDistance(p.tMove, p.profile) },
      ceiling: rec.ceiling, tMove: p.tMove, getBack: tp.getBack,
    };
    plan = p;
  } else {
    plan = movePlan(rec, L);
    view = {
      plans: [plan], focus: 0, grid: rec.grid, heat: rec.scores[L],
      reach: { x: state.student.x, y: state.student.y, r: travelDistance(rec.tMove, profiles.student) },
      ceiling: rec.ceiling, tMove: rec.tMove, getBack: plan.getBack,
    };
  }

  // Most likely: the reply that lands nearest the busiest landing cell.
  const d = analysis.density;
  let peak = 0;
  for (let i = 1; i < d.w.length; i++) if (d.w[i] > d.w[peak]) peak = i;
  const px = d.x0 + ((peak % d.nx) + 0.5) * d.cell, py = d.y0 + (Math.floor(peak / d.nx) + 0.5) * d.cell;
  let bestD = Infinity;
  analysis.replies.forEach((r, i) => {
    const dd = Math.hypot(r.landX - px, r.landY - py);
    if (dd < bestD) { bestD = dd; featured.likely = i; }
  });
  // Most dangerous: the reply the recovery spot(s) handle worst.
  let vals;
  if (analysis.doubles) {
    const qa = cellOf(view.plans[0].target.x, view.plans[0].target.y), qb = cellOf(view.plans[1].target.x, view.plans[1].target.y);
    vals = analysis.replies.map((_, r) => Math.max(rec.V[0][rec.at(0, qa) + r], rec.V[1][rec.at(0, qb) + r]));
  } else {
    vals = replyValues(rec, plan.target.x, plan.target.y, 0);
  }
  let worst = -1;
  vals.forEach((v, i) => { if (i !== featured.likely && (worst < 0 || v < vals[worst])) worst = i; });
  featured.danger = worst;
}

function recomputeAll() {
  computeFast();
  scheduleSlow();
  saveState();
}

// ---------------------------------------------------------------- drawing

let drawQueued = false;
function requestDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; draw(); });
}

function sizeCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [w, h];
}

function scene() {
  const showAnswer = ui.mode === 'lesson' || ui.revealed;
  const an = stale ? null : analysis;
  return {
    state, step: anim ? anim.step : ui.step, layers: ui.layers, incoming, shot, analysis: an,
    view: an && an.outcome === 'rally' ? view : null,
    showAnswer: showAnswer && !anim, level: ui.level, guess: ui.guess, featured,
    anim: anim ? anim.frame : null,
    doubles: doubles(), hitter: hitterOf(state), partnerHits: partnerHits(state),
    oppReach: profiles.opponent.reach,
    hideIncoming: drag && ['you', 'partner', 'opp', 'opp2', 'contact'].includes(drag.kind),
  };
}

function draw() {
  const [cw, ch] = sizeCanvas(court, cctx);
  const [sw, sh] = sizeCanvas(side, sctx);
  cv = courtView(cw, ch);
  if (!drag) {
    let zTop = Math.max(hitterOf(state).z + 2, 8);
    if (shot && shot.ok) for (let i = 0; i < shot.path.n; i++) zTop = Math.max(zTop, shot.path.z[i] + 1.5);
    sideZMax = Math.min(24, Math.ceil(zTop));
  }
  sv = sideView(sw, sh, cv, sideZMax);
  const s = scene();
  drawCourt(cctx, cv, theme, s);
  drawSide(sctx, sv, theme, s);
}

// ---------------------------------------------------------------- UI text

function fmt(v, d = 1) { return Number.isFinite(v) ? v.toFixed(d) : '–'; }
const pressed = (sel, attr, value) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));

function refresh() {
  $('app').dataset.format = state.format;
  document.querySelectorAll('.step').forEach((b) => {
    const n = Number(b.dataset.step);
    const cur = anim ? anim.step : ui.step;
    if (n === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', n < cur);
  });
  pressed('#format button', 'format', state.format);
  pressed('#mode button', 'mode', ui.mode);
  pressed('#hitter button', 'hitter', state.hitter);
  pressed('#focus button', 'focus', ui.focus === 1 ? 'partner' : 'you');
  pressed('.shot-btn', 'shot', state.shotId);
  $('shot-blurb').textContent = shotById(state.shotId).blurb;
  pressed('#rule button', 'rule', state.rule);
  document.querySelectorAll('#incoming button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.incoming === (state.rule === 'return' ? 'bounce' : state.incoming)));
    b.disabled = state.rule === 'return';
  });
  $('rule-hint').textContent = state.rule === 'return'
    ? 'The serve bounced before it was hit, and the return must bounce before the serving team can play it.'
    : 'Anyone can volley from outside the kitchen.';
  $('opp-label').textContent = doubles() ? 'Opponent A' : 'Opponent';

  for (const [id, v] of [['student', state.studentSkill], ['opp', state.oppSkill], ['partner', state.partnerSkill], ['opp2', state.opp2Skill]]) {
    setRating(`o-${id}`, v);
    $(`r-${id}`).value = v;
  }
  setRating('o-move', state.linkMove ? state.studentSkill : state.studentMove);
  $('r-move').value = state.linkMove ? state.studentSkill : state.studentMove;
  $('r-move').disabled = state.linkMove;
  $('link-move').checked = state.linkMove;

  refreshAmbition();
  refreshSummary();
  requestDraw();
}

function setRating(id, v) {
  const o = $(id);
  o.textContent = v.toFixed(1);
  o.classList.toggle('pro', v >= PRO_RATING);
}

function refreshAmbition() {
  const v = !stale && view ? view : null;
  // Keep the thumb inside the track: positions run from 26px to (height - 26px).
  const at = (f) => `calc(26px + (100% - 52px) * ${clamp(f, 0, 1).toFixed(4)})`;
  const f = ui.level / (LEVELS - 1);
  $('amb-thumb').style.bottom = at(f);
  $('amb-fill').style.height = at(f);
  $('amb-val').textContent = String(ui.level);
  $('amb').setAttribute('aria-valuenow', String(ui.level));
  const ceil = $('amb-ceiling'), over = $('amb-over');
  ceil.querySelector('span').textContent = doubles() ? 'Team ceiling' : 'Your ceiling';
  const hide = !v || v.ceiling >= LEVELS - 1 || (ui.mode === 'predict' && !ui.revealed);
  ceil.hidden = hide; over.hidden = hide;
  let isOver = false;
  if (!hide) {
    const pos = clamp((v.ceiling + 0.5) / (LEVELS - 1), 0, 1);
    ceil.style.bottom = at(pos);
    over.style.height = `calc(100% - ${at(pos)})`;
    isOver = ui.level > v.ceiling;
    ceil.classList.toggle('below', isOver);
  }
  $('amb').setAttribute('aria-valuetext', `Level ${ui.level} of ${LEVELS - 1}${isOver ? ', above the ceiling' : ''}`);
  $('amb-thumb').classList.toggle('over', isOver);
}

function refreshSummary() {
  const rally = !stale && analysis && analysis.outcome === 'rally' && view;
  const showAnswer = ui.mode === 'lesson' || ui.revealed;
  const show = rally && showAnswer && ui.step >= 4 && plan;
  $('s-time').textContent = rally && ui.step >= 3 ? `${fmt(view.tMove, 2)} s` : '–';
  $('s-dist').textContent = show ? `${Math.round(plan.idealDist)} ft` : '–';
  $('s-steps').textContent = show ? String(plan.idealPace.steps) : '–';
  $('s-ret-k').textContent = doubles() ? 'Team returns' : 'Replies returned';
  $('s-ret').textContent = show ? `${Math.round(view.getBack * 100)}%` : '–';
  const order = ['walk', 'jog', 'shuffle', 'sprint', 'impossible'];
  const k = order.indexOf(show ? plan.idealPace.level.key : null);
  document.querySelectorAll('#pace-bar span').forEach((sp, i) => {
    sp.classList.toggle('on', i === k);
    sp.classList.toggle('lit', k >= 0 && i < k);
  });

  // Coach's note
  const parts = [];
  const step = anim ? anim.step : ui.step;
  const pHits = partnerHits(state);
  const h = hitterOf(state);
  if (incoming) {
    const taker = pHits ? 'your partner takes' : 'you take';
    if (state.rule === 'return') {
      parts.push([1, `The serve must bounce (two-bounce rule), and ${taker} it at ${h.z.toFixed(1)} ft, ${zoneName(h.y)}. The return must bounce too.`]);
    } else {
      const who = pHits ? 'your partner, who takes' : 'you and you take';
      parts.push([1, `The ball comes to ${who} it ${incoming.kind === 'volley' ? 'in the air' : 'after the bounce'} at ${h.z.toFixed(1)} ft, ${zoneName(h.y)}.`]);
    }
  }
  if (shot && shot.ok && step >= 2) {
    let t = shotSummary(shot);
    if (pHits) t = t.replace(/^Your /, "Your partner's ");
    const hp = pHits ? profiles.partner : profiles.student;
    const skill = pHits ? state.partnerSkill : state.studentSkill;
    if (shot.tooFast) t += ` That is more pace than a typical ${skill.toFixed(1)} can produce (about ${Math.round(hp.maxDrive)} mph).`;
    parts.push([2, t]);
  }
  if (step >= 3 && !stale && analysis) parts.push([3, analysis.doubles || doubles() ? doublesOpponentSummary(analysis) : opponentSummary(analysis)]);
  if (step >= 4 && show) parts.push([4, analysis.doubles ? doublesMoveSummary(view.tp, view.shares) : moveSummary(plan, ui.level, LEVELS)]);
  const note = $('note');
  note.innerHTML = '';
  parts.forEach(([n, t], i) => {
    const span = document.createElement(n === step ? 'b' : 'span');
    span.textContent = (i ? ' ' : '') + t;
    note.appendChild(span);
  });
  if (stale) note.appendChild(Object.assign(document.createElement('span'), { textContent: parts.length ? ' Working out their options…' : 'Working out their options…' }));

  // Serve-and-return formation while Rules says "Rally": offer the rule.
  $('suggest').hidden = !(looksLikeReturn(state) && !ui.keepRally && !anim);

  // Banner
  const banner = $('banner');
  let msg = null, warn = false;
  if (shot && !shot.ok) { msg = 'That shot is not possible from here. Raise the net clearance or move the target.'; warn = true; }
  else if (!stale && analysis && analysis.outcome !== 'rally' && ui.step >= 3) msg = opponentSummary(analysis);
  banner.hidden = !msg;
  if (msg) { banner.textContent = msg; banner.classList.toggle('warn', warn); }

  // Predict panel
  const predict = $('predict');
  predict.hidden = !(ui.mode === 'predict' && ui.step >= 4);
  if (!predict.hidden) {
    $('reveal').disabled = !ui.guess || !rally;
    $('reveal').hidden = ui.revealed;
    $('retry').hidden = !ui.revealed;
    $('predict-text').textContent = predictText(rally);
  }
  $('play').disabled = !(shot && shot.ok) || (ui.mode === 'predict' && !ui.revealed);
}

function predictText(rally) {
  if (!rally) return 'This shot does not lead to a rally. Pick another shot to quiz on.';
  if (!ui.guess) return doubles()
    ? 'Where should YOU be when they hit it? Tap your spot (the teal player).'
    : 'Where should you be when they hit it? Tap your side of the court.';
  if (!ui.revealed) return 'Happy with that spot? Reveal the answer, or tap again to move it.';
  const rec = analysis.rec, g = ui.guess;
  const me = view.plans[0];
  let yours, lvl;
  if (analysis.doubles) {
    const mate = view.plans[1].target;
    yours = teamScoreAt(rec, 0, g, mate);
    lvl = teamScoreAt(rec, ui.level, g, mate) / (me.idealScore || 1);
  } else {
    yours = scoreAt(rec, 0, g.x, g.y);
    lvl = scoreAt(rec, ui.level, g.x, g.y) / (me.ideal.score || 1);
  }
  const off = Math.hypot(g.x - me.ideal.x, g.y - me.ideal.y);
  const inTime = travelTime(Math.hypot(g.x - me.start.x, g.y - me.start.y), profiles.student) <= view.plans[0].tMove;
  const dir = describeDirection(me.ideal.x - g.x, me.ideal.y - g.y);
  const who = analysis.doubles ? 'your team returns' : 'you return';
  return `From your spot ${who} ${Math.round(yours * 100)}% of their likely replies (best ${Math.round(view.getBack * 100)}%), `
    + `scoring ${Math.round(Math.min(1, lvl) * 100)}% of the best at this ambition level. `
    + (off < 1.5 ? 'You were right on it. ' : `The best spot is ${dir} of your guess. `)
    + (inTime ? 'You could get there in time.' : 'You could not get there in time.');
}

// ---------------------------------------------------------------- controls

function fillExamples() {
  const sel = $('example');
  sel.length = 1;
  examples().forEach((ex, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = ex.name;
    sel.appendChild(o);
  });
}

const KEEP = ['studentSkill', 'studentMove', 'linkMove', 'oppSkill', 'partnerSkill', 'opp2Skill', 'format'];

function setFormat(f) {
  if (f === state.format) return;
  stopPlay();
  state.format = f;
  if (f === 'doubles') {
    const ok = state.partner && state.partner.y < 0 && state.opponent2 && state.opponent2.y > 0
      && Math.hypot(state.partner.x - state.student.x, state.partner.y - state.student.y) >= 3
      && Math.hypot(state.opponent2.x - state.opponent.x, state.opponent2.y - state.opponent.y) >= 3;
    if (!ok) state = withDoublesPositions(state);
  }
  ui.focus = 0; ui.guess = null; ui.revealed = false; ui.keepRally = false;
  fillExamples();
  recomputeAll();
}

function buildControls() {
  const shots = $('shots');
  for (const s of SHOTS) {
    const b = document.createElement('button');
    b.className = 'shot-btn'; b.dataset.shot = s.id; b.textContent = s.name; b.type = 'button';
    b.addEventListener('click', () => selectShot(s.id));
    shots.appendChild(b);
  }
  fillExamples();
  const sel = $('example');
  sel.addEventListener('change', () => {
    if (sel.value === '') return;
    const ex = examples()[Number(sel.value)];
    const keep = Object.fromEntries(KEEP.map((k) => [k, state[k]]));
    state = { ...structuredClone(DEFAULT_STATE), ...structuredClone(ex.state), ...keep };
    sel.value = '';
    ui.guess = null; ui.revealed = false; ui.keepRally = false;
    recomputeAll();
  });

  document.querySelectorAll('#format button').forEach((b) => b.addEventListener('click', () => setFormat(b.dataset.format)));
  document.querySelectorAll('#hitter button').forEach((b) => b.addEventListener('click', () => {
    if (state.hitter === b.dataset.hitter) return;
    state.hitter = b.dataset.hitter;
    ui.guess = null; ui.revealed = false;
    recomputeAll();
  }));
  document.querySelectorAll('#focus button').forEach((b) => b.addEventListener('click', () => {
    ui.focus = b.dataset.focus === 'partner' ? 1 : 0;
    derive();
    refresh();
  }));
  document.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => {
    stopPlay();
    ui.step = Number(b.dataset.step);
    refresh();
  }));
  document.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => {
    stopPlay();
    ui.mode = b.dataset.mode;
    ui.guess = null; ui.revealed = false;
    if (ui.mode === 'predict') ui.step = 4;
    refresh();
  }));
  document.querySelectorAll('#rule button').forEach((b) => b.addEventListener('click', () => { state.rule = b.dataset.rule; recomputeAll(); }));
  document.querySelectorAll('#incoming button').forEach((b) => b.addEventListener('click', () => { state.incoming = b.dataset.incoming; computeFast(); refresh(); saveState(); }));

  const rating = (id, apply) => {
    let t = 0;
    $(id).addEventListener('input', (e) => {
      apply(Number(e.target.value));
      computeFast({ withIncoming: false });
      stale = true;
      refresh();
      clearTimeout(t);
      t = setTimeout(() => { scheduleSlow(0); saveState(); }, 250);
    });
  };
  rating('r-student', (v) => { state.studentSkill = v; });
  rating('r-move', (v) => { state.studentMove = v; });
  rating('r-opp', (v) => { state.oppSkill = v; });
  rating('r-partner', (v) => { state.partnerSkill = v; });
  rating('r-opp2', (v) => { state.opp2Skill = v; });
  $('link-move').addEventListener('change', (e) => {
    state.linkMove = e.target.checked;
    if (!state.linkMove) state.studentMove = state.studentSkill;
    recomputeAll();
  });

  for (const [id, key] of [['l-heat', 'heat'], ['l-fan', 'fan'], ['l-zones', 'zones'], ['l-split', 'split']]) {
    $(id).addEventListener('change', (e) => { ui.layers[key] = e.target.checked; requestDraw(); });
  }

  $('suggest-apply').addEventListener('click', () => { state.rule = 'return'; recomputeAll(); });
  $('suggest-dismiss').addEventListener('click', () => { ui.keepRally = true; refresh(); });
  $('reveal').addEventListener('click', () => { ui.revealed = true; refresh(); });
  $('retry').addEventListener('click', () => { ui.guess = null; ui.revealed = false; refresh(); });
  $('play').addEventListener('click', () => (anim ? stopPlay() : startPlay()));

  setupAmbition();
  setupCourtDrag();
  setupSideDrag();
}

function selectShot(id) {
  const s = shotById(id);
  const h = hitterOf(state);
  state.shotId = id;
  state.target = s.target(h);
  state.clearance = s.clearance;
  if (id === 'overhead' && h.z < 6) h.z = 7.5;
  if (id !== 'overhead' && h.z > 6.5) h.z = 3;
  ui.guess = null; ui.revealed = false;
  recomputeAll();
}

function setupAmbition() {
  const track = $('amb');
  const setFromY = (clientY) => {
    const r = track.getBoundingClientRect();
    const f = 1 - (clientY - r.top - 26) / Math.max(1, r.height - 52);
    setLevel(Math.round(clamp(f, 0, 1) * (LEVELS - 1)));
  };
  let active = false;
  track.addEventListener('pointerdown', (e) => { active = true; track.setPointerCapture(e.pointerId); setFromY(e.clientY); });
  track.addEventListener('pointermove', (e) => { if (active) setFromY(e.clientY); });
  track.addEventListener('pointerup', () => { active = false; });
  track.addEventListener('pointercancel', () => { active = false; });
  track.addEventListener('keydown', (e) => {
    const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 };
    if (e.key in map) { setLevel(clamp(ui.level + map[e.key], 0, LEVELS - 1)); e.preventDefault(); }
    if (e.key === 'Home') { setLevel(0); e.preventDefault(); }
    if (e.key === 'End') { setLevel(LEVELS - 1); e.preventDefault(); }
  });
}

function setLevel(L) {
  if (L === ui.level) return;
  ui.level = L;
  if (ui.mode === 'lesson' && ui.step < 4) ui.step = 4;
  derive();
  refresh();
}

function pointerPos(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function courtHandles() {
  const hs = [['you', state.student], ['opp', state.opponent]];
  if (doubles()) hs.push(['partner', state.partner], ['opp2', state.opponent2]);
  if (ui.step >= 2) hs.push(['target', state.target]);
  return hs;
}

function setupCourtDrag() {
  court.addEventListener('pointerdown', (e) => {
    if (anim) return;
    const [px, py] = pointerPos(court, e);
    let best = null, bestD = 34;
    for (const [kind, p] of courtHandles()) {
      const d = Math.hypot(cv.sx(p.y) - px, cv.sy(p.x) - py);
      if (d < bestD) { bestD = d; best = kind; }
    }
    if (best) {
      drag = { kind: best, x0: px, y0: py, moved: false };
      court.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const c = cv.toCourt(px, py);
    if (ui.mode === 'predict' && ui.step >= 4 && !ui.revealed && c.y < 0) {
      ui.guess = { x: clamp(c.x, -13, 13), y: clamp(c.y, -27, -0.3) };
      refresh();
    }
  });
  court.addEventListener('pointermove', (e) => {
    const [px, py] = pointerPos(court, e);
    if (!drag) {
      court.style.cursor = courtHandles().some(([, p]) => Math.hypot(cv.sx(p.y) - px, cv.sy(p.x) - py) < 34) ? 'grab' : 'default';
      return;
    }
    if (!drag.moved && Math.hypot(px - drag.x0, py - drag.y0) < 6) return; // still a tap
    drag.moved = true;
    const c = cv.toCourt(px, py);
    const near = (p) => { p.x = clamp(c.x, -13, 13); p.y = clamp(c.y, -27, -0.5); };
    const far = (p) => { p.x = clamp(c.x, -13, 13); p.y = clamp(c.y, 0.5, 27); };
    if (drag.kind === 'you') near(state.student);
    if (drag.kind === 'partner') near(state.partner);
    if (drag.kind === 'opp') far(state.opponent);
    if (drag.kind === 'opp2') far(state.opponent2);
    if (drag.kind === 'target') far(state.target);
    computeFast({ withIncoming: false });
    stale = true;
    ui.guess = null; ui.revealed = false;
    refresh();
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) {
      // In Predict mode a tap is always a guess, even on a player ("stay here").
      const c = cv.toCourt(d.x0, d.y0);
      if (ui.mode === 'predict' && ui.step >= 4 && !ui.revealed && c.y < 0) {
        ui.guess = { x: clamp(c.x, -13, 13), y: clamp(c.y, -27, -0.3) };
        refresh();
        return;
      }
      // A tap on your team picks whose numbers and heat map to show.
      if (doubles() && (d.kind === 'you' || d.kind === 'partner')) {
        ui.focus = d.kind === 'partner' ? 1 : 0;
        derive();
      }
      refresh();
      return;
    }
    recomputeAll();
  };
  court.addEventListener('pointerup', end);
  court.addEventListener('pointercancel', end);
}

function setupSideDrag() {
  side.addEventListener('pointerdown', (e) => {
    if (anim) return;
    const [px, py] = pointerPos(side, e);
    const h = hitterOf(state);
    const hs = [['contact', sv.sx(h.y), sv.sz(h.z)]];
    if (shot && shot.ok && ui.step >= 2) hs.push(['net', sv.sx(0), sv.sz(shot.zNet)]);
    let best = null, bestD = 30;
    for (const [kind, x, y] of hs) {
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = kind; }
    }
    if (!best) return;
    drag = { kind: best, xCross: shot && shot.ok ? shot.xCross : 0, moved: true };
    side.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  side.addEventListener('pointermove', (e) => {
    const [px, py] = pointerPos(side, e);
    const h = hitterOf(state);
    if (!drag) {
      const near = (x, y) => Math.hypot(x - px, y - py) < 30;
      side.style.cursor = near(sv.sx(h.y), sv.sz(h.z)) || (shot && shot.ok && near(sv.sx(0), sv.sz(shot.zNet))) ? 'ns-resize' : 'default';
      return;
    }
    const z = sv.toZ(py);
    if (drag.kind === 'contact') h.z = clamp(Math.round(z * 10) / 10, 0.3, 8.5);
    if (drag.kind === 'net') state.clearance = clamp(z - netHeight(drag.xCross) - BALL_R, 0.05, 18);
    computeFast({ withIncoming: false });
    stale = true;
    refresh();
  });
  const end = () => { if (!drag) return; drag = null; recomputeAll(); };
  side.addEventListener('pointerup', end);
  side.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- playback

function startPlay() {
  if (!shot || !shot.ok) return;
  const rally = !stale && analysis && analysis.outcome === 'rally';
  const tA = incoming ? incoming.path.t[incoming.path.n - 1] : 0;
  const tB = rally ? analysis.main.t : shot.path.t[shot.path.n - 1];
  const reply = rally && featured.likely >= 0 ? analysis.replies[featured.likely] : null;
  const tC = reply ? reply.path.t[reply.path.n - 1] - reply.contact.t : 0;
  const receiver = rally && analysis.main.who === 1 ? 'opp2' : 'opp';
  const recvPos = receiver === 'opp2' ? state.opponent2 : state.opponent;
  let body = { x: recvPos.x, y: recvPos.y };
  if (rally) {
    const c = analysis.main;
    const dx = recvPos.x - c.x, dy = recvPos.y - c.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, profiles.opponent.reach / d);
    body = { x: c.x + dx * k, y: c.y + dy * k };
  }
  anim = { t0: performance.now(), slow: 0.45, tA, tB, tC, reply, rally, receiver, body, step: 1, frame: null };
  $('play').classList.add('playing');
  $('play').querySelector('span:last-child').textContent = 'Stop';
  requestAnimationFrame(tick);
}

function stopPlay() {
  if (!anim) return;
  anim = null;
  $('play').classList.remove('playing');
  $('play').querySelector('span:last-child').textContent = 'Play';
  ui.step = 4;
  refresh();
}

function moveToward(from, to, dist) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d < 1e-6 || dist <= 0) return { x: from.x, y: from.y };
  const f = Math.min(1, dist / d);
  return { x: from.x + dx * f, y: from.y + dy * f };
}

function tick(now) {
  if (!anim) return;
  const a = anim;
  const T = ((now - a.t0) / 1000) * a.slow;
  const pHits = partnerHits(state);
  const you0 = { x: state.student.x, y: state.student.y };
  const mate0 = { x: state.partner.x, y: state.partner.y };
  const opp0 = { x: state.opponent.x, y: state.opponent.y };
  const opp20 = { x: state.opponent2.x, y: state.opponent2.y };
  const plans = view ? view.plans : [];
  const youTarget = plans[0] ? plans[0].target : you0;
  const mateTarget = plans[1] ? plans[1].target : mate0;
  const ps = profiles.student, pp = profiles.partner, po = profiles.opponent;
  const lag = (hits, p) => (hits ? p.followThrough : 0.1);
  const youAt = (t) => moveToward(you0, youTarget, travelDistance(t - lag(!pHits, ps), ps));
  const mateAt = (t) => moveToward(mate0, mateTarget, travelDistance(t - lag(pHits, pp), pp));
  const runner = (t, from) => moveToward(from, a.body, travelDistance(t - po.reaction, po));
  const opps = (t) => ({
    opp: a.rally && a.receiver === 'opp' ? runner(t, opp0) : opp0,
    opp2: a.rally && a.receiver === 'opp2' ? runner(t, opp20) : opp20,
  });
  let frame;
  if (T < a.tA && incoming) {
    a.step = 1;
    frame = { ball: posAt(incoming.path, T), you: you0, partner: mate0, opp: opp0, opp2: opp20 };
  } else if (T < a.tA + a.tB) {
    const t = T - a.tA;
    a.step = t < a.tB - 0.05 ? 2 : 3;
    const you = youAt(t);
    frame = { ball: posAt(shot.path, t), you, partner: mateAt(t), ...opps(t), ring: a.rally ? 1 - t / a.tB : null, ringAt: you };
  } else if (a.reply && T < a.tA + a.tB + a.tC) {
    const t = T - a.tA - a.tB;
    a.step = 3;
    frame = { ball: posAt(a.reply.path, a.reply.contact.t + t), you: youAt(a.tB), partner: mateAt(a.tB), ...opps(a.tB) };
  } else if (T < a.tA + a.tB + a.tC + 0.5) {
    a.step = a.rally ? 3 : 2;
    frame = { ball: null, you: youAt(a.tB), partner: mateAt(a.tB), ...opps(a.tB) };
  } else {
    stopPlay();
    return;
  }
  a.frame = frame;
  refreshSteps();
  draw();
  requestAnimationFrame(tick);
}

function refreshSteps() {
  document.querySelectorAll('.step').forEach((b) => {
    const n = Number(b.dataset.step);
    if (n === anim.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', n < anim.step);
  });
}

// ---------------------------------------------------------------- boot

function boot() {
  buildControls();
  new ResizeObserver(() => requestDraw()).observe($('stage'));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const retheme = () => { theme = readTheme(); requestDraw(); };
  mq.addEventListener?.('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  initGuide({
    isDoubles: doubles,
    beforeTour: () => {
      stopPlay();
      ui.mode = 'lesson'; ui.step = 4; ui.guess = null; ui.revealed = false;
      refresh();
    },
  });
  computeFast();
  refresh();
  $('busy').textContent = 'Loading the physics…';
  scheduleSlow(60);
  setTimeout(() => { $('busy').textContent = 'Calculating…'; }, 200);
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { theme = readTheme(); requestDraw(); });
boot();
