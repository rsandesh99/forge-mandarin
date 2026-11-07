// Forge voice relay: turns text into natural speech and returns a WAV file.
// Google Gemini TTS, the open Qwen3-TTS hosted by DeepInfra, or Alibaba's Qwen3-TTS. The browser sends its own key in the
// Authorization header; nothing is stored or logged here.
const GEMINI_MODELS = ['gemini-3.8-flash-tts-preview', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
const GEMINI_VOICES = new Set(['Kore', 'Sulafat', 'Vindemiatrix', 'Aoede', 'Leda', 'Achernar', 'Charon', 'Iapetus', 'Puck', 'Orus']);
const QWEN_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const QWEN_VOICES = new Set(['Cherry', 'Serena', 'Chelsie', 'Momo', 'Vivian', 'Maia', 'Ethan', 'Moon', 'Kai', 'Ryan']);
const DI_URL = 'https://api.deepinfra.com/v1/inference/Qwen/Qwen3-TTS';
const DI_VOICES = new Set(['Vivian', 'Serena', 'Uncle_Fu']);
let geminiModel = ''; // remembered while this instance stays warm

function wav(pcm, rate = 24000) { // 16-bit mono PCM -> WAV
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function prompt(text, lang, slow) { // Gemini TTS takes a short spoken-style direction before the text
  if (lang === 'English') return 'Say warmly and clearly: ' + text;
  return (slow ? 'Say slowly and very clearly, in standard Mandarin, so a beginner can hear every tone: ' : 'Say naturally and clearly, in standard Mandarin: ') + text;
}
function sendErr(res, status, raw) {
  // Google reports a bad key as 400; Forge treats it as 401 so the app can say "key rejected".
  if (status === 400 && /API[_ ]KEY[_ ]INVALID|API key not valid/i.test(raw || '')) status = 401;
  res.status(status); res.setHeader('Content-Type', 'application/json'); res.send(raw || JSON.stringify({ error: 'TTS failed' }));
}

async function gemini(auth, text, voice, lang, slow, hint) {
  const key = auth.replace(/^Bearer\s+/i, '');
  const order = [...new Set([hint, geminiModel, ...GEMINI_MODELS].filter(m => GEMINI_MODELS.includes(m)))];
  let last = null;
  for (const model of order) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(text, lang, slow) }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICES.has(voice) ? voice : 'Kore' } } } },
      }),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await r.text();
    if (r.status === 404) { last = { status: 404, raw }; continue; } // model name not offered here: try the next one
    if (!r.ok) return { status: r.status, raw };
    let j = null; try { j = JSON.parse(raw); } catch (e) { }
    const part = j && j.candidates && j.candidates[0] && j.candidates[0].content && (j.candidates[0].content.parts || []).find(p => p.inlineData && p.inlineData.data);
    if (!part) return { status: 502, raw: JSON.stringify({ error: 'No audio in the response' }) };
    geminiModel = model;
    const rate = Number((/rate=(\d+)/.exec(part.inlineData.mimeType || '') || [])[1]) || 24000;
    const data = Buffer.from(part.inlineData.data, 'base64');
    return { audio: /wav/i.test(part.inlineData.mimeType || '') ? data : wav(data, rate), model };
  }
  return last || { status: 502, raw: JSON.stringify({ error: 'No TTS model available' }) };
}

function decodeAudio(s) { // "data:audio/wav;base64,..." or bare base64
  const m = /^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s.exec(s || '');
  return m ? { audio: Buffer.from(m[2], 'base64'), type: m[1] || 'audio/wav' } : { audio: Buffer.from(s || '', 'base64'), type: 'audio/wav' };
}
async function deepinfra(auth, text, voice) {
  const r = await fetch(DI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ input: text, voice: DI_VOICES.has(voice) ? voice : 'Vivian' }),
    signal: AbortSignal.timeout(25000),
  });
  const raw = await r.text();
  if (!r.ok) return { status: r.status === 403 ? 401 : r.status, raw };
  let j = null; try { j = JSON.parse(raw); } catch (e) { }
  const a = j && j.audio;
  if (typeof a === 'string' && /^https?:/.test(a)) { const f = await fetch(a, { signal: AbortSignal.timeout(15000) }); if (f.ok) return { audio: Buffer.from(await f.arrayBuffer()), type: f.headers.get('content-type') || 'audio/wav' }; }
  if (typeof a === 'string' && a) return decodeAudio(a);
  return { status: 502, raw: JSON.stringify({ error: 'No audio in the response' }) };
}

async function qwen(auth, text, voice, lang) {
  const r = await fetch(QWEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text, voice: QWEN_VOICES.has(voice) ? voice : 'Cherry', language_type: lang } }),
    signal: AbortSignal.timeout(20000),
  });
  const raw = await r.text();
  if (!r.ok) return { status: r.status, raw };
  let j = null; try { j = JSON.parse(raw); } catch (e) { }
  const a = j && j.output && j.output.audio;
  if (a && a.data) return { audio: Buffer.from(a.data, 'base64') };
  if (a && a.url) {
    const f = await fetch(a.url, { signal: AbortSignal.timeout(15000) });
    if (f.ok) return { audio: Buffer.from(await f.arrayBuffer()) };
  }
  return { status: 502, raw: JSON.stringify({ error: 'No audio in the response' }) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let p = req.body;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
  const text = p && typeof p.text === 'string' ? p.text.trim() : '';
  const lang = p && p.lang === 'English' ? 'English' : 'Chinese';
  const provider = p && ['qwen', 'deepinfra'].includes(p.provider) ? p.provider : 'gemini';
  const auth = req.headers.authorization;
  if (!text || text.length > 600 || !auth) { res.status(400).json({ error: 'Expected {provider, text, voice, lang} (text up to 600 characters) and an Authorization header.' }); return; }
  try {
    const out = provider === 'qwen' ? await qwen(auth, text, p.voice, lang) : provider === 'deepinfra' ? await deepinfra(auth, text, p.voice) : await gemini(auth, text, p.voice, lang, !!p.slow, p.model);
    if (!out.audio || !out.audio.length) { console.log(JSON.stringify({ route: 'tts', provider, status: out.status || 502, error: String(out.raw || '').slice(0, 300) })); sendErr(res, out.status || 502, out.raw); return; }
    console.log(JSON.stringify({ route: 'tts', provider, status: 200, model: out.model || '', chars: text.length, bytes: out.audio.length }));
    res.status(200);
    res.setHeader('Content-Type', out.type || 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    if (out.model) res.setHeader('x-forge-tts-model', out.model);
    res.send(out.audio);
  } catch (e) {
    console.log(JSON.stringify({ route: 'tts', provider, status: 502, error: String(e && e.message || e) }));
    res.status(502).json({ error: 'Could not reach the voice service' });
  }
};
