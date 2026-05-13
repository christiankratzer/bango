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

function playCorrect() {
  playTone(660, 0.14, 'sine', 0);
  playTone(990, 0.20, 'sine', 0.10);
}

function playIncorrect() {
  playTone(220, 0.28, 'square', 0, 0.18);
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

function speakNumber(numStr) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const text = state.mode === 'digits'
    ? numStr.split('').join('、 ')
    : numStr;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  const voice = resolveVoice();
  if (voice) u.voice = voice;
  u.rate = state.rate;
  speechSynthesis.speak(u);
}

function generateNumber(length) {
  let s = '';
  const firstMin = state.mode === 'full' && length > 1 ? 1 : 0;
  s += Math.floor(Math.random() * (10 - firstMin)) + firstMin;
  for (let i = 1; i < length; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function startSession(opts) {
  state.mode = opts.mode;
  state.rate = opts.rate;
  state.queue = [];
  for (let i = 0; i < opts.sequenceLength; i++) {
    state.queue.push(generateNumber(opts.digitCount));
  }
  state.total = opts.sequenceLength;
  state.mistakes = 0;
  state.startTime = Date.now();

  showScreen('trainer-screen');
  $('answer-input').value = '';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  nextNumber();
}

function nextNumber() {
  if (state.queue.length === 0) {
    finishSession();
    return;
  }
  state.current = state.queue[0];
  const done = state.total - state.queue.length;
  $('progress-text').textContent = `${done} / ${state.total}`;
  $('answer-input').value = '';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('answer-input').focus();
  setTimeout(() => speakNumber(state.current), 200);
}

function handleAnswer(answer) {
  const correct = state.current;
  if (answer === correct) {
    state.queue.shift();
    playCorrect();
    $('feedback').textContent = '✓ ' + correct;
    $('feedback').className = 'feedback good';
    setTimeout(nextNumber, 800);
  } else {
    state.mistakes++;
    state.queue.push(state.queue.shift());
    playIncorrect();
    $('feedback').textContent = `✗ was ${correct}`;
    $('feedback').className = 'feedback bad';
    $('answer-input').classList.add('shake');
    setTimeout(() => $('answer-input').classList.remove('shake'), 400);
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
    mode: document.querySelector('input[name="mode"]:checked').value,
    rate: parseFloat($('rate').value) || 0.9,
  };
  startSession(opts);
});

$('answer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('answer-input').value.trim();
  if (v === '') return;
  handleAnswer(v);
});

$('replay-btn').addEventListener('click', () => {
  if (state.current) speakNumber(state.current);
  $('answer-input').focus();
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
