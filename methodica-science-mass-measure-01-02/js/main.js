/* xAPI: canonical URL id prefix + short-id helper (added for URL-format ids) */
var XAPI_ID_PREFIX = "https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/";
function shortId(u){ return String(u || "").split("/").pop(); }

'use strict';

/* ═══════════════════════════════════════════════════════════
   methodica-science-mass-measure-01-02 — main.js
   Part 02 of the mass-measurement lomda. 5 screens:
     S0  TransitionScreen        (companion video)
     S1  SingleChoiceQuestion    (speech bubbles)  — scored Q1a
     S2  SingleChoiceQuestion    (speech bubbles)  — scored Q1b
     S3  DragAndDropQuestion      (text → image)   — scored Q2
     S4  ValueInputQuestion                         — scored Q3
   Reuses the part-01 CSS component classes verbatim. Character
   choice is carried over from part 01 via localStorage.
   ═══════════════════════════════════════════════════════════ */

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_SCREENS = 5;  // S0–S4

/* Onward navigation to the next part of the lomda (sibling folder). */
const NEXT_PART_URL = '../methodica-science-mass-measure-01-03/index.html';
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

/* ═══ COMPONENT — Progress Question (single sequence) ═══
   Nav A (3 dots) is shared by S1, S2, S3, S4:
     • Q1 (dot 1) decided only after BOTH S1 (a) and S2 (b) are answered;
       check only if both parts are correct (any attempt).
     • Q2 (dot 2) decided after S3.
     • Q3 (dot 3) decided after S4. */
var practiceA = {
  questions: [
    { number: 1, visited: true,  state: 'current',      screen: 1 },    // Q1 = S1 + S2
    { number: 2, visited: false, state: 'not-answered', screen: null }, // Q2 = S3
    { number: 3, visited: false, state: 'not-answered', screen: null }  // Q3 = S4
  ]
};

/* Generic renderer (identical contract to part 01). */
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
    if (q.state !== 'not-answered') {
      icon.classList.add('progress-question__icon--' + q.state);
    }
    label.classList.toggle('progress-question__label--visited', q.visited);
    var navigable = q.visited && q.screen != null;
    item.style.cursor = navigable ? 'pointer' : '';
    item.onclick = navigable
      ? (function (s) { return function () { goTo(s); }; })(q.screen)
      : null;
  });
  for (var n = 1; n < questions.length; n++) {
    var conn = container.querySelector('[data-connector="' + n + '"]');
    if (!conn) continue;
    var qState = questions[n - 1].state;
    conn.classList.toggle(
      'progress-question__connector--visited',
      qState === 'correct' || qState === 'incorrect'
    );
  }
}
function syncNavA() {
  document.querySelectorAll('.progress-question[data-nav="A"]')
    .forEach(function (c) { updateProgressQuestion(c, practiceA); });
}

/* Q1 = two parts (S1 = a, S2 = b). Dot decides only once both are in:
   check only if BOTH parts are correct (attempt number doesn't matter). */
var q1aCorrect = null, q1bCorrect = null;
function markQ1Part(part, correct) {
  if (part === 'a') q1aCorrect = correct;
  if (part === 'b') q1bCorrect = correct;
  practiceA.questions[0].visited = true;
  if (q1aCorrect !== null && q1bCorrect !== null) {
    practiceA.questions[0].state = (q1aCorrect && q1bCorrect) ? 'correct' : 'incorrect';
  }
  syncNavA();
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

/* Image zoom — shared modal. Shows a scaled clone of the image wrapper
   (image + name tags); speech bubbles live outside it and are excluded. */
function openImageZoom(btn) {
  const modal = document.getElementById('img-zoom-modal');
  const stage = document.getElementById('img-zoom-modal-stage');
  if (!modal || !stage || !btn) return;
  const wrapper = btn.closest('.s12q-frame-inner, .scq-img-inner, .s16ddq-img-frame');
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
  1: 's1q-popup', 2: 's2q-popup', 3: 's3ddq-popup', 4: 's4v-popup'
};
/* Screen number → whether that screen's question has actually been resolved
   (correct, or final wrong) — same "is this question done" check each screen's
   own resetScreenState() branch already uses to decide fresh-reset vs. resume.
   The popup-reopen below must only fire when this is true: reopening a
   "try again" popup over a board that a *not-done* screen's own reset just
   wiped back to blank would show stale feedback for an empty board. */
const SCREEN_DONE = {
  1: () => scqState.s1.done, 2: () => scqState.s2.done,
  3: () => s3ddqDone, 4: () => s4vDone
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
  if (n === 3) s3ddqEnter();
  if (n === 4) s4vEnter();
}

function goBack() { goTo(currentScreen - 1); }

function advanceScreen() {
  if (currentScreen === 1 && !scqState.s1.answered) return;
  if (currentScreen === 2 && !scqState.s2.answered) return;
  if (currentScreen === 3 && !s3ddqDone) return;
  goTo(currentScreen + 1);
}

/* ─── Keyboard Navigation ────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
  if (e.key === 'Escape') {
    scqClosePopup('s1'); scqCloseHint('s1');
    scqClosePopup('s2'); scqCloseHint('s2');
    s3ddqClosePopup(); s3ddqCloseHint();
    s4vClosePopup(); s4vCloseHint();
  }
});

/* ═══════════════════════════════════════════════════════════
   Shared — draggable feedback popup (any #id) + reset helper
   ═══════════════════════════════════════════════════════════ */
function resetPopupPosition(popup) {
  popup.style.left = '2px';
  popup.style.top  = 'auto';
  popup.style.bottom = '76px';
}
let popupDrag = null;   // { id, offX, offY }
function popupMouseDown(e, id) {
  if (e.target.closest('.scq-popup-close')) return;
  const popup = document.getElementById(id);
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const m       = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = m ? parseFloat(m[1]) : 1;
  const cx = (e.clientX - appLeft) / scale;
  const cy = (e.clientY - appTop)  / scale;
  const topPx = parseFloat(popup.style.top);
  const top   = isNaN(topPx) ? popup.offsetTop : topPx;
  popup.style.top = top + 'px';
  popup.style.bottom = 'auto';
  popupDrag = { id: id, offX: cx - (parseFloat(popup.style.left) || 2), offY: cy - top };
  e.preventDefault();
}
window.addEventListener('mousemove', e => {
  if (!popupDrag) return;
  const popup = document.getElementById(popupDrag.id);
  const app   = document.getElementById('app');
  if (!popup || !app) return;
  const appLeft = parseFloat(app.style.left) || 0;
  const appTop  = parseFloat(app.style.top)  || 0;
  const m       = app.style.transform.match(/scale\(([^)]+)\)/);
  const scale   = m ? parseFloat(m[1]) : 1;
  const nx = (e.clientX - appLeft) / scale - popupDrag.offX;
  const ny = (e.clientY - appTop)  / scale - popupDrag.offY;
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
   TEMPLATE — SingleChoiceQuestion (speech bubbles)  · S1, S2
   Generic engine keyed by screen id ('s1' | 's2').
   ═══════════════════════════════════════════════════════════ */
const SCQ = {
  s1: {
    correctId: 'b', maxAttempts: 2, part: 'a',
    popup: {
      retry:   { bg: '#ffdbdc', title: 'התשובה אינה נכונה.',
                 body: ['שננסה שוב?'] },
      correct: { bg: '#edf8ed', title: 'התשובה נכונה.',
                 body: ['תוצאת המדידה של עדן גבוהה משמעותית מזו של שחר ופלג ולכן עלינו לבדוק אותה.'] },
      wrong2:  { bg: '#ffdbdc', title: 'לא מדויק. התשובה הנכונה מסומנת.',
                 body: ['תוצאת המדידה של עדן גבוהה משמעותית מזו של שחר ופלג ולכן עלינו לבדוק אותה.'] }
    }
  },
  s2: {
    correctId: 'a', maxAttempts: 2, part: 'b',
    popup: {
      retry:   { bg: '#ffdbdc', title: 'התשובה אינה נכונה.',
                 body: ['שננסה שוב?'] },
      correct: { bg: '#edf8ed', title: 'התשובה נכונה.',
                 body: ['כאשר מתקבלת תוצאה חריגה, נמדוד פעם נוספת כדי לבדוק האם הייתה טעות במדידה.'] },
      wrong2:  { bg: '#ffdbdc', title: 'לא מדויק. התשובה הנכונה מסומנת.',
                 body: ['כאשר מתקבלת תוצאה חריגה, נמדוד פעם נוספת כדי לבדוק האם הייתה טעות במדידה.'] }
    }
  }
};
const scqState = {
  s1: { selected: null, attempts: 0, answered: false, done: false },
  s2: { selected: null, attempts: 0, answered: false, done: false }
};

function scqSelect(scr, el) {
  const st = scqState[scr];
  if (st.answered) return;
  st.selected = el.dataset.id;
  if (st.attempts > 0) {
    hide(scr + 'q-popup');
    document.querySelectorAll('#' + scr + ' .scq-opt')
      .forEach(o => o.classList.remove('wrong', 'correct'));
  }
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => {
    const sel = o.dataset.id === st.selected;
    o.classList.toggle('selected', sel);
    o.setAttribute('aria-checked', sel ? 'true' : 'false');
  });
  scqUpdateBar(scr);
}

var SCQ_QID = {
  s1: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-02-002/q1',
  s2: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-02-002/q2'
};

function scqCheck(scr) {
  const st = scqState[scr], cfg = SCQ[scr];
  if (st.answered) { advanceScreen(); return; }
  if (!st.selected) return;

  st.attempts++;
  const isCorrect = st.selected === cfg.correctId;

  try {
    var _optEl = document.querySelector('#' + scr + ' .scq-opt[data-id="' + st.selected + '"] .scq-opt-text');
    var _ans = _optEl ? _optEl.textContent.trim() : String(st.selected);
    var _row = isCorrect ? 'answered.last' : (st.attempts >= cfg.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!isCorrect, score: { scaled: isCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: SCQ_QID[scr] });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (isCorrect) {
    scqMark(scr, cfg.correctId, 'correct');
    scqShowPopup(scr, 'correct');
    scqFinish(scr, true);
  } else if (st.attempts >= cfg.maxAttempts) {
    scqMark(scr, cfg.correctId, 'correct');
    scqMark(scr, st.selected, 'wrong');
    scqShowPopup(scr, 'wrong2');
    scqFinish(scr, false);
  } else {
    scqMark(scr, st.selected, 'wrong');
    scqShowPopup(scr, 'retry');
    const hint = document.getElementById(scr + 'q-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function scqMark(scr, id, cls) {
  const opt = document.querySelector('#' + scr + ' .scq-opt[data-id="' + id + '"]');
  if (!opt) return;
  opt.classList.remove('selected');
  opt.classList.add(cls);
}

function scqShowPopup(scr, type) {
  const popup = document.getElementById(scr + 'q-popup');
  if (!popup) return;
  const cfg = SCQ[scr].popup[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById(scr + 'q-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById(scr + 'q-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}
function scqClosePopup(scr) { hide(scr + 'q-popup'); }

function scqFinish(scr, correct) {
  const st = scqState[scr];
  st.answered = true;
  st.done     = true;
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => { o.disabled = true; });
  const chk = document.getElementById(scr + 'q-check');
  if (chk) { chk.textContent = 'שנמשיך?'; chk.disabled = false; }
  const hint = document.getElementById(scr + 'q-hint');
  if (hint) hint.style.visibility = 'hidden';
  markQ1Part(SCQ[scr].part, correct);
}

function scqUpdateBar(scr) {
  const st = scqState[scr];
  if (st.answered) return;
  const chk = document.getElementById(scr + 'q-check');
  if (chk) chk.disabled = !st.selected;
}

function scqOpenHint(scr)  {
  document.getElementById(scr + 'q-hint-overlay')?.classList.remove('hidden');
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
}
function scqCloseHint(scr) { hide(scr + 'q-hint-overlay'); }
function scqCloseHintOnBackdrop(e, scr) {
  if (e.target && e.target.id === scr + 'q-hint-overlay') scqCloseHint(scr);
}

function scqResetInitial(scr) {
  const st = scqState[scr];
  st.selected = null; st.attempts = 0; st.answered = false;
  document.querySelectorAll('#' + scr + ' .scq-opt').forEach(o => {
    o.classList.remove('selected', 'correct', 'wrong');
    o.disabled = false;
    o.setAttribute('aria-checked', 'false');
  });
  hide(scr + 'q-popup');
  const chk = document.getElementById(scr + 'q-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById(scr + 'q-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function scqEnter(scr) {
  if (!scqState[scr].done) scqResetInitial(scr);
  hide(scr + 'q-hint-overlay');
  // Q1 is "current" while either part is being answered (unless already decided)
  if (practiceA.questions[0].state !== 'correct' &&
      practiceA.questions[0].state !== 'incorrect') {
    practiceA.questions[0].state = 'current';
  }
  practiceA.questions[0].visited = true;
  syncNavA();
}

/* ═══════════════════════════════════════════════════════════
   S3 — DragAndDropQuestion (text cards → zone under each image)
   Clone of part-01 s16ddq. Marks Nav A · Q2 on completion.
   ═══════════════════════════════════════════════════════════ */
const S3DDQ = {
  // target (image) → matching description card. Targets are numbered
  // right→left (target-s3-1 = rightmost = Doc1).
  correctMap: {
    'target-s3-1': 'drag-s3-3',  // Doc1 → גם מדויק וגם מהימן
    'target-s3-2': 'drag-s3-2',  // Doc2 → מהימן אך לא מדויק
    'target-s3-3': 'drag-s3-1',  // Doc3 → מדויק אך לא מהימן
    'target-s3-4': 'drag-s3-4'   // Doc4 → לא מדויק ולא מהימן
  },
  maxAttempts: 2,
  feedbackText: {
    retry:   { bg: '#ffdbdc', titleColor: '#303030', title: 'התשובה אינה נכונה.',
               body: ['שננסה שוב?'] },
    correct: { bg: '#edf8ed', titleColor: '#222222', title: 'תשובה נכונה. כל הכבוד!',
               body: ['מהימנות משמעותה תוצאות דומות בכל המדידות. דיוק משמעו המדידות קרובות לערך האמיתי. מדענים ומדעניות ישאפו לגם וגם.'] },
    wrong2:  { bg: '#ffdbdc', titleColor: '#303030', title: 'לא מדויק. לא נורא. התשובה הנכונה מסומנת.',
               body: ['מהימנות משמעותה תוצאות דומות בכל המדידות. דיוק משמעו המדידות קרובות לערך האמיתי. מדענים ומדעניות ישאפו לגם וגם.'] }
  }
};
S3DDQ.revealMap = S3DDQ.correctMap;

const s3ddqTexts = {
  'drag-s3-1': 'מדויק אך לא מהימן',
  'drag-s3-2': 'מהימן אך לא מדויק',
  'drag-s3-3': 'גם מדויק וגם מהימן',
  'drag-s3-4': 'לא מדויק ולא מהימן'
};
const s3ddqPlacement = {
  'drag-s3-1': 'source', 'drag-s3-2': 'source',
  'drag-s3-3': 'source', 'drag-s3-4': 'source'
};
let s3ddqChecked      = false;
let s3ddqDone         = false;
let s3ddqAttempts     = 0;
let s3ddqShowFeedback = false;
let s3ddqDropHandled  = false;
let s3ddqResult       = null;

function s3ddqRender() {
  Object.keys(s3ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const inSource = (s3ddqPlacement[id] === 'source');
    card.classList.toggle('ghost', !inSource);
    card.draggable = (inSource && !s3ddqChecked);
  });

  const targetIds = [...new Set([
    ...Object.keys(S3DDQ.correctMap),
    ...Object.values(s3ddqPlacement).filter(v => v !== 'source')
  ])];

  targetIds.forEach(targetId => {
    const zone = document.getElementById(targetId);
    if (!zone) return;
    zone.querySelector('.s16ddq-placed-card')?.remove();
    const dragId = Object.keys(s3ddqPlacement).find(k => s3ddqPlacement[k] === targetId) || null;
    if (dragId) {
      const card = document.createElement('div');
      card.className = 's16ddq-placed-card';
      const txt = document.createElement('span');
      txt.className = 's16ddq-card-text';
      txt.textContent = s3ddqTexts[dragId];
      card.appendChild(txt);
      if (!s3ddqChecked) {
        card.draggable = true;
        card.addEventListener('dragstart', ev => s3ddqPlacedDragStart(ev, dragId));
        card.addEventListener('dragend',   ev => s3ddqDragEnd(ev));
      }
      zone.appendChild(card);
      zone.classList.add('occupied');
    } else {
      zone.classList.remove('occupied', 'drag-over');
    }
  });

  s3ddqUpdateCheck();
}

function s3ddqAllFilled() {
  return Object.keys(S3DDQ.correctMap).every(tId =>
    Object.keys(s3ddqPlacement).some(dId => s3ddqPlacement[dId] === tId));
}
function s3ddqUpdateCheck() {
  if (s3ddqChecked) return;
  const btn = document.getElementById('s3ddq-check');
  if (btn) btn.disabled = !s3ddqAllFilled();
}

function s3ddqDragStart(e, dragId) {
  if (s3ddqChecked || s3ddqPlacement[dragId] !== 'source') { e.preventDefault(); return; }
  s3ddqClearAttemptFeedback();
  s3ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.effectAllowed = 'move';
  // Selected state (תכלת stroke) — set synchronously so the drag image captures it
  e.currentTarget.classList.add('selected');
  setTimeout(() => { document.getElementById(dragId)?.classList.add('dragging'); }, 0);
}
function s3ddqPlacedDragStart(e, dragId) {
  if (s3ddqChecked) { e.preventDefault(); return; }
  s3ddqClearAttemptFeedback();
  s3ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.effectAllowed = 'move';
  // Selected state (תכלת stroke) on the placed card being dragged back out
  e.currentTarget.classList.add('selected');
  setTimeout(() => {
    s3ddqPlacement[dragId] = 'source';
    s3ddqRender();
    document.getElementById(dragId)?.classList.add('dragging');
  }, 0);
}
function s3ddqDragEnd() {
  Object.keys(s3ddqPlacement).forEach(id => {
    document.getElementById(id)?.classList.remove('dragging', 'selected');
  });
  document.querySelectorAll('#s3 .s16ddq-target').forEach(t => t.classList.remove('drag-over'));
  if (!s3ddqDropHandled) s3ddqRender();
  s3ddqDropHandled = false;
}
function s3ddqDragOver(e, targetId) {
  if (s3ddqChecked) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.getElementById(targetId)?.classList.add('drag-over');
}
function s3ddqDragLeave(e, targetId) {
  const zone = document.getElementById(targetId);
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
}
function s3ddqDrop(e, targetId) {
  e.preventDefault();
  if (s3ddqChecked) return;
  const dragId = e.dataTransfer.getData('text/plain');
  if (!dragId) return;
  document.getElementById(targetId)?.classList.remove('drag-over');
  s3ddqDropHandled = true;
  const evicted = Object.keys(s3ddqPlacement).find(k => s3ddqPlacement[k] === targetId);
  if (evicted && evicted !== dragId) s3ddqPlacement[evicted] = 'source';
  s3ddqPlacement[dragId] = targetId;
  s3ddqRender();
}

function s3ddqCheck() {
  if (s3ddqDone) { advanceScreen(); return; }
  if (!s3ddqAllFilled()) return;

  s3ddqClearAttemptFeedback();
  s3ddqAttempts++;

  const allCorrect = Object.keys(S3DDQ.correctMap).every(
    tId => s3ddqPlacement[S3DDQ.correctMap[tId]] === tId);

  try {
    var _ans = Object.keys(S3DDQ.correctMap).map(function(tId) {
      var dId = Object.keys(s3ddqPlacement).find(function(k){ return s3ddqPlacement[k] === tId; });
      return tId + '=' + (dId ? s3ddqTexts[dId] : '—');
    }).join('; ');
    var _row = allCorrect ? 'answered.last' : (s3ddqAttempts >= S3DDQ.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!allCorrect, score: { scaled: allCorrect ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-02-003/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (allCorrect) {
    s3ddqChecked = true; s3ddqDone = true;
    s3ddqRender(); s3ddqLock(); s3ddqShowFeedbackIcons(true);
    s3ddqShowPopup('correct');
    s3ddqResult = 'correct';
    s3ddqFinish('correct');
  } else if (s3ddqAttempts >= S3DDQ.maxAttempts) {
    s3ddqChecked = true; s3ddqDone = true;
    s3ddqRevealCorrect(); s3ddqLock(); s3ddqShowFeedbackIcons(true);
    s3ddqShowPopup('wrong2');
    s3ddqResult = 'incorrect';
    s3ddqFinish('incorrect');
  } else {
    s3ddqShowFeedback = true;
    s3ddqShowFeedbackIcons(false);
    s3ddqShowPopup('retry');
    const hint = document.getElementById('s3ddq-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function s3ddqLock() {
  Object.keys(s3ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.draggable = false;
    card.classList.add('locked');
  });
  document.querySelectorAll('#s3 .s16ddq-placed-card').forEach(c => { c.draggable = false; });
}
function s3ddqRevealCorrect() {
  Object.keys(S3DDQ.revealMap).forEach(tId => { s3ddqPlacement[S3DDQ.revealMap[tId]] = tId; });
  const assigned = new Set(Object.values(S3DDQ.revealMap));
  Object.keys(s3ddqPlacement).forEach(id => { if (!assigned.has(id)) s3ddqPlacement[id] = 'source'; });
  s3ddqRender();
}
function s3ddqFinish(result) {
  const btn = document.getElementById('s3ddq-check');
  if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
  const hint = document.getElementById('s3ddq-hint');
  if (hint) hint.style.visibility = 'hidden';
  hide('s3ddq-hint-overlay');
  practiceA.questions[1].visited = true;
  practiceA.questions[1].state   = result;
  practiceA.questions[1].screen  = 3;
  syncNavA();
}

function s3ddqOpenHint()  {
  document.getElementById('s3ddq-hint-overlay')?.classList.remove('hidden');
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
}
function s3ddqCloseHint() { hide('s3ddq-hint-overlay'); }
function s3ddqCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's3ddq-hint-overlay') s3ddqCloseHint();
}

function s3ddqShowFeedbackIcons(allGreen) {
  [1, 2, 3, 4].forEach(i => {
    const tId  = 'target-s3-' + i;
    const zone = document.getElementById(tId);
    if (!zone) return;
    const isCorrect = allGreen || (s3ddqPlacement[S3DDQ.correctMap[tId]] === tId);
    const placedCard = zone.querySelector('.s16ddq-placed-card');
    if (placedCard) {
      placedCard.querySelector('.s16ddq-placed-ficon')?.remove();
      const iconEl = document.createElement('div');
      iconEl.className = 's16ddq-placed-ficon ' +
        (isCorrect ? 's16ddq-placed-ficon--correct' : 's16ddq-placed-ficon--wrong');
      placedCard.appendChild(iconEl);
    }
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong');
    zone.classList.add(isCorrect ? 's16ddq-correct' : 's16ddq-wrong');
  });
}
function s3ddqClearAttemptFeedback() {
  if (!s3ddqShowFeedback) return;
  s3ddqShowFeedback = false;
  [1, 2, 3, 4].forEach(i => {
    const zone = document.getElementById('target-s3-' + i);
    if (!zone) return;
    zone.querySelector('.s16ddq-placed-ficon')?.remove();
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong');
  });
}

function s3ddqShowPopup(type) {
  const popup = document.getElementById('s3ddq-popup');
  if (!popup) return;
  const cfg = S3DDQ.feedbackText[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s3ddq-popup-title');
  if (titleEl) { titleEl.textContent = cfg.title; titleEl.style.color = cfg.titleColor; }
  const bodyEl = document.getElementById('s3ddq-popup-body');
  if (bodyEl) bodyEl.innerHTML = cfg.body.map(p => `<p>${p}</p>`).join('');
  popup.classList.remove('hidden');
}
function s3ddqClosePopup() { hide('s3ddq-popup'); }

function s3ddqEnter() {
  if (s3ddqDone) {
    s3ddqRender(); s3ddqLock(); s3ddqShowFeedbackIcons(true);
    const btn = document.getElementById('s3ddq-check');
    if (btn) { btn.textContent = 'שנמשיך?'; btn.disabled = false; }
    const hint = document.getElementById('s3ddq-hint');
    if (hint) hint.style.visibility = 'hidden';
    hide('s3ddq-popup'); hide('s3ddq-hint-overlay');
    if (s3ddqResult) practiceA.questions[1].state = s3ddqResult;
    syncNavA();
    return;
  }
  s3ddqChecked = false; s3ddqResult = null; s3ddqAttempts = 0;
  s3ddqShowFeedback = false; s3ddqDropHandled = false;
  Object.keys(s3ddqPlacement).forEach(id => { s3ddqPlacement[id] = 'source'; });
  Object.keys(S3DDQ.correctMap).forEach(tId => {
    const zone = document.getElementById(tId);
    if (!zone) return;
    zone.classList.remove('s16ddq-correct', 's16ddq-wrong', 'occupied', 'drag-over');
    zone.querySelector('.s16ddq-placed-card')?.remove();
  });
  Object.keys(s3ddqPlacement).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.remove('ghost', 'dragging', 'locked');
    card.draggable = true;
  });
  const btn = document.getElementById('s3ddq-check');
  if (btn) { btn.textContent = 'צדקתי?'; btn.disabled = true; }
  const hint = document.getElementById('s3ddq-hint');
  if (hint) hint.style.visibility = 'hidden';
  hide('s3ddq-popup'); hide('s3ddq-hint-overlay');

  practiceA.questions[1].visited = true;
  practiceA.questions[1].state   = 'current';
  practiceA.questions[1].screen  = 3;
  s3ddqRender();
  syncNavA();
}

/* ═══════════════════════════════════════════════════════════
   S4 — ValueInputQuestion (recover the erased measurement)
   Correct = 48 (accepts 48 / 48.0; rejects 48.1–48.9). 2 attempts.
   Marks Nav B · Q1 on completion.
   ═══════════════════════════════════════════════════════════ */
const S4V = {
  correct: 48, maxAttempts: 2,
  explain: [
    'ממוצע הוא סכום כל המדידות חלקי מספרן.',
    'אם הממוצע הוא 50 ויש 3 מדידות, אז הסכום הוא 50×3=150.',
    'חיבור מדידה 1 ומדידה 2 נותן 50+52=102, ולכן המדידה השלישית היא 150−102=48.'
  ],
  popup: {
    retry:   { bg: '#ffdbdc', title: 'התשובה אינה נכונה.', body: ['שננסה שוב?'] },
    correct: { bg: '#edf8ed', title: 'תשובה נכונה. כל הכבוד!', body: null },
    wrong2:  { bg: '#ffdbdc', title: 'לא מדויק. התשובה הנכונה עודכנה.', body: null }
  }
};
let s4vAttempts = 0, s4vAnswered = false, s4vDone = false, s4vResult = null;

/* Remediation gate — part 03 is reachable only with ≥2 of the 3 practice
   questions correct (Q1 = S1+S2 combined, Q2 = S3, Q3 = S4). Below that,
   "המשך" does not navigate. */
const REMEDIATION_PASS_THRESHOLD = 2;
function practiceAScore() {
  return practiceA.questions.filter(function (q) { return q.state === 'correct'; }).length;
}

function s4vInputChange() {
  if (s4vAnswered) return;
  const inp = document.getElementById('s4v-input');
  inp.classList.remove('error');
  const chk = document.getElementById('s4v-check');
  if (chk) chk.disabled = (inp.value.trim() === '');
}

function s4vIsCorrect(raw) {
  if (raw.trim() === '') return false;
  return Number(raw) === S4V.correct;   // 48 or 48.0 → true; 48.1–48.9, 47, 49 → false
}

function s4vCheck() {
  if (s4vAnswered) {
    // TODO(reporting): below-threshold case (<2/3) needs a system notification that the
    // student failed part 02 and cannot advance to part 03 — no verified xAPI verb/pattern
    // for a component-level failure exists yet (see REPORTING-ADDING.md); add once defined.
    if (practiceAScore() >= REMEDIATION_PASS_THRESHOLD) goToNextPart();   // ≥2/3 → continue to part 03
    return;
  }
  const inp = document.getElementById('s4v-input');
  if (!inp || inp.value.trim() === '') return;

  s4vAttempts++;
  const correct = s4vIsCorrect(inp.value);

  try {
    var _ans = inp.value.trim();
    var _row = correct ? 'answered.last' : (s4vAttempts >= S4V.maxAttempts ? 'answered.last' : 'answered');
    sendStatement720(_row, 'question',
      { success: !!correct, score: { scaled: correct ? 1 : 0 }, extensions: { student_answer: [_ans] } },
      { questionId: XAPI_ID_PREFIX + 'methodica-science-mass-measure-01-02-004/q1' });
  } catch(e) { console.error('[xAPI] answered', e); }

  if (correct) {
    s4vShowPopup('correct');
    s4vFinish('correct');
  } else if (s4vAttempts >= S4V.maxAttempts) {
    inp.value = String(S4V.correct);     // reveal the correct value
    s4vShowPopup('wrong2');
    s4vFinish('incorrect');
  } else {
    inp.classList.add('error');
    s4vShowPopup('retry');
    const hint = document.getElementById('s4v-hint');
    if (hint) hint.style.visibility = 'visible';
  }
}

function s4vShowPopup(type) {
  const popup = document.getElementById('s4v-popup');
  if (!popup) return;
  const cfg = S4V.popup[type];
  popup.style.background = cfg.bg;
  resetPopupPosition(popup);
  const titleEl = document.getElementById('s4v-popup-title');
  if (titleEl) titleEl.innerHTML = '<strong>' + cfg.title + '</strong>';
  const bodyEl = document.getElementById('s4v-popup-body');
  const body = cfg.body || S4V.explain;
  if (bodyEl) bodyEl.innerHTML = body.map(p => '<p>' + p + '</p>').join('');
  popup.classList.remove('hidden');
}
function s4vClosePopup() { hide('s4v-popup'); }

function s4vFinish(result) {
  s4vAnswered = true; s4vDone = true; s4vResult = result;
  const inp = document.getElementById('s4v-input');
  if (inp) { inp.classList.remove('error'); inp.classList.add('locked'); inp.disabled = true; }
  const chk = document.getElementById('s4v-check');
  if (chk) { chk.textContent = 'המשך'; chk.disabled = false; }   // → part 03
  const hint = document.getElementById('s4v-hint');
  if (hint) hint.style.visibility = 'hidden';
  hide('s4v-hint-overlay');
  practiceA.questions[2].visited = true;
  practiceA.questions[2].state   = result;
  practiceA.questions[2].screen  = 4;
  syncNavA();
}

function s4vOpenHint()  {
  document.getElementById('s4v-hint-overlay')?.classList.remove('hidden');
  try { sendStatement720('requested.1', 'question'); } catch(e) {}
}
function s4vCloseHint() { hide('s4v-hint-overlay'); }
function s4vCloseHintOnBackdrop(e) {
  if (e.target && e.target.id === 's4v-hint-overlay') s4vCloseHint();
}

function s4vResetInitial() {
  s4vAttempts = 0; s4vAnswered = false;
  const inp = document.getElementById('s4v-input');
  if (inp) { inp.value = ''; inp.disabled = false; inp.classList.remove('error', 'locked'); }
  hide('s4v-popup'); hide('s4v-hint-overlay');
  const chk = document.getElementById('s4v-check');
  if (chk) { chk.textContent = 'צדקתי?'; chk.disabled = true; }
  const hint = document.getElementById('s4v-hint');
  if (hint) { hint.disabled = false; hint.style.visibility = 'hidden'; }
}

function s4vEnter() {
  if (s4vDone) {
    if (s4vResult) practiceA.questions[2].state = s4vResult;
    syncNavA();
    return;
  }
  s4vResetInitial();
  practiceA.questions[2].visited = true;
  practiceA.questions[2].state   = 'current';
  practiceA.questions[2].screen  = 4;
  syncNavA();
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
  const count = document.querySelectorAll('.screen').length;
  window.parent.postMessage({ type: 'DEV_READY', total: count }, '*');
}

/* ─── Initial entry — load the S0 video on first paint ─────── */
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
var SCREEN_TO_SUBCONTENT = { 0: null, 1: ['002', 1], 2: ['002', 2], 3: ['003', 1], 4: ['004', 1] };

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
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-02.json'; // ← part number

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
