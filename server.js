// server.js — Express web service with SQLite database
try { (await import('dotenv')).config(); } catch (_) {}

import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'site.db'));

// Initialize database tables if they don't exist
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS spotify_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS social_urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS about_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gifted_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      gifts INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default social URLs if empty
  const socialCount = db.prepare('SELECT COUNT(*) as count FROM social_urls').get();
  if (socialCount.count === 0) {
    const insertSocial = db.prepare('INSERT OR REPLACE INTO social_urls (platform, url) VALUES (?, ?)');
    insertSocial.run('twitch', 'https://www.twitch.tv/ThatLegendJackk');
    insertSocial.run('tiktok', 'https://www.tiktok.com/@thatlegendjack');
    insertSocial.run('kick', 'https://kick.com/ThatLegendJackk');
    insertSocial.run('onlyfans', 'https://onlyfans.com/your-handle');
  }

  // Insert default about content if empty
  const aboutCount = db.prepare('SELECT COUNT(*) as count FROM about_content').get();
  if (aboutCount.count === 0) {
    db.prepare('INSERT INTO about_content (content) VALUES (?)').run('This is your About Me section.');
  }
}

initDatabase();

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Cookie session
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

/* ---------- ENV to client ---------- */
app.get('/api/config', (req, res) => {
  res.json({ discord_user_id: process.env.DISCORD_USER_ID || null });
});

/* ---------- Auth API ---------- */
function getRole(req) {
  return req.session.role || 'guest';
}

app.post('/api/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  if (username === 'ThatLegendJack' && password === 'BooBear24/7') {
    req.session.role = 'staff';
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({ role: getRole(req) });
});

/* ---------- Social URLs API ---------- */
app.get('/api/social-urls', (req, res) => {
  try {
    const urls = db.prepare('SELECT platform, url FROM social_urls').all();
    const urlMap = {};
    urls.forEach(row => { urlMap[row.platform] = row.url; });
    res.json(urlMap);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load social URLs' });
  }
});

app.post('/api/social-urls', express.json(), (req, res) => {
  if (getRole(req) !== 'staff') return res.status(403).json({ error: 'Unauthorized' });
  
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO social_urls (platform, url) VALUES (?, ?)');
    Object.entries(req.body).forEach(([platform, url]) => {
      if (url) stmt.run(platform, url);
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save social URLs' });
  }
});

/* ---------- About Content API ---------- */
app.get('/api/about', (req, res) => {
  try {
    const row = db.prepare('SELECT content FROM about_content ORDER BY id DESC LIMIT 1').get();
    res.json({ content: row?.content || 'This is your About Me section.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load about content' });
  }
});

app.post('/api/about', express.json(), (req, res) => {
  if (getRole(req) !== 'staff') return res.status(403).json({ error: 'Unauthorized' });
  
  try {
    db.prepare('INSERT INTO about_content (content) VALUES (?)').run(req.body.content);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save about content' });
  }
});

/* ---------- Gifted Subs API ---------- */
app.get('/api/subs', (req, res) => {
  try {
    const subs = db.prepare('SELECT username, gifts FROM gifted_subs ORDER BY gifts DESC').all();
    res.json(subs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load subs' });
  }
});

app.post('/api/subs', express.json(), (req, res) => {
  if (getRole(req) !== 'staff') return res.status(403).json({ error: 'Unauthorized' });
  
  try {
    const { username, gifts } = req.body;
    const existing = db.prepare('SELECT id FROM gifted_subs WHERE username = ?').get(username);
    
    if (existing) {
      db.prepare('UPDATE gifted_subs SET gifts = ? WHERE username = ?').run(gifts, username);
    } else {
      db.prepare('INSERT INTO gifted_subs (username, gifts) VALUES (?, ?)').run(username, gifts);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save sub' });
  }
});

app.delete('/api/subs', (req, res) => {
  if (getRole(req) !== 'staff') return res.status(403).json({ error: 'Unauthorized' });
  
  try {
    db.prepare('DELETE FROM gifted_subs').run();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset subs' });
  }
});

/* ---------- Login Page ---------- */
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
const SPOTIFY_REDIRECT_URI = (process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/spotify/callback').trim();

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
    
    // Save to database
    db.prepare(`
      INSERT OR REPLACE INTO spotify_data (id, access_token, refresh_token, expires_at) 
      VALUES (1, ?, ?, ?)
    `).run(j.access_token, j.refresh_token, Date.now() + (j.expires_in || 3600) * 1000);
    
    res.redirect('/');
  } catch (e) {
    res.status(500).send('OAuth error: ' + e.message);
  }
});

async function ensureSpotifyAccessToken() {
  try {
    const row = db.prepare('SELECT * FROM spotify_data WHERE id = 1').get();
    if (!row || !row.refresh_token) return null;
    
    if (row.access_token && Date.now() < (row.expires_at || 0)) {
      return row.access_token;
    }

    // Refresh token
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token
    });
    const r = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${b64(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    if (!r.ok) {
      db.prepare('DELETE FROM spotify_data WHERE id = 1').run();
      return null;
    }
    const j = await r.json();
    db.prepare(`
      UPDATE spotify_data SET access_token = ?, expires_at = ? WHERE id = 1
    `).run(j.access_token, Date.now() + (j.expires_in || 3600) * 1000);
    
    return j.access_token;
  } catch (e) {
    return null;
  }
}

app.get('/api/spotify/now-playing', async (req, res) => {
  try {
    const at = await ensureSpotifyAccessToken();
    if (!at) return res.status(401).json({ error: 'not_connected' });
    
    const r = await fetch(NOW_PLAYING_URL, { headers: { Authorization: `Bearer ${at}` } });
    if (r.status === 204) return res.json({ playing: false });
    if (!r.ok) return res.status(r.status).json({ error: 'spotify_error' });
    
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/spotify/status', async (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM spotify_data WHERE id = 1').get();
    res.json({ 
      connected: !!row?.access_token,
      last_updated: row?.last_updated
    });
  } catch (e) {
    res.json({ connected: false });
  }
});

/* ---------- SPA fallback ---------- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (typeof fetch !== 'function') console.error('Node 18+ required');
app.listen(PORT, () => console.log('Server on :' + PORT));
