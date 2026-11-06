# Forge 锻

Personal Mandarin trainer. A single static page (`index.html`) with no build step, plus one small serverless relay.

- **Daily session:** tone-pair drills, FSRS reviews, new words, reading at your level, shadowing.
- **Drive mode:** hands-free voice-in/voice-out drills for the car. Needs Chrome on Android or Safari on iPhone, and the microphone.
- **AI teacher (林老师):** a spoken lesson that teaches words and phrases one at a time and corrects your tones.

## AI providers

Pick a provider in Settings and paste its key. Keys stay in the browser's local storage and are never synced.

| Provider | Default model | Notes |
|---|---|---|
| Qwen (Alibaba Cloud, Singapore) — recommended | `qwen3.7-plus` | The same key also powers the natural voice (Qwen3-TTS) |
| DeepSeek | `deepseek-flash` | Cheapest brain; thinking is turned off for speed |
| GLM (Z.ai) | `glm-4.7-flash` | Free model; good backup |
| OpenRouter | `qwen/qwen3.6-plus` | One key for many models; 5.5% fee per top-up |

Forge calls the provider directly from the browser. If the browser blocks that call (CORS), it falls back to `/api/chat`. That relay forwards the request to one of the four fixed provider URLs with the user's own key, and stores and logs nothing.

## Natural voice

With an Alibaba Cloud (Model Studio, Singapore) key, Forge speaks with Qwen3-TTS (`qwen3-tts-flash`) through `/api/tts`, which returns the audio file. Clips are cached in the browser (IndexedDB), so repeats are instant and free. If the key is missing or rejected, Forge falls back to the device's built-in voice.

## Deploy

Vercel, from this repo. `vercel.json` pins the relay to Mumbai (`bom1`).
