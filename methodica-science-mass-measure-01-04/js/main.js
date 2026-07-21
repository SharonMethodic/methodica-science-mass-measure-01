/* xAPI: canonical URL id prefix + short-id helper (added for URL-format ids) */
var XAPI_ID_PREFIX = "https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/";
function shortId(u){ return String(u || "").split("/").pop(); }

'use strict';

/* ═══════════════════════════════════════════════════════════
   methodica-science-mass-measure-01-04 — main.js
   Part 04 — practice questions (שאלת השיא was split into part 05).
   Screens s0–s8; TOTAL_SCREENS is derived from the DOM so it
   adapts as screens are added.
   ═══════════════════════════════════════════════════════════ */

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_SCREENS = document.querySelectorAll('.screen').length;

/* Onward navigation to the next part of the lomda (sibling folder). */
const NEXT_PART_URL = '../methodica-science-mass-measure-01-05/index.html';
function goToNextPart() {
  try { sendStatement720('completed', 'onlinelesson'); } catch(e) {}
  window.location.href = NEXT_PART_URL + window.location.search;
}

/* ─── Character carry-over (written by part 01, read here) ── */
const CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Sporty-fix.mp4',
  'character-2': 'assets/video/Character-2-Sporty-fix.mp4'
};
function getCharacter() {
  try { return localStorage.getItem('lomda_selectedCharacter') || 'character-1'; }
  catch (e) { return 'character-1'; }
}

/* Companion videos play once (no loop). Freeze on the last visible frame
   instead of dropping into the player's black "ended" state. */
function freezeVideoOnEnd(vid) {
  if (!vid || vid._freezeWired) return;
  vid._freezeWired = true;
  // Hold on the clean opening frame, not a mid-motion (blurred) or black end frame.
  function showRestFrame() { try { vid.currentTime = 0; } catch (e) {} vid.pause(); }
  vid.addEventListener("timeupdate", function () {
    if (vid.duration && vid.currentTime >= vid.duration - 0.3) showRestFrame();
  });
  vid.addEventListener("ended", showRestFrame);
}

/* ═══ Progress Question nav A — 3 dots, shared by s1–s7 ═══
   Dot 1 (Q1): s1 practice + s2 scored.
   Dot 2 (Q2): s3/s4 practice + s5 scored.
   Dot 3 (Q3): s6 (Q3a) + s7 (Q3b) — check only if BOTH answered
   correctly (attempt number within each doesn't matter). */
var practiceA = {
  questions: [
    { number: 1, visited: true,  state: 'current',      screen: 1 },
    { number: 2, visited: false, state: 'not-answered', screen: null },
    { number: 3, visited: false, state: 'not-answered', screen: null }
  ]
};
function updateProgressQuestion(container, state) {
  var questions = state.questions;
  questions.forEach(function (q, i) {
    var n    = i + 1;
    var item = container.querySelector('[data-question="' + n + '"]');
    if (!item) return;
    var icon  = item.querySelector('.progress-question__icon');
    var label = item.querySelector('.progress-question__label');
    icon.classList.remove(
      'progress-question__icon--current',
      'progress-question__icon--correct',
      'progress-question__icon--incorrect'
    );
    if (q.state !== 'not-answered') icon.classList.add('progress-question__icon--' + q.state);
    label.classList.toggle('progress-question__label--visited', q.visited);
    var navigable = q.visited && q.screen != null;
    item.style.cursor = navigable ? 'pointer' : '';
    item.onclick = navigable ? (function (s) { return function () { goTo(s); }; })(q.screen) : null;
  });
  for (var n = 1; n < questions.length; n++) {
    var conn = container.querySelector('[data-connector="' + n + '"]');
    if (!conn) continue;
    var st = questions[n - 1].state;
    conn.classList.toggle('progress-question__connector--visited', st === 'correct' || st === 'incorrect');
  }
}
function syncNavA() {
  document.querySelectorAll('.progress-question[data-nav="A"]')
    .forEach(function (c) { updateProgressQuestion(c, practiceA); });
}

/* ─── State ─────────────────────────────────────────────── */
let currentScreen = 0;

/* ─── Scale App — fit the 1280×710 canvas to the viewport ── */
function scaleApp() {
  const app = document.getElementById('app');
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 710);
  app.style.transform = `scale(${scale})`;
  app.style.left = `${Math.round((window.innerWidth  - 1280 * scale) / 2)}px`;
  app.style.top  = `${Math.round((window.innerHeight - 710  * scale) / 2)}px`;
}
window.addEventListener('resize', scaleApp);
scaleApp();

/* ─── Image zoom (shared modal for content images) ─────────── */
function openImageZoom(btn) {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal || !stage || !btn) return;
  const wrapper = btn.closest('.scq-img-inner');
  if (!wrapper) return;
  const clone = wrapper.cloneNode(true);
  clone.querySelectorAll('.img-zoom-btn').forEach(b => b.remove());
  clone.classList.add('img-zoom-clone');
  stage.innerHTML = '';
  stage.appendChild(clone);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}
function closeImageZoom() {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (stage) stage.innerHTML = '';
}
document.addEventListener('click', function (e) {
  const openBtn = e.target.closest('[data-zoom-src]');
  if (openBtn) { openImageZoom(openBtn); return; }
  if (e.target.closest('[data-zoom-close="true"]')) closeImageZoom();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeImageZoom();
});

/* ─── Navigation ─────────────────────────────────────────── */
/* Screen number → its feedback popup element id, for screens that have one.
   Used to restore a popup the learner left open (not X-closed) — see below. */
const SCREEN_POPUP_ID = {
  2: 's2q-popup', 3: 's3-popup', 4: 's4-popup',
  5: 's5q-popup', 6: 's6q-popup', 7: 's7ddq-popup'
};
/* Screen number → whether that screen's question has actually been resolved
   (correct, or final wrong) — same "is this question done" check each screen's
   own resetScreenState() branch already uses to decide fresh-reset vs. resume.
   The popup-reopen below must only fire when this is true: reopening a
   "try again" popup over a board that a *not-done* screen's own reset just
   wiped back to blank would show stale feedback for an empty board. */
const SCREEN_DONE = {
  2: () => scqState.s2.done, 3: () => mwState.s3.done, 4: () => mwState.s4.done,
  5: () => scqState.s5.done, 6: () => scqState.s6.done, 7: () => s7ddqDone
};
let popupOpenOnExit = {};

function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
  // Record whether the screen we're leaving still has its own feedback popup
  // visible (i.e. the learner never closed it with the X button) — restored below.
  // Only counts if the question is actually resolved (Done) — see SCREEN_DONE above.
  const leavingPopupId = SCREEN_POPUP_ID[currentScreen];
  if (leavingPopupId) {
    const leavingPopup = document.getElementById(leavingPopupId);
    const leavingDone = SCREEN_DONE[currentScreen] ? SCREEN_DONE[currentScreen]() : false;
    popupOpenOnExit[currentScreen] = leavingDone && !!(leavingPopup && !leavingPopup.classList.contains('hidden'));
  }
  // Every feedback popup / hint overlay belongs to the screen it was opened on.
  // Hide them ALL on any navigation so none carries over to the next screen.
  document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
    .forEach(el => el.classList.add('hidden'));
  const prev = document.querySelector('.screen.active');
  if (prev) prev.classList.remove('active');
  /* Halt the S8 YouTube video when leaving, so its audio doesn't play elsewhere. */
  if (prev && prev.id === 's8' && typeof pauseS8Video === 'function') pauseS8Video();
  currentScreen = n;
  const next = document.getElementById('s' + n);
  if (next) next.classList.add('active');
  resetScreenState(n);
  // Reopen this screen's own feedback popup if it was left open (not X-closed) —
  // resetScreenState() above already restored the locked/answered visual state
  // via the existing resume-state guards; this only restores the popup itself,
  // at its default position, without re-running any check logic.
  const enterPopupId = SCREEN_POPUP_ID[n];
  if (enterPopupId && popupOpenOnExit[n]) {
    const enterPopup = document.getElementById(enterPopupId);
    if (enterPopup) {
      resetPopupPosition(enterPopup);
      enterPopup.classList.remove('hidden');
    }
  }
}
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function resetScreenState(n) {
  if (n === 0) s0Enter();
  if (n === 1) s1Enter();
  if (n === 2) scqEnter('s2');
  if (n === 3) mwEnter('s3');
  if (n === 4) mwEnter('s4');
  if (n === 5) scqEnter('s5');
  if (n === 6) scqEnter('s6');
  if (n === 7) s7ddqEnter();
  if (n === 8) s8Enter();
}

function goBack() { goTo(currentScreen - 1); }
function advanceScreen() {
  if (currentScreen === 1 && !s1Done) return;
  if (currentScreen === 2 && !scqState.s2.answered) return;
  if (currentScreen === 3 && !mwState.s3.done) return;
  if (currentScreen === 4 && !mwState.s4.done) return;
  if (currentScreen === 5 && !scqState.s5.answered) return;
  if (currentScreen === 6 && !scqState.s6.answered) return;
  if (currentScreen === 7 && !s7ddqDone) return;
  if (currentScreen >= 8) return;   // S8 is the last screen — onward to part 05 via its own button
  goTo(currentScreen + 1);
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
  if (e.key === 'Escape') {
    ['s2q-popup','s2q-hint-overlay','s3-popup','s4-popup'].forEach(hide);
  }
});

/* ═══════════════════════════════════════════════════════════
   Shared — draggable feedback popup (any #id) + reset helper
   ═══════════════════════════════════════════════════════════ */
function resetPopupPosition(popup) {
  popup.style.left = '2px'; popup.style.top = 'auto'; popup.style.bottom = '76px';
}
let popupDrag = null;
function popupMouseDown(e, id) {
  if (e.target.closest('.scq-popup-close')) return;
  const popup = document.getElementById(id), app = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0, appTop = parseFloat(app.style.top) || 0;
  const m = app.style.transform.match(/scale\(([^)]+)\)/); const scale = m ? parseFloat(m[1]) : 1;
  const cx = (e.clientX - appLeft) / scale, cy = (e.clientY - appTop) / scale;
  const topPx = parseFloat(popup.style.top); const top = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top = top + 'px'; popup.style.bottom = 'auto';
  popupDrag = { id: id, offX: cx - (parseFloat(popup.style.left) || 2), offY: cy - top };
  e.preventDefault();
}
window.addEventListener('mousemove', e => {
  if (!popupDrag) return;
  const popup = document.getElementById(popupDrag.id), app = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0, appTop = parseFloat(app.style.top) || 0;
  const m = app.style.transform.match(/scale\(([^)]+)\)/); const scale = m ? parseFloat(m[1]) : 1;
  const nx = (e.clientX - appLeft) / scale - popupDrag.offX;
  const ny = (e.clientY - appTop) / scale - popupDrag.offY;
  popup.style.left = Math.max(0, Math.min(nx, 1280 - popup.offsetWidth)) + 'px';
  popup.style.top  = Math.max(0, Math.min(ny, 710 - 74 - popup.offsetHeight)) + 'px';
});
window.addEventListener('mouseup', () => { popupDrag = null; });

/* ═══════════════════════════════════════════════════════════
   S0 — TransitionScreen — companion video (character-dependent)
   ═══════════════════════════════════════════════════════════ */
function s0Enter() {
  const src = CHARACTER_VIDEOS[getCharacter()] || CHARACTER_VIDEOS['character-1'];
  const vid = document.getElementById('s0-video');
  if (vid) { vid.src = src; vid.load(); vid.play().catch(() => {}); freezeVideoOnEnd(vid); }
}
function advanceFromS0() { goTo(1); }

/* ═══════════════════════════════════════════════════════════
   S1 — MeasurementWidget (practice): cup → 40g, faucet, → 115g
   Two weighings. The faucet replaces the reset between them and
   swaps the cup image to the filled variant. Not scored.
   ═══════════════════════════════════════════════════════════ */
const S1_MEAS = [40, 115];
let s1Idx = 0;                 // 0 = empty cup, 1 = full cup
let s1SlotState = 'idle';      // 'idle' | 'weighing' | 'validated'
let s1Done = false;

function s1Fmt(v) { return (v < 10 ? '0' : '') + Number(v).toFixed(2); }

function s1Enter() {
  practiceA.questions[0].visited = true;
  if (practiceA.questions[0].state !== 'correct' && practiceA.questions[0].state !== 'incorrect') {
    practiceA.questions[0].state = 'current';
  }
  syncNavA();
}

function s1CupDragStart(e) {
  if (s1SlotState !== 'idle' || s1Idx >= 2) { e.preventDefault(); return; }
  e.dataTransfer.setData('text/plain', 'cup');
  e.dataTransfer.effectAllowed = 'move';
}
function s1ScaleDragOver(e) {
  if (s1SlotState === 'idle' && s1Idx < 2) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
}
function s1ScaleDrop(e) {
  e.preventDefault();
  if (s1SlotState !== 'idle' || s1Idx >= 2) return;
  if (e.dataTransfer.getData('text/plain') !== 'cup') return;
  s1SlotState = 'weighing';
  const display = document.getElementById('s1-display');
  if (display) display.textContent = s1Fmt(S1_MEAS[s1Idx]);
  const inp = document.getElementById('s1-input-' + (s1Idx + 1));
  if (inp) { inp.disabled = false; inp.classList.add('active'); inp.focus(); }
  s1PlaceCupOnScale();
}
function s1PlaceCupOnScale() {
  const cup = document.getElementById('s1-cup');
  const col = document.getElementById('s1-scale-col');
  if (cup && col) {
    /* Cup is 152px and the scale sits 60px higher on this screen:
       bottom edge stays on the plate (base bottom 70+96=166 → 106). */
    cup.style.position = 'absolute';
    cup.style.top = '-46px';
    cup.style.left = '122px';
    cup.style.cursor = 'default';
    col.appendChild(cup);
  }
}
function s1ReturnCupToTray() {
  const cup = document.getElementById('s1-cup');
  const tray = document.getElementById('s1-tray');
  if (cup && tray) {
    cup.style.position = '';
    cup.style.top = '';
    cup.style.left = '';
    cup.style.cursor = 'grab';
    tray.insertBefore(cup, tray.firstChild);
  }
}

function s1InputChange(idx) {
  if (s1Idx !== idx - 1 || s1SlotState === 'idle') return;
  const inp = document.getElementById('s1-input-' + idx);
  const val = inp ? inp.value.trim() : '';
  if (val === '') {
    inp.classList.remove('error'); inp.classList.add('active');
    s1SlotState = 'weighing';
  } else if (Number(val) === S1_MEAS[s1Idx]) {
    inp.classList.remove('error', 'active');
    inp.setAttribute('readonly', '');
    inp.classList.add('locked');
    s1SlotState = 'validated';
    s1OnValidated();
  } else {
    inp.classList.remove('active'); inp.classList.add('error');
    s1SlotState = 'weighing';
  }
}

function s1OnValidated() {
  if (s1Idx === 0) {
    // First weighing done — cup auto-returns to its place; scale clears;
    // the faucet becomes available to fill the cup.
    s1ReturnCupToTray();
    const display = document.getElementById('s1-display');
    if (display) display.textContent = '00.00';
    const faucet = document.getElementById('s1-faucet');
    if (faucet) faucet.disabled = false;
  } else {
    // Second weighing done — practice complete
    s1Done = true;
    const cont = document.getElementById('s1-continue');
    if (cont) cont.disabled = false;
  }
}

function s1Faucet() {
  if (s1Idx !== 0 || s1SlotState !== 'validated') return;
  // Fill the cup: swap image, reset the scale, advance to weighing 2
  const cupImg = document.getElementById('s1-cup-img');
  if (cupImg) cupImg.src = 'assets/img/CupFull.png';
  const faucet = document.getElementById('s1-faucet');
  if (faucet) faucet.disabled = true;
  const display = document.getElementById('s1-display');
  if (display) display.textContent = '00.00';
  s1ReturnCupToTray();
  s1Idx = 1;
  s1SlotState = 'idle';
}

/* ═══════════════════════════════════════════════════════════
   SCQ engine — generic SingleChoiceQuestion, per-screen config.
   Used for scored questions; config supplies scoring/nav hooks.
   ═══════════════════════════════════════════════════════════ */
const SCQ = {};
const scqState = {};
/* xAPI questionId per graded SCQ screen. */
var SCQ_QID = {
  s2: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-04-002/q1',
  s5: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-04-003/q1',
  s6: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-04-004/q1'
};
function scqRegister(scr, cfg) {
  SCQ[scr] = cfg;
  scqState[scr] = { selected: null, attempts: 0, answered: false, done: false };
}
function scqSelect(scr, el) {
  const st = scqState[scr]; if (st.answered) return;
  st.selected = el.dataset.id;
  if (st.attempts > 0) {
    hide(scr + 'q-popup');
    document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => {
    const sel = o.dataset.id === st.selected;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  const chk = document.getElementById(scr + 'q-check'); if (chk) chk.disabled = false;
}
function scqCheck(scr) {
  const st = scqState[scr], cfg = SCQ[scr];
  if (st.answered) { (cfg.onAdvance || advanceScreen)(); return; }
  if (!st.selected) return;
  st.attempts++;
  const correct = st.selected === cfg.correctId;
  /* xAPI — emit ONE answered statement (answer string captured before any reset). */
  if (SCQ_QID[scr]) {
    try {
      var _optEl = document.querySelector('#' + scr + ' .scq-opt[data-id="' + st.selected + '"] .scq-opt-text');
      var _ans = _optEl ? _optEl.textContent.trim() : st.selected;
      var _row = correct ? 'answered.last' : (st.attempts >= cfg.maxAttempts ? 'answered.last' : 'answered');
      sendStatement720(_row, 'question',
        { success: !!correct, score: { scaled: correct ? 1 : 0 }, extensions: { student_answer: [_ans] } },
        { questionId: SCQ_QID[scr] });
    } catch(e) { console.error('[xAPI] answered', e); }
  }
  if (correct) {
    scqMark(scr, cfg.correctId, 'correct'); scqShowPopup(scr, 'correct'); scqFinish(scr, true);
  } else if (st.attempts >= cfg.maxAttempts) {
    scqMark(scr, cfg.correctId, 'correct'); scqMark(scr, st.selected, 'wrong');
    scqShowPopup(scr, 'wrong2'); scqFinish(scr, false);
  } else {
    scqMark(scr, st.selected, 'wrong'); scqShowPopup(scr, 'retry');
    const h = document.getElementById(scr + 'q-hint'); if (h && cfg.hasHint) h.style.visibility = 'visible';
  }
}
function scqMark(scr, id, cls) {
  const o = document.querySelector('#' + scr + ' .scq-opt[data-id="' + id + '"]');
  if (o) { o.classList.remove('selected'); o.classList.add(cls); }
}
function scqShowPopup(scr, type) {
  const p = document.getElementById(scr + 'q-popup'); if (!p) return;
  const cfg = SCQ[scr].popup[type];
  p.style.background = (type === 'correct') ? '#edf8ed' : '#ffdbdc';
  resetPopupPosition(p);
  const t = document.getElementById(scr + 'q-popup-title'); if (t) t.innerHTML = '<strong>' + cfg.title + '</strong>';
  const b = document.getElementById(scr + 'q-popup-body'); if (b) b.innerHTML = cfg.body.map(x => '<p>' + x + '</p>').join('');
  p.classList.remove('hidden');
}
function scqClosePopup(scr) { hide(scr + 'q-popup'); }
function scqFinish(scr, correct) {
  const st = scqState[scr], cfg = SCQ[scr];
  st.answered = true; st.done = true;
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => o.disabled = true);
  const chk = document.getElementById(scr + 'q-check'); if (chk) { chk.textContent = cfg.doneLabel || 'שנמשיך?'; chk.disabled = false; }
  const h = document.getElementById(scr + 'q-hint'); if (h) h.style.visibility = 'hidden';
  if (cfg.onFinish) cfg.onFinish(correct);
}
function scqOpenHint(scr)  { document.getElementById(scr + 'q-hint-overlay')?.classList.remove('hidden'); try { sendStatement720('requested.1', 'question'); } catch(e) {} }
function scqCloseHint(scr) { hide(scr + 'q-hint-overlay'); }
function scqCloseHintOnBackdrop(e, scr) { if (e.target && e.target.id === scr + 'q-hint-overlay') scqCloseHint(scr); }
function scqResetInitial(scr) {
  const st = scqState[scr]; st.selected = null; st.attempts = 0; st.answered = false;
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong'); o.disabled = false; o.setAttribute('aria-checked', 'false');
  });
  hide(scr + 'q-popup');
  const chk = document.getElementById(scr + 'q-check'); if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const h = document.getElementById(scr + 'q-hint'); if (h) { h.disabled = false; h.style.visibility = 'hidden'; }
}
function scqEnter(scr) {
  if (!scqState[scr].done) scqResetInitial(scr);
  hide(scr + 'q-hint-overlay');
  if (SCQ[scr].onEnter) SCQ[scr].onEnter();
}

/* ── S2 — scored Q1 (closes nav-A dot 1). Correct = c (75 גרם). ── */
scqRegister('s2', {
  correctId: 'c', maxAttempts: 2, hasHint: true, doneLabel: 'שנמשיך?',
  popup: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'התשובה נכונה.', body: ['המסה של הנוזל לבדו היא 75 גרם. זה החישוב: מסת הכוס עם הנוזל פחות מסת הכוס הריקה. גם לנוזלים יש מסה, אבל כדי למדוד אותה נכון צריך להפריד בין מסת הכלי לבין מסת הנוזל שבתוכו.'] },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מסומנת.', body: ['המסה של הנוזל לבדו היא 75 גרם. זה החישוב: מסת הכוס עם הנוזל פחות מסת הכוס הריקה. גם לנוזלים יש מסה, אבל כדי למדוד אותה נכון צריך להפריד בין מסת הכלי לבין מסת הנוזל שבתוכו.'] }
  },
  onEnter: function () {
    practiceA.questions[0].visited = true; practiceA.questions[0].screen = 2;
    if (practiceA.questions[0].state !== 'correct' && practiceA.questions[0].state !== 'incorrect')
      practiceA.questions[0].state = 'current';
    syncNavA();
  },
  onFinish: function (c) {
    practiceA.questions[0].visited = true; practiceA.questions[0].screen = 2;
    practiceA.questions[0].state = c ? 'correct' : 'incorrect'; syncNavA();
  }
});

function navADecided(i) {
  return practiceA.questions[i].state === 'correct' || practiceA.questions[i].state === 'incorrect';
}

/* ── S5 — scored Q2 (closes nav-A dot 2). Correct = c. ── */
scqRegister('s5', {
  correctId: 'c', maxAttempts: 2, hasHint: true, doneLabel: 'שנמשיך?',
  popup: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'התשובה נכונה.', body: ['לאחר הניפוח המסה שנמדדה גדלה, ולכן הנתונים מחזקים את הטענה ש<strong>גם לאוויר יש מסה</strong>. חשוב לחזק מסקנות באמצעות מדידות וניסויים נוספים.'] },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מסומנת.', body: ['לאחר הניפוח המסה שנמדדה גדלה, ולכן הנתונים מחזקים את הטענה ש<strong>גם לאוויר יש מסה</strong>. חשוב לחזק מסקנות באמצעות מדידות וניסויים נוספים.'] }
  },
  onEnter: function () {
    practiceA.questions[1].visited = true; practiceA.questions[1].screen = 3;
    if (!navADecided(1)) practiceA.questions[1].state = 'current';
    syncNavA();
  },
  onFinish: function (c) {
    practiceA.questions[1].visited = true; practiceA.questions[1].screen = 3;
    practiceA.questions[1].state = c ? 'correct' : 'incorrect'; syncNavA();
  }
});

/* ── S6 — Q3a (nav-A dot 3, part 1). 1 attempt, no hint. Correct = b (לא).
   Dot 3 stays 'current'; decided at S7 (verdict = Q3a AND Q3b). ── */
let q3aCorrect = false;
scqRegister('s6', {
  correctId: 'b', maxAttempts: 1, hasHint: false, doneLabel: 'שנמשיך?',
  popup: {
    correct: { title: 'נכון. תמר לא סיימה את המדידה.', body: ['בואו נבין יחד מדוע.'] },
    wrong2:  { title: 'לא מדויק. תמר לא סיימה את המדידה.', body: ['בואו נבין יחד מדוע.'] }
  },
  onEnter: function () {
    practiceA.questions[2].visited = true; practiceA.questions[2].screen = 6;
    if (!navADecided(2)) practiceA.questions[2].state = 'current';
    syncNavA();
  },
  onFinish: function (c) { q3aCorrect = c; }   // dot 3 verdict set at S7
});

/* ═══════════════════════════════════════════════════════════
   MeasurementWidget (table) — s3 / s4
   Weigh a balloon 3× into a table, then enter the average.
   Average gets 1 attempt; a wrong value reveals the answer (on blur)
   and the learner must enter it to enable the continue button.
   Not scored (nav-A dot 2 stays 'current').
   ═══════════════════════════════════════════════════════════ */
const MW = {
  s3: { meas: [3.1, 3.3, 3.2], avg: 3.2, continueLabel: 'אפשר להמשיך', correctBody: 'ממוצע המדידות הוא 3.2 גר\'.' },
  s4: { meas: [3.0, 4.2, 3.6], avg: 3.6, continueLabel: 'מה אומר ההבדל?', correctBody: 'ממוצע המדידות הוא 3.6 גר\'.' }
};
const mwState = {
  s3: { idx: 0, slot: 'idle', done: false, avgChecked: false },
  s4: { idx: 0, slot: 'idle', done: false, avgChecked: false }
};
function mwFmt(v) { return (v < 10 ? '0' : '') + Number(v).toFixed(2); }

function mwEnter(scr) {
  practiceA.questions[1].visited = true; practiceA.questions[1].screen = 3;
  if (practiceA.questions[1].state !== 'correct' && practiceA.questions[1].state !== 'incorrect')
    practiceA.questions[1].state = 'current';
  syncNavA();
}
function mwBalloonDragStart(e, scr) {
  const s = mwState[scr]; if (s.slot !== 'idle' || s.idx >= 3) { e.preventDefault(); return; }
  e.dataTransfer.setData('text/plain', 'balloon'); e.dataTransfer.effectAllowed = 'move';
}
function mwScaleDragOver(e, scr) {
  const s = mwState[scr]; if (s.slot === 'idle' && s.idx < 3) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
}
function mwScaleDrop(e, scr) {
  e.preventDefault(); const s = mwState[scr]; if (s.slot !== 'idle' || s.idx >= 3) return;
  if (e.dataTransfer.getData('text/plain') !== 'balloon') return;
  s.slot = 'weighing';
  const d = document.getElementById(scr + '-display'); if (d) d.textContent = mwFmt(MW[scr].meas[s.idx]);
  const inp = document.getElementById(scr + '-input-' + (s.idx + 1)); if (inp) { inp.disabled = false; inp.classList.add('active'); inp.focus(); }
  const b = document.getElementById(scr + '-balloon'), col = document.getElementById(scr + '-scale-col');
  // 132px token on the 60px-lifted scale: center-x 194px, bottom edge 98px
  if (b && col) { b.style.position = 'absolute'; b.style.top = '-34px'; b.style.left = '128px'; b.style.cursor = 'default'; col.appendChild(b); }
}
function mwReturnBalloon(scr) {
  const b = document.getElementById(scr + '-balloon'), tray = document.getElementById(scr + '-tray');
  if (b && tray) { b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.cursor = 'grab'; tray.appendChild(b); }
}
function mwInputChange(scr, idx) {
  const s = mwState[scr]; if (s.idx !== idx - 1 || s.slot === 'idle') return;
  const inp = document.getElementById(scr + '-input-' + idx); const val = inp ? inp.value.trim() : '';
  const rb = document.getElementById(scr + '-reset-btn');
  if (val === '') { inp.classList.remove('error'); inp.classList.add('active'); s.slot = 'weighing'; if (rb) rb.disabled = true; }
  else if (Number(val) === MW[scr].meas[s.idx]) { inp.classList.remove('error', 'active'); inp.setAttribute('readonly', ''); s.slot = 'validated'; if (rb) rb.disabled = false; }
  else { inp.classList.remove('active'); inp.classList.add('error'); s.slot = 'wrong'; if (rb) rb.disabled = true; }
}
function mwReset(scr) {
  const s = mwState[scr]; if (s.slot !== 'validated') return;
  const inp = document.getElementById(scr + '-input-' + (s.idx + 1)); if (inp) inp.classList.add('locked');
  const d = document.getElementById(scr + '-display'); if (d) d.textContent = '00.00';
  mwReturnBalloon(scr);
  const rb = document.getElementById(scr + '-reset-btn'); if (rb) rb.disabled = true;
  s.idx++; s.slot = 'idle';
  if (s.idx >= 3) {
    const avg = document.getElementById(scr + '-avg'); if (avg) { avg.disabled = false; avg.classList.add('active'); avg.focus(); }
    const b = document.getElementById(scr + '-balloon'); if (b) b.style.cursor = 'default';
  }
}
/* Average input. Before the check: enable the "צדקתי?" button once a value is
   present. After a wrong check: the continue button stays disabled until the
   learner types the revealed correct value. */
function mwAvgChange(scr) {
  const s = mwState[scr]; if (s.idx < 3) return;
  const avg = document.getElementById(scr + '-avg'); const val = avg ? avg.value.trim() : '';
  const btn = document.getElementById(scr + '-continue');
  if (!s.avgChecked) {
    avg.classList.remove('error');
    if (btn) btn.disabled = (val === '');
    return;
  }
  // post-wrong-check: must reach the correct value to unlock continue
  if (val !== '' && Number(val) === MW[scr].avg) {
    avg.classList.remove('error'); avg.setAttribute('readonly', ''); avg.classList.add('locked');
    s.done = true; if (btn) btn.disabled = false;
  } else {
    avg.classList.remove('locked'); avg.removeAttribute('readonly');
    s.done = false; if (btn) btn.disabled = true;
  }
}

/* Bottom-bar button: acts as "צדקתי?" (1 attempt) before checking, then as the
   continue button afterwards. */
function mwBarBtn(scr) {
  const s = mwState[scr];
  const avg = document.getElementById(scr + '-avg');
  const btn = document.getElementById(scr + '-continue');
  if (!s.avgChecked) {
    const val = avg ? avg.value.trim() : '';
    if (val === '') return;
    s.avgChecked = true;
    if (Number(val) === MW[scr].avg) {
      avg.setAttribute('readonly', ''); avg.classList.add('locked'); avg.classList.remove('error');
      s.done = true;
      mwAvgPopup(scr, true);
      if (btn) { btn.textContent = MW[scr].continueLabel; btn.disabled = false; }
    } else {
      avg.classList.add('error');
      mwAvgPopup(scr, false);
      s.done = false;
      if (btn) { btn.textContent = MW[scr].continueLabel; btn.disabled = true; }
    }
  } else {
    advanceScreen();
  }
}

function mwAvgPopup(scr, correct) {
  const p = document.getElementById(scr + '-popup'); if (!p) return;
  p.style.background = correct ? '#edf8ed' : '#ffdbdc';
  resetPopupPosition(p);
  if (correct) {
    document.getElementById(scr + '-popup-title').innerHTML = '<strong>תשובה נכונה.</strong>';
    document.getElementById(scr + '-popup-body').innerHTML = '<p>' + MW[scr].correctBody + '</p>';
  } else {
    document.getElementById(scr + '-popup-title').innerHTML = '<strong>יש לך טעות.</strong>';
    document.getElementById(scr + '-popup-body').innerHTML = '<p>הערך הנכון הוא ' + MW[scr].avg + '. הזינו אותו כעת.</p>';
  }
  p.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════
   S7 — DragAndDropQuestion sequencing (Q3b). 7 steps → 5 targets.
   Closes nav-A dot 3 (verdict = Q3a AND Q3b correct). 2 attempts.
   ═══════════════════════════════════════════════════════════ */
const S7DDQ = {
  correctMap: {
    'target-s7-1': 'drag-s7-3',  // בדיקת איפוס
    'target-s7-2': 'drag-s7-4',  // הנחת הכוס
    'target-s7-3': 'drag-s7-5',  // לחיצת איפוס
    'target-s7-4': 'drag-s7-1',  // מזיגת מים עד 32
    'target-s7-5': 'drag-s7-7'   // חזרה 3 פעמים
  },
  maxAttempts: 2,
  feedbackText: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'תשובה נכונה. כל הכבוד!', body: ['זכרו, כדי למדוד מסה של נוזל בצורה מדויקת: נשתמש בכלי מתאים, נאפס את מסת הכלי, נמדוד את מסת הנוזל עצמו, ונחזור על המדידה כדי להבטיח מהימנות.'] },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מוצגת.', body: ['זכרו, כדי למדוד מסה של נוזל בצורה מדויקת: נשתמש בכלי מתאים, נאפס את מסת הכלי, נמדוד את מסת הנוזל עצמו, ונחזור על המדידה כדי להבטיח מהימנות.'] }
  }
};
S7DDQ.revealMap = S7DDQ.correctMap;
const s7ddqTexts = {
  'drag-s7-1': 'למזוג מים לכוס המדידה עד שהמאזניים מראים 32 גרם',
  'drag-s7-2': 'לכבות את המאזניים לפני המדידה',
  'drag-s7-3': 'לבדוק שהמאזניים מאופסים (מראים 0.00)',
  'drag-s7-4': 'להניח את כוס המדידה על המאזניים',
  'drag-s7-5': 'ללחוץ על כפתור האיפוס',
  'drag-s7-6': 'לקרוא את נפח המים בלבד, ללא קשר לערך על צג המאזניים',
  'drag-s7-7': 'לחזור על המדידה 3 פעמים לפחות, ולהשוות בין התוצאות'
};
const s7ddqPlacement = {
  'drag-s7-1': 'source', 'drag-s7-2': 'source', 'drag-s7-3': 'source',
  'drag-s7-4': 'source', 'drag-s7-5': 'source', 'drag-s7-6': 'source', 'drag-s7-7': 'source'
};
const S7_TARGETS = ['target-s7-1', 'target-s7-2', 'target-s7-3', 'target-s7-4', 'target-s7-5'];
let s7ddqChecked = false, s7ddqDone = false, s7ddqAttempts = 0,
    s7ddqShowFeedback = false, s7ddqDropHandled = false, s7ddqResult = null;

function s7ddqRender() {
  Object.keys(s7ddqPlacement).forEach(id => {
    const card = document.getElementById(id); if (!card) return;
    const inSource = (s7ddqPlacement[id] === 'source');
    card.classList.toggle('ghost', !inSource);
    card.draggable = (inSource && !s7ddqChecked);
  });
  S7_TARGETS.forEach(targetId => {
    const zone = document.getElementById(targetId); if (!zone) return;
    zone.querySelector('.s11ddq-placed-card')?.remove();
    const dragId = Object.keys(s7ddqPlacement).find(k => s7ddqPlacement[k] === targetId) || null;
    if (dragId) {
      const card = document.createElement('div'); card.className = 's11ddq-placed-card';
      const txt = document.createElement('span'); txt.className = 's11ddq-card-text';
      txt.textContent = s7ddqTexts[dragId]; card.appendChild(txt);
      if (!s7ddqChecked) {
        card.draggable = true;
        card.addEventListener('dragstart', ev => s7ddqPlacedDragStart(ev, dragId));
        card.addEventListener('dragend', ev => s7ddqDragEnd(ev));
      }
      zone.appendChild(card); zone.classList.add('occupied');
    } else { zone.classList.remove('occupied', 'drag-over'); }
  });
  s7ddqUpdateCheck();
}
function s7ddqAllFilled() {
  return S7_TARGETS.every(t => Object.keys(s7ddqPlacement).some(d => s7ddqPlacement[d] === t));
}
function s7ddqUpdateCheck() {
  if (s7ddqChecked) return;
  const btn = document.getElementById('s7ddq-check'); if (btn) btn.disabled = !s7ddqAllFilled();
}
function s7ddqDragStart(e, dragId) {
  if (s7ddqChecked || s7ddqPlacement[dragId] !== 'source') { e.preventDefault(); return; }
  s7ddqClearAttemptFeedback(); s7ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move';
  // Selected state (תכלת stroke) — set synchronously so the drag image captures it
  e.currentTarget.classList.add('selected');
  setTimeout(() => document.getElementById(dragId)?.classList.add('dragging'), 0);
}
function s7ddqPlacedDragStart(e, dragId) {
  if (s7ddqChecked) { e.preventDefault(); return; }
  s7ddqClearAttemptFeedback(); s7ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move';
  // Selected state (תכלת stroke) on the placed card being dragged back out
  e.currentTarget.classList.add('selected');
  setTimeout(() => { s7ddqPlacement[dragId] = 'source'; s7ddqRender(); document.getElementById(dragId)?.classList.add('dragging'); }, 0);
}
function s7ddqDragEnd() {
  Object.keys(s7ddqPlacement).forEach(id => document.getElementById(id)?.classList.remove('dragging', 'selected'));
  document.querySelectorAll('#s7 .s11ddq-target').forEach(t => t.classList.remove('drag-over'));
  if (!s7ddqDropHandled) s7ddqRender();
  s7ddqDropHandled = false;
}
function s7ddqDragOver(e, targetId) {
  if (s7ddqChecked) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.getElementById(targetId)?.classList.add('drag-over');
}
function s7ddqDragLeave(e, targetId) {
  const zone = document.getElementById(targetId);
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
}
function s7ddqDrop(e, targetId) {
  e.preventDefault(); if (s7ddqChecked) return;
  const dragId = e.dataTransfer.getData('text/plain'); if (!dragId) return;
  document.getElementById(targetId)?.classList.remove('drag-over');
  s7ddqDropHandled = true;
  const evicted = Object.keys(s7ddqPlacement).find(k => s7ddqPlacement[k] === targetId);
  if (evicted && evicted !== dragId) s7ddqPlacement[evicted] = 'source';
  s7ddqPlacement[dragId] = targetId;
  s7ddqRender();
}
function s7ddqCheck() {
  if (s7ddqDone) { advanceScreen(); return; }
  if (!s7ddqAllFilled()) return;
  s7ddqClearAttemptFeedback(); s7ddqAttempts++;
  const allCorrect = S7_TARGETS.every(t => s7ddqPlacement[S7DDQ.correctMap[t]] === t);
  /* xAPI — emit ONE answered statement (placed sequence captured before any reveal/reset). */
  try {
    var _seq = S7_TARGETS.map(function (t, i) {
      var dragId = Object.keys(s7ddqPlacement).find(function (d) { return s7ddqPlacement[d] === t; });
      return (i + 1) + '. ' + (dragId ? s7ddqTexts[dragId] : '—');
    }).join(' | ');
    var _row = allCorrect ? 'answered.last' : (s7ddqAttempts >= S7DDQ.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_seq] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-04-004/q2' });
  } catch(e) { console.error('[xAPI] answered', e); }
  if (allCorrect) {
    s7ddqChecked = true; s7ddqDone = true; s7ddqRender(); s7ddqLock(); s7ddqShowFeedbackIcons(true);
    s7ddqShowPopup('correct'); s7ddqResult = 'correct'; s7ddqFinish();
  } else if (s7ddqAttempts >= S7DDQ.maxAttempts) {
    s7ddqChecked = true; s7ddqDone = true; s7ddqRevealCorrect(); s7ddqLock(); s7ddqShowFeedbackIcons(true);
    s7ddqShowPopup('wrong2'); s7ddqResult = 'incorrect'; s7ddqFinish();
  } else {
    s7ddqShowFeedback = true; s7ddqShowFeedbackIcons(false); s7ddqShowPopup('retry');
    const h = document.getElementById('s7ddq-hint'); if (h) h.style.visibility = 'visible';
  }
}
function s7ddqLock() {
  Object.keys(s7ddqPlacement).forEach(id => { const c = document.getElementById(id); if (c) { c.draggable = false; c.classList.add('locked'); } });
  document.querySelectorAll('#s7 .s11ddq-placed-card').forEach(c => c.draggable = false);
}
function s7ddqRevealCorrect() {
  Object.keys(S7DDQ.revealMap).forEach(t => { s7ddqPlacement[S7DDQ.revealMap[t]] = t; });
  const assigned = new Set(Object.values(S7DDQ.revealMap));
  Object.keys(s7ddqPlacement).forEach(id => { if (!assigned.has(id)) s7ddqPlacement[id] = 'source'; });
  s7ddqRender();
}
function s7ddqFinish() {
  const btn = document.getElementById('s7ddq-check'); if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
  const h = document.getElementById('s7ddq-hint'); if (h) h.style.visibility = 'hidden';
  hide('s7ddq-hint-overlay');
  // Dot 3 verdict = Q3a (s6) AND Q3b (s7) both correct (any attempt)
  const verdict = (q3aCorrect && s7ddqResult === 'correct') ? 'correct' : 'incorrect';
  practiceA.questions[2].visited = true; practiceA.questions[2].screen = 6;
  practiceA.questions[2].state = verdict; s7ddqResult = verdict; syncNavA();
}
function s7ddqOpenHint() { document.getElementById('s7ddq-hint-overlay')?.classList.remove('hidden'); try { sendStatement720('requested.1', 'question'); } catch(e) {} }
function s7ddqCloseHint() { hide('s7ddq-hint-overlay'); }
function s7ddqCloseHintOnBackdrop(e) { if (e.target && e.target.id === 's7ddq-hint-overlay') s7ddqCloseHint(); }
function s7ddqShowFeedbackIcons(allGreen) {
  S7_TARGETS.forEach(t => {
    const zone = document.getElementById(t); if (!zone) return;
    const isCorrect = allGreen || (s7ddqPlacement[S7DDQ.correctMap[t]] === t);
    const placed = zone.querySelector('.s11ddq-placed-card');
    if (placed) {
      placed.querySelector('.s11ddq-placed-ficon')?.remove();
      const ic = document.createElement('div');
      ic.className = 's11ddq-placed-ficon ' + (isCorrect ? 's11ddq-placed-ficon--correct' : 's11ddq-placed-ficon--wrong');
      placed.appendChild(ic);
    }
    zone.classList.remove('s11ddq-correct', 's11ddq-wrong');
    zone.classList.add(isCorrect ? 's11ddq-correct' : 's11ddq-wrong');
  });
}
function s7ddqClearAttemptFeedback() {
  if (!s7ddqShowFeedback) return;
  s7ddqShowFeedback = false;
  S7_TARGETS.forEach(t => {
    const zone = document.getElementById(t); if (!zone) return;
    zone.querySelector('.s11ddq-placed-ficon')?.remove();
    zone.classList.remove('s11ddq-correct', 's11ddq-wrong');
  });
}
function s7ddqShowPopup(type) {
  const p = document.getElementById('s7ddq-popup'); if (!p) return;
  const cfg = S7DDQ.feedbackText[type];
  p.style.background = (type === 'correct') ? '#edf8ed' : '#ffdbdc';
  resetPopupPosition(p);
  document.getElementById('s7ddq-popup-title').textContent = cfg.title;
  document.getElementById('s7ddq-popup-body').innerHTML = cfg.body.map(x => '<p>' + x + '</p>').join('');
  p.classList.remove('hidden');
}
function s7ddqEnter() {
  if (s7ddqDone) {
    s7ddqRender(); s7ddqLock(); s7ddqShowFeedbackIcons(true);
    const btn = document.getElementById('s7ddq-check'); if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
    if (s7ddqResult) practiceA.questions[2].state = s7ddqResult;
    syncNavA(); return;
  }
  practiceA.questions[2].visited = true; practiceA.questions[2].screen = 6;
  if (!navADecided(2)) practiceA.questions[2].state = 'current';
  s7ddqRender(); syncNavA();
}

/* ═══════════════════════════════════════════════════════════
   S8 — VideoWatchAndContinue (YouTube embed). Watching the video
   to the end unlocks the continue button (→ part 05).
   ═══════════════════════════════════════════════════════════ */
/* S8 YouTube video — https://www.youtube.com/watch?v=8AVv7XEeXF8
   YouTube IFrame Player API (same pattern as part 01): the API script is
   loaded lazily on first entry, replaces #s8-youtube-player with the player
   iframe, and ENDED unlocks Continue. youtube-nocookie.com host works under
   Edge Tracking Prevention; cc_load_policy turns Hebrew captions on. */
const S8_YT_VIDEO_ID = '8AVv7XEeXF8';
let s8Done     = false;
let s8YtPlayer = null;
let s8YtApiLoading = false;

function loadYouTubeApi(cb) {
  if (window.YT && window.YT.Player) { cb(); return; }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof prev === 'function') prev();
    cb();
  };
  if (!s8YtApiLoading) {
    s8YtApiLoading = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
}

/* Shared playerVars for the YouTube embed. YouTube rejects embeds whose
   origin/referrer signals are broken with player error 153 ("configuration
   error"): over file:// window.location.origin is "null" (an invalid origin
   param) and no Referer is sent — so pass origin/widget_referrer only when
   actually served over http(s). */
function ytEmbedPlayerVars() {
  const vars = { rel: 0, modestbranding: 1, playsinline: 1, hl: 'iw', cc_lang_pref: 'iw', cc_load_policy: 1 };
  if (/^https?:$/.test(window.location.protocol)) {
    vars.origin = window.location.origin;
    vars.widget_referrer = window.location.href;
  }
  return vars;
}

function initS8Player() {
  if (s8YtPlayer) return;
  loadYouTubeApi(function () {
    if (s8YtPlayer) return;
    s8YtPlayer = new YT.Player('s8-youtube-player', {
      videoId: S8_YT_VIDEO_ID,
      host: 'https://www.youtube-nocookie.com',
      playerVars: ytEmbedPlayerVars(),
      events: {
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) s8OnVideoEnded();
        },
        /* Player failed — don't strand the learner behind the watch gate. */
        onError: function () { s8OnVideoEnded(); }
      }
    });
  });
}

function pauseS8Video() {
  if (s8YtPlayer && typeof s8YtPlayer.pauseVideo === 'function') s8YtPlayer.pauseVideo();
}

function s8OnVideoEnded() {
  s8Done = true;
  const cont = document.getElementById('s8-continue');
  if (cont) cont.disabled = false;
}

function s8Enter() {
  const cont = document.getElementById('s8-continue');
  /* Completed end state persists: once watched, Continue stays unlocked. */
  if (s8Done) {
    if (cont) cont.disabled = false;
  } else {
    if (cont) cont.disabled = true;
    if (s8YtPlayer && typeof s8YtPlayer.stopVideo === 'function') {
      s8YtPlayer.stopVideo();
    } else {
      initS8Player();
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Dev mode: postMessage bridge (used by index_dev.html)
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'DEV_GOTO') return;
  const n = parseInt(e.data.screen, 10);
  if (!isNaN(n)) goTo(n);
});
if (window.parent !== window) {
  window.parent.postMessage({ type: 'DEV_READY', total: document.querySelectorAll('.screen').length }, '*');
}

/* ─── Initial entry ─────────────────────────────────────── */
s0Enter();

// ============================================================
//  REPORT MODAL
// ============================================================
function openReportModal() {
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}
function tryCloseReportModal() {
  var typeVal = document.getElementById('report-type').value;
  var textVal = document.getElementById('report-text').value.trim();
  if (typeVal || textVal) {
    document.getElementById('report-modal').setAttribute('hidden', '');
    document.getElementById('report-confirm-modal').removeAttribute('hidden');
  } else { forceCloseReportModal(); }
}
function forceCloseReportModal() {
  document.getElementById('report-modal').setAttribute('hidden', '');
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  resetReportForm();
}
function backToReportForm() {
  document.getElementById('report-confirm-modal').setAttribute('hidden', '');
  document.getElementById('report-modal').removeAttribute('hidden');
  setTimeout(function() { var el = document.getElementById('report-type'); if (el) el.focus(); }, 40);
}

var REPORT_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfFq5XFtH1pPpLgV5RWT4m3NanYPW5GKremqTvkp6zKjEGqcw/formResponse';

// screen -> [subContent suffix, page-in-item] ; null = no matching subContent
var SCREEN_TO_SUBCONTENT = { 0:null, 1:['002',1], 2:['002',2], 3:['003',1], 4:['003',2], 5:['003',3], 6:['004',1], 7:['004',2], 8:null };

function submitReport() {
  var typeSel = document.getElementById('report-type');
  var textVal = document.getElementById('report-text').value.trim();
  var errEl   = document.getElementById('report-error');
  if (!typeSel.value || !textVal) {
    if (errEl) errEl.removeAttribute('hidden');
    (typeSel.value ? document.getElementById('report-text') : typeSel).focus();
    return;
  }
  if (errEl) errEl.setAttribute('hidden', '');
  var now  = new Date();
  var meta = window.METADATA || {};
  var body = new URLSearchParams();
  body.append('entry.301404029_year',  now.getFullYear());
  body.append('entry.301404029_month', now.getMonth() + 1);
  body.append('entry.301404029_day',   now.getDate());
  body.append('entry.2066097581_hour',   now.getHours());
  body.append('entry.2066097581_minute', now.getMinutes());
  body.append('entry.1933069481', shortId(meta.learningUnitId));
  body.append('entry.2070680092', shortId(meta.id));
  var mapEntry = SCREEN_TO_SUBCONTENT[currentScreen];
  var itemId   = mapEntry ? (shortId(meta.id)) + '-' + mapEntry[0] : '';
  var itemPage = mapEntry ? String(mapEntry[1]) : String(currentScreen);
  body.append('entry.1555704258', itemId);
  body.append('entry.1671046914', itemPage);
  body.append('entry.1179822443', typeSel.options[typeSel.selectedIndex].text);
  body.append('entry.806447525',  textVal);
  fetch(REPORT_FORM_ACTION, { method: 'POST', mode: 'no-cors', body: body })
    .catch(function(e) { console.error('[Report] send failed', e); });
  console.log('[Report Issue] sent');
  showReportThanks();
}
function showReportThanks() {
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.setAttribute('hidden', ''); });
  var t = document.getElementById('report-thanks');
  if (t) t.removeAttribute('hidden');
}
function resetReportForm() {
  document.getElementById('report-type').value = '';
  document.getElementById('report-text').value = '';
  document.getElementById('report-char-count').textContent = '0 / 250';
  var errEl = document.getElementById('report-error');
  if (errEl) errEl.setAttribute('hidden', '');
  var t = document.getElementById('report-thanks');
  if (t) t.setAttribute('hidden', '');
  document.querySelectorAll('#report-modal .report-field, #report-modal .report-actions, #report-modal .report-modal-body')
    .forEach(function(el) { el.removeAttribute('hidden'); });
}
// Wire the existing flag button + char counter + Esc-to-close
(function wireReport() {
  var flagBtn = document.getElementById('flag-btn');
  if (flagBtn) flagBtn.addEventListener('click', openReportModal);
  var reportTextarea = document.getElementById('report-text');
  var reportCounter  = document.getElementById('report-char-count');
  if (reportTextarea && reportCounter) {
    reportTextarea.addEventListener('input', function() {
      reportCounter.textContent = reportTextarea.value.length + ' / 250';
    });
  }
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    var confirmModal = document.getElementById('report-confirm-modal');
    var reportModal  = document.getElementById('report-modal');
    if (confirmModal && !confirmModal.hasAttribute('hidden')) { forceCloseReportModal(); return; }
    if (reportModal && !reportModal.hasAttribute('hidden'))  { tryCloseReportModal();   return; }
  });
})();

/* ═══════════════════ xAPI ═══════════════════ */
(function initXAPI() {
  var CDN = 'https://lomdot.education.gov.il/metodica/720active/common/';
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-04.json';

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function() { console.error('[xAPI] failed to load', src); cb(); };
    document.head.appendChild(s);
  }
  function pollMetadataReady(cb) {
    if (window.jsXAPI_MetadataReady) { cb(); }
    else { setTimeout(function() { pollMetadataReady(cb); }, 200); }
  }
  loadScript(CDN + 'xapiwrapper.min.js', function() {
    loadScript(CDN + 'xapi-720-f.js', function() {
      try {
        getXAPIParameters(METADATA_FILE);
        pollMetadataReady(function() {
          try {
            ADL.XAPIWrapper.changeConfig({ endpoint: window.slxapi.endpoint, auth: window.slxapi.auth });
            sendStatement720('initialized', 'onlinelesson');
          } catch(e) { console.error('[xAPI] init', e); }
        });
      } catch(e) { console.error('[xAPI] load', e); }
    });
  });
})();
