# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

No build step. Serve the directory with any static server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The service worker only registers on a same-origin HTTP(S) load, not from `file://`.

There is no test suite, linter, or package manifest — this is hand-written HTML/CSS/JS.

## Architecture

Pure-static PWA. Three top-level concerns live in `app.js`:

1. **Voice resolution** (`populateVoices`, `resolveVoice`, `speak`). The Web Speech API has no standardized gender field, so `classify()` infers it from known voice names (Kyoko, Haruka, Otoya, …). Selected voice is persisted to `localStorage` under `bango.voice`. iOS requires the *first* `speak()` call to happen synchronously inside a user gesture — `startSession` passes `immediate=true` to `nextNumber` for this reason; subsequent calls are fine from a `setTimeout`.

2. **Challenge generation**. Each mode has its own `challengeXxx()` function returning `{ speech, answer, display }`:
   - `speech` is the Japanese string fed to TTS (sometimes with `、` pauses to force digit-by-digit reading, e.g. phone numbers).
   - `answer` is the canonical digit string used for comparison.
   - `display` is the human-readable form shown in feedback and the summary.
   `generateChallenge()` dispatches on `state.mode`. `maxLengthForMode()` / `placeholderForMode()` configure the input field per mode. Weekday mode is special: it uses button grid input instead of the text field — `configureTrainerInput()` toggles which is visible, and `isWeekdayMode()` gates input-field logic.

3. **Session loop** (`startSession` → `nextNumber` → `handleAnswer` → `finishSession`). The queue is round-robin: correct answers are shifted off; wrong ones are rotated to the back. Each challenge object carries an `attempts` counter that survives re-queuing, and `state.challenges` keeps the original order for the end-of-session summary.

   Critical invariant: **answers must be locked between submit and the next prompt**. `state.locked` is set in `handleAnswer` and cleared in `nextNumber`. Without this, a rapid second submit during the 800 ms feedback delay would match the *still-current* `state.current` and shift another (un-asked) challenge off the queue — fast clicks could drain the whole sequence.

## Audio

Both correct and incorrect tones are synthesized live with the Web Audio API (`playBell`, `playTone`) — no audio files ship. `ensureAudio()` lazily constructs the `AudioContext` and resumes it (Safari starts it suspended). It is called from the form submit handler so the first context creation happens inside a user gesture.

## Answer normalization

`normalizeAnswer()` strips non-digits and drops leading zeros, *except* in phone mode where leading `0` is meaningful. This lets users type `5月3日` answers as `53`, `503`, or `0503` interchangeably. When changing comparison logic, run both sides (`answer` and user input) through the same normalizer.

## Service worker

`sw.js` precaches the shell with a versioned cache name (`bango-vN`). **Bump the version any time you change `app.js`, `index.html`, `styles.css`, `manifest.webmanifest`, or `icon.svg`** — otherwise returning users keep the old bundle. The fetch handler is cache-first with a network fallback, so a stale cache wins silently if the version isn't bumped.

## Voice availability

Voices are an OS concern; the app can't ship them. The behavior matrix is in `README.md`. If `populateVoices()` finds zero `ja-*` voices, the warning banner is shown and speech falls back to the default voice (wrong pronunciation, but the rest of the app still works).
