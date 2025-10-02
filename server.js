// server.js — Express web service with SQLite database
try { (await import('dotenv')).config(); } catch (_) {}

import path from 'node:path';
import express from 'express';
import cookieSession from 'cookie-session';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Database setup
let db;
async function initDatabase() {
  db = await open({
    filename: './site.db',
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS staff_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS gifted_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      gifts INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS spotify_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('Database initialized');
}

initDatabase();

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
  res.json({ 
    discord_user_id: process.env.DISCORD_USER_ID || null,
    admin_secret: process.env.ADMIN_SECRET || 'dev_secret_change_me',
    twitch_client_id: process.env.TWITCH_CLIENT_ID || '',
    staff_logins: process.env.STAFF_LOGINS ? JSON.parse(process.env.STAFF_LOGINS) : []
  });
});

/* ---------- Staff Authentication ---------- */
const STAFF_LOGINS = process.env.STAFF_LOGINS ? JSON.parse(process.env.STAFF_LOGINS) : [
  { username: "ThatLegendJack", password: "BooBear24/7", role: "admin" }
];

function authenticateStaff(username, password) {
  return STAFF_LOGINS.find(staff => 
    staff.username === username && staff.password === password
  );
}

app.post('/api/staff/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  const staff = authenticateStaff(username, password);
  
  if (staff) {
    req.session.staff = {
      username: staff.username,
      role: staff.role,
      loggedIn: true
    };
    res.json({ success: true, user: staff.username, role: staff.role });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/staff/logout', (req, res) => {
  req.session.staff = null;
  res.json({ success: true });
});

app.get('/api/staff/check', (req, res) => {
  if (req.session.staff?.loggedIn) {
    res.json({ loggedIn: true, user: req.session.staff.username, role: req.session.staff.role });
  } else {
    res.json({ loggedIn: false });
  }
});

/* ---------- Staff Chat Messages ---------- */
app.get('/api/staff/messages', async (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    const messages = await db.all(
      'SELECT username, message, timestamp FROM staff_messages ORDER BY timestamp DESC LIMIT 50'
    );
    res.json(messages.reverse()); // Return oldest first
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff/messages', express.json(), async (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  try {
    await db.run(
      'INSERT INTO staff_messages (username, message) VALUES (?, ?)',
      [req.session.staff.username, message.trim()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Gifted Subs (Database) ---------- */
app.get('/api/subs', async (req, res) => {
  try {
    const subs = await db.all(
      'SELECT username, gifts FROM gifted_subs ORDER BY gifts DESC, updated_at DESC'
    );
    res.json(subs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subs', express.json(), async (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  const { username, gifts } = req.body;
  if (!username || gifts === undefined) {
    return res.status(400).json({ error: 'Username and gifts required' });
  }
  
  try {
    const existing = await db.get(
      'SELECT * FROM gifted_subs WHERE username = ?',
      [username.toLowerCase()]
    );
    
    if (existing) {
      await db.run(
        'UPDATE gifted_subs SET gifts = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
        [gifts, username.toLowerCase()]
      );
    } else {
      await db.run(
        'INSERT INTO gifted_subs (username, gifts) VALUES (?, ?)',
        [username.toLowerCase(), gifts]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subs', async (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    await db.run('DELETE FROM gifted_subs');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Global About Me ---------- */
let globalAboutHTML = process.env.DEFAULT_ABOUT_HTML || '<p>Welcome to my stream! This is the About Me section.</p>';

app.get('/api/about', (req, res) => {
  res.json({ html: globalAboutHTML });
});

app.post('/api/about', express.json(), (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  globalAboutHTML = req.body.html || globalAboutHTML;
  res.json({ success: true });
});

/* ---------- Social Links ---------- */
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
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  socialLinks = { ...socialLinks, ...req.body };
  res.json({ success: true });
});

/* ---------- Partnered Servers ---------- */
app.get('/api/partnered-servers', (req, res) => {
  try {
    const partneredServers = process.env.PARTNERED_SERVERS ? JSON.parse(process.env.PARTNERED_SERVERS) : [];
    res.json(partneredServers);
  } catch (error) {
    console.error('Error parsing partnered servers:', error);
    res.status(500).json({ error: 'Failed to load partnered servers' });
  }
});

/* ---------- Spotify OAuth (Server-wide) ---------- */
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = (process.env.SPOTIFY_REDIRECT_URI || `${process.env.BASE_URL || 'https://thatlegendjack.onrender.com'}/auth/spotify/callback`).trim();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

// Get current Spotify token from database
async function getSpotifyToken() {
  try {
    const token = await db.get(
      'SELECT access_token, refresh_token, expires_at FROM spotify_tokens ORDER BY id DESC LIMIT 1'
    );
    return token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

// Save Spotify token to database
async function saveSpotifyToken(access_token, refresh_token, expires_in) {
  try {
    const expires_at = new Date(Date.now() + (expires_in * 1000)).toISOString();
    
    // Delete old tokens
    await db.run('DELETE FROM spotify_tokens');
    
    // Insert new token
    await db.run(
      'INSERT INTO spotify_tokens (access_token, refresh_token, expires_at) VALUES (?, ?, ?)',
      [access_token, refresh_token, expires_at]
    );
    
    console.log('Spotify token saved to database');
  } catch (error) {
    console.error('Error saving Spotify token:', error);
  }
}

// Refresh Spotify token if expired
async function refreshSpotifyToken(refresh_token) {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token
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
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const tokenData = await response.json();
    await saveSpotifyToken(
      tokenData.access_token,
      tokenData.refresh_token || refresh_token,
      tokenData.expires_in
    );
    
    return tokenData.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return null;
  }
}

// Ensure we have a valid access token
async function ensureValidSpotifyToken() {
  try {
    const token = await getSpotifyToken();
    
    if (!token) {
      return null; // No token available
    }
    
    // Check if token is expired (with 1 minute buffer)
    const isExpired = new Date(token.expires_at) < new Date(Date.now() + 60000);
    
    if (isExpired) {
      console.log('Spotify token expired, refreshing...');
      const newAccessToken = await refreshSpotifyToken(token.refresh_token);
      return newAccessToken;
    }
    
    return token.access_token;
  } catch (error) {
    console.error('Error ensuring valid Spotify token:', error);
    return null;
  }
}

// Spotify authentication routes
app.get('/auth/spotify/login', (req, res) => {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    return res.status(500).send('Spotify credentials missing from server environment');
  }
  
  const state = Math.random().toString(36).slice(2);
  req.session.spotify_state = state;
  
  const scope = 'user-read-currently-playing user-read-playback-state';
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state,
    show_dialog: 'false'
  });
  
  res.redirect(`${SPOTIFY_AUTH_URL}?${q}`);
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
      const errorText = await response.text();
      throw new Error(`Spotify token error: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    
    // Save token to database (shared for all users)
    await saveSpotifyToken(
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in
    );
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spotify Connected</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1DB954; color: white; }
          .message { background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>✅ Spotify Connected Successfully!</h1>
          <p>The Spotify connection is now active for everyone visiting the site.</p>
          <p>You can close this window and return to the stream.</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #191414; color: white; border: none; border-radius: 5px; cursor: pointer;">Close Window</button>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Spotify callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spotify Connection Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #EF0107; color: white; }
          .message { background: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>❌ Spotify Connection Failed</h1>
          <p>There was an error connecting to Spotify. Please try again.</p>
          <p>Error: ${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Check Spotify connection status
app.get('/api/spotify/status', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const isConnected = !!(token && new Date(token.expires_at) > new Date());
    
    res.json({
      connected: isConnected,
      expires_at: token?.expires_at || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect Spotify (staff only)
app.delete('/api/spotify/disconnect', async (req, res) => {
  if (!req.session.staff?.loggedIn) {
    return res.status(401).json({ error: 'Not authorized' });
  }
  
  try {
    await db.run('DELETE FROM spotify_tokens');
    res.json({ success: true, message: 'Spotify disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Now playing endpoint (shared for all users)
app.get('/api/spotify/now-playing', async (req, res) => {
  try {
    const accessToken = await ensureValidSpotifyToken();
    
    if (!accessToken) {
      return res.status(401).json({ error: 'not_connected' });
    }
    
    const response = await fetch(NOW_PLAYING_URL, { 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });
    
    if (response.status === 204) {
      return res.json({ playing: false });
    }
    
    if (!response.ok) {
      return res.status(401).json({ error: 'not_connected' });
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Spotify now-playing error:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Twitch Bits Leaderboard ---------- */
app.get('/api/twitch/bits', async (req, res) => {
  const { count = 10, period = 'all' } = req.query;
  
  try {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
    
    if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) {
      return res.status(501).json({ error: 'Twitch credentials not configured' });
    }
    
    const url = new URL('https://api.twitch.tv/helix/bits/leaderboard');
    url.searchParams.set('count', Math.min(Math.max(parseInt(count), 1), 10));
    url.searchParams.set('period', period);
    
    const response = await fetch(url, {
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${TWITCH_ACCESS_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Twitch API error: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ---------- Login Page ---------- */
app.get('/login.html', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Staff Login - ThatLegendJack</title>
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
  <h1>Staff Login</h1>
  <form onsubmit="return doStaffLogin(event)">
    <input id="staffUsername" placeholder="Username" required/>
    <input id="staffPassword" type="password" placeholder="Password" required/>
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
app.listen(PORT, () => console.log('Server running on port:' + PORT));
