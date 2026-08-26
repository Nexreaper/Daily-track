/* =========================================================
   Nexreaper Ledger — app.js
   Vanilla ES6, no build tools. All data stays in localStorage.

   PRD §10 known-issue fixes implemented here:
   1. Notifications  → service worker (sw.js) + Notification API +
                       in-app toast fallback; permission requested on
                       first visit and re-requested from Settings.
   2. Water counter  → single delegated listener on #waterGrid +
                       globally accessible handleWaterClick(); the
                       grid is rebuilt from state on every render, so
                       the UI can never drift from storage.
   3. Arc label      → HTML overlay (not SVG text) so the % is always
                       perfectly centered.
   4. Roadmap arrow  → expanded stages kept in roadmapOpen Set and
                       re-applied on every render (native <details>
                       with CSS rotation).
   5. Savings button → "Add budgeted" is disabled (with an explainer)
                       whenever monthly income − expenses <= 0.
   ========================================================= */
'use strict';

/* ============================ helpers ============================ */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = s => { const v = parseFloat(s); return isFinite(v) ? v : 0; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function dateStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function addDays(ds, n) {
  const d = new Date(ds + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
function diffDays(earlier, later) {
  return Math.round((new Date(later + 'T12:00:00') - new Date(earlier + 'T12:00:00')) / 864e5);
}
function fmtDate(ds) {
  return new Date(ds + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? h + 'h ' + m + 'm' : h + 'h') : m + 'm';
}
function fmtClock(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h ? h + 'h ' : '') + pad(m) + 'm ' + pad(ss) + 's';
}
function fmtH(h) { return String(Math.round(h * 10) / 10); }
function weekday(ds) { return new Date(ds + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }); }
function uid() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function money(v) {
  const c = (profile && profile.currency) || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
  } catch (e) { return c + ' ' + Math.round(v); }
}

/* ============================ icons ============================ */

const SA = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const I = {
  flame: '<svg ' + SA + '><path d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047a8.287 8.287 0 0 0 2.962 2.555 8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"/></svg>',
  moon: '<svg ' + SA + '><path d="M21.752 15.002A9.72 9.72 0 0 1 18 17.25c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>',
  sparkles: '<svg ' + SA + '><path d="M9.813 15.904 9.375 17.25l-.438-1.346a2.25 2.25 0 0 0-1.346-1.346L6.25 14.125l1.346-.438a2.25 2.25 0 0 0 1.346-1.346l.438-1.346.438 1.346a2.25 2.25 0 0 0 1.346 1.346l1.346.438-1.346.438a2.25 2.25 0 0 0-1.346 1.346ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg>',
  drop: '<svg ' + SA + '><path d="M12 3.2s5.8 6.1 5.8 9.9a5.8 5.8 0 1 1-11.6 0C6.2 9.3 12 3.2 12 3.2Z"/></svg>',
  book: '<svg ' + SA + '><path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>',
  pen: '<svg ' + SA + '><path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg>',
  bed: '<svg ' + SA + '><path d="M3.75 17.25h16.5m-16.5 0v-8.136c0-.425.142-.837.401-1.171a4.5 4.5 0 0 1 1.406-1.398l3.623-2.178A18.944 18.944 0 0 1 12 3a18.944 18.944 0 0 1 3.719.507l3.622 2.177a4.5 4.5 0 0 1 1.406 1.4 4.5 4.5 0 0 1 .401 1.168V17.25m-16.5 0H12m6.75 0v-3.379c0-.621-.504-1.125-1.125-1.125H9.375c-.621 0-1.125.504-1.125 1.125V17.25m7.5 0V21m0 0h3m-3.75 0H3.75"/></svg>',
  dumbbell: '<svg ' + SA + '><path d="M6.75 6.75v10.5M17.25 6.75v10.5M3.75 9v6M20.25 9v6M6.75 12h10.5"/></svg>',
  target: '<svg ' + SA + '><circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  sun: '<svg ' + SA + '><path d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M5.64 5.64l1.06 1.06M17.3 17.3l1.06 1.06M18.36 5.64 17.3 6.7M6.7 17.3l-1.06 1.06"/></svg>',
  check: '<svg ' + SA + ' stroke-width="2.4"><path d="m5 13 4 4L19 7"/></svg>',
  chev: '<svg ' + SA + '><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg ' + SA + ' stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg ' + SA + ' stroke-width="2.2"><path d="M5 12h14"/></svg>',
  bell: '<svg ' + SA + '><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>'
};

/* ============================ constants ============================ */

const K = {
  profile: 'profile',          // PRD §8: profile stored as "profile"
  logs: 'logs',                // PRD §8: logs stored as "logs"
  theme: 'nl_theme',
  notified: 'nl_notified',
  checkinNext: 'nl_checkin_next',
  asked: 'nl_asked',
  bannerDismissed: 'nl_banner_dismissed'
};

const GOAL_KEYS = ['habit', 'exercise', 'reading', 'writing', 'water', 'sleep', 'savings', 'spiritual'];

const GOAL_META = {
  habit: { i: I.flame, l: 'Habit' },
  exercise: { i: I.dumbbell, l: 'Exercise' },
  reading: { i: I.book, l: 'Reading' },
  writing: { i: I.pen, l: 'Writing' },
  water: { i: I.drop, l: 'Water' },
  sleep: { i: I.bed, l: 'Sleep' },
  savings: { i: I.target, l: 'Savings' },
  spiritual: { i: I.sun, l: 'Spiritual' }
};

const GOAL_DEFS = [
  ['habit', 'Habit', 'One streak, protected daily'],
  ['exercise', 'Exercise', 'Pushup target'],
  ['reading', 'Reading', 'Daily pages'],
  ['writing', 'Writing', 'Daily lines'],
  ['water', 'Water', '8 glasses a day'],
  ['sleep', 'Sleep', 'Track your nights'],
  ['savings', 'Savings', 'Budget toward a goal'],
  ['spiritual', 'Spiritual', 'Prayer or practice']
];

// Keys match the log schema in PRD §8 and the previous build, so
// existing stored data keeps working after the rewrite.
const LOOK_TASKS = [
  ['cleanse_am', 'Morning cleanse', 'Wash with a gentle cleanser'],
  ['moisturize_am', 'Moisturize', 'Lock in hydration'],
  ['spf', 'SPF 30+', 'Even on cloudy days'],
  ['posture', 'Posture check', 'Shoulders back, phone at eye level'],
  ['mewing', 'Mewing', 'Tongue to the roof, lips sealed'],
  ['hair', 'Hair routine', 'Keep your shape consistent'],
  ['grooming', 'Grooming', 'Nails trimmed, face tidy'],
  ['stretching', 'Stretch 10 min', 'Neck, spine, shoulders'],
  ['confidence', 'Confidence win', 'Say one true thing about yourself'],
  ['hydration', 'Hydration check', 'Hydration shows in your skin']
];

const ROADMAP = [
  {
    title: 'Foundation', key: 'foundation',
    steps: [
      { key: 'clarify-role', label: 'Clarify the role you want.' },
      { key: 'daily-routine', label: 'Lock in a repeatable daily routine.' },
      { key: 'journal-focus', label: 'Write one focused journal entry each day.' }
    ]
  },
  {
    title: 'Skill Build', key: 'skill-build',
    steps: [
      { key: 'portfolio-project', label: 'Ship one portfolio project.' },
      { key: 'practice-block', label: 'Complete a deep practice block.' },
      { key: 'documentation', label: 'Document what you are learning.' }
    ]
  },
  {
    title: 'Momentum', key: 'momentum',
    steps: [
      { key: 'networking', label: 'Reach out to one useful contact.' },
      { key: 'applications', label: 'Send targeted applications.' },
      { key: 'review', label: 'Review the week and adjust the plan.' }
    ]
  },
  {
    title: 'Leadership', key: 'leadership',
    steps: [
      { key: 'mentor', label: 'Help someone else improve.' },
      { key: 'own-outcome', label: 'Own a clear weekly outcome.' }
    ]
  }
];

const DEFAULT_PRAYER_TIMES = { Fajr: '05:00', Dhuhr: '12:30', Asr: '15:45', Maghrib: '18:45', Isha: '20:00' };
const PRAYER_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const PRACTICE_OPTS = {
  islam: [['prayers', 'Five daily prayers'], ['scripture', 'Scripture (Quran) reading'], ['meditation', 'Meditation / dhikr'], ['none', 'None for now']],
  christianity: [['scripture', 'Scripture reading'], ['prayers', 'Prayers'], ['meditation', 'Quiet time & meditation'], ['none', 'None for now']],
  hinduism: [['puja', 'Daily puja'], ['scripture', 'Scripture reading'], ['meditation', 'Meditation'], ['none', 'None for now']],
  buddhism: [['meditation', 'Meditation / mindfulness'], ['scripture', 'Sutra reading'], ['none', 'None for now']],
  other: [['meditation', 'Meditation'], ['scripture', 'Scripture reading'], ['none', 'None for now']]
};

const ARC_C = 2 * Math.PI * 64; // r=64 in the arc SVG

/* ============================ state ============================ */

let profile = null;
let logs = { checkins: [] };
let tab = 'home';
let obStep = 0;
let currentDateKey = dateStr();
let sleepTick = null;
let swReg = null;
// PRD bug #4 fix: remember which roadmap stages are expanded so the
// arrows keep their rotation across re-renders.
const roadmapOpen = new Set(['foundation']);

/* ============================ storage ============================ */

function saveProfile() { try { localStorage.setItem(K.profile, JSON.stringify(profile)); } catch (e) {} }
function saveLogs() { try { localStorage.setItem(K.logs, JSON.stringify(logs)); } catch (e) {} }

function dayDefaults() {
  return {
    prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    spiritual: false,
    exerciseCount: 0,
    exerciseDone: false,
    reading: false,
    writing: false,
    water: 0,
    sleep: false,
    sleepDurationMin: 0,
    looks: {
      cleanse_am: false, moisturize_am: false, spf: false, posture: false,
      mewing: false, hair: false, grooming: false, stretching: false,
      confidence: false, hydration: false
    }
  };
}

function normalizeDay(g) {
  const d = dayDefaults();
  g = g || {};
  const out = dayDefaults();
  out.prayers = Object.assign({}, d.prayers, g.prayers);
  out.looks = Object.assign({}, d.looks, g.looks);
  ['spiritual', 'exerciseDone', 'reading', 'writing', 'sleep'].forEach(k => { out[k] = !!g[k]; });
  ['exerciseCount', 'water', 'sleepDurationMin'].forEach(k => { out[k] = Math.max(0, Number(g[k]) || 0); });
  return out;
}

function getDay(ds) {
  if (!logs[ds] || Array.isArray(logs[ds])) logs[ds] = dayDefaults();
  else logs[ds] = normalizeDay(logs[ds]);
  return logs[ds];
}
function peekDay(ds) {
  const g = logs[ds];
  return g && !Array.isArray(g) ? normalizeDay(g) : dayDefaults();
}

function normalizeProfile(raw) {
  const d = raw || {};
  const goals = Array.isArray(d.goals) ? d.goals.filter(g => GOAL_KEYS.indexOf(g) !== -1) : GOAL_KEYS.slice();
  const rm = d.roadmapProgress && typeof d.roadmapProgress === 'object' ? d.roadmapProgress : {};
  const sessions = Array.isArray(d.sleepSessions)
    ? d.sleepSessions.filter(s => s && typeof s.start === 'string' && typeof s.end === 'string' && typeof s.durationMin === 'number' && typeof s.date === 'string')
    : [];
  const pt = d.prayerTimes && typeof d.prayerTimes === 'object' ? d.prayerTimes : {};
  const religions = ['islam', 'christianity', 'hinduism', 'buddhism', 'other'];
  const practices = ['prayers', 'scripture', 'puja', 'meditation'];
  return {
    id: typeof d.id === 'string' ? d.id : uid(),
    name: typeof d.name === 'string' && d.name ? d.name : 'Friend',
    age: clamp(Math.round(Number(d.age) || 18), 1, 120),
    weight: Math.max(0, Number(d.weight) || 0),
    weightUnit: d.weightUnit === 'lb' ? 'lb' : 'kg',
    religion: religions.indexOf(d.religion) !== -1 ? d.religion : 'islam',
    religionPractice: practices.indexOf(d.religionPractice) !== -1 ? d.religionPractice : null,
    religionPracticeLabel: typeof d.religionPracticeLabel === 'string' && d.religionPracticeLabel ? d.religionPracticeLabel : 'Daily practice',
    goals: goals.length ? goals : GOAL_KEYS.slice(),
    habitName: typeof d.habitName === 'string' && d.habitName ? d.habitName : 'My habit',
    pushupTarget: clamp(Math.round(Number(d.pushupTarget) || 20), 1, 500),
    careerGoal: typeof d.careerGoal === 'string' && d.careerGoal ? d.careerGoal : 'Build a stronger career path',
    lastRelapseDate: typeof d.lastRelapseDate === 'string' ? d.lastRelapseDate : dateStr(),
    habitStartDate: typeof d.habitStartDate === 'string' ? d.habitStartDate : dateStr(),
    roadmapProgress: rm,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : dateStr(),
    savingsGoalName: typeof d.savingsGoalName === 'string' && d.savingsGoalName ? d.savingsGoalName : 'My savings goal',
    savingsTarget: Math.max(0, Number(d.savingsTarget) || 0),
    savingsCurrent: Math.max(0, Number(d.savingsCurrent) || 0),
    monthlyIncome: Math.max(0, Number(d.monthlyIncome) || 0),
    monthlyExpenses: Math.max(0, Number(d.monthlyExpenses) || 0),
    currency: typeof d.currency === 'string' && d.currency ? d.currency : 'USD',
    savingsLog: d.savingsLog && typeof d.savingsLog === 'object' ? d.savingsLog : {},
    sleepStatus: d.sleepStatus === 'asleep' ? 'asleep' : 'awake',
    sleepStartedAt: typeof d.sleepStartedAt === 'string' ? d.sleepStartedAt : null,
    sleepSessions: sessions,
    sleepTargetHours: clamp(Number(d.sleepTargetHours) || 7.5, 4, 12),
    prayerTimes: {
      Fajr: typeof pt.Fajr === 'string' ? pt.Fajr : DEFAULT_PRAYER_TIMES.Fajr,
      Dhuhr: typeof pt.Dhuhr === 'string' ? pt.Dhuhr : DEFAULT_PRAYER_TIMES.Dhuhr,
      Asr: typeof pt.Asr === 'string' ? pt.Asr : DEFAULT_PRAYER_TIMES.Asr,
      Maghrib: typeof pt.Maghrib === 'string' ? pt.Maghrib : DEFAULT_PRAYER_TIMES.Maghrib,
      Isha: typeof pt.Isha === 'string' ? pt.Isha : DEFAULT_PRAYER_TIMES.Isha
    },
    checkinEnabled: d.checkinEnabled !== false
  };
}

function normalizeLogs(raw) {
  const out = { checkins: [] };
  const d = raw && typeof raw === 'object' ? raw : {};
  if (Array.isArray(d.checkins)) {
    out.checkins = d.checkins
      .filter(c => c && typeof c.timestamp === 'string' && typeof c.text === 'string')
      .map(c => ({ timestamp: c.timestamp, text: String(c.text), source: c.source === 'notification' ? 'notification' : 'manual' }));
  }
  Object.keys(d).forEach(k => {
    if (k === 'checkins') return;
    if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) out[k] = normalizeDay(d[k]);
  });
  return out;
}

function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem(K.profile));
    if (p && typeof p === 'object') profile = normalizeProfile(p);
  } catch (e) {}
  if (!profile) return;
  try {
    const l = JSON.parse(localStorage.getItem(K.logs));
    logs = normalizeLogs(l);
  } catch (e) { logs = { checkins: [] }; }
}

/* ============================ scoring ============================ */

const hasGoal = k => profile.goals.indexOf(k) !== -1;

function streakDays() {
  return Math.max(0, diffDays(profile.lastRelapseDate || profile.createdAt, dateStr()));
}

// Completion for a day, with partial credit for water / sleep /
// exercise so the sunrise arc moves as you go, not only at the end.
function dayCompletion(ds) {
  const p = profile, g = peekDay(ds);
  const parts = {};
  let earned = 0, total = 0;
  const add = (k, e, t) => { parts[k] = { e: e, t: t }; earned += e; total += t; };

  if (hasGoal('habit')) add('habit', diffDays(p.lastRelapseDate || p.createdAt, ds) > 0 ? 1 : 0, 1);
  if (hasGoal('exercise')) add('exercise', Math.min(1, g.exerciseCount / Math.max(1, p.pushupTarget)), 1);
  if (hasGoal('reading')) add('reading', g.reading ? 1 : 0, 1);
  if (hasGoal('writing')) add('writing', g.writing ? 1 : 0, 1);
  if (hasGoal('water')) add('water', g.water / 8, 1);
  if (hasGoal('sleep')) add('sleep', Math.min(1, g.sleepDurationMin / Math.max(1, p.sleepTargetHours * 60)), 1);
  if (hasGoal('savings')) {
    const m = ds.slice(0, 7);
    add('savings', (p.savingsLog && p.savingsLog[m] > 0) ? 1 : 0, 1);
  }
  if (hasGoal('spiritual')) {
    if (p.religionPractice === 'prayers') {
      const c = PRAYER_ORDER.filter(k => g.prayers[k]).length;
      add('spiritual', c / 5, 5);
    } else add('spiritual', g.spiritual ? 1 : 0, 1);
  }
  return { pct: total ? Math.round((earned / total) * 100) : 0, earned: Math.round(earned * 10) / 10, total: total, parts: parts };
}

function last7() {
  const out = [];
  for (let i = 6; i >= 0; i--) out.push(addDays(dateStr(), -i));
  return out;
}

/* ============================ toasts ============================ */

function toast(msg, kind) {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const t = document.createElement('div');
  t.className = 'nl-toast' + (kind === 'green' ? ' nl-toast-green' : kind === 'red' ? ' nl-toast-red' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3600);
}

/* ============================ rendering ============================ */

function render() {
  if (!profile) return;
  renderHeader();
  if (tab === 'home') renderHome();
  else if (tab === 'sleep') renderSleep();
  else renderLooks();
}

function renderHeader() {
  $('#hdr-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('#streak-num').textContent = String(streakDays());
}

function renderHome() {
  const ci = $('#checkin-quick-input');
  const ciVal = ci ? ci.value : ''; // keep the user's half-typed check-in alive
  renderNotifBanner();
  renderGreeting();
  const c = dayCompletion(dateStr());
  renderArc(c);
  renderHabit();
  renderSpiritual();
  renderExercise();
  renderDaily();
  renderWeekly();
  renderSavings();
  renderRoadmap();
  renderCheckinList();
  const ci2 = $('#checkin-quick-input');
  if (ci2) ci2.value = ciVal;
}

function renderNotifBanner() {
  const b = $('#notif-banner');
  if (!('Notification' in window) || Notification.permission === 'granted' || localStorage.getItem(K.bannerDismissed)) {
    b.hidden = true;
    return;
  }
  b.hidden = false;
  const denied = Notification.permission === 'denied';
  b.innerHTML =
    '<div class="flex items-start gap-3">' +
    '<span class="mini-ic mt-0.5">' + I.bell + '</span>' +
    '<div class="flex-1 min-w-0"><p class="text-sm font-semibold mb-1">' +
    (denied ? 'Notifications are blocked' : 'Turn on reminders') + '</p>' +
    '<p class="text-xs text-muted mb-0">' +
    (denied
      ? 'Enable notifications in your browser settings for OS-level prayer alerts. In-app reminders will still show.'
      : 'Get prayer-time alerts and 1–3 hour check-ins. Nothing leaves your phone.') +
    '</p></div>' +
    '<div class="flex gap-2 shrink-0 items-center">' +
    (denied ? '' : '<button class="btn-gold btn-sm" type="button" data-action="enable-notify">Enable</button>') +
    '<button class="icon-btn icon-btn-sm" type="button" data-action="dismiss-banner" aria-label="Dismiss">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
    '</div></div>';
}

function renderGreeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  $('#greeting').innerHTML =
    '<h2 class="font-display text-2xl leading-tight">Good ' + part + ', <span class="text-gold">' + esc(profile.name) + '</span></h2>' +
    '<p class="text-sm text-muted mt-1 mb-0">Here is your day, at a glance.</p>';
}

function renderArc(c) {
  $('#arc-progress').style.strokeDashoffset = String(ARC_C * (1 - c.pct / 100));
  $('#arc-pct').textContent = c.pct + '%';
  $('#arc-sub-line').textContent = c.total
    ? c.earned + ' of ' + c.total + ' points earned today'
    : 'No goals selected — add some in Settings.';
  $('#goal-chips').innerHTML = profile.goals.map(k => {
    const meta = GOAL_META[k];
    const part = c.parts[k];
    const done = part && part.e >= part.t - 1e-9;
    return '<span class="chip' + (done ? ' chip-done' : '') + '" title="' + meta.l + (done ? ' — done' : '') + '">' +
      meta.i + '<span>' + meta.l + '</span></span>';
  }).join('');
}

function renderHabit() {
  const card = $('#card-habit');
  if (!hasGoal('habit')) { card.hidden = true; return; }
  card.hidden = false;
  const s = streakDays();
  $('#habitBody').innerHTML =
    '<div class="flex items-center justify-between gap-3">' +
    '<div class="flex items-center gap-3 min-w-0">' +
    '<span class="chip-ic text-gold">' + I.flame + '</span>' +
    '<div class="min-w-0"><div class="font-semibold truncate">' + esc(profile.habitName) + '</div>' +
    '<div class="text-xs text-muted">Since ' + fmtDate(profile.habitStartDate) + '</div></div></div>' +
    '<div class="text-right shrink-0"><div class="font-display text-3xl text-gold tabular-nums leading-none">' + s + '</div>' +
    '<div class="text-[10px] uppercase tracking-wider text-muted mt-1">day streak</div></div>' +
    '</div>' +
    '<p class="text-xs text-muted mt-3 mb-0">One clean day at a time. A relapse resets the count — not your progress.</p>' +
    '<button class="btn-danger btn-sm mt-3" type="button" data-action="relapse">Log a relapse &amp; reset</button>';
}

function renderSpiritual() {
  const card = $('#card-spiritual');
  if (!hasGoal('spiritual')) { card.hidden = true; return; }
  card.hidden = false;
  const ds = dateStr();
  const g = getDay(ds);

  if (profile.religionPractice === 'prayers') {
    const done = PRAYER_ORDER.filter(k => g.prayers[k]).length;
    let html =
      '<div class="flex items-center justify-between mb-3">' +
      '<div class="flex items-center gap-3 min-w-0"><span class="chip-ic text-gold">' + I.moon + '</span>' +
      '<div class="min-w-0"><div class="font-semibold truncate">' + esc(profile.religionPracticeLabel) + '</div>' +
      '<div class="text-xs text-muted">' + done + ' of 5 logged today</div></div></div>' +
      (done === 5 ? '<span class="text-xs text-mint font-semibold shrink-0">All done ✨</span>' : '') +
      '</div><div class="space-y-2">';
    html += PRAYER_ORDER.map(k => {
      const name = k.charAt(0).toUpperCase() + k.slice(1);
      const t = profile.prayerTimes[name] || '';
      return '<button type="button" class="row-toggle' + (g.prayers[k] ? ' done' : '') + '" data-set="prayer.' + k + '" data-ds="' + ds + '">' +
        '<span class="prayer-check">' + I.check + '</span>' +
        '<span class="flex-1 text-left font-medium capitalize">' + k + '</span>' +
        '<span class="prayer-time">' + t + '</span></button>';
    }).join('');
    html += '</div>';
    $('#spiritualBody').innerHTML = html;
  } else {
    const on = !!g.spiritual;
    $('#spiritualBody').innerHTML =
      '<div class="flex items-center gap-3 mb-3"><span class="chip-ic text-gold">' + I.sun + '</span>' +
      '<div class="font-semibold">' + esc(profile.religionPracticeLabel) + '</div></div>' +
      '<button type="button" class="row-toggle' + (on ? ' done' : '') + '" data-set="spiritual" data-ds="' + ds + '">' +
      '<span class="row-check">' + I.check + '</span>' +
      '<span class="flex-1 text-left font-medium">' + esc(profile.religionPracticeLabel) + '</span>' +
      '<span class="text-xs text-muted shrink-0">' + (on ? 'Done today' : 'Mark done') + '</span></button>' +
      '<p class="text-xs text-muted mt-3 mb-0">A single toggle for your daily practice.</p>';
  }
}

function renderExercise() {
  const card = $('#card-exercise');
  if (!hasGoal('exercise')) { card.hidden = true; return; }
  card.hidden = false;
  const g = getDay(dateStr());
  const t = Math.max(1, profile.pushupTarget || 20);
  const pct = clamp(Math.round((g.exerciseCount / t) * 100), 0, 100);
  $('#exBody').innerHTML =
    '<div class="flex items-center justify-between gap-3">' +
    '<div class="flex items-center gap-3 min-w-0"><span class="chip-ic text-gold">' + I.dumbbell + '</span>' +
    '<div class="min-w-0"><div class="font-semibold">Pushups</div>' +
    '<div class="text-xs text-muted">' + g.exerciseCount + ' of ' + t + '</div></div></div>' +
    '<div class="flex items-center gap-2 shrink-0">' +
    '<button class="step-btn" type="button" data-action="ex-minus" aria-label="Remove one pushup">' + I.minus + '</button>' +
    '<span class="font-display text-2xl w-10 text-center tabular-nums">' + g.exerciseCount + '</span>' +
    '<button class="step-btn" type="button" data-action="ex-plus" aria-label="Add one pushup">' + I.plus + '</button>' +
    '</div></div>' +
    '<div class="bar-track mt-4"><div class="bar-fill ' + (g.exerciseDone ? 'bar-green' : 'bar-gold') + '" style="width:' + pct + '%"></div></div>' +
    '<div class="text-xs mt-1.5 ' + (g.exerciseDone ? 'text-mint font-semibold' : 'text-muted') + '">' +
    (g.exerciseDone ? 'Target reached — strong. 🎉' : (t - g.exerciseCount) + ' to go') + '</div>';
}

function toggleRow(g, f, label, sub) {
  const on = !!g[f];
  return '<button type="button" class="row-toggle' + (on ? ' done' : '') + '" data-set="' + f + '" data-ds="' + dateStr() + '">' +
    '<span class="row-check">' + I.check + '</span>' +
    '<span class="flex-1 text-left"><span class="block font-medium">' + label + '</span>' +
    '<span class="block text-xs text-muted">' + sub + '</span></span></button>';
}

function sleepSummary(g) {
  if (profile.sleepStatus === 'asleep') return 'Asleep — timer running';
  if (g.sleepDurationMin > 0) return fmtDur(g.sleepDurationMin) + ' logged today';
  const y = peekDay(addDays(dateStr(), -1));
  if (y.sleepDurationMin > 0) return 'Last night: ' + fmtDur(y.sleepDurationMin);
  return 'No sleep logged yet';
}

function renderDaily() {
  const card = $('#card-daily');
  if (!(hasGoal('reading') || hasGoal('writing') || hasGoal('water') || hasGoal('sleep'))) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  const g = getDay(dateStr());
  let html = '';
  if (hasGoal('reading')) html += toggleRow(g, 'reading', 'Reading', 'A few pages counts.');
  if (hasGoal('writing')) html += toggleRow(g, 'writing', 'Writing', 'One honest line counts.');
  if (hasGoal('sleep')) {
    const done = g.sleepDurationMin > 0;
    html +=
      '<button type="button" class="row-toggle' + (done ? ' done' : '') + '" data-action="go-sleep">' +
      '<span class="chip-ic text-gold">' + I.bed + '</span>' +
      '<span class="flex-1 text-left"><span class="block font-medium">Sleep</span>' +
      '<span class="block text-xs text-muted">' + sleepSummary(g) + '</span></span>' +
      (done ? '<span class="row-check">' + I.check + '</span>' : '<span class="text-xs text-muted shrink-0">details →</span>') +
      '</button>';
  }
  $('#dailyBody').innerHTML = html;
  renderWater(g);
}

function renderWater(g) {
  const grid = $('#waterGrid');
  grid.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'glass' + (i < g.water ? ' full' : '');
    b.dataset.i = String(i);
    b.setAttribute('aria-pressed', String(i < g.water));
    b.setAttribute('aria-label', 'Glass ' + (i + 1) + (i < g.water ? ' (filled) — tap to empty' : ' — tap to fill'));
    b.innerHTML = I.drop;
    grid.appendChild(b);
  }
  $('#waterCount').textContent = String(g.water);
}

function renderWeekly() {
  const days = last7();
  const t = dateStr();
  $('#weeklyChart').innerHTML = days.map(ds => {
    const p = dayCompletion(ds).pct;
    const isT = ds === t;
    return '<div class="chart-col' + (isT ? ' today' : '') + '" title="' + ds + ' · ' + p + '% complete">' +
      '<span class="chart-val">' + p + '</span>' +
      '<div class="chart-barwrap"><div class="chart-bar" style="height:' + (p > 0 ? Math.max(p, 6) : 4) + '%"></div></div>' +
      '<span class="chart-lbl">' + weekday(ds) + '</span></div>';
  }).join('');
}

function statBox(label, val) {
  return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-lbl">' + label + '</div></div>';
}

function monthlyBudget() {
  return Math.round((profile.monthlyIncome - profile.monthlyExpenses) * 100) / 100;
}

function renderSavings() {
  const card = $('#card-savings');
  if (!hasGoal('savings')) { card.hidden = true; return; }
  card.hidden = false;
  const p = profile;
  const budget = monthlyBudget();
  const remaining = Math.max(0, p.savingsTarget - p.savingsCurrent);
  const pct = p.savingsTarget > 0 ? Math.min(999, Math.round((p.savingsCurrent / p.savingsTarget) * 100)) : 0;
  const reached = p.savingsTarget > 0 && p.savingsCurrent >= p.savingsTarget;

  let eta = '—';
  if (reached) eta = 'Reached 🎉';
  else if (budget > 0 && remaining > 0) {
    const months = remaining / budget;
    const d = new Date();
    d.setMonth(d.getMonth() + Math.ceil(months));
    eta = '≈ ' + Math.ceil(months) + ' mo · ' + d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } else if (!reached) eta = 'No surplus';

  $('#savBody').innerHTML =
    '<div class="flex items-start justify-between gap-3">' +
    '<div class="min-w-0"><div class="font-semibold truncate">' + esc(p.savingsGoalName) + '</div>' +
    '<div class="text-xs text-muted mt-0.5">' + money(p.savingsCurrent) + ' saved of ' + money(p.savingsTarget) + '</div></div>' +
    '<div class="font-display text-2xl text-gold tabular-nums shrink-0">' + pct + '%</div></div>' +
    '<div class="bar-track mt-3"><div class="bar-fill bar-gold" style="width:' + Math.min(100, pct) + '%"></div></div>' +
    '<div class="grid grid-cols-3 gap-2 mt-4">' +
    statBox('Remaining', reached ? money(0) : money(remaining)) +
    statBox('Monthly budget', budget > 0 ? money(budget) : '—') +
    statBox('Time to goal', eta) +
    '</div>' +
    (reached
      ? '<p class="text-sm text-mint font-semibold mt-4 mb-0 text-center">Goal reached — everything you saved, counted. 🏆</p>'
      : '<div class="flex gap-2 mt-4 items-center">' +
        // PRD bug #5 fix: disabled (with explainer) when budget <= 0
        '<button class="btn-gold flex-1" type="button" data-action="sav-budget"' + (budget <= 0 || remaining <= 0 ? ' disabled' : '') + '>+ Budgeted' + (budget > 0 ? ' (' + money(budget) + ')' : '') + '</button>' +
        '<div class="flex-1 flex gap-2">' +
        '<input id="sav-custom-input" class="input" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="Custom">' +
        '<button class="btn-ghost" type="button" data-action="sav-custom">Add</button>' +
        '</div></div>' +
        (budget <= 0 ? '<p class="text-xs text-muted mt-2 mb-0">Budget button is disabled until monthly income exceeds expenses (Settings → Savings goal).</p>' : ''));
}

function renderRoadmap() {
  const p = profile;
  const rm = p.roadmapProgress || {};
  let total = 0, done = 0;
  const html = ROADMAP.map(st => {
    const sd = st.steps.filter(s => rm[s.key]).length;
    total += st.steps.length;
    done += sd;
    const open = roadmapOpen.has(st.key);
    return '<details class="rm-stage" data-stage="' + st.key + '"' + (open ? ' open' : '') + '>' +
      '<summary class="rm-sum"><span class="flex-1">' + st.title + '</span>' +
      '<span class="rm-progress">' + sd + '/' + st.steps.length + '</span>' +
      '<span class="rm-chev">' + I.chev + '</span></summary>' +
      '<div class="rm-steps">' + st.steps.map(s => {
        const checked = !!rm[s.key];
        return '<label class="rm-step' + (checked ? ' done' : '') + '">' +
          '<input type="checkbox" data-rr="' + s.key + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="rm-box">' + I.check + '</span>' +
          '<span class="rm-lbl">' + s.label + '</span></label>';
      }).join('') + '</div></details>';
  }).join('');
  $('#rmList').innerHTML = html;
  $('#rmBar').style.width = total ? Math.round((done / total) * 100) + '%' : '0%';
  $('#rmCount').textContent = done + ' / ' + total;
  $('#rm-goal').textContent = p.careerGoal ? 'Path: ' + p.careerGoal : '';
  // PRD bug #4: sync expanded state into roadmapOpen so re-renders keep it
  $$('#rmList .rm-stage').forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) roadmapOpen.add(d.dataset.stage);
      else roadmapOpen.delete(d.dataset.stage);
    });
  });
}

function renderCheckinList() {
  const list = Array.isArray(logs.checkins) ? logs.checkins : [];
  const last = list.slice(-5).reverse();
  $('#checkinList').innerHTML = last.length ? last.map(c =>
    '<li class="checkin-item"><span class="checkin-ic">' + I.bell + '</span>' +
    '<div class="min-w-0"><p>' + esc(c.text) + '</p>' +
    '<div class="checkin-when">' +
    new Date(c.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) +
    ' · ' + (c.source === 'notification' ? 'reminder' : 'manual') + '</div></div></li>'
  ).join('') :
  '<li class="checkin-empty">No check-ins yet. When a nudge comes, be honest in one line — or log one below.</li>';
}

function renderSleep() {
  const p = profile;
  const body = $('#sleepStatusBody');
  if (p.sleepStatus === 'asleep' && p.sleepStartedAt) {
    const start = new Date(p.sleepStartedAt);
    body.innerHTML =
      '<div class="sleep-emoji">🌙</div>' +
      '<div class="sleep-elapsed" id="sleep-elapsed">' + fmtClock(Date.now() - start.getTime()) + '</div>' +
      '<div class="sleep-note">asleep since ' + start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      '<div class="sleep-actions"><button class="btn-gold" type="button" data-action="wake">I just woke up</button></div>';
  } else {
    const last = p.sleepSessions[p.sleepSessions.length - 1];
    body.innerHTML =
      '<div class="sleep-emoji">☀️</div>' +
      '<div class="font-medium mt-2">' + (last ? 'Last session: ' + fmtDur(last.durationMin) + ' · ' + fmtDate(last.date) : 'No sleep logged yet') + '</div>' +
      '<div class="sleep-note">Tap below when your head hits the pillow.</div>' +
      '<div class="sleep-actions"><button class="btn-ghost" type="button" data-action="sleep">I\'m going to sleep</button></div>';
  }

  $('#sleepTargetVal').textContent = fmtH(p.sleepTargetHours) + 'h';
  $('#sleepTargetSub').textContent = 'You aim for ' + fmtH(p.sleepTargetHours) + 'h every night (4–12h).';
  renderSleepChart();

  const hist = p.sleepSessions.slice(-10).reverse();
  $('#sleepHistory').innerHTML = hist.length ? hist.map(s =>
    '<li class="sleep-hist-item"><span>' +
    new Date(s.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    '</span><span class="sleep-hist-dur ' + (s.durationMin >= p.sleepTargetHours * 60 ? 'ok' : 'low') + '">' +
    fmtDur(s.durationMin) + '</span></li>'
  ).join('') : '<li class="sleep-hist-empty">Your sessions will appear here.</li>';
}

function renderSleepChart() {
  const p = profile;
  const days = last7();
  const t = dateStr();
  const mins = days.map(ds => {
    const fromSessions = (p.sleepSessions || []).filter(s => s.date === ds).reduce((a, b) => a + b.durationMin, 0);
    return fromSessions || peekDay(ds).sleepDurationMin;
  });
  const maxVal = Math.max.apply(null, mins.concat([60]));
  const scale = Math.max(p.sleepTargetHours * 60, maxVal, 120);
  const tgtPct = clamp((p.sleepTargetHours * 60 / scale) * 100, 0, 100);

  const bars = days.map((ds, i) => {
    const v = mins[i];
    const h = v > 0 ? clamp((v / scale) * 100, 4, 100) : 0;
    const isT = ds === t;
    return '<div class="chart-col' + (isT ? ' today' : '') + '" title="' + ds + ' · ' + (v ? fmtDur(v) : 'no data') + '">' +
      '<span class="chart-val">' + (v ? (Math.round(v / 6) / 10) + 'h' : '') + '</span>' +
      '<div class="chart-barwrap"><div class="chart-bar bar-green" style="height:' + h + '%"></div></div>' +
      '<span class="chart-lbl">' + weekday(ds) + '</span></div>';
  }).join('');

  // Bar area: value label (~0.95rem) + 6.5rem bar zone + gap/weekday label below.
  // The dashed target line is positioned relative to the bar zone bottom.
  $('#sleepChart').innerHTML =
    '<div class="chart sleep-chart-bars">' +
    '<div class="sleep-target-line" style="bottom: calc(1.3rem + 6.5rem * ' + (tgtPct / 100) + ')"></div>' +
    bars + '</div>';
}

function renderLooks() {
  const g = getDay(dateStr());
  const done = LOOK_TASKS.filter(([k]) => g.looks[k]).length;
  const pct = Math.round((done / LOOK_TASKS.length) * 100);
  $('#looksCount').textContent = done + ' / ' + LOOK_TASKS.length;
  $('#looksBar').style.width = pct + '%';
  $('#looksList').innerHTML = LOOK_TASKS.map(([k, t, s]) => {
    const on = !!g.looks[k];
    return '<button type="button" class="row-toggle' + (on ? ' done' : '') + '" data-looks="' + k + '">' +
      '<span class="row-check">' + I.check + '</span>' +
      '<span class="flex-1 text-left"><span class="block font-medium">' + t + '</span>' +
      '<span class="block text-xs text-muted">' + s + '</span></span></button>';
  }).join('');

  const days = last7();
  const t = dateStr();
  const vals = days.map(ds => {
    const gg = peekDay(ds);
    const d = Object.values(gg.looks).filter(Boolean).length;
    return Math.round((d / LOOK_TASKS.length) * 100);
  });
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  $('#looksAvg').textContent = 'Weekly average ' + avg + '% · best day ' + Math.max.apply(null, vals) + '%.';
  $('#looksChart').innerHTML = days.map((ds, i) => {
    const v = vals[i];
    return '<div class="chart-col' + (ds === t ? ' today' : '') + '" title="' + ds + ' · ' + v + '%">' +
      '<span class="chart-val">' + v + '</span>' +
      '<div class="chart-barwrap"><div class="chart-bar" style="height:' + (v > 0 ? Math.max(v, 6) : 4) + '%"></div></div>' +
      '<span class="chart-lbl">' + weekday(ds) + '</span></div>';
  }).join('');
}

/* ============================ actions ============================ */

function changeExercise(delta) {
  const g = getDay(dateStr());
  g.exerciseCount = clamp(g.exerciseCount + delta, 0, 999);
  g.exerciseDone = g.exerciseCount >= Math.max(1, profile.pushupTarget || 20);
  saveLogs();
  render();
}

// PRD bug #2 fix: global handler + delegation (see click listener below).
function handleWaterClick(i) {
  if (!profile) return;
  const g = getDay(dateStr());
  g.water = g.water > i ? i : Math.min(8, i + 1);
  saveLogs();
  render();
}

function setWaterCount(n) {
  const g = getDay(dateStr());
  g.water = clamp(Math.round(n), 0, 8);
  saveLogs();
  render();
}

function relapse() {
  if (!confirm('Log a relapse? Your streak resets to 0. Be honest — that is how the streak means something.')) return;
  profile.lastRelapseDate = dateStr();
  saveProfile();
  render();
  toast('Streak reset. Tomorrow is a new start.', 'red');
}

function addSavings(n, source) {
  const p = profile;
  const remaining = p.savingsTarget - p.savingsCurrent;
  if (remaining <= 0) { toast('Goal already reached — nothing left to save.', 'green'); return; }
  let amt = Math.round(n * 100) / 100;
  if (!(amt > 0)) return;
  const capped = amt > remaining;
  amt = Math.min(amt, Math.round(remaining * 100) / 100);
  p.savingsCurrent = Math.round((p.savingsCurrent + amt) * 100) / 100;
  const m = dateStr().slice(0, 7);
  p.savingsLog = p.savingsLog || {};
  p.savingsLog[m] = Math.round(((p.savingsLog[m] || 0) + amt) * 100) / 100;
  saveProfile();
  render();
  toast('Added ' + money(amt) + (capped ? ' (capped at remaining goal)' : '') + ' toward ' + p.savingsGoalName + '.', 'green');
}

function addCustomSavings() {
  const el = $('#sav-custom-input');
  const n = num(el.value);
  if (!(n > 0)) { toast('Enter an amount greater than zero.', 'red'); return; }
  addSavings(n, 'custom');
  if (el) el.value = '';
}

function startSleep() {
  profile.sleepStatus = 'asleep';
  profile.sleepStartedAt = new Date().toISOString();
  saveProfile();
  render();
  toast('Sleep timer started. Rest well. 🌙');
}

function endSleep() {
  const end = new Date();
  const start = new Date(profile.sleepStartedAt);
  const min = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const ds = dateStr(end);
  const g = getDay(ds);
  g.sleep = true;
  g.sleepDurationMin += min;
  profile.sleepSessions.push({ start: profile.sleepStartedAt, end: end.toISOString(), durationMin: min, date: ds });
  profile.sleepStatus = 'awake';
  profile.sleepStartedAt = null;
  saveProfile();
  saveLogs();
  render();
  const met = min >= profile.sleepTargetHours * 60;
  toast('Slept ' + fmtDur(min) + (met ? ' — target met. 💪' : '. One night at a time.'), 'green');
}

function changeSleepTarget(delta) {
  profile.sleepTargetHours = clamp(Math.round((profile.sleepTargetHours + delta) * 2) / 2, 4, 12);
  saveProfile();
  renderSleep();
}

function addCheckin(text, source) {
  text = (text || '').trim();
  if (!text) return false;
  if (!Array.isArray(logs.checkins)) logs.checkins = [];
  logs.checkins.push({ timestamp: new Date().toISOString(), text: text.slice(0, 200), source: source || 'manual' });
  if (logs.checkins.length > 200) logs.checkins = logs.checkins.slice(-200);
  saveLogs();
  renderCheckinList();
  return true;
}

/* ============================ modals ============================ */

function openModal(m) {
  m.hidden = false;
  void m.offsetWidth; // reflow so the transition runs
  m.classList.add('open');
}
function closeModal(m) {
  m.classList.remove('open');
  setTimeout(() => { m.hidden = true; }, 220);
}

function openCheckinModal(source) {
  $('#checkin-modal-title').textContent = source === 'notification' ? 'Check-in reminder' : 'Log an activity';
  openModal($('#checkin-modal'));
  setTimeout(() => $('#checkin-modal-input').focus(), 260);
}

function saveCheckinModal() {
  const input = $('#checkin-modal-input');
  const ok = addCheckin(input.value, 'manual');
  input.value = '';
  if (ok) {
    closeModal($('#checkin-modal'));
    toast('Activity logged. Keep being honest with yourself.');
  } else {
    toast('Write a line first — even “just existing” counts.', 'red');
  }
}

/* ============================ settings ============================ */

function openSettings() {
  const p = profile;
  $('#set-name').value = p.name;
  $('#set-age').value = p.age;
  $('#set-weight').value = p.weight;
  $('#set-unit').value = p.weightUnit;
  $('#set-habit').value = p.habitName;
  $('#set-pushups').value = p.pushupTarget;
  $('#set-career').value = p.careerGoal;
  $('#set-sav-name').value = p.savingsGoalName;
  $('#set-sav-target').value = p.savingsTarget;
  $('#set-sav-current').value = p.savingsCurrent;
  $('#set-income').value = p.monthlyIncome;
  $('#set-expenses').value = p.monthlyExpenses;
  $('#set-currency').value = p.currency;
  $('#set-prayers-sec').hidden = p.religionPractice !== 'prayers';
  PRAYER_NAMES.forEach(n => { $('#set-t-' + n).value = p.prayerTimes[n] || ''; });
  $('#set-checkin').checked = !!p.checkinEnabled;
  $('#set-theme').checked = document.documentElement.dataset.theme === 'light';
  updateNotifStatus();
  openModal($('#settings'));
  setTimeout(() => $('#set-name').focus(), 260);
}

function updateNotifStatus() {
  const el = $('#notif-status');
  if (!('Notification' in window)) {
    el.textContent = 'Notifications are not supported in this browser — in-app reminders will be used.';
    return;
  }
  el.textContent = 'Browser notifications: ' + ({
    granted: 'allowed ✓',
    denied: 'blocked — in-app reminders only',
    default: 'not asked yet'
  }[Notification.permission] || Notification.permission);
}

function saveSettingsProfile() {
  const name = $('#set-name').value.trim();
  if (!name) { toast('Name can\'t be empty.', 'red'); return; }
  profile.name = name;
  profile.age = clamp(Math.round(num($('#set-age').value)), 1, 120);
  profile.weight = Math.max(0, num($('#set-weight').value));
  profile.weightUnit = $('#set-unit').value === 'lb' ? 'lb' : 'kg';
  profile.habitName = $('#set-habit').value.trim() || 'My habit';
  profile.pushupTarget = clamp(Math.round(num($('#set-pushups').value)), 1, 500);
  profile.careerGoal = $('#set-career').value.trim() || 'Build a stronger career path';
  saveProfile();
  render();
  toast('Profile saved.', 'green');
}

function saveSettingsSavings() {
  const p = profile;
  p.savingsGoalName = $('#set-sav-name').value.trim() || 'My savings goal';
  p.savingsTarget = Math.max(0, num($('#set-sav-target').value));
  p.savingsCurrent = Math.max(0, num($('#set-sav-current').value));
  p.monthlyIncome = Math.max(0, num($('#set-income').value));
  p.monthlyExpenses = Math.max(0, num($('#set-expenses').value));
  p.currency = $('#set-currency').value || 'USD';
  saveProfile();
  render();
  toast('Savings goal saved.', 'green');
}

function saveSettingsPrayers() {
  const p = profile;
  let saved = 0;
  PRAYER_NAMES.forEach(n => {
    const v = $('#set-t-' + n).value;
    if (v && /^\d{2}:\d{2}$/.test(v)) { p.prayerTimes[n] = v; saved++; }
  });
  if (!saved) { toast('Set at least one prayer time.', 'red'); return; }
  saveProfile();
  render();
  toast('Prayer times saved.', 'green');
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(K.theme, t); } catch (e) {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === 'light' ? '#F3EFE4' : '#0E1226';
}

/* ============================ data (export / import / reset) ============================ */

function exportData() {
  const payload = { app: 'nexreaper-ledger', version: 1, exportedAt: new Date().toISOString(), profile: profile, logs: logs };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nexreaper-ledger-' + dateStr() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup downloaded.', 'green');
}

function onImportFile(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(String(r.result));
      const prof = (d && d.profile) || d;
      if (!prof || !prof.id || typeof prof !== 'object') throw new Error('invalid backup');
      const lg = (d && d.logs) && typeof d.logs === 'object' ? d.logs : {};
      if (!confirm('Import this backup? It will replace your current data.')) return;
      profile = normalizeProfile(prof);
      logs = normalizeLogs(lg);
      saveProfile();
      saveLogs();
      tab = 'home';
      render();
      toast('Backup restored. Welcome back.', 'green');
    } catch (err) {
      toast('That file is not a valid Nexreaper Ledger backup.', 'red');
    }
  };
  r.readAsText(f);
}

function resetData() {
  if (!confirm('Erase ALL Nexreaper Ledger data and start over? This cannot be undone.')) return;
  [K.profile, K.logs, K.theme, K.notified, K.checkinNext, K.asked, K.bannerDismissed].forEach(k => {
    try { localStorage.removeItem(k); } catch (e) {}
  });
  try { sessionStorage.clear(); } catch (e) {}
  location.reload();
}

/* ============================ notifications (PRD bug #1 fix) ============================ */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const run = () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      swReg = reg;
      reg.addEventListener('message', e => {
        const d = e.data || {};
        if (d.type === 'checkin-open') openCheckinModal('notification');
      });
    }).catch(() => {});
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
}

async function showNotif(title, body, tag, kind) {
  // 1) service worker (works when the page is backgrounded on Android)
  if (swReg && 'showNotification' in swReg) {
    try {
      await swReg.showNotification(title, { body: body, tag: tag, icon: 'icons/icon-192.svg', data: { kind: kind } });
      return true;
    } catch (e) {}
  }
  // 2) direct Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, { body: body, tag: tag, icon: 'icons/icon-192.svg', data: { kind: kind } });
      setTimeout(() => { try { n.close(); } catch (e) {} }, 8000);
      return true;
    } catch (e) {}
  }
  // 3) caller falls back to an in-app toast
  return false;
}

function maybeAskNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default' && !localStorage.getItem(K.asked)) {
    localStorage.setItem(K.asked, '1');
    Notification.requestPermission().catch(() => {});
  }
}

async function enableNotifications() {
  if (!('Notification' in window)) { toast('This browser does not support notifications.', 'red'); return; }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
  }
  renderNotifBanner();
  updateNotifStatus();
  if (perm === 'granted') toast('Reminders enabled — try the test button below.', 'green');
}

async function testNotification() {
  if (!('Notification' in window)) { toast('This browser does not support notifications. In-app reminders still work.', 'red'); return; }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
  }
  if (perm !== 'granted') {
    toast('Permission not granted — allow notifications for this site in your browser settings, then try again.', 'red');
    updateNotifStatus();
    return;
  }
  const shown = await showNotif('Nexreaper Ledger', 'Test notification: reminders are working. You\'ll get prayer times and check-ins.', 'nl-test', 'test');
  if (shown) toast('Test notification sent — check your system notification tray.', 'green');
  else toast('Your OS blocked the notification (common on Android in the background). In-app reminders will still appear.', 'red');
  updateNotifStatus();
}

function loadNotified() {
  try {
    const d = JSON.parse(localStorage.getItem(K.notified)) || {};
    const ds = dateStr();
    const out = {};
    Object.keys(d).forEach(k => { if (k.indexOf(ds) === 0) out[k] = true; });
    return out;
  } catch (e) { return {}; }
}
function saveNotified(d) { try { localStorage.setItem(K.notified, JSON.stringify(d)); } catch (e) {} }

// PRD §4.6: check every 30s; if the clock matches a prayer time (and it
// hasn't fired today, and the prayer isn't logged yet) → notify.
async function checkPrayers() {
  if (!profile) return;
  const ds = dateStr();
  if (ds !== currentDateKey) { currentDateKey = ds; render(); }
  if (profile.religionPractice !== 'prayers') return;
  const now = new Date();
  const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const notified = loadNotified();
  let changed = false;
  for (const name of Object.keys(profile.prayerTimes)) {
    if (profile.prayerTimes[name] !== hhmm) continue;
    const key = ds + '|' + name;
    if (notified[key]) continue;
    notified[key] = true;
    changed = true;
    const already = peekDay(ds).prayers[name.toLowerCase()];
    if (!already) {
      const shown = await showNotif('🕌 It\'s time for ' + name, 'Log it in Nexreaper Ledger to keep your day intact.', 'nl-prayer-' + name, 'prayer');
      if (!shown && document.visibilityState === 'visible') toast('🕌 Time for ' + name + ' — log it when you can.');
    }
  }
  if (changed) saveNotified(notified);
}

// PRD §4.6: random check-in every 1–3 hours (persisted so reloads don't reset it).
async function checkCheckinDue() {
  if (!profile || !profile.checkinEnabled) return;
  let next = Number(localStorage.getItem(K.checkinNext) || 0);
  if (!next) {
    localStorage.setItem(K.checkinNext, String(Date.now() + rand(3600e3, 10800e3)));
    return;
  }
  if (Date.now() >= next) {
    localStorage.setItem(K.checkinNext, String(Date.now() + rand(3600e3, 10800e3)));
    const shown = await showNotif('Nexreaper Ledger', 'What are you doing right now?', 'nl-checkin', 'checkin');
    openCheckinModal(shown ? 'notification' : 'inapp');
  }
}

function startEngine() {
  registerSW();
  startSleepTick();
  currentDateKey = dateStr();
  setInterval(checkPrayers, 30000);
  setInterval(checkCheckinDue, 30000);
  checkPrayers();
  checkCheckinDue();
}

function startSleepTick() {
  if (sleepTick) clearInterval(sleepTick);
  sleepTick = setInterval(() => {
    if (!profile) return;
    const el = document.getElementById('sleep-elapsed');
    if (profile.sleepStatus === 'asleep' && profile.sleepStartedAt && el) {
      el.textContent = fmtClock(Date.now() - new Date(profile.sleepStartedAt).getTime());
    }
    if (dateStr() !== currentDateKey) { currentDateKey = dateStr(); render(); }
  }, 1000);
}

/* ============================ onboarding ============================ */

function buildGoalCards() {
  $('#ob-goals').innerHTML = GOAL_DEFS.map(([k, t, s]) =>
    '<label class="goal-card checked" data-goalcard="' + k + '">' +
    '<input type="checkbox" class="sr-only ob-goal-card" data-goal="' + k + '" checked>' +
    '<span class="gc-ic">' + GOAL_META[k].i + '</span>' +
    '<span class="gc-t">' + t + '</span>' +
    '<span class="gc-s">' + s + '</span>' +
    '<span class="gc-check">' + I.check + '</span>' +
    '</label>'
  ).join('');
}

function buildDots() {
  $('#ob-dots').innerHTML = [0, 1, 2, 3, 4].map(n =>
    '<span class="ob-dot' + (n === 0 ? ' active' : '') + '"></span>'
  ).join('');
}

function setObStep(i) {
  obStep = i;
  for (let n = 0; n <= 4; n++) $('#ob-step-' + n).hidden = n !== i;
  $('#ob-back').hidden = i === 0;
  $('#ob-next').textContent = i === 0 ? 'Begin' : (i === 4 ? 'Start tracking' : 'Continue');
  $$('#ob-dots .ob-dot').forEach((d, n) => d.classList.toggle('active', n === i));
  if (i === 2) refreshPracticeOptions();
  if (i === 4) {
    $('#ob-savings-wrap').classList.toggle('hidden', !goalChecked('savings'));
  }
}

function refreshPracticeOptions() {
  let rel = $('#ob-religion').value;
  if (!PRACTICE_OPTS[rel]) rel = 'islam';
  const cur = $('#ob-practice').value || PRACTICE_OPTS[rel][0][0];
  $('#ob-practice').innerHTML = PRACTICE_OPTS[rel].map(([v, l]) =>
    '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + l + '</option>'
  ).join('');
  syncPracticeLabel();
}

function syncPracticeLabel() {
  const v = $('#ob-practice').value;
  const sel = $('#ob-practice').selectedOptions[0];
  if (v && v !== 'none') $('#ob-practice-label').value = sel ? sel.textContent : 'Daily practice';
  else $('#ob-practice-label').value = '';
  $('#ob-practice-hint').textContent = v === 'prayers'
    ? 'We\'ll show a 5-prayer checklist (Fajr → Isha) with time reminders.'
    : v === 'none'
      ? 'You can add a practice later in Settings.'
      : 'We\'ll show a single daily toggle for this practice.';
}

function goalChecked(k) {
  const cb = document.querySelector('.ob-goal-card[data-goal="' + k + '"]');
  return !!(cb && cb.checked);
}

const GOAL_WRAPS = { habit: '#ob-habit-wrap', exercise: '#ob-ex-wrap', savings: '#ob-savings-wrap' };

function onGoalCardChange(e) {
  const cb = e.target.closest('.ob-goal-card');
  if (!cb) return;
  const card = cb.closest('.goal-card');
  if (card) card.classList.toggle('checked', cb.checked);
  const wrapSel = GOAL_WRAPS[cb.dataset.goal];
  if (wrapSel) $(wrapSel).classList.toggle('hidden', !cb.checked);
}

function obNext() {
  if (obStep === 0) { setObStep(1); return; }
  if (obStep === 1) {
    if (!$('#ob-name').value.trim()) {
      toast('Tell us your name — the ledger needs to know who it belongs to.', 'red');
      $('#ob-name').focus();
      return;
    }
    setObStep(2);
    return;
  }
  if (obStep === 2) { setObStep(3); return; }
  if (obStep === 3) {
    if (!GOAL_KEYS.some(goalChecked)) {
      const err = $('#ob-goal-err');
      err.textContent = 'Pick at least one area to track.';
      err.hidden = false;
      return;
    }
    $('#ob-goal-err').hidden = true;
    setObStep(4);
    return;
  }
  if (obStep === 4) finishOnboarding();
}

function finishOnboarding() {
  const rel = $('#ob-religion').value;
  const practice = $('#ob-practice').value || 'none';
  const goals = GOAL_KEYS.filter(goalChecked);
  profile = {
    id: uid(),
    name: $('#ob-name').value.trim() || 'Friend',
    age: clamp(Math.round(num($('#ob-age').value)) || 18, 1, 120),
    weight: Math.max(0, num($('#ob-weight').value)),
    weightUnit: $('#ob-unit').value === 'lb' ? 'lb' : 'kg',
    religion: rel,
    religionPractice: practice === 'none' ? null : practice,
    religionPracticeLabel: $('#ob-practice-label').value.trim() || 'Daily practice',
    goals: goals,
    habitName: goalChecked('habit') ? ($('#ob-habit-name').value.trim() || 'My habit') : 'My habit',
    pushupTarget: clamp(Math.round(num($('#ob-pushups').value) || 20), 1, 500),
    careerGoal: $('#ob-career').value.trim() || 'Build a stronger career path',
    lastRelapseDate: dateStr(),
    habitStartDate: dateStr(),
    roadmapProgress: ROADMAP.flatMap(s => s.steps).reduce((a, st) => { a[st.key] = false; return a; }, {}),
    createdAt: dateStr(),
    savingsGoalName: goalChecked('savings') ? ($('#ob-sav-name').value.trim() || 'My savings goal') : 'My savings goal',
    savingsTarget: Math.max(0, num($('#ob-sav-target').value)),
    savingsCurrent: Math.max(0, num($('#ob-sav-current').value)),
    monthlyIncome: Math.max(0, num($('#ob-income').value)),
    monthlyExpenses: Math.max(0, num($('#ob-expenses').value)),
    currency: $('#ob-currency').value || 'USD',
    savingsLog: {},
    sleepStatus: 'awake',
    sleepStartedAt: null,
    sleepSessions: [],
    sleepTargetHours: 7.5,
    prayerTimes: Object.assign({}, DEFAULT_PRAYER_TIMES),
    checkinEnabled: true
  };
  saveProfile();
  $('#onboarding').hidden = true;
  $('#app').hidden = false;
  startEngine();
  render();
  maybeAskNotif();
  toast('Welcome, ' + profile.name + '. Your ledger starts today.', 'green');
}

/* ============================ action registry ============================ */

const ACTIONS = {
  'relapse': () => relapse(),
  'ex-minus': () => changeExercise(-1),
  'ex-plus': () => changeExercise(1),
  'water-minus': () => setWaterCount(getDay(dateStr()).water - 1),
  'water-fill': () => setWaterCount(8),
  'go-sleep': () => setTab('sleep'),
  'sleep': () => startSleep(),
  'wake': () => endSleep(),
  'sleep-target-minus': () => changeSleepTarget(-0.5),
  'sleep-target-plus': () => changeSleepTarget(0.5),
  'sav-budget': () => {
    const b = monthlyBudget();
    if (b <= 0) { toast('Monthly budget is zero or negative. Set income above expenses in Settings.', 'red'); return; }
    addSavings(b, 'budget');
  },
  'sav-custom': () => addCustomSavings(),
  'open-checkin': () => openCheckinModal('manual'),
  'save-checkin': () => saveCheckinModal(),
  'save-profile': () => saveSettingsProfile(),
  'save-savings': () => saveSettingsSavings(),
  'save-prayers': () => saveSettingsPrayers(),
  'test-notify': () => testNotification(),
  'enable-notify': () => enableNotifications(),
  'dismiss-banner': () => {
    try { localStorage.setItem(K.bannerDismissed, '1'); } catch (e) {}
    renderNotifBanner();
  },
  'export-data': () => exportData(),
  'reset-data': () => resetData()
};

function setTab(t) {
  tab = t;
  $$('#app .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $('#tab-home').hidden = t !== 'home';
  $('#tab-sleep').hidden = t !== 'sleep';
  $('#tab-looks').hidden = t !== 'looks';
  window.scrollTo({ top: 0 });
  render();
}

/* ============================ bindings ============================ */

function bindStatic() {
  $('#streak-ic').innerHTML = I.flame;
  $('#water-ic').innerHTML = I.drop;
  $('#sav-ic').innerHTML = I.target;
  $$('.ob-feat-ic').forEach(el => { el.innerHTML = I.check; });

  buildGoalCards();
  buildDots();
  refreshPracticeOptions();

  $('#ob-next').addEventListener('click', obNext);
  $('#ob-back').addEventListener('click', () => setObStep(Math.max(0, obStep - 1)));
  $('#ob-religion').addEventListener('change', refreshPracticeOptions);
  $('#ob-practice').addEventListener('change', syncPracticeLabel);
  $('#ob-goals').addEventListener('change', onGoalCardChange);

  $$('#app .tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#import-file').addEventListener('change', onImportFile);

  $('#set-checkin').addEventListener('change', e => {
    profile.checkinEnabled = e.target.checked;
    saveProfile();
    if (e.target.checked) {
      try { localStorage.removeItem(K.checkinNext); } catch (err) {} // reschedule fresh
      maybeAskNotif();
    }
    updateNotifStatus();
    toast(e.target.checked ? 'Random check-ins enabled — first nudge in 1–3 hours.' : 'Random check-ins disabled.');
  });

  $('#set-theme').addEventListener('change', e => setTheme(e.target.checked ? 'light' : 'dark'));

  $('#checkin-quick').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#checkin-quick-input');
    if (addCheckin(input.value, 'manual')) {
      input.value = '';
      toast('Activity logged.');
    }
  });

  // Roadmap step checkboxes (event delegation — re-render safe)
  $('#rmList').addEventListener('change', e => {
    const cb = e.target.closest('input[data-rr]');
    if (!cb) return;
    if (!profile.roadmapProgress) profile.roadmapProgress = {};
    profile.roadmapProgress[cb.dataset.rr] = cb.checked;
    saveProfile();
    renderRoadmap();
  });

  // Global click delegation. PRD bug #2 fix: water glasses use ONE
  // delegated listener on the persistent #waterGrid container (via
  // closest('.glass')), so re-renders can never detach the handler and
  // handleWaterClick is a global function, reachable from anywhere.
  document.addEventListener('click', e => {
    const close = e.target.closest('[data-close]');
    if (close) {
      const m = close.closest('.modal');
      if (m) closeModal(m);
      return;
    }

    const act = e.target.closest('[data-action]');
    if (act) {
      const fn = ACTIONS[act.dataset.action];
      if (fn) fn(act, e);
      return;
    }

    const set = e.target.closest('[data-set]');
    if (set) {
      const ds = set.dataset.ds || dateStr();
      const g = getDay(ds);
      const f = set.dataset.set;
      if (f.indexOf('prayer.') === 0) g.prayers[f.slice(7)] = !g.prayers[f.slice(7)];
      else g[f] = !g[f];
      saveLogs();
      render();
      return;
    }

    const lk = e.target.closest('[data-looks]');
    if (lk) {
      const g = getDay(dateStr());
      const k = lk.dataset.looks;
      g.looks[k] = !g.looks[k];
      saveLogs();
      render();
      return;
    }

    const glass = e.target.closest('.glass[data-i]');
    if (glass) handleWaterClick(Number(glass.dataset.i));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal.open').forEach(m => closeModal(m));
  });
}

/* ============================ init ============================ */

document.addEventListener('DOMContentLoaded', () => {
  bindStatic();
  loadState();

  if (profile) {
    $('#onboarding').hidden = true;
    $('#app').hidden = false;
    startEngine();
    render();
    maybeAskNotif(); // PRD §9: prompt for notification permission on first visit

    // A notification click opened us with ?checkin=1 → open the modal
    const q = new URLSearchParams(location.search);
    if (q.get('checkin') === '1') {
      history.replaceState({}, '', location.pathname + location.hash);
      setTimeout(() => openCheckinModal('notification'), 400);
    }
  } else {
    $('#onboarding').hidden = false;
    setObStep(0);
  }
});
