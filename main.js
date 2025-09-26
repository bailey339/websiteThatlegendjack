/* ===== Utilities ===== */
function safe(fn){ try{ fn(); }catch(e){ console.warn(e); } }
function $(sel){ return document.querySelector(sel); }
function showSection(id){
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target){ target.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
}

/* ===== Auth (client-side demo) ===== */
const ADMIN_USER = "ThatLegendJack";
const ADMIN_PASS = "BooBear24/7";
let ADMIN_SECRET = '';

function setRole(r){ try{ localStorage.setItem('role', r);}catch{} }
function getRole(){ try{ return localStorage.getItem('role') || 'guest'; }catch{ return 'guest'; } }

function doLogout(){ setRole('guest'); location.href = '/'; }
function doLogin(e){
  e.preventDefault();
  const u = $('#username')?.value?.trim() || '';
  const p = $('#password')?.value?.trim() || '';
  if (u === ADMIN_USER && p === ADMIN_PASS) { setRole('staff'); location.href = '/'; }
  else alert('Invalid credentials');
}

function applyRoleUI(){
  const isStaff = getRole() === 'staff';
  safe(()=>$('#loginBtn').classList.toggle('hidden', isStaff));
  safe(()=>$('#logoutBtn').classList.toggle('hidden', !isStaff));
  safe(()=>$('#about-box').contentEditable = isStaff ? 'true' : 'false');
  safe(()=>$('#subs-controls').classList.toggle('hidden', !isStaff));
  safe(()=>$('#admin-controls').classList.toggle('hidden', !isStaff));
  
  if (isStaff) {
    loadSocialLinksForEdit();
  }
}

/* ===== Global About Me ===== */
async function loadAbout(){
  try {
    const r = await fetch('/api/about');
    const data = await r.json();
    if (data.html) $('#about-box').innerHTML = data.html;
  } catch {
    $('#about-box').innerHTML = '<p>Welcome to my stream!</p>';
  }
}

function toggleAboutEdit(enable=true){
  safe(()=>{ $('#about-box').contentEditable = enable ? 'true' : 'false'; });
  safe(()=>{ $('#about-save-row').classList.toggle('hidden', !enable); });
}

function saveAbout(){
  const html = $('#about-box')?.innerHTML || '';
  
  fetch('/api/about', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_SECRET}`
    },
    body: JSON.stringify({ html })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      toggleAboutEdit(false);
      alert('About saved globally');
    } else {
      alert('Failed to save');
    }
  })
  .catch(() => alert('Error saving'));
}

/* ===== Social Links Management ===== */
async function loadSocialLinks(){
  try {
    const r = await fetch('/api/social-links');
    const links = await r.json();
    
    // Update social link hrefs
    document.querySelectorAll('.social').forEach(link => {
      const platform = link.getAttribute('aria-label')?.toLowerCase();
      if (platform && links[platform]) {
        link.href = links[platform];
        link.id = `social-${platform}`;
      }
    });
  } catch (e) {
    console.warn('Failed to load social links:', e);
  }
}

async function loadSocialLinksForEdit(){
  try {
    const r = await fetch('/api/social-links');
    const links = await r.json();
    
    // Populate edit fields
    $('#social-twitch-url').value = links.twitch || '';
    $('#social-tiktok-url').value = links.tiktok || '';
    $('#social-kick-url').value = links.kick || '';
    $('#social-onlyfans-url').value = links.onlyfans || '';
  } catch (e) {
    console.warn('Failed to load social links for edit:', e);
  }
}

function updateSocialLinks(){
  const updates = {
    twitch: $('#social-twitch-url')?.value?.trim() || '',
    tiktok: $('#social-tiktok-url')?.value?.trim() || '',
    kick: $('#social-kick-url')?.value?.trim() || '',
    onlyfans: $('#social-onlyfans-url')?.value?.trim() || ''
  };
  
  fetch('/api/social-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_SECRET}`
    },
    body: JSON.stringify(updates)
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      alert('Social links updated globally');
      loadSocialLinks(); // Refresh display
    } else {
      alert('Failed to update social links');
    }
  })
  .catch(() => alert('Error updating social links'));
}

/* ===== Subs (local) ===== */
const SUBS_KEY = 'gifted_subs_alltime_v1';
function lsGetSubs(){ try{ return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); }catch{return [];} }
function lsSetSubs(v){ try{ localStorage.setItem(SUBS_KEY, JSON.stringify(v)); }catch{} }

function addOrUpdateSub(){
  const u = $('#sub_user')?.value?.trim();
  const n = parseInt($('#sub_gifts')?.value || '0', 10);
  if (!u || isNaN(n)) return alert('Enter username and gifts');
  const list = lsGetSubs();
  const i = list.findIndex(x => (x.username || x.user || '').toLowerCase() === u.toLowerCase());
  if (i >= 0) { list[i].gifts = n; list[i].username = list[i].username || list[i].user || u; }
  else { list.push({ username: u, gifts: n }); }
  lsSetSubs(list);
  renderSubs();
}

function resetSubs(){
  if (!confirm('Reset all gifted subs?')) return;
  try{ localStorage.removeItem(SUBS_KEY); }catch{}
  renderSubs();
}

function renderSubs(){
  const rows = lsGetSubs();
  const box = $('#subs-list');
  if (!box) return;
  if (!rows.length){ box.innerHTML = 'No subs yet.'; return; }
  const sorted = [...rows].sort((a,b)=>(b.gifts||0)-(a.gifts||0));
  box.innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Gifted</th></tr></thead><tbody>${
    sorted.map((s,i)=>`<tr><td>${i+1}</td><td>${s.username||s.user}</td><td>${s.gifts}</td></tr>`).join('')
  }</tbody></table>`;
}

/* ===== Twitch Embed ===== */
const TWITCH_CHANNEL = 'ThatLegendJackk';
let twitchEmbed = null;
function initTwitch(){
  const el = document.getElementById('twitch-player');
  if (!el) return;
  if (typeof Twitch === 'undefined' || !Twitch.Embed){ setTimeout(initTwitch, 250); return; }
  if (twitchEmbed) return;
  const parentHost = location.hostname || 'localhost';
  twitchEmbed = new Twitch.Embed('twitch-player', {
    width:'100%', height:'100%', channel: TWITCH_CHANNEL, layout:'video', muted:true,
    parent:[parentHost],
  });
}

/* ===== Twitch Bits (client creds) ===== */
function saveTwitchCreds(){
  const cid = $('#twitch_client_id')?.value?.trim();
  const tok = $('#twitch_access_token')?.value?.trim();
  if (!cid || !tok) return alert('Paste both Client ID and Access Token');
  try{
    localStorage.setItem('twitch_client_id', cid);
    localStorage.setItem('twitch_access_token', tok);
    alert('Saved.');
  }catch{ alert('Could not save.'); }
}

async function helix(path, params={}){
  const cid = localStorage.getItem('twitch_client_id') || '';
  const tok = localStorage.getItem('twitch_access_token') || '';
  if (!cid || !tok) throw new Error('Missing Twitch credentials.');
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  Object.entries(params).forEach(([k,v])=>{ if (v!==undefined && v!==null && v!=='') url.searchParams.set(k,v); });
  const res = await fetch(url, { headers: { 'Client-Id': cid, 'Authorization': `Bearer ${tok}` } });
  if (!res.ok){ const body = await res.text(); throw new Error(`${res.status} ${res.statusText}: ${body}`); }
  return res.json();
}

async function getUsersMap(userIds){
  if (!userIds.length) return new Map();
  const cid = localStorage.getItem('twitch_client_id') || '';
  const tok = localStorage.getItem('twitch_access_token') || '';
  const url = new URL('https://api.twitch.tv/helix/users');
  userIds.forEach(id => url.searchParams.append('id', id));
  const res = await fetch(url, { headers: { 'Client-Id': cid, 'Authorization': `Bearer ${tok}` } });
  if (!res.ok){ const body = await res.text(); throw new Error(`${res.status} ${res.statusText}: ${body}`); }
  const { data } = await res.json();
  const map = new Map(); for (const u of data) map.set(u.id, u);
  return map;
}

async function refreshBits(){
  const listEl = $('#bits-list'); if (!listEl) return;
  const count = Math.min(Math.max(parseInt($('#bits_count')?.value || '10', 10), 1), 10);
  const period = $('#bits_period')?.value || 'all';
  listEl.innerHTML = '<p>Loading…</p>';
  try{
    const { data: entries } = await helix('bits/leaderboard', { count, period });
    const ids = [...new Set(entries.map(e => e.user_id).filter(Boolean))];
    const usersMap = await getUsersMap(ids);
    if (!entries.length){ listEl.innerHTML = '<p>No results.</p>'; return; }
    const rows = entries.map(e=>{
      const u = usersMap.get(e.user_id);
      const name = u?.display_name || u?.login || e.user_name || e.user_login || e.user_id;
      return `<tr><td>${e.rank}</td><td>${name}</td><td>${e.score}</td></tr>`;
    }).join('');
    listEl.innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Bits</th></tr></thead><tbody>${rows}</tbody></table>`;
  }catch(err){
    listEl.innerHTML = `<div style="padding:.6rem;background:rgba(0,0,0,.35);border-radius:8px">
      <p><strong>Error:</strong> ${err.message}</p>
      <p>Use a <em>User access token</em> with <code>bits:read</code> scope and matching Client ID.</p>
    </div>`;
  }
}

/* ===== Discord Presence via Lanyard ===== */
let DISCORD_USER_ID = '';
async function apiGet(path){
  const r = await fetch(path, { credentials:'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

async function loadDiscordConfig(){
  try{
    const cfg = await apiGet('/api/config');
    DISCORD_USER_ID = cfg?.discord_user_id || '';
    ADMIN_SECRET = cfg?.admin_secret || 'dev_secret_change_me';
    if (!DISCORD_USER_ID){ console.warn('No DISCORD_USER_ID set on server.'); return; }
    connectLanyard();
  }catch(e){ console.warn('Failed to load /api/config:', e.message); }
}

function connectLanyard(){
  if (!DISCORD_USER_ID) return;
  const ws = new WebSocket('wss://lanyard.cnrad.dev/socket');
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_USER_ID } }));
  });
  ws.addEventListener('message', (event) => {
    try{
      const msg = JSON.parse(event.data);
      if (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE') {
        const data = msg.d[DISCORD_USER_ID] || msg.d;
        const state = data?.discord_status || 'offline';
        const s = $('#discord-status'); if (s) s.textContent = 'Discord: ' + state.charAt(0).toUpperCase() + state.slice(1);
      }
    }catch{}
  });
  ws.addEventListener('close', () => setTimeout(connectLanyard, 3000));
}

/* ===== Spotify Live Status ===== */
let spotifyTimer = null;
async function updateSpotify(){
  const el = $('#spotify-track');
  if (!el) return;
  
  try {
    const r = await fetch('/api/spotify/now-playing');
    
    if (r.status === 401) {
      el.innerHTML = '<button class="spotify-btn" onclick="connectSpotify()">Connect Spotify</button>';
      return;
    }
    
    if (r.ok) {
      const data = await r.json();
      
      if (data.error === 'not_connected' || !data || data.playing === false || !data.item) {
        el.innerHTML = '<button class="spotify-btn" onclick="connectSpotify()">Connect Spotify</button>';
      } else {
        const name = data.item?.name || 'Unknown';
        const artists = (data.item?.artists || []).map(a => a.name).join(', ');
        const fullText = `🎵 ${name} - ${artists}`;
        
        el.textContent = fullText;
        el.title = fullText;
        
        if (fullText.length > 25) {
          el.classList.add('scrolling');
        } else {
          el.classList.remove('scrolling');
        }
      }
    } else {
      el.innerHTML = '<button class="spotify-btn" onclick="connectSpotify()">Connect Spotify</button>';
    }
  } catch (error) {
    el.innerHTML = '<button class="spotify-btn" onclick="connectSpotify()">Connect Spotify</button>';
  }
  
  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotify, 10000);
}

function connectSpotify() {
  window.location.href = '/auth/spotify/login';
}

/* ===== Social Links Initialization ===== */
function initSocialLinks() {
  loadSocialLinks();
  
  if (getRole() === 'staff') {
    loadSocialLinksForEdit();
  }
}

/* ===== Boot ===== */
window.addEventListener('DOMContentLoaded', () => {
  // Robust nav
  const map = { about:'about', leaderboards:'leaderboards' };
  document.querySelectorAll('.nav-center .nav-box').forEach(btn=>{
    btn.addEventListener('click', () => {
      const id = [...btn.classList].find(c => map[c]);
      showSection(map[id] || 'home');
    });
  });

  showSection('home');
  applyRoleUI();
  loadAbout();
  initSocialLinks();
  renderSubs();

  // Twitch embed
  if (typeof Twitch === 'undefined') {
    const twitchScript = document.createElement('script');
    twitchScript.src = 'https://embed.twitch.tv/embed/v1.js';
    twitchScript.onload = () => initTwitch();
    document.head.appendChild(twitchScript);
  } else { initTwitch(); }

  // Discord + Spotify
  loadDiscordConfig();
  updateSpotify();

  // Prefill saved Twitch creds
  const idEl = $('#twitch_client_id');
  const tkEl = $('#twitch_access_token');
  if (idEl) idEl.value = localStorage.getItem('twitch_client_id') || '';
  if (tkEl) tkEl.value = localStorage.getItem('twitch_access_token') || '';

  // Extra: Bind buttons safely
  $('#bits_refresh_btn')?.addEventListener('click', e => { e.preventDefault(); refreshBits(); });
  $('#subs_add_btn')?.addEventListener('click', e => { e.preventDefault(); addOrUpdateSub(); });
  $('#subs_reset_btn')?.addEventListener('click', e => { e.preventDefault(); resetSubs(); });
  $('#twitch_save_btn')?.addEventListener('click', e => { e.preventDefault(); saveTwitchCreds(); });
});
