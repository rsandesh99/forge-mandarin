// Forge voice relay: turns text into speech with Alibaba's Qwen3-TTS and returns the audio file.
// The browser sends its own Alibaba key in the Authorization header; nothing is stored or logged here.
const TTS_URL = 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const VOICES = new Set(['Cherry', 'Serena', 'Chelsie', 'Momo', 'Vivian', 'Maia', 'Ethan', 'Moon', 'Kai', 'Ryan']);
const LANGS = new Set(['Chinese', 'English']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let p = req.body;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
  const text = p && typeof p.text === 'string' ? p.text.trim() : '';
  const voice = p && VOICES.has(p.voice) ? p.voice : 'Cherry';
  const lang = p && LANGS.has(p.lang) ? p.lang : 'Chinese';
  const auth = req.headers.authorization;
  if (!text || text.length > 600 || !auth) { res.status(400).json({ error: 'Expected {text, voice, lang} (text up to 600 characters) and an Authorization header.' }); return; }
  try {
    const r = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text, voice, language_type: lang } }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await r.text();
    let j = null; try { j = JSON.parse(raw); } catch (e) { }
    if (!r.ok) { res.status(r.status); res.setHeader('Content-Type', 'application/json'); res.send(raw || JSON.stringify({ error: 'TTS failed' })); return; }
    const audio = j && j.output && j.output.audio;
    let buf = null;
    if (audio && audio.data) buf = Buffer.from(audio.data, 'base64');
    else if (audio && audio.url) {
      const a = await fetch(audio.url, { signal: AbortSignal.timeout(15000) });
      if (!a.ok) { res.status(502).json({ error: 'Could not download the audio' }); return; }
      buf = Buffer.from(await a.arrayBuffer());
    }
    if (!buf || !buf.length) { res.status(502).json({ error: 'No audio in the TTS response', code: j && j.code, message: j && j.message }); return; }
    res.status(200);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Alibaba Cloud' });
  }
};
