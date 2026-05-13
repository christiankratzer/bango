const state = {
  queue: [],
  current: null,
  mode: 'digits',
  rate: 0.9,
  total: 0,
  mistakes: 0,
  startTime: 0,
  voice: null,
};

const $ = (id) => document.getElementById(id);

// Web Speech API has no standard gender field — infer from known voice names.
const FEMALE_HINTS = [
  'kyoko', 'haruka', 'ayumi', 'sayaka', 'o-ren', 'oren',
  'nanami', 'mizuki', 'female', '女', 'google 日本語',
];
const MALE_HINTS = ['otoya', 'hattori', 'ichiro', 'keita', 'male', '男'];

function classify(name) {
  const n = name.toLowerCase();
  if (FEMALE_HINTS.some(h => n.includes(h))) return 'female';
  if (MALE_HINTS.some(h => n.includes(h))) return 'male';
  return 'unknown';
}

let availableVoices = [];

function populateVoices() {
  if (!('speechSynthesis' in window)) {
    $('voice-warning').textContent = 'This browser does not support speech synthesis.';
    $('voice-warning').classList.remove('hidden');
    return;
  }
  const all = speechSynthesis.getVoices();
  availableVoices = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('ja'));
  const select = $('voice-select');
  select.innerHTML = '';

  if (availableVoices.length === 0) {
    $('voice-warning').classList.remove('hidden');
    select.disabled = true;
    const opt = document.createElement('option');
    opt.textContent = '(no Japanese voice available)';
    select.appendChild(opt);
    state.voice = null;
    return;
  }

  $('voice-warning').classList.add('hidden');
  select.disabled = false;

  availableVoices.forEach((v, i) => {
    const g = classify(v.name);
    const tag = g === 'female' ? ' ♀' : g === 'male' ? ' ♂' : '';
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${v.name}${tag}`;
    select.appendChild(opt);
  });

  const saved = localStorage.getItem('bango.voice');
  let idx = saved ? availableVoices.findIndex(v => v.name === saved) : -1;
  if (idx === -1) idx = availableVoices.findIndex(v => classify(v.name) === 'female');
  if (idx === -1) idx = availableVoices.findIndex(v => classify(v.name) !== 'male');
  if (idx === -1) idx = 0;
  select.value = String(idx);
  state.voice = availableVoices[idx];
}

if ('speechSynthesis' in window) {
  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
}

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', delay = 0, peakGain = 0.25) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Bell-like tone: fundamental + 2nd harmonic at lower gain, longer decay.
function playBell(freq, duration, delay = 0, peakGain = 0.22) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  [
    { f: freq, g: peakGain, type: 'sine' },
    { f: freq * 2.01, g: peakGain * 0.28, type: 'sine' },
    { f: freq * 3.0, g: peakGain * 0.10, type: 'triangle' },
  ].forEach(({ f, g, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(g, t0 + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  });
}

function playCorrect() {
  // C-major arpeggio resolving up an octave: C5, E5, G5, C6.
  playBell(523.25, 0.45, 0.00);
  playBell(659.25, 0.45, 0.07);
  playBell(783.99, 0.50, 0.14);
  playBell(1046.50, 0.70, 0.22, 0.26);
  // Haptic — Android only; iOS Safari ignores this.
  if (navigator.vibrate) navigator.vibrate([40, 30, 90]);
}

function playIncorrect() {
  playTone(220, 0.28, 'square', 0, 0.18);
  if (navigator.vibrate) navigator.vibrate(120);
}

function resolveVoice() {
  if (!('speechSynthesis' in window)) return null;
  const targetName = state.voice ? state.voice.name : null;
  const voices = speechSynthesis.getVoices();
  if (targetName) {
    const match = voices.find(v => v.name === targetName);
    if (match) return match;
  }
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ja')) || null;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  const voice = resolveVoice();
  if (voice) u.voice = voice;
  u.rate = state.rate;
  speechSynthesis.speak(u);
}

// --- Random helpers ---
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += randInt(0, 9);
  return s;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function daysInMonth(m) {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土'];

// --- Challenge generators ---
// Each returns { speech, answer, display }.
function challengeNumber(length, asDigits) {
  let s = '';
  const firstMin = !asDigits && length > 1 ? 1 : 0;
  s += randInt(firstMin, 9);
  for (let i = 1; i < length; i++) s += randInt(0, 9);
  return {
    speech: asDigits ? s.split('').join('、 ') : s,
    answer: s,
    display: s,
  };
}

function challengePhone() {
  // Mobile (11 digits, 0X0-XXXX-XXXX) or landline (10 digits, 0X-XXXX-XXXX).
  const mobile = Math.random() < 0.5;
  let phone, groups;
  if (mobile) {
    const prefix = ['090', '080', '070'][randInt(0, 2)];
    phone = prefix + randDigits(4) + randDigits(4);
    groups = [phone.slice(0, 3), phone.slice(3, 7), phone.slice(7)];
  } else {
    const prefix = ['03', '06'][randInt(0, 1)];
    phone = prefix + randDigits(4) + randDigits(4);
    groups = [phone.slice(0, 2), phone.slice(2, 6), phone.slice(6)];
  }
  return {
    speech: groups.map(g => g.split('').join('、 ')).join(' の '),
    answer: phone,
    display: groups.join('-'),
  };
}

function challengeDate() {
  const m = randInt(1, 12);
  const d = randInt(1, daysInMonth(m));
  return {
    speech: `${m}月${d}日`,
    answer: pad2(m) + pad2(d),
    display: `${m}月${d}日`,
  };
}

function challengePrice() {
  // Weighted by magnitude so all three ranges get practiced.
  const r = Math.random();
  let amt;
  if (r < 0.40) amt = randInt(100, 999);          // convenience-store range
  else if (r < 0.75) amt = randInt(1000, 9999);   // restaurant / shopping
  else amt = randInt(10000, 99999);               // hotel / bigger purchases
  return {
    speech: `${amt}円`,
    answer: String(amt),
    display: `¥${amt.toLocaleString()}`,
  };
}

function challengeTime() {
  const h = randInt(1, 23);
  const r = Math.random();
  let m, speech;
  if (r < 0.30) { m = 0;  speech = `${h}時`; }       // exact hour
  else if (r < 0.50) { m = 30; speech = `${h}時半`; } // half past
  else { m = randInt(1, 59); speech = `${h}時${m}分`; }
  return {
    speech,
    answer: pad2(h) + pad2(m),
    display: `${h}:${pad2(m)}`,
  };
}

function challengeMonth() {
  const m = randInt(1, 12);
  return { speech: `${m}月`, answer: String(m), display: `${m}月` };
}

function challengeWeekday() {
  const i = randInt(0, 6);
  return {
    speech: `${WEEKDAY_KANJI[i]}曜日`,
    answer: String(i),
    display: `${WEEKDAY_KANJI[i]}曜日`,
  };
}

function generateChallenge() {
  switch (state.mode) {
    case 'digits':   return challengeNumber(state.digitCount, true);
    case 'full':     return challengeNumber(state.digitCount, false);
    case 'phone':    return challengePhone();
    case 'price':    return challengePrice();
    case 'time':     return challengeTime();
    case 'date':     return challengeDate();
    case 'months':   return challengeMonth();
    case 'weekdays': return challengeWeekday();
    default:         return challengeNumber(state.digitCount, true);
  }
}

function isWeekdayMode() { return state.mode === 'weekdays'; }

function maxLengthForMode() {
  switch (state.mode) {
    case 'phone': return 11;
    case 'price': return 5;
    case 'time': return 4;
    case 'date': return 4;
    case 'months': return 2;
    case 'weekdays': return 1;
    default: return state.digitCount;
  }
}

function placeholderForMode() {
  switch (state.mode) {
    case 'date': return 'MMDD';
    case 'time': return 'HHMM';
    case 'price': return 'yen';
    case 'phone': return '10 or 11 digits';
    case 'months': return '1–12';
    default: return '';
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function startSession(opts) {
  state.mode = opts.mode;
  state.rate = opts.rate;
  state.digitCount = opts.digitCount;
  state.queue = [];
  for (let i = 0; i < opts.sequenceLength; i++) {
    state.queue.push(generateChallenge());
  }
  state.total = opts.sequenceLength;
  state.mistakes = 0;
  state.startTime = Date.now();

  showScreen('trainer-screen');
  configureTrainerInput();
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  // First speak runs synchronously to keep iOS user-gesture permission;
  // subsequent ones are fine from a timer.
  nextNumber(true);
}

function configureTrainerInput() {
  const isWeekday = isWeekdayMode();
  $('answer-form').classList.toggle('hidden', isWeekday);
  $('weekday-input').classList.toggle('hidden', !isWeekday);
  if (!isWeekday) {
    const input = $('answer-input');
    input.value = '';
    input.maxLength = maxLengthForMode();
    input.placeholder = placeholderForMode();
  }
}

function nextNumber(immediate = false) {
  if (state.queue.length === 0) {
    finishSession();
    return;
  }
  state.current = state.queue[0];
  const done = state.total - state.queue.length;
  $('progress-text').textContent = `${done} / ${state.total}`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  if (!isWeekdayMode()) {
    $('answer-input').value = '';
    $('answer-input').focus();
  }
  if (immediate) {
    speak(state.current.speech);
  } else {
    setTimeout(() => speak(state.current.speech), 200);
  }
}

// Accept user-friendly variants: strip non-digits, and drop leading zeros for
// modes where zero-padding is just our canonical form (time/date/months).
function normalizeAnswer(input) {
  const digits = String(input).replace(/\D/g, '');
  if (state.mode === 'time' || state.mode === 'date' || state.mode === 'months') {
    return digits.replace(/^0+/, '') || '0';
  }
  return digits;
}

function handleAnswer(answer) {
  const ch = state.current;
  const match = normalizeAnswer(answer) === normalizeAnswer(ch.answer);
  if (match) {
    state.queue.shift();
    playCorrect();
    $('feedback').textContent = '✓ ' + ch.display;
    $('feedback').className = 'feedback good';
    setTimeout(nextNumber, 800);
  } else {
    state.mistakes++;
    state.queue.push(state.queue.shift());
    playIncorrect();
    $('feedback').textContent = `✗ was ${ch.display}`;
    $('feedback').className = 'feedback bad';
    const target = isWeekdayMode() ? $('weekday-input') : $('answer-input');
    target.classList.add('shake');
    setTimeout(() => target.classList.remove('shake'), 400);
    setTimeout(nextNumber, 1600);
  }
}

function finishSession() {
  const elapsed = Math.round((Date.now() - state.startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const mistakeStr = state.mistakes === 1 ? '1 mistake' : `${state.mistakes} mistakes`;
  $('stats').textContent = `${state.total} numbers in ${timeStr} with ${mistakeStr}.`;
  showScreen('done-screen');
}

$('setup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  ensureAudio();
  const opts = {
    digitCount: Math.max(1, Math.min(12, parseInt($('digit-count').value, 10) || 4)),
    sequenceLength: Math.max(1, Math.min(50, parseInt($('sequence-length').value, 10) || 10)),
    mode: $('mode-select').value,
    rate: parseFloat($('rate').value) || 0.9,
  };
  startSession(opts);
});

function syncDigitCountVisibility() {
  const mode = $('mode-select').value;
  const showDigits = mode === 'digits' || mode === 'full';
  $('digit-count-row').classList.toggle('hidden', !showDigits);
}
$('mode-select').addEventListener('change', syncDigitCountVisibility);
syncDigitCountVisibility();

document.querySelectorAll('.day-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    handleAnswer(btn.dataset.day);
  });
});

$('answer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('answer-input').value.trim();
  if (v === '') return;
  handleAnswer(v);
});

$('replay-btn').addEventListener('click', () => {
  if (state.current) speak(state.current.speech);
  if (!isWeekdayMode()) $('answer-input').focus();
});

$('quit-btn').addEventListener('click', () => {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  showScreen('setup-screen');
});

$('again-btn').addEventListener('click', () => {
  showScreen('setup-screen');
});

$('rate').addEventListener('input', (e) => {
  $('rate-out').textContent = parseFloat(e.target.value).toFixed(2);
});

$('voice-select').addEventListener('change', (e) => {
  const idx = parseInt(e.target.value, 10);
  state.voice = availableVoices[idx] || null;
  if (state.voice) {
    try { localStorage.setItem('bango.voice', state.voice.name); } catch {}
    ensureAudio();
    speechSynthesis.cancel();
    const sample = new SpeechSynthesisUtterance('一二三');
    sample.lang = 'ja-JP';
    const v = resolveVoice();
    if (v) sample.voice = v;
    sample.rate = parseFloat($('rate').value) || 0.9;
    speechSynthesis.speak(sample);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
