// server.js — Express web service (+ Spotify OAuth, Discord config) — ESM
try { (await import('dotenv')).config(); } catch (_) {}

import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Cookie session (used for admin auth)
app.use(cookieSession({
  name: 'tlj_sess',
  keys: [process.env.SESSION_SECRET || 'dev_change_me'],
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  maxAge: 30 * 24 * 60 * 60 * 1000
}));

/* ---------- Health check ---------- */
app.get('/healthz', (_, res) => res.status(200).send('ok'));

/* ---------- Static files ---------- */
app.use(express.static(__dirname, { extensions: ['html'] }));

/* ---------- ENV to client (Discord ID only) ---------- */
app.get('/api/config', (req, res) => {
  res.json({ 
    discord_user_id: process.env.DISCORD_USER_ID || null,
    admin_secret: process.env.ADMIN_SECRET || 'dev_secret_change_me'
  });
});

/* ---------- Global About Me (admin editable, everyone sees) ---------- */
let globalAboutHTML = process.env.DEFAULT_ABOUT_HTML || '<p>Welcome to my stream! This is the About Me section.</p>';

app.get('/api/about', (req, res) => {
  res.json({ html: globalAboutHTML });
});

app.post('/api/about', express.json(), (req, res) => {
  // Simple admin check
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET || 'dev_secret_change_me'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  globalAboutHTML = req.body.html || globalAboutHTML;
  res.json({ success: true });
});

/* ---------- Social Links (admin configurable) ---------- */
const defaultSocialLinks = {
  twitch: 'https://www.twitch.tv/ThatLegendJackk',
  tiktok: 'https://www.tiktok.com/@thatlegendjack', 
  kick: 'https://kick.com/ThatLegendJackk',
  onlyfans: 'https://onlyfans.com/your-handle'
};

let socialLinks = { ...defaultSocialLinks };

app.get('/api/social-links', (req, res) => {
  res.json(socialLinks);
});

app.post('/api/social-links', express.json(), (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_SECRET || 'dev_secret_change_me'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  socialLinks = { ...socialLinks, ...req.body };
  res.json({ success: true });
});

/* ---------- Spotify OAuth (FIXED FOR RENDER) ---------- */
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://thatlegendjack.onrender.com/auth/spotify/callback';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

function authUrl(state) {
  const scope = 'user-read-currently-playing user-read-playback-state';
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state,
    show_dialog: 'false'
  });
  return `${SPOTIFY_AUTH_URL}?${q}`;
}

app.get('/auth/spotify/login', (req, res) => {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(500).send('Spotify credentials missing');
  }
  const state = Math.random().toString(36).slice(2);
  req.session.spotify_state = state;
  res.redirect(authUrl(state));
});

app.get('/auth/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.spotify_state) {
    return res.status(400).send('Invalid state parameter');
  }
  
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.toString(),
      redirect_uri: SPOTIFY_REDIRECT_URI
    });
    
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    });
    
    if (!response.ok) {
      throw new Error(`Spotify token error: ${response.status}`);
    }
    
    const tokenData = await response.json();
    req.session.spotify = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    };
    
    res.redirect('/');
  } catch (error) {
    console.error('Spotify callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

async function ensureSpotifyAccessToken(sess) {
  if (!sess?.spotify?.refresh_token) return null;
  if (sess.spotify.access_token && Date.now() < (sess.spotify.expires_at || 0)) return sess.spotify.access_token;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: sess.spotify.refresh_token
  });
  
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  
  if (!response.ok) { 
    sess.spotify = null; 
    return null; 
  }
  
  const tokenData = await response.json();
  sess.spotify = {
    access_token: tokenData.access_token,
    refresh_token: sess.spotify.refresh_token,
    expires_at: Date.now() + (tokenData.expires_in * 1000)
  };
  return sess.spotify.access_token;
}

app.get('/api/spotify/now-playing', async (req, res) => {
  try {
    const accessToken = await ensureSpotifyAccessToken(req.session);
    if (!accessToken) {
      return res.status(401).json({ error: 'not_connected' });
    }
    
    const response = await fetch(NOW_PLAYING_URL, { 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });
    
    if (response.status === 204) return res.json({ playing: false });
    if (!response.ok) return res.status(response.status).json({ error: 'spotify_error' });
    
    res.json(await response.json());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple test endpoint
app.get('/api/spotify/test', (req, res) => {
  res.json({ 
    message: 'Spotify endpoint working',
    has_creds: !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    redirect_uri: SPOTIFY_REDIRECT_URI
  });
});

/* ---------- Minimal login page ---------- */
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

/* ---------- SPA fallback ---------- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (typeof fetch !== 'function') console.error('Node 18+ required');
app.listen(PORT, () => console.log('Server on :' + PORT));
