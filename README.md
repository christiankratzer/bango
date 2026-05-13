# Bango — Japanese Numbers Trainer

A tiny web app to train your ear for spoken Japanese numbers — phone numbers,
prices, room numbers, anything where you need to grab digits on the fly.

## Use it

1. Pick how many digits per number and how many numbers in the round.
2. Pick a reading style:
   - **Digit by digit** — phone-number style, each digit spoken separately.
   - **Full number** — price style, the whole number read as one (with all the
     Japanese sandhi: 300 = さんびゃく, 800 = はっぴゃく, etc.).
3. Hit Start. Listen, type, repeat. Correct answers leave the queue; misses
   cycle back round-robin until everything's cleared.

## How it works

- Pure static site. HTML + JS + CSS, no build step, no backend.
- Speech comes from your **browser's built-in Web Speech API**, using whatever
  Japanese voice your OS provides (Kyoko on macOS/iOS, Haruka/Ayumi on Windows,
  Google TTS on Android). No API keys, no cost, no network calls at runtime.
- Correct/incorrect tones are synthesized live with the Web Audio API — no
  sound files shipped.
- PWA-installable. Works offline once cached (speech voices are local to the
  OS).

## Voice support

| Platform        | Quality | Notes                                  |
| --------------- | ------- | -------------------------------------- |
| iOS / iPadOS    | Great   | Kyoko ships by default                 |
| macOS           | Great   | Kyoko ships by default                 |
| Windows         | Good    | Haruka / Ayumi installed with language pack |
| Android Chrome  | Varies  | Google TTS — usually fine, sometimes missing |
| Linux (Firefox) | Often missing | No ja-JP voice without `espeak-ng` |

If no Japanese voice is detected, the app shows a banner — the rest still
works, but speech will use a default voice and won't sound right.

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## License

MIT.
