/* ============================
   main.js — Web Service client
============================ */

/* Helper: JSON API */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  try { return await res.json(); } catch { return null; }
}

/* Router */
function showSection(id) {
  document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

/* Login (server-first, demo fallback) */
async function doLogin(e) {
  if (e) e.preventDefault();
  const username = (document.getElementById('username')?.value || '').trim();
  const password = (document.getElementById('password')?.value || '').trim();

  try {
    await api('/api/auth/login', { method: 'POST', body: { username, password } });
    alert(`Logged in as ${username}`);
  } catch {
    alert(`(Demo) Logged in as ${username}`);
  }
  showSection('home');
  return false;
}

/* Twitch Embed */
const TWITCH_CHANNEL = 'ThatLegendJackk';
let twitchEmbed = null;

function initTwitch() {
  const el = document.getElementById('twitch-player');
  if (!el) return;
  if (typeof Twitch === 'undefined' || !Twitch.Embed) { setTimeout(initTwitch, 250); return; }
  if (twitchEmbed) return;

  const parentHost = location.hostname || 'localhost';
  twitchEmbed = new Twitch.Embed('twitch-player', {
    width: '100%',
    height: '100%',
    channel: TWITCH_CHANNEL,
    layout: 'video',
    muted: true,
    parent: [parentHost],
  });
}

/* Spotify Now Playing */
function saveSpotifyToken() {
  const box = document.getElementById('spotify_token');
  const t = (box?.value || '').trim();
  if (!t) { alert('Paste a Spotify Access Token first.'); return; }
  try {
    localStorage.setItem('spotify_access_token', t);
    alert('Spotify token saved in this browser.');
    updateSpotifyNowPlaying();
  } catch {
    alert('Could not save token in this browser.');
  }
}

let spotifyTimer = null;
async function updateSpotifyNowPlaying() {
  const el = document.getElementById('spotify-track');
  if (!el) return;

  let token = '';
  try { token = localStorage.getItem('spotify_access_token') || ''; } catch {}
  if (!token) { el.textContent = 'Spotify: Not Connected'; return; }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 204) {
      el.textContent = 'Spotify: Not Playing';
    } else if (!res.ok) {
      el.textContent = 'Spotify: Re-auth needed';
    } else {
      const data = await res.json();
      if (!data || !data.item) {
        el.textContent = 'Spotify: Not Playing';
      } else {
        const name = data.item.name;
        const artists = (data.item.artists || []).map(a => a.name).join(', ');
        el.textContent = `${name} — ${artists}`;
      }
    }
  } catch {
    el.textContent = 'Spotify: Error';
  }

  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotifyNowPlaying, 15000);
}

/* Discord Presence via env (/api/config) */
let DISCORD_USER_ID = '';

async function loadConfig() {
  try {
    const cfg = await api('/api/config'); // { discord_user_id }
    DISCORD_USER_ID = cfg?.discord_user_id || '';
    if (DISCORD_USER_ID) connectLanyard();
    else console.warn('No DISCORD_USER_ID set on server.');
  } catch (e) {
    console.warn('Failed to load /api/config:', e.message);
  }
}

function connectLanyard() {
  if (!DISCORD_USER_ID) return;
  const ws = new WebSocket('wss://lanyard.cnrad.dev/socket');
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_USER_ID } }));
  });
  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE') {
        const data = msg.d[DISCORD_USER_ID] || msg.d;
        const s = document.getElementById('discord-status');
        if (!s) return;
        const state = data?.discord_status || 'offline';
        s.textContent = 'Discord: ' + state.charAt(0).toUpperCase() + state.slice(1);
      }
    } catch {}
  });
  ws.addEventListener('close', () => setTimeout(connectLanyard, 3000));
}

/* Gifted Subs (local; server optional) */
const SUBS_KEY = 'gifted_subs_alltime_v1';

function lsGetSubs() { try { return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); } catch { return []; } }
function lsSetSubs(v) { try { localStorage.setItem(SUBS_KEY, JSON.stringify(v)); } catch {} }

async function loadSubs() {
  const box = document.getElementById('subs-list');
  if (!box) return;

  try {
    const subs = await api('/api/subs');
    renderSubsTable(subs, box);
    return;
  } catch {}

  renderSubsTable(lsGetSubs(), box);
}

function renderSubsTable(rows, box) {
  if (!rows || !rows.length) { box.innerHTML = '<p>No subs yet.</p>'; return; }
  const sorted = [...rows].sort((a, b) => (b.gifts || 0) - (a.gifts || 0));
  const tr = sorted.map((s, i) =>
    `<tr><td>${i + 1}</td><td>${s.username || s.user}</td><td>${s.gifts}</td></tr>`
  ).join('');
  box.innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Gifted</th></tr></thead><tbody>${tr}</tbody></table>`;
}

async function addOrUpdateSub() {
  const u = (document.getElementById('sub_user')?.value || '').trim();
  const n = parseInt(document.getElementById('sub_gifts')?.value || '0', 10);
  if (!u || isNaN(n)) return alert('Enter username and gifts.');

  try {
    await api('/api/subs', { method: 'POST', body: { username: u, gifts: n } });
    await loadSubs();
    return;
  } catch {}

  const list = lsGetSubs();
  const i = list.findIndex(x => (x.username || x.user || '').toLowerCase() === u.toLowerCase());
  if (i >= 0) {
    list[i].gifts = n;
    list[i].username = list[i].username || list[i].user || u;
  } else {
    list.push({ username: u, gifts: n });
  }
  lsSetSubs(list);
  await loadSubs();
}

async function resetSubs() {
  if (!confirm('Reset all gifted subs?')) return;

  try {
    const subs = await api('/api/subs');
    for (const r of subs) {
      await fetch(`/api/subs/${encodeURIComponent(r.username)}`, { method: 'DELETE', credentials: 'include' });
    }
    await loadSubs();
    return;
  } catch {}

  try { localStorage.removeItem(SUBS_KEY); } catch {}
  await loadSubs();
}

/* Twitch Bits (Helix via client creds) */
function saveTwitchCreds() {
  const idEl = document.getElementById('twitch_client_id');
  const tkEl = document.getElementById('twitch_access_token');
  const cid = (idEl?.value || '').trim();
  const tok = (tkEl?.value || '').trim();
  if (!cid || !tok) return alert('Paste both Client ID and Access Token');
  try {
    localStorage.setItem('twitch_client_id', cid);
    localStorage.setItem('twitch_access_token', tok);
    alert('Saved in this browser.');
  } catch {
    alert('Could not save in this browser.');
  }
}

async function helix(path, params = {}) {
  const cid = localStorage.getItem('twitch_client_id') || '';
  const tok = localStorage.getItem('twitch_access_token') || '';
  if (!cid || !tok) throw new Error('Missing Twitch credentials (client id / access token).');

  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, { headers: { 'Client-Id': cid, 'Authorization': `Bearer ${tok}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

async function getUsersMap(userIds) {
  if (!userIds.length) return new Map();
  const cid = localStorage.getItem('twitch_client_id') || '';
  const tok = localStorage.getItem('twitch_access_token') || '';

  const url = new URL('https://api.twitch.tv/helix/users');
  userIds.forEach(id => url.searchParams.append('id', id));

  const res = await fetch(url, { headers: { 'Client-Id': cid, 'Authorization': `Bearer ${tok}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  const { data } = await res.json();
  const map = new Map();
  for (const u of data) map.set(u.id, u);
  return map;
}

async function refreshBits() {
  const listEl = document.getElementById('bits-list');
  if (!listEl) return;

  const count = Math.min(Math.max(parseInt(document.getElementById('bits_count')?.value || '10', 10), 1), 10);
  const period = document.getElementById('bits_period')?.value || 'all';
  listEl.innerHTML = '<p>Loading…</p>';

  try {
    const { data: entries } = await helix('bits/leaderboard', { count, period });
    const ids = [...new Set(entries.map(e => e.user_id).filter(Boolean))];
    const usersMap = await getUsersMap(ids);

    if (!entries.length) { listEl.innerHTML = '<p>No results.</p>'; return; }

    const rows = entries.map(e => {
      const u = usersMap.get(e.user_id);
      const name = u?.display_name || u?.login || e.user_name || e.user_login || e.user_id;
      return `<tr><td>${e.rank}</td><td>${name}</td><td>${e.score}</td></tr>`;
    }).join('');

    listEl.innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Bits</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) {
    listEl.innerHTML = `
      <div style="padding:.6rem;background:rgba(0,0,0,.35);border-radius:8px">
        <p><strong>Error:</strong> ${err.message}</p>
        <p>Use a <em>User access token</em> with <code>bits:read</code> scope and matching Client ID.</p>
      </div>`;
  }
}

/* Boot */
window.addEventListener('DOMContentLoaded', () => {
  showSection('home');

  // Twitch embed
  const twitchScript = document.createElement('script');
  twitchScript.src = 'https://embed.twitch.tv/embed/v1.js';
  twitchScript.onload = () => initTwitch();
  document.head.appendChild(twitchScript);

  // Spotify poll
  updateSpotifyNowPlaying();

  // Discord presence (env)
  loadConfig();

  // Leaderboards (subs)
  loadSubs();

  // Prefill saved Twitch creds
  const idEl = document.getElementById('twitch_client_id');
  const tkEl = document.getElementById('twitch_access_token');
  if (idEl) idEl.value = localStorage.getItem('twitch_client_id') || '';
  if (tkEl) tkEl.value = localStorage.getItem('twitch_access_token') || '';
});
