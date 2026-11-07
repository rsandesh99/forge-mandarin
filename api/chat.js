// Forge relay: forwards a chat request to one of a fixed set of AI providers.
// The browser sends its own key in the Authorization header; nothing is stored or logged here.
// Used only when a provider blocks direct browser calls (CORS).
const PROVIDERS = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  glm: 'https://api.z.ai/api/paas/v4/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = null; } }
  const { provider, body } = payload || {};
  const url = PROVIDERS[provider];
  const auth = req.headers.authorization;
  if (!url || !auth || !body || typeof body !== 'object') { res.status(400).json({ error: 'Expected {provider, body} and an Authorization header.' }); return; }
  const headers = { 'Content-Type': 'application/json', Authorization: auth };
  if (provider === 'openrouter') headers['X-Title'] = 'Forge';
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const text = await r.text();
    console.log(JSON.stringify({ route: 'chat', provider, model: body.model, status: r.status, error: r.ok ? undefined : text.slice(0, 300) }));
    res.status(r.status);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.send(text);
  } catch (e) {
    console.log(JSON.stringify({ route: 'chat', provider, status: 502, error: String(e && e.message || e) }));
    res.status(502).json({ error: 'Could not reach ' + provider });
  }
};
