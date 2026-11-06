# Forge 锻

Personal Mandarin trainer. A single static page (`index.html`) with no build step, plus one small serverless relay.

- **Daily session:** tone-pair drills, FSRS reviews, new words, reading at your level, shadowing.
- **Drive mode:** hands-free voice-in/voice-out drills for the car. Needs Chrome on Android or Safari on iPhone, and the microphone.
- **AI teacher (林老师):** a spoken lesson that teaches words and phrases one at a time and corrects your tones.

## AI providers

Pick a provider in Settings and paste its key. Keys stay in the browser's local storage and are never synced.

| Provider | Default model | Notes |
|---|---|---|
| Gemini (Google AI Studio), recommended | `gemini-3.8-flash` | Free to start; the same key also powers the natural voice |
| Qwen (Alibaba Cloud, Singapore) | `qwen3.7-plus` | Alibaba Cloud signup isn't open in India |
| DeepSeek | `deepseek-flash` | Cheapest brain; thinking is turned off for speed |
| GLM (Z.ai) | `glm-4.7-flash` | Free model; good backup |
| OpenRouter | `qwen/qwen3.6-plus` | One key for many models; 5.5% fee per top-up |

Forge calls the provider directly from the browser. If the browser blocks that call (CORS), it falls back to `/api/chat`. That relay forwards the request to a fixed list of provider URLs with the user's own key, and stores and logs nothing.

## Natural voice

`/api/tts` returns a WAV clip from one of three engines:

- **Google Gemini TTS** (`gemini-3.x-flash-tts-preview`), using the same Google key as the teacher.
- **Qwen3-TTS**, the open model hosted by DeepInfra (needs a DeepInfra key).
- **Qwen3-TTS-Flash** on Alibaba Cloud.

With two engines set up, Settings offers a 3-round blind A/B test and keeps the winner. Clips are cached in IndexedDB, so repeats are instant and free. If no key works, Forge falls back to the device's built-in voice.

## Deploy

Vercel, from this repo. `vercel.json` pins the relay to Mumbai (`bom1`).
