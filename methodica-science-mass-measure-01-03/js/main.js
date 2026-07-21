/* xAPI: canonical URL id prefix + short-id helper (added for URL-format ids) */
var XAPI_ID_PREFIX = "https://lomdot.education.gov.il/metodica/720active/science/mass-measure/01/";
function shortId(u){ return String(u || "").split("/").pop(); }

'use strict';

/* ═══════════════════════════════════════════════════════════
   methodica-science-mass-measure-01-03 — main.js
   Part 03 of the mass-measurement lomda. 2 screens:
     S0  TransitionScreen   (companion video; clone of part-01 s10)
     S1  TextScreen          (new template — "משימת כיתה" task list)
   Reuses the part-01 CSS component classes. Character choice is
   carried over from earlier parts via localStorage. The S1 button
   navigates onward to part 04.
   ═══════════════════════════════════════════════════════════ */

/* ─── Constants ─────────────────────────────────────────── */
const TOTAL_SCREENS = 2;  // S0–S1

/* Onward navigation to the next part of the lomda (sibling folder). */
const NEXT_PART_URL = '../methodica-science-mass-measure-01-04/index.html';
function goToNextPart() {
  try { sendStatement720('completed', 'onlinelesson'); } catch(e) {}
  window.location.href = NEXT_PART_URL + window.location.search;
}

/* ─── Character carry-over (written by part 01, read here) ── */
const CHARACTER_VIDEOS = {
  'character-1': 'assets/video/Character-1-Bag.mp4',
  'character-2': 'assets/video/Character-2-Bag.mp4'
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
window.addEventListener('resize', scaleApp);
scaleApp();

/* ─── Navigation ─────────────────────────────────────────── */
function goTo(n) {
  if (n < 0 || n >= TOTAL_SCREENS) return;
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
}

function resetScreenState(n) {
  if (n === 0) s0Enter();
}

function goBack() { goTo(currentScreen - 1); }

function advanceScreen() {
  if (currentScreen + 1 >= TOTAL_SCREENS) return;  // S1 advances to part 04 via its own button
  goTo(currentScreen + 1);
}

/* ─── Keyboard Navigation ────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  advanceScreen();
  if (e.key === 'ArrowRight') goBack();
});

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
   S1 — TextScreen — static instructions; the continue button
   (goToNextPart) is wired in the markup. Nothing to initialise.
   ═══════════════════════════════════════════════════════════ */

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
var SCREEN_TO_SUBCONTENT = { 0:null, 1:['001',1] };

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
  var METADATA_FILE = '../metadata/methodica-science-mass-measure-01-03.json';

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
