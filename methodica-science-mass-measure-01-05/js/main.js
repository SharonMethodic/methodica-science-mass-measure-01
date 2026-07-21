/* xAPI: canonical URL id prefix + short-id helper (added for URL-format ids) */
var XAPI_ID_PREFIX = "https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/";
function shortId(u){ return String(u || "").split("/").pop(); }

'use strict';

/* ═══════════════════════════════════════════════════════════
   methodica-science-mass-measure-01-05 — main.js
   Part 05 (final part) — שאלת השיא. Split out of part 04
   (former screens s9–s15, renumbered s0–s6):
     S0  TransitionScreen        (intro to שאלת השיא, companion video)
     S1  SCQ image variant       (Q1a — Exp.jpg)
     S2  SCQ image variant       (Q1b — Exp35.jpg, tooltip)
     S3  DropdownQuestion        (Q1c — two methods → goals)
     S4  SCQ text-only           (Q1d — score branch on advance)
     S5  TransitionScreen        (<3/4 correct — finish)
     S6  TransitionScreen        (≥3/4 correct — finish)
   ═══════════════════════════════════════════════════════════ */

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_SCREENS = document.querySelectorAll('.screen').length;

/* ─── Character carry-over (written by part 01, read here) ── */
/* S0 (שאלת השיא intro) uses the per-character "Challenge" clips. */
const S0_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Challenge.mp4',
  'character-2': 'assets/video/Character-2-Challenge.mp4'
};
/* S5 (fail finish) uses its own "OK" companion clips (per character). */
const S5_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-OK.mp4',
  'character-2': 'assets/video/Character-2-OK.mp4'
};
/* S6 (success finish) uses the per-character "Success" clips. */
const S6_CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Success.mp4',
  'character-2': 'assets/video/Character-2-Success.mp4'
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
window.addEventListener('resize', function () {
  scaleApp();
  s3UpdateScrollState();
});
scaleApp();

/* ─── Image zoom (shared modal for content images) ─────────── */
function openImageZoom(btn) {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal || !stage || !btn) return;
  const wrapper = btn.closest('.scq-img-inner, .s12-img-frame');
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
  1: 's1q-popup', 2: 's2q-popup', 3: 's3-popup', 4: 's4q-popup'
};
/* Screen number → whether that screen's question has actually been resolved
   (correct, or final wrong) — same "is this question done" check each screen's
   own resetScreenState() branch already uses to decide fresh-reset vs. resume.
   The popup-reopen below must only fire when this is true: reopening a
   "try again" popup over a board that a *not-done* screen's own reset just
   wiped back to blank would show stale feedback for an empty board. */
const SCREEN_DONE = {
  1: () => scqState.s1.done, 2: () => scqState.s2.done,
  3: () => s3done, 4: () => scqState.s4.done
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
  if (n === 1) scqEnter('s1');
  if (n === 2) scqEnter('s2');
  if (n === 3) s3Enter();
  if (n === 4) scqEnter('s4');
  if (n === 5) s5Enter();
  if (n === 6) s6Enter();
}

function goBack() { goTo(currentScreen - 1); }
function advanceScreen() {
  if (currentScreen === 1 && !scqState.s1.answered) return;
  if (currentScreen === 2 && !scqState.s2.answered) return;
  if (currentScreen === 3 && !s3done) return;
  if (currentScreen === 4) { if (scqState.s4.answered) peakBranch(); return; }
  if (currentScreen >= 5) return;   // s5/s6 are terminal
  goTo(currentScreen + 1);
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
  if (e.key === 'Escape') {
    document.querySelectorAll('[id$="-popup"], [id$="-hint-overlay"]')
      .forEach(el => el.classList.add('hidden'));
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
   S0 — TransitionScreen (intro to שאלת השיא). Companion video.
   ═══════════════════════════════════════════════════════════ */
function s0Enter() {
  const src = S0_CHARACTER_VIDEOS[getCharacter()] || S0_CHARACTER_VIDEOS['character-1'];
  const vid = document.getElementById('s0-video');
  if (vid) { vid.src = src; vid.load(); vid.play().catch(() => {}); freezeVideoOnEnd(vid); }
}

/* ═══════════════════════════════════════════════════════════
   SCQ engine — generic SingleChoiceQuestion, per-screen config.
   Used for scored questions; config supplies scoring/nav hooks.
   ═══════════════════════════════════════════════════════════ */
const SCQ = {};
const scqState = {};
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
var SCQ_QID = {
  s1: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-05-001/q1',
  s2: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-05-001/q2',
  s4: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-05-001/q4'
};
function scqCheck(scr) {
  const st = scqState[scr], cfg = SCQ[scr];
  if (st.answered) { (cfg.onAdvance || advanceScreen)(); return; }
  if (!st.selected) return;
  st.attempts++;
  const correct = st.selected === cfg.correctId;
  // ── xAPI: emit the answered statement (answer string captured BEFORE reset) ──
  if (SCQ_QID[scr]) {
    try {
      var _optEl = document.querySelector('#' + scr + ' .scq-opt[data-id="' + st.selected + '"] .scq-opt-text');
      var _ans = _optEl ? _optEl.textContent.trim() : String(st.selected);
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
function scqOpenHint(scr)  {
  document.getElementById(scr + 'q-hint-overlay')?.classList.remove('hidden');
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
}
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

/* ═══════════════════════════════════════════════════════════
   שאלת השיא — s1–s4. 4 scored sub-questions, no progress nav.
   Correct (within attempts) is tallied; ≥3/4 → s6 else s5.
   ═══════════════════════════════════════════════════════════ */
const peakResults = { s1: false, s2: false, s3: false, s4: false };
function peakBranch() {
  const n = ['s1', 's2', 's3', 's4'].filter(k => peakResults[k]).length;
  goTo(n >= 3 ? 6 : 5);
}

const PEAK_CORRECT_BODY_S1 = ['המסה הכוללת נשארה זהה משום שכל חלקי המערכת נשארו על המאזניים.'];
scqRegister('s1', {
  correctId: 'b', maxAttempts: 2, hasHint: true, doneLabel: 'שנמשיך?',
  popup: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'התשובה נכונה.', body: PEAK_CORRECT_BODY_S1 },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מסומנת.', body: PEAK_CORRECT_BODY_S1 }
  },
  onFinish: function (c) { peakResults.s1 = c; }
});

const PEAK_CORRECT_BODY_S2 = ['ההפרש בין שתי המדידות מייצג את מסת הגז שהשתחרר מהבקבוק.'];
scqRegister('s2', {
  correctId: 'd', maxAttempts: 2, hasHint: true, doneLabel: 'שנמשיך?',
  popup: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'התשובה נכונה.', body: PEAK_CORRECT_BODY_S2 },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מסומנת.', body: PEAK_CORRECT_BODY_S2 }
  },
  onFinish: function (c) { peakResults.s2 = c; }   // correct = d (2.4 גרם), per Figma 2365-4652
});

const PEAK_CORRECT_BODY_S4 = ['מדידות חריגות דורשות בדיקה נוספת לפני הסקת מסקנה סופית.'];
scqRegister('s4', {
  correctId: 'c', maxAttempts: 2, hasHint: true, doneLabel: 'המשך', onAdvance: peakBranch,
  popup: {
    retry:   { title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { title: 'התשובה נכונה.', body: PEAK_CORRECT_BODY_S4 },
    wrong2:  { title: 'לא מדויק. התשובה הנכונה מסומנת.', body: PEAK_CORRECT_BODY_S4 }
  },
  onFinish: function (c) { peakResults.s4 = c; }
});

/* ── S3 — DropdownQuestion, 2 image methods → goal. 1 attempt. ── */
const S3_LABELS = { a: 'השוואת מסת המערכת לפני ואחרי הניסוי', b: 'חישוב מסת הגז שהשתחרר' };
const S3_CORRECT = { right: 'a', left: 'b' };   // right(Exp)=compare, left(Exp35)=compute released gas
const s3sel = { right: null, left: null };
let s3done = false;
function s3Toggle(side) {
  if (s3done) return;
  const other = side === 'right' ? 'left' : 'right';
  document.getElementById('s3-list-' + other)?.classList.add('hidden');
  document.getElementById('s3-btn-' + other)?.setAttribute('aria-expanded', 'false');
  const listEl = document.getElementById('s3-list-' + side);
  if (!listEl) return;
  const opening = listEl.classList.contains('hidden');
  listEl.classList.toggle('hidden');
  document.getElementById('s3-btn-' + side)?.setAttribute('aria-expanded', opening ? 'true' : 'false');
  s3UpdateScrollState();
  if (opening) s3FitList(side);
}
function s3UpdateScrollState() {
  const scrollArea = document.getElementById('s3-scroll-area');
  if (!scrollArea) return;
  requestAnimationFrame(() => {
    const hasContentOverflow = scrollArea.scrollHeight > scrollArea.clientHeight + 1;
    const scrollRect = scrollArea.getBoundingClientRect();
    const hasOpenDropdownOverflow = Array.from(document.querySelectorAll('#s3 .mdq-list:not(.hidden)'))
      .some(listEl => {
        const listRect = listEl.getBoundingClientRect();
        return listRect.bottom > scrollRect.bottom + 1 || listRect.top < scrollRect.top - 1;
      });
    scrollArea.classList.toggle('s12-scrollable', hasContentOverflow || hasOpenDropdownOverflow);
  });
}
function s3FitList(side) {
  const listEl = document.getElementById('s3-list-' + side);
  const app = document.getElementById('app');
  const scrollArea = document.getElementById('s3-scroll-area');
  if (!listEl || !app || !scrollArea) return;
  const m = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale = m ? parseFloat(m[1]) : 1;
  requestAnimationFrame(() => {
    const scrollRect = scrollArea.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const bottomOverflow = listRect.bottom - scrollRect.bottom + 16 * scale;
    const topOverflow = scrollRect.top - listRect.top;
    if (bottomOverflow > 0) {
      scrollArea.scrollTop += bottomOverflow / scale;
    } else if (topOverflow > 0) {
      scrollArea.scrollTop -= topOverflow / scale;
    }
  });
}
function s3Select(side, id) {
  if (s3done) return;
  s3sel[side] = id;
  const sel = document.getElementById('s3-selected-' + side);
  if (sel) sel.textContent = S3_LABELS[id];
  const btn = document.getElementById('s3-btn-' + side);
  if (btn) { btn.dataset.empty = 'false'; btn.setAttribute('aria-expanded', 'false'); }
  document.getElementById('s3-list-' + side)?.classList.add('hidden');
  s3UpdateScrollState();
  const chk = document.getElementById('s3-check');
  if (chk) chk.disabled = !(s3sel.right && s3sel.left);
}
function s3Check() {
  if (s3done) { goTo(4); return; }
  if (!(s3sel.right && s3sel.left)) return;
  s3done = true;
  const correct = (s3sel.right === S3_CORRECT.right && s3sel.left === S3_CORRECT.left);
  peakResults.s3 = correct;
  // ── xAPI: single-attempt question. Capture answer string BEFORE the reveal below. ──
  try {
    var _ans = 'ימין: ' + (S3_LABELS[s3sel.right] || '—') + '; שמאל: ' + (S3_LABELS[s3sel.left] || '—');
    sendStatement720('answered.last', 'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-05-001/q3' });
  } catch(e) { console.error('[xAPI] answered', e); }
  if (!correct) {   // reveal correct values
    s3sel.right = S3_CORRECT.right; s3sel.left = S3_CORRECT.left;
    document.getElementById('s3-selected-right').textContent = S3_LABELS[S3_CORRECT.right];
    document.getElementById('s3-selected-left').textContent = S3_LABELS[S3_CORRECT.left];
  }
  // Whether right or wrong, the values shown are now the correct answer → mark them green.
  document.getElementById('s3-btn-right')?.classList.add('s12-ok');
  document.getElementById('s3-btn-left')?.classList.add('s12-ok');
  const p = document.getElementById('s3-popup');
  if (p) {
    p.style.background = correct ? '#edf8ed' : '#ffdbdc';
    resetPopupPosition(p);
    document.getElementById('s3-popup-title').innerHTML = '<strong>' + (correct ? 'התשובה נכונה.' : 'לא מדויק. התשובה הנכונה מסומנת.') + '</strong>';
    document.getElementById('s3-popup-body').innerHTML = '<p>כאשר משנים את מה שנמצא על המאזניים, משתנה גם סוג המידע שאפשר להסיק מהמדידה.</p>';
    p.classList.remove('hidden');
  }
  const chk = document.getElementById('s3-check'); if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
}
function s3Enter() {
  if (s3done) return;
  const scrollArea = document.getElementById('s3-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;
  s3sel.right = null; s3sel.left = null;
  ['right', 'left'].forEach(side => {
    const sel = document.getElementById('s3-selected-' + side); if (sel) sel.textContent = 'בחרו תשובה';
    const btn = document.getElementById('s3-btn-' + side); if (btn) { btn.dataset.empty = 'true'; btn.classList.remove('s12-ok', 's12-bad'); btn.setAttribute('aria-expanded', 'false'); }
    document.getElementById('s3-list-' + side)?.classList.add('hidden');
  });
  const chk = document.getElementById('s3-check'); if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  hide('s3-popup');
  s3UpdateScrollState();
}

/* ── S5 / S6 — finish transitions (companion video) ── */
function s5Enter() { loadCompanionVideo('s5-video', S5_CHARACTER_VIDEOS); }
function s6Enter() { loadCompanionVideo('s6-video', S6_CHARACTER_VIDEOS); }
function loadCompanionVideo(id, videos) {
  const src = videos[getCharacter()] || videos['character-1'];
  const vid = document.getElementById(id);
  if (vid) { vid.src = src; vid.load(); vid.play().catch(() => {}); freezeVideoOnEnd(vid); }
}
function finishLomda() {
  /* End of the lomda — final screen; nothing further to navigate to.
     This is the LAST part, so emit BOTH the component and unit completed. */
  try { sendStatement720('completed', 'onlinelesson'); } catch(e) {}
  try { sendStatement720('completed', 'onlinelesson', null, { scope: 'unit' }); } catch(e) {}
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
var SCREEN_TO_SUBCONTENT = { 0:null, 1:['001',1], 2:['001',2], 3:['001',3], 4:['001',4], 5:null, 6:null };

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
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-05.json';

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
            loadUnitMetadata('../metadata/methodica-science-mass-measure-01_unit.json', function() {});
          } catch(e) { console.error('[xAPI] init', e); }
        });
      } catch(e) { console.error('[xAPI] load', e); }
    });
  });
})();
