// The built-in guide: welcome cards on first visit, a spotlight tour of the
// real controls, and a legend of what every mark on the court means.
// Written for both coaches and players: the main text speaks to whoever is
// holding the tablet, and "Coach tip" lines add how to use it in a lesson.

const SEEN_KEY = 'recovery-coach-welcome-v1';
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- legend

const sw = (inner) => `<svg viewBox="0 0 64 30" aria-hidden="true">${inner}</svg>`;
const dot = (fill, extra = '') => `<circle cx="32" cy="15" r="8" style="fill:${fill};stroke:rgba(8,20,28,.85);stroke-width:2"/>${extra}`;

const LEGEND = [
  { group: 'People' },
  { svg: sw(dot('var(--you)')), text: '<b>You</b>. Drag to set where you are when you hit.' },
  { svg: sw(dot('var(--partner)', '<circle cx="32" cy="15" r="5.5" style="fill:none;stroke:var(--you);stroke-width:3"/>')), text: '<b>Your partner</b> (doubles).', doubles: true },
  { svg: sw(dot('var(--opp)')), text: '<b>Opponents</b>. Drag them too.' },
  { group: 'The ball' },
  { svg: sw('<circle cx="32" cy="15" r="8" style="fill:none;stroke:var(--ball);stroke-width:2.5"/><path d="M20 15h6M38 15h6M32 3v6M32 21v6" style="stroke:var(--ball);stroke-width:2.5"/>'), text: '<b>Target</b>: where the shot is aimed. Drag it.' },
  { svg: sw('<path d="M6 22 Q32 2 58 18" style="fill:none;stroke:rgba(10,16,4,.55);stroke-width:6;stroke-linecap:round"/><path d="M6 22 Q32 2 58 18" style="fill:none;stroke:var(--ball);stroke-width:3.5;stroke-linecap:round"/>'), text: '<b>The shot</b> as it really flies. Dashed after the bounce.' },
  { svg: sw('<path d="M6 15 H58" style="stroke:var(--on-court);stroke-width:2;stroke-dasharray:5 5"/>'), text: '<b>Incoming ball</b>, for context.' },
  { group: 'Their options' },
  { svg: sw('<g style="stroke:var(--opp);stroke-width:1.2;opacity:.6"><path d="M58 15 L6 4"/><path d="M58 15 L6 10"/><path d="M58 15 L6 16"/><path d="M58 15 L6 22"/><path d="M58 15 L6 27"/></g>'), text: '<b>Their likely replies</b>: one line per reply.' },
  { svg: sw('<path d="M58 8 L6 8" style="stroke:var(--opp);stroke-width:3"/><path d="M58 22 L6 22" style="stroke:var(--opp);stroke-width:3;stroke-dasharray:7 5"/>'), text: '<b>Most likely</b> (solid) and <b>most dangerous</b> (dashed) reply.' },
  { svg: sw('<circle cx="14" cy="15" r="3" style="fill:var(--opp);opacity:.5"/><circle cx="30" cy="15" r="5" style="fill:var(--opp);opacity:.75"/><circle cx="48" cy="15" r="7" style="fill:var(--opp)"/>'), text: '<b>Where replies land</b>. Bigger means more often.' },
  { group: 'Your move' },
  { svg: sw('<rect x="4" y="5" width="56" height="20" rx="3" style="fill:url(#lg-heat)"/><defs><linearGradient id="lg-heat"><stop offset="0" style="stop-color:var(--you);stop-opacity:0"/><stop offset="1" style="stop-color:var(--you);stop-opacity:.7"/></linearGradient></defs>'), text: '<b>Good places to stand</b>. Brighter is better.' },
  { svg: sw('<circle cx="32" cy="15" r="11" style="fill:none;stroke:var(--you);stroke-width:1.5;stroke-dasharray:3 4"/>'), text: '<b>How far you can get</b> before they hit it.' },
  { svg: sw('<path d="M8 15 H50" style="stroke:var(--on-court);stroke-width:3.5"/><path d="M58 15 L47 9 L47 21 Z" style="fill:var(--on-court)"/><circle cx="22" cy="15" r="3" style="fill:var(--on-court)"/><circle cx="36" cy="15" r="3" style="fill:var(--on-court)"/>'), text: '<b>Your move</b>. Each dot is a step.' },
  { svg: sw('<circle cx="20" cy="15" r="8" style="fill:none;stroke:var(--you);stroke-width:2.5;stroke-dasharray:5 4"/><circle cx="46" cy="15" r="8" style="fill:none;stroke:var(--warn);stroke-width:2.5;stroke-dasharray:5 4"/>'), text: '<b>Recover here</b> (teal). <b>Ideal but out of reach</b> (red).' },
  { svg: sw('<rect x="3" y="7" width="13" height="16" rx="2" style="fill:var(--you);opacity:.6"/><rect x="18" y="7" width="13" height="16" rx="2" style="fill:var(--partner);opacity:.6"/><rect x="33" y="7" width="13" height="16" rx="2" style="fill:var(--ball);opacity:.6"/><rect x="48" y="7" width="13" height="16" rx="2" style="fill:var(--opp);opacity:.6"/>'), text: '<b>Who covers what</b> (doubles): you, your partner, <b>call it</b> (either could take it), and open (nobody can).', doubles: true, wide: true },
];

function legendHTML() {
  let html = '';
  let open = false;
  for (const item of LEGEND) {
    if (item.group) {
      if (open) html += '</ul>';
      html += `<h3 class="legend-group">${item.group}</h3><ul class="legend">`;
      open = true;
      continue;
    }
    html += `<li class="${item.wide ? 'lg-doubles' : ''}">${item.svg}<span class="lg-text">${item.text}</span></li>`;
  }
  return html + (open ? '</ul>' : '');
}

// ---------------------------------------------------------------- welcome

const ART = `<svg class="welcome-art" viewBox="0 0 560 200" role="img" aria-label="A court from above: you hit a shot across the net, the opponent's likely replies fan back, and an arrow shows where to recover.">
  <rect width="560" height="200" rx="12" style="fill:var(--surround)"/>
  <rect x="60" y="30" width="440" height="140" style="fill:var(--court)"/>
  <rect x="210" y="30" width="140" height="140" style="fill:var(--kitchen)"/>
  <g style="fill:none;stroke:var(--court-line);stroke-width:2"><rect x="60" y="30" width="440" height="140"/><path d="M210 30v140M350 30v140M60 100h150M350 100h150"/></g>
  <path d="M280 22v156" style="stroke:var(--net);stroke-width:5"/>
  <g style="stroke:var(--opp);stroke-width:1.5;opacity:.45;fill:none"><path d="M460 60 L110 40"/><path d="M460 60 L120 80"/><path d="M460 60 L130 120"/><path d="M460 60 L150 160"/><path d="M460 60 L230 150"/></g>
  <path d="M460 60 L120 80" style="stroke:var(--opp);stroke-width:3"/>
  <path d="M110 120 Q280 40 455 66" style="fill:none;stroke:rgba(10,16,4,.5);stroke-width:7;stroke-linecap:round"/>
  <path d="M110 120 Q280 40 455 66" style="fill:none;stroke:var(--ball);stroke-width:4;stroke-linecap:round"/>
  <path d="M110 120 L150 104" style="stroke:var(--on-court);stroke-width:4"/><path d="M160 100 L144 98 L150 112 Z" style="fill:var(--on-court)"/>
  <circle cx="162" cy="99" r="11" style="fill:none;stroke:var(--you);stroke-width:3;stroke-dasharray:5 4"/>
  <circle cx="110" cy="120" r="12" style="fill:var(--you);stroke:rgba(8,20,28,.85);stroke-width:2"/>
  <circle cx="470" cy="56" r="12" style="fill:var(--opp);stroke:rgba(8,20,28,.85);stroke-width:2"/>
</svg>`;

const SLIDES = [
  {
    kicker: 'Welcome',
    title: 'See what happens after the shot',
    body: () => `<p class="lead">Recovery Coach runs real ball physics on a pickleball court. Set up any moment in a rally and pick a shot. It works out every reply the other side is likely to hit back, and where you${doublesNow() ? ' and your partner' : ''} should be to handle it.</p>
      ${ART}
      <div class="audience">
        <div><b>For coaches</b>Explain positioning in seconds, one step at a time, then check it stuck with Predict mode.</div>
        <div><b>For players</b>Learn where to be before you need it on court, worked out for your level and your speed.</div>
      </div>`,
  },
  {
    kicker: 'Why it helps',
    title: 'Turn “move over there” into something you can see',
    body: () => `<ol class="why">
      <li><span class="num">1</span><span><b>Cause and effect</b>Every shot opens some replies and closes others. You see all of them, not just the one you pictured.</span></li>
      <li><span class="num">2</span><span><b>Real time, real steps</b>You get 0.7 seconds, not “enough time”. The app turns that into steps and a pace: walk, jog, shuffle hard or sprint.</span></li>
      <li><span class="num">3</span><span><b>Fitted to the player</b>Ratings from 2.5 to 7.5 (Pro from 6.0) set how fast and how accurately each player moves and hits.</span></li>
      <li><span class="num">4</span><span><b>Singles and doubles</b>In doubles it places both partners and shows who covers which balls, including the ones in the middle.</span></li>
    </ol>`,
  },
  {
    kicker: 'How to read it',
    title: 'What the marks mean',
    body: () => `<div class="legend-wrap">${legendHTML()}</div>`,
    last: true,
  },
];

let isDoublesFn = () => false;
const doublesNow = () => isDoublesFn();

let slide = 0, lastFocus = null;

function renderSlide() {
  const s = SLIDES[slide];
  $('welcome-body').innerHTML = `<p class="dialog-kicker">${s.kicker}</p><h2 class="dialog-title" id="welcome-title">${s.title}</h2>${s.body()}`;
  $('welcome-dots').innerHTML = SLIDES.map((_, i) => `<span class="${i === slide ? 'on' : ''}"></span>`).join('');
  $('welcome-back').hidden = slide === 0;
  $('welcome-next').textContent = s.last ? 'Take the 1-minute tour' : 'Next';
  $('welcome-skip').textContent = s.last ? 'Start using it' : 'Skip';
  $('welcome-body').scrollTop = 0;
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  $('help').classList.remove('nudge');
}

function openWelcome() {
  lastFocus = document.activeElement;
  slide = 0;
  renderSlide();
  $('welcome').hidden = false;
  $('welcome-next').focus();
}

function closeWelcome() {
  $('welcome').hidden = true;
  markSeen();
  (lastFocus && lastFocus.focus ? lastFocus : $('help')).focus();
}

function openLegend() {
  lastFocus = document.activeElement;
  $('legend-list').innerHTML = legendHTML();
  $('legend').hidden = false;
  $('legend-close').focus();
}

function closeLegend() {
  $('legend').hidden = true;
  (lastFocus && lastFocus.focus ? lastFocus : $('help')).focus();
}

// ---------------------------------------------------------------- tour

function tourStops() {
  const d = doublesNow();
  return [
    { sel: '#court-wrap', title: 'The court',
      text: d ? 'You are teal, your partner is pale, the opponents are coral. Drag anyone to set up the moment, and drag the yellow target to aim the shot. Tap you or your partner to see that player’s numbers.'
        : 'You are teal, your opponent is coral. Drag either one to set up the moment, and drag the yellow target to aim the shot.',
      tip: 'Coach tip: recreate a rally your student just played, so the lesson is about their own shot.' },
    { sel: '#format', title: 'Singles or doubles',
      text: 'Switch formats at any time. Doubles adds a partner and a second opponent, and the app places both of you.' },
    ...(d ? [{ sel: '#hitter', title: 'Who hits',
      text: 'Choose whether you or your partner plays the shot. A great question is “your partner just hit that, where do YOU go?”' }] : []),
    { sel: '#shots', title: 'Pick a shot',
      text: 'Each shot comes with realistic speed, spin and height for the player’s level. The side view below shows the result.' },
    { sel: '#side-wrap', title: 'Height and clearance',
      text: 'Drag the round handle to set how high the ball is when it is hit, and the yellow diamond to set how high it clears the net.' },
    { sel: '#steps', title: 'Step through the rally',
      text: '1 Incoming, 2 Your shot, 3 Their options, 4 Your move. Tap a step to reveal one idea at a time, or press Play to watch it in slow motion.',
      tip: 'Coach tip: stop on step 3 and ask “so where do you go?” before showing step 4.' },
    { sel: '#ambition-col', title: 'How ambitious?',
      text: 'Bottom: just get the ball back. Top: be set early and take it where you can attack. The recovery spot moves as you slide. A red dashed line marks the highest level that can be reached in time.' },
    { sel: '#summary', title: 'How hard is the move?',
      text: d ? 'Distance, steps and the pace needed, from Walk to Not possible, for whoever is selected. The note underneath says it in plain words, including who covers what.'
        : 'Distance, steps and the pace needed, from Walk to Not possible, plus the share of likely replies you would return. The note underneath says it in plain words.' },
    { sel: '#mode', title: 'Predict mode',
      text: 'Turns it into a quiz: the answer is hidden, you tap where you would recover, then reveal how close you were.',
      tip: 'Coach tip: quiz first, explain second. It sticks better.' },
    { sel: '#players-group', title: 'Player levels',
      text: 'Set everyone’s level from 2.5 to 7.5 (Pro from 6.0). Your movement can be set apart from your skill, for quick players who are still learning shots, or the other way round.' },
    { sel: '#help', title: 'Help is always here',
      text: 'Open this menu any time for the welcome, this tour, or the list of what every mark means.' },
  ];
}

let stops = [], stopIdx = 0, tourOpts = {};

function visible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function placeTour() {
  const stop = stops[stopIdx];
  const el = document.querySelector(stop.sel);
  const hole = $('tour-hole'), card = $('tour-card');
  const r = el.getBoundingClientRect();
  const pad = 6;
  Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
  const vw = window.innerWidth, vh = window.innerHeight;
  const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14, m = 16;
  // Try right, left, below, above; otherwise pin to the emptier half.
  const opts = [
    [r.right + gap, r.top],
    [r.left - gap - cw, r.top],
    [r.left, r.bottom + gap],
    [r.left, r.top - gap - ch],
  ];
  const fits = ([x, y]) => x >= m && x + cw <= vw - m && y >= m && y + ch <= vh - m;
  let pos = opts.find(fits);
  if (!pos) {
    const fitsX = (x) => Math.min(Math.max(m, x), vw - cw - m);
    const below = r.bottom + gap + ch <= vh - m;
    pos = below ? [fitsX(r.left), r.bottom + gap] : (r.top - gap - ch >= m ? [fitsX(r.left), r.top - gap - ch] : [fitsX((vw - cw) / 2), vh - ch - m]);
  }
  card.style.left = `${Math.min(Math.max(m, pos[0]), vw - cw - m)}px`;
  card.style.top = `${Math.min(Math.max(m, pos[1]), vh - ch - m)}px`;
}

function showStop() {
  const stop = stops[stopIdx];
  $('tour-count').textContent = `${stopIdx + 1} of ${stops.length}`;
  $('tour-title').textContent = stop.title;
  $('tour-text').textContent = stop.text;
  $('tour-tip').textContent = stop.tip || '';
  $('tour-back').hidden = stopIdx === 0;
  $('tour-next').textContent = stopIdx === stops.length - 1 ? 'Done' : 'Next';
  const el = document.querySelector(stop.sel);
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  requestAnimationFrame(placeTour);
}

function startTour() {
  closeMenus();
  if (!$('welcome').hidden) $('welcome').hidden = true;
  markSeen();
  if (tourOpts.beforeTour) tourOpts.beforeTour();
  stops = tourStops().filter((s) => visible(document.querySelector(s.sel)));
  stopIdx = 0;
  lastFocus = document.activeElement;
  $('tour').hidden = false;
  showStop();
  $('tour-next').focus();
}

function endTour() {
  $('tour').hidden = true;
  (lastFocus && lastFocus.focus ? lastFocus : $('help')).focus();
}

// ---------------------------------------------------------------- wiring

function closeMenus() {
  $('help-menu').hidden = true;
  $('help').setAttribute('aria-expanded', 'false');
}

export function initGuide(opts = {}) {
  tourOpts = opts;
  if (opts.isDoubles) isDoublesFn = opts.isDoubles;

  $('help').addEventListener('click', (e) => {
    e.stopPropagation();
    const open = $('help-menu').hidden;
    $('help-menu').hidden = !open;
    $('help').setAttribute('aria-expanded', String(open));
    if (open) $('help-menu').querySelector('button').focus();
  });
  $('help-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenus();
    if (b.dataset.help === 'welcome') openWelcome();
    if (b.dataset.help === 'tour') startTour();
    if (b.dataset.help === 'legend') openLegend();
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.help-wrap')) closeMenus(); });

  $('welcome-next').addEventListener('click', () => {
    if (SLIDES[slide].last) startTour();
    else { slide++; renderSlide(); }
  });
  $('welcome-back').addEventListener('click', () => { if (slide > 0) { slide--; renderSlide(); } });
  $('welcome-skip').addEventListener('click', closeWelcome);
  $('legend-close').addEventListener('click', closeLegend);
  for (const id of ['welcome', 'legend']) {
    $(id).addEventListener('click', (e) => { if (e.target === $(id)) (id === 'welcome' ? closeWelcome : closeLegend)(); });
  }
  $('tour-next').addEventListener('click', () => {
    if (stopIdx >= stops.length - 1) endTour();
    else { stopIdx++; showStop(); }
  });
  $('tour-back').addEventListener('click', () => { if (stopIdx > 0) { stopIdx--; showStop(); } });
  $('tour-end').addEventListener('click', endTour);
  window.addEventListener('resize', () => { if (!$('tour').hidden) placeTour(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('tour').hidden) endTour();
    else if (!$('welcome').hidden) closeWelcome();
    else if (!$('legend').hidden) closeLegend();
    else closeMenus();
  });

  // First visit: show the welcome. If storage is unavailable we cannot tell,
  // so we leave the app clear and highlight the help button instead.
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); } catch { seen = 'unknown'; }
  if (seen === null) openWelcome();
  else if (seen === 'unknown') $('help').classList.add('nudge');
}
