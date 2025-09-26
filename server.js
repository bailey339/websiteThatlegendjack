// server.js — Express web service (+ Spotify OAuth, Discord config) — ESM
try { (await import('dotenv')).config(); } catch (_) {}

import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CRITICAL FIX: Trust Render's proxy
app.set('trust proxy', 1);

app.use(express.json());

// FIXED Cookie session configuration
app.use(cookieSession({
  name: 'tlj_sess',
  keys: [process.env.SESSION_SECRET || 'dev_change_me'],
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // ← CHANGED TO FALSE to work on Render
  maxAge: 30 * 24 * 60 * 60 * 1000
}));

/* ---------- Health check ---------- */
app.get('/healthz', (_, res) => res.status(200).send('ok'));

/* ---------- Static files ---------- */
app.use(express.static(__dirname, { extensions: ['html'] }));

/* ---------- ENV to client (Discord ID only) ---------- */
app.get('/api/config', (req, res) => {
  res.json({ discord_user_id: process.env.DISCORD_USER_ID || null });
});

/* ---------- Minimal login page (no extra file) ---------- */
app.get('/login.html', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Login - ThatLegendJack</title>
<style>
  body{ margin:0; font-family:Arial,Helvetica,sans-serif; color:#fff; text-align:center;
    background:linear-gradient(135deg,#EF0107 0%,#FFF 35%,#063672 70%,#9C824A 100%); }
  h1{ margin:1rem 0 0; font-size:2.2rem; font-weight:900; text-shadow:2px 2px 5px #000 }
  form{max-width:420px;margin:1.5rem auto;background:rgba(0,0,0,.35);padding:1rem;border-radius:12px}
  input{display:block;width:100%;margin:.5rem 0;padding:.6rem;border:none;border-radius:8px}
  button{padding:.6rem 1rem;border:none;border-radius:8px;background:#EF0107;color:#fff;font-weight:800;cursor:pointer}
  button:hover{background:#9C824A}
</style>
</head>
<body>
  <h1>Login</h1>
  <form onsubmit="return doLogin(event)">
    <input id="username" placeholder="Username" required/>
    <input id="password" type="password" placeholder="Password" required/>
    <button type="submit">Login</button>
  </form>
  <script src="/main.js"></script>
</body>
</html>`);
});

/* ---------- Spotify OAuth ---------- */
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/spotify/callback';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

function authUrl(state) {
  const scope = ['user-read-currently-playing', 'user-read-playback-state'].join(' ');
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    show_dialog: 'false'
  });
  return `${SPOTIFY_AUTH_URL}?${q}`;
}

app.get('/auth/spotify/login', (req, res) => {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return res.status(500).send('Spotify env missing');
  const state = Math.random().toString(36).slice(2);
  req.session.spotify_state = state;
  res.redirect(authUrl(state));
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.spotify_state) return res.status(400).send('Bad state');
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.toString(),
      redirect_uri: SPOTIFY_REDIRECT_URI
    });
    const r = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${b64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!r.ok) return res.status(500).send('Token exchange failed: ' + await r.text());
    const j = await r.json();
    req.session.spotify = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000
    };
    res.redirect('/');
  } catch (e) {
    res.status(500).send('OAuth error: ' + e.message);
  }
});

async function ensureSpotifyAccessToken(sess) {
  if (!sess?.spotify?.refresh_token) return null;
  if (sess.spotify.access_token && Date.now() < (sess.spotify.expires_at || 0)) return sess.spotify.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: sess.spotify.refresh_token
  });
  const r = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${b64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!r.ok) { sess.spotify = null; return null; }
  const j = await r.json();
  sess.spotify = {
    access_token: j.access_token,
    refresh_token: sess.spotify.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000
  };
  return sess.spotify.access_token;
}

app.get('/api/spotify/now-playing', async (req, res) => {
  try {
    const at = await ensureSpotifyAccessToken(req.session);
    if (!at) return res.status(401).json({ error: 'not_connected' });
    const r = await fetch(NOW_PLAYING_URL, { headers: { Authorization: `Bearer ${at}` } });
    if (r.status === 204) return res.json({ playing: false });
    if (!r.ok) return res.status(r.status).json({ error: 'spotify_error' });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- SPA fallback ---------- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (typeof fetch !== 'function') console.error('Node 18+ required');
app.listen(PORT, () => console.log('Server on :' + PORT));
