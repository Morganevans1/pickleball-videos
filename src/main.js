// App wiring: state, controls, drag handling, animation.

import { DEFAULT_STATE, profilesFor, solveStudentShot, solveIncoming, analyse } from './engine/scenario.js';
import { SHOTS, shotById } from './engine/solver.js';
import { LEVELS, movePlan, scoreAt, replyValues } from './engine/recovery.js';
import { travelTime, travelDistance, PRO_RATING } from './engine/ratings.js';
import { shotSummary, opponentSummary, moveSummary, describeDirection, zoneName } from './engine/narrate.js';
import { BALL_R, netHeight } from './engine/physics.js';
import { readTheme, courtView, sideView, drawCourt, drawSide, posAt } from './render.js';

const STORE_KEY = 'recovery-coach-v1';

const EXAMPLES = [
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
const ui = { step: 4, level: 5, mode: 'lesson', guess: null, revealed: false, layers: { heat: true, fan: true, zones: true } };
let profiles = profilesFor(state);
let shot = null, incoming = null, analysis = null, stale = true;
let plan = null, featured = { likely: -1, danger: -1 };
let drag = null, sideZMax = 10, anim = null;
let theme = readTheme();

const court = $('court'), side = $('side');
const cctx = court.getContext('2d'), sctx = side.getContext('2d');
let cv = courtView(1, 1), sv = sideView(1, 1, cv, 10);

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

function derive() {
  plan = null; featured = { likely: -1, danger: -1 };
  if (!analysis || analysis.outcome !== 'rally') return;
  plan = movePlan(analysis.rec, ui.level);
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
  // Most dangerous: the hardest one to return from the recovery spot.
  const vals = replyValues(analysis.rec, plan.target.x, plan.target.y, 0);
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
  const rec = an && an.outcome === 'rally' ? an.rec : null;
  return {
    state, step: anim ? anim.step : ui.step, layers: ui.layers, incoming, shot, analysis: an,
    plan: rec ? plan : null, showAnswer: showAnswer && !anim, level: ui.level, guess: ui.guess, featured,
    anim: anim ? anim.frame : null,
    reachRadius: rec ? travelDistance(rec.tMove, profiles.student) : 0,
    oppReach: profiles.opponent.reach,
    hideIncoming: drag && (drag.kind === 'you' || drag.kind === 'opp' || drag.kind === 'contact'),
  };
}

function draw() {
  const [cw, ch] = sizeCanvas(court, cctx);
  const [sw, sh] = sizeCanvas(side, sctx);
  cv = courtView(cw, ch);
  if (!drag) {
    let zTop = Math.max(state.student.z + 2, 8);
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

function refresh() {
  // Steps
  document.querySelectorAll('.step').forEach((b) => {
    const n = Number(b.dataset.step);
    const cur = anim ? anim.step : ui.step;
    if (n === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', n < cur);
  });
  document.querySelectorAll('#mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ui.mode)));
  document.querySelectorAll('.shot-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shot === state.shotId)));
  $('shot-blurb').textContent = shotById(state.shotId).blurb;
  document.querySelectorAll('#rule button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rule === state.rule)));
  document.querySelectorAll('#incoming button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.incoming === (state.rule === 'return' ? 'bounce' : state.incoming)));
    b.disabled = state.rule === 'return';
  });
  $('rule-hint').textContent = state.rule === 'return'
    ? 'The serve bounced before you hit it, and your return must bounce before they can play it.'
    : 'Anyone can volley from outside the kitchen.';

  setRating('o-student', state.studentSkill);
  setRating('o-opp', state.oppSkill);
  setRating('o-move', state.linkMove ? state.studentSkill : state.studentMove);
  $('r-student').value = state.studentSkill;
  $('r-opp').value = state.oppSkill;
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
  const rec = !stale && analysis && analysis.outcome === 'rally' ? analysis.rec : null;
  // Keep the thumb inside the track: positions run from 26px to (height - 26px).
  const at = (f) => `calc(26px + (100% - 52px) * ${clamp(f, 0, 1).toFixed(4)})`;
  const f = ui.level / (LEVELS - 1);
  $('amb-thumb').style.bottom = at(f);
  $('amb-fill').style.height = at(f);
  $('amb-val').textContent = String(ui.level);
  $('amb').setAttribute('aria-valuenow', String(ui.level));
  const ceil = $('amb-ceiling'), over = $('amb-over');
  const hide = !rec || rec.ceiling >= LEVELS - 1 || (ui.mode === 'predict' && !ui.revealed);
  ceil.hidden = hide; over.hidden = hide;
  let over_ = false;
  if (!hide) {
    const pos = clamp((rec.ceiling + 0.5) / (LEVELS - 1), 0, 1);
    ceil.style.bottom = at(pos);
    over.style.height = `calc(100% - ${at(pos)})`;
    over_ = ui.level > rec.ceiling;
    ceil.classList.toggle('below', over_);
    $('amb').setAttribute('aria-valuetext', `Level ${ui.level} of ${LEVELS - 1}${over_ ? ', above your ceiling' : ''}`);
  } else {
    $('amb').setAttribute('aria-valuetext', `Level ${ui.level} of ${LEVELS - 1}`);
  }
  $('amb-thumb').classList.toggle('over', over_);
}

function refreshSummary() {
  const rally = !stale && analysis && analysis.outcome === 'rally';
  const showAnswer = ui.mode === 'lesson' || ui.revealed;
  const show = rally && showAnswer && ui.step >= 4 && plan;
  $('s-time').textContent = rally && ui.step >= 3 ? `${fmt(analysis.rec.tMove, 2)} s` : '–';
  $('s-dist').textContent = show ? `${Math.round(plan.idealDist)} ft` : '–';
  $('s-steps').textContent = show ? String(plan.idealPace.steps) : '–';
  $('s-ret').textContent = show ? `${Math.round(plan.getBack * 100)}%` : '–';
  const order = ['walk', 'jog', 'shuffle', 'sprint', 'impossible'];
  const key = show ? plan.idealPace.level.key : null;
  const k = order.indexOf(key);
  document.querySelectorAll('#pace-bar span').forEach((sp, i) => {
    sp.classList.toggle('on', i === k);
    sp.classList.toggle('lit', k >= 0 && i < k);
  });

  // Coach's note
  const parts = [];
  const step = anim ? anim.step : ui.step;
  if (incoming) {
    parts.push([1, `The ball comes to you ${incoming.kind === 'volley' ? 'in the air' : 'after the bounce'} and you take it at ${state.student.z.toFixed(1)} ft, ${zoneName(state.student.y)}.`]);
  }
  if (shot && shot.ok && step >= 2) {
    let t = shotSummary(shot);
    if (shot.tooFast) t += ` That is more pace than a typical ${state.studentSkill.toFixed(1)} can produce (about ${Math.round(profiles.student.maxDrive)} mph).`;
    parts.push([2, t]);
  }
  if (step >= 3 && !stale && analysis) parts.push([3, opponentSummary(analysis)]);
  if (step >= 4 && show) parts.push([4, moveSummary(plan, ui.level, LEVELS)]);
  const note = $('note');
  note.innerHTML = '';
  parts.forEach(([n, t], i) => {
    const span = document.createElement(n === step ? 'b' : 'span');
    span.textContent = (i ? ' ' : '') + t;
    note.appendChild(span);
  });
  if (stale) note.appendChild(Object.assign(document.createElement('span'), { textContent: parts.length ? ' Working out their options…' : 'Working out their options…' }));

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
  if (!ui.guess) return 'Where should you be when they hit it? Tap your side of the court.';
  if (!ui.revealed) return 'Happy with that spot? Reveal the answer, or tap again to move it.';
  const rec = analysis.rec, g = ui.guess;
  const yours = scoreAt(rec, 0, g.x, g.y);
  const lvl = scoreAt(rec, ui.level, g.x, g.y) / (plan.ideal.score || 1);
  const off = Math.hypot(g.x - plan.ideal.x, g.y - plan.ideal.y);
  const inTime = travelTime(Math.hypot(g.x - state.student.x, g.y - state.student.y), profiles.student) <= rec.tMove;
  const dir = describeDirection(plan.ideal.x - g.x, plan.ideal.y - g.y);
  return `From your spot you return ${Math.round(yours * 100)}% of their likely replies (ideal ${Math.round(plan.getBack * 100)}%), `
    + `scoring ${Math.round(Math.min(1, lvl) * 100)}% of the ideal at this ambition level. `
    + (off < 1.5 ? 'You were right on it. ' : `The ideal is ${dir} of your guess. `)
    + (inTime ? 'You could get there in time.' : 'You could not get there in time.');
}

// ---------------------------------------------------------------- controls

function buildControls() {
  const shots = $('shots');
  for (const s of SHOTS) {
    const b = document.createElement('button');
    b.className = 'shot-btn'; b.dataset.shot = s.id; b.textContent = s.name; b.type = 'button';
    b.addEventListener('click', () => selectShot(s.id));
    shots.appendChild(b);
  }
  const sel = $('example');
  EXAMPLES.forEach((ex, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = ex.name;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    if (sel.value === '') return;
    const ex = EXAMPLES[Number(sel.value)];
    const keep = { studentSkill: state.studentSkill, studentMove: state.studentMove, linkMove: state.linkMove, oppSkill: state.oppSkill };
    state = { ...structuredClone(DEFAULT_STATE), ...structuredClone(ex.state), ...keep };
    sel.value = '';
    ui.guess = null; ui.revealed = false;
    recomputeAll();
  });

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
  $('link-move').addEventListener('change', (e) => {
    state.linkMove = e.target.checked;
    if (!state.linkMove) state.studentMove = state.studentSkill;
    recomputeAll();
  });

  for (const [id, key] of [['l-heat', 'heat'], ['l-fan', 'fan'], ['l-zones', 'zones']]) {
    $(id).addEventListener('change', (e) => { ui.layers[key] = e.target.checked; requestDraw(); });
  }

  $('reveal').addEventListener('click', () => { ui.revealed = true; refresh(); });
  $('retry').addEventListener('click', () => { ui.guess = null; ui.revealed = false; refresh(); });
  $('play').addEventListener('click', () => (anim ? stopPlay() : startPlay()));

  setupAmbition();
  setupCourtDrag();
  setupSideDrag();
}

function selectShot(id) {
  const s = shotById(id);
  state.shotId = id;
  state.target = s.target(state.student);
  state.clearance = s.clearance;
  if (id === 'overhead' && state.student.z < 6) state.student.z = 7.5;
  if (id !== 'overhead' && state.student.z > 6.5) state.student.z = 3;
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

function setupCourtDrag() {
  court.addEventListener('pointerdown', (e) => {
    if (anim) return;
    const [px, py] = pointerPos(court, e);
    const handles = [
      ['you', state.student],
      ['opp', state.opponent],
    ];
    if (ui.step >= 2) handles.push(['target', state.target]);
    let best = null, bestD = 34;
    for (const [kind, p] of handles) {
      const d = Math.hypot(cv.sx(p.y) - px, cv.sy(p.x) - py);
      if (d < bestD) { bestD = d; best = kind; }
    }
    if (best) {
      drag = { kind: best };
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
      court.style.cursor = 'default';
      for (const p of [state.student, state.opponent, state.target]) {
        if (Math.hypot(cv.sx(p.y) - px, cv.sy(p.x) - py) < 34) court.style.cursor = 'grab';
      }
      return;
    }
    const c = cv.toCourt(px, py);
    if (drag.kind === 'you') { state.student.x = clamp(c.x, -13, 13); state.student.y = clamp(c.y, -27, -0.5); }
    if (drag.kind === 'opp') { state.opponent.x = clamp(c.x, -13, 13); state.opponent.y = clamp(c.y, 0.5, 27); }
    if (drag.kind === 'target') { state.target.x = clamp(c.x, -13, 13); state.target.y = clamp(c.y, 0.5, 27); }
    computeFast({ withIncoming: false });
    stale = true;
    ui.guess = null; ui.revealed = false;
    refresh();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    recomputeAll();
  };
  court.addEventListener('pointerup', end);
  court.addEventListener('pointercancel', end);
}

function setupSideDrag() {
  side.addEventListener('pointerdown', (e) => {
    if (anim) return;
    const [px, py] = pointerPos(side, e);
    const hs = [['contact', sv.sx(state.student.y), sv.sz(state.student.z)]];
    if (shot && shot.ok && ui.step >= 2) hs.push(['net', sv.sx(0), sv.sz(shot.zNet)]);
    let best = null, bestD = 30;
    for (const [kind, x, y] of hs) {
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) { bestD = d; best = kind; }
    }
    if (!best) return;
    drag = { kind: best, xCross: shot && shot.ok ? shot.xCross : 0 };
    side.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  side.addEventListener('pointermove', (e) => {
    const [px, py] = pointerPos(side, e);
    if (!drag) {
      const near = (x, y) => Math.hypot(x - px, y - py) < 30;
      side.style.cursor = near(sv.sx(state.student.y), sv.sz(state.student.z)) || (shot && shot.ok && near(sv.sx(0), sv.sz(shot.zNet))) ? 'ns-resize' : 'default';
      return;
    }
    const z = sv.toZ(py);
    if (drag.kind === 'contact') state.student.z = clamp(Math.round(z * 10) / 10, 0.3, 8.5);
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
  let bodyX = state.opponent.x, bodyY = state.opponent.y;
  if (rally) {
    const c = analysis.main;
    const dx = state.opponent.x - c.x, dy = state.opponent.y - c.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, profiles.opponent.reach / d);
    bodyX = c.x + dx * k; bodyY = c.y + dy * k;
  }
  anim = { t0: performance.now(), slow: 0.45, tA, tB, tC, reply, rally, body: { x: bodyX, y: bodyY }, step: 1, frame: null };
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
  const you0 = { x: state.student.x, y: state.student.y };
  const opp0 = { x: state.opponent.x, y: state.opponent.y };
  const target = plan ? plan.target : you0;
  const ps = profiles.student, po = profiles.opponent;
  const youAt = (t) => moveToward(you0, target, travelDistance(t - ps.followThrough, ps));
  const oppAt = (t) => moveToward(opp0, a.body, travelDistance(t - po.reaction, po));
  let frame;
  if (T < a.tA && incoming) {
    a.step = 1;
    frame = { ball: posAt(incoming.path, T), you: you0, opp: opp0 };
  } else if (T < a.tA + a.tB) {
    const t = T - a.tA;
    a.step = t < a.tB - 0.05 ? 2 : 3;
    frame = { ball: posAt(shot.path, t), you: youAt(t), opp: a.rally ? oppAt(t) : opp0, ring: a.rally ? 1 - t / a.tB : null };
  } else if (a.reply && T < a.tA + a.tB + a.tC) {
    const t = T - a.tA - a.tB;
    a.step = 3;
    frame = { ball: posAt(a.reply.path, a.reply.contact.t + t), you: youAt(a.tB), opp: oppAt(a.tB) };
  } else if (T < a.tA + a.tB + a.tC + 0.5) {
    a.step = a.rally ? 3 : 2;
    frame = { ball: null, you: youAt(a.tB), opp: a.rally ? oppAt(a.tB) : opp0 };
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
  computeFast();
  refresh();
  $('busy').textContent = 'Loading the physics…';
  scheduleSlow(60);
  setTimeout(() => { $('busy').textContent = 'Calculating…'; }, 200);
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { theme = readTheme(); requestDraw(); });
boot();
