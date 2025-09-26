/* ===== Utilities ===== */
function safe(fn){ try{ fn(); }catch(e){ console.warn(e); } }
function $(sel){ return document.querySelector(sel); }
function showSection(id){
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target){ 
    target.classList.remove('hidden'); 
    window.scrollTo({top:0,behavior:'smooth'}); 
    // Hide back button on home page
    safe(() => {
      const backBtn = $('.back-btn');
      if (backBtn) backBtn.style.display = id === 'home' ? 'none' : 'block';
    });
  }
}

/* ===== Auth ===== */
async function doLogin(e){
  e.preventDefault();
  const u = $('#username')?.value?.trim() || '';
  const p = $('#password')?.value?.trim() || '';
  
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const result = await r.json();
    if (result.success) {
      location.href = '/';
    } else {
      alert('Invalid credentials');
    }
  } catch (e) {
    alert('Login failed: ' + e.message);
  }
}

async function doLogout(){
  try {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/';
  } catch (e) {
    location.href = '/';
  }
}

async function checkAuth(){
  try {
    const r = await fetch('/api/auth/status');
    const data = await r.json();
    applyRoleUI(data.role === 'staff');
  } catch (e) {
    applyRoleUI(false);
  }
}

function applyRoleUI(isStaff){
  safe(() => $('#loginBtn').classList.toggle('hidden', isStaff));
  safe(() => $('#logoutBtn').classList.toggle('hidden', !isStaff));
  safe(() => $('#about-box').contentEditable = isStaff ? 'true' : 'false'));
  safe(() => $('#subs-controls').classList.toggle('hidden', !isStaff));
  safe(() => $('#url-management').classList.toggle('hidden', !isStaff));
}

/* ===== Social URL Management ===== */
async function loadSocialUrls(){
  try {
    const r = await fetch('/api/social-urls');
    const urls = await r.json();
    safe(() => {
      $('#twitch_url').value = urls.twitch || '';
      $('#tiktok_url').value = urls.tiktok || '';
      $('#kick_url').value = urls.kick || '';
      $('#onlyfans_url').value = urls.onlyfans || '';
    });
    updateSocialLinks(urls);
  } catch (e) {
    console.warn('Failed to load social URLs:', e);
  }
}

async function saveSocialUrls(){
  const urls = {
    twitch: $('#twitch_url')?.value?.trim() || '',
    tiktok: $('#tiktok_url')?.value?.trim() || '',
    kick: $('#kick_url')?.value?.trim() || '',
    onlyfans: $('#onlyfans_url')?.value?.trim() || ''
  };
  
  try {
    const r = await fetch('/api/social-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(urls)
    });
    const result = await r.json();
    if (result.success) {
      updateSocialLinks(urls);
      alert('URLs saved successfully!');
    } else {
      alert('Failed to save URLs');
    }
  } catch (e) {
    alert('Error saving URLs: ' + e.message);
  }
}

function updateSocialLinks(urls){
  safe(() => {
    const twitchLink = document.querySelector('.social[aria-label="Twitch"]');
    const tiktokLink = document.querySelector('.social[aria-label="TikTok"]');
    const kickLink = document.querySelector('.social[aria-label="Kick"]');
    const onlyfansLink = document.querySelector('.social[aria-label="OnlyFans"]');
    
    if (twitchLink && urls.twitch) twitchLink.href = urls.twitch;
    if (tiktokLink && urls.tiktok) tiktokLink.href = urls.tiktok;
    if (kickLink && urls.kick) kickLink.href = urls.kick;
    if (onlyfansLink && urls.onlyfans) onlyfansLink.href = urls.onlyfans;
  });
}

/* ===== About Content ===== */
async function loadAbout(){
  try {
    const r = await fetch('/api/about');
    const data = await r.json();
    if (data.content && $('#about-box')) {
      $('#about-box').innerHTML = data.content;
    }
  } catch (e) {
    console.warn('Failed to load about content:', e);
  }
}

async function saveAbout(){
  const html = $('#about-box')?.innerHTML || '';
  try {
    const r = await fetch('/api/about', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: html })
    });
    const result = await r.json();
    if (result.success) {
      toggleAboutEdit(false);
      alert('About saved to database!');
    } else {
      alert('Failed to save about content');
    }
  } catch (e) {
    alert('Error saving about: ' + e.message);
  }
}

function toggleAboutEdit(enable=true){
  safe(() => { $('#about-box').contentEditable = enable ? 'true' : 'false'; });
  safe(() => { $('#about-save-row').classList.toggle('hidden', !enable); });
}

/* ===== Gifted Subs ===== */
async function loadSubs(){
  try {
    const r = await fetch('/api/subs');
    const subs = await r.json();
    renderSubs(subs);
  } catch (e) {
    console.warn('Failed to load subs:', e);
  }
}

async function addOrUpdateSub(){
  const u = $('#sub_user')?.value?.trim();
  const n = parseInt($('#sub_gifts')?.value || '0', 10);
  if (!u || isNaN(n)) return alert('Enter username and gifts');
  
  try {
    const r = await fetch('/api/subs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, gifts: n })
    });
    const result = await r.json();
    if (result.success) {
      $('#sub_user').value = '';
      $('#sub_gifts').value = '';
      loadSubs();
    } else {
      alert('Failed to save sub');
    }
  } catch (e) {
    alert('Error saving sub: ' + e.message);
  }
}

async function resetSubs(){
  if (!confirm('Reset all gifted subs?')) return;
  try {
    const r = await fetch('/api/subs', { method: 'DELETE' });
    const result = await r.json();
    if (result.success) {
      loadSubs();
    } else {
      alert('Failed to reset subs');
    }
  } catch (e) {
    alert('Error resetting subs: ' + e.message);
  }
}

function renderSubs(subs){
  const box = $('#subs-list');
  if (!box) return;
  if (!subs.length){ box.innerHTML = 'No subs yet.'; return; }
  box.innerHTML = `<table><thead><tr><th>#</th><th>User</th><th>Gifted</th></tr></thead><tbody>${
    subs.map((s,i)=>`<tr><td>${i+1}</td><td>${s.username}</td><td>${s.gifts}</td></tr>`).join('')
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

/* ===== Twitch Bits ===== */
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

/* ===== Discord Presence ===== */
let DISCORD_USER_ID = '';
async function apiGet(path){
  const r = await fetch(path, { credentials:'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

async function loadDiscordConfig(){
  try{
    const cfg = await apiGet('/api/config');
    DISCORD_USER_ID = cfg?.discord_user_id || '';
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

/* ===== Spotify ===== */
function connectSpotify(){ window.location.href = '/auth/spotify/login'; }

let spotifyTimer = null;
async function updateSpotify(){
  const el = $('#spotify-track');
  const connectBox = $('#spotify-connect');
  if (!el) return;
  
  try {
    const r = await fetch('/api/spotify/now-playing', { credentials:'include' });
    if (r.status === 401){ 
      el.textContent = 'Spotify: Not Connected'; 
      connectBox?.classList.remove('hidden'); 
    } else if (r.ok){
      const data = await r.json();
      if (!data || data.playing === false || !data.item){
        el.textContent = 'Spotify: Not Playing';
      } else {
        const name = data.item?.name || 'Unknown';
        const artists = (data.item?.artists || []).map(a => a.name).join(', ') || 'Unknown Artist';
        el.textContent = `${name} — ${artists}`;
        el.title = `${name} by ${artists}`;
      }
      connectBox?.classList.add('hidden');
    } else {
      el.textContent = 'Spotify: Not Connected';
      connectBox?.classList.remove('hidden');
    }
  } catch {
    el.textContent = 'Spotify: Not Connected';
    connectBox?.classList.remove('hidden');
  }
  
  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotify, 15000);
}

async function checkSpotifyStatus(){
  try {
    const r = await fetch('/api/spotify/status');
    const data = await r.json();
    if (data.connected) {
      $('#spotify-connect').classList.add('hidden');
    }
  } catch (e) {}
}

/* ===== Navigation ===== */
function setupNavigation() {
  // Remove home button functionality from nav boxes
  const navBoxes = document.querySelectorAll('.nav-center .nav-box');
  navBoxes.forEach(box => {
    box.onclick = function() {
      const id = this.getAttribute('data-section');
      if (id) {
        showSection(id);
      }
    };
  });

  // Back button
  const backBtn = $('.back-btn');
  if (backBtn) {
    backBtn.onclick = function() {
      showSection('home');
    };
  }
}

/* ===== Boot ===== */
window.addEventListener('DOMContentLoaded', () => {
  // Setup navigation
  setupNavigation();
  
  // Start with home section
  showSection('home');
  
  // Load data
  checkAuth();
  loadAbout();
  loadSubs();
  loadSocialUrls();
  checkSpotifyStatus();

  // Twitch embed
  if (typeof Twitch === 'undefined') {
    const twitchScript = document.createElement('script');
    twitchScript.src = 'https://embed.twitch.tv/embed/v1.js';
    twitchScript.onload = () => initTwitch();
    document.head.appendChild(twitchScript);
  } else { 
    initTwitch(); 
  }

  // Discord + Spotify
  loadDiscordConfig();
  updateSpotify();

  // Prefill Twitch creds
  const idEl = $('#twitch_client_id');
  const tkEl = $('#twitch_access_token');
  if (idEl) idEl.value = localStorage.getItem('twitch_client_id') || '';
  if (tkEl) tkEl.value = localStorage.getItem('twitch_access_token') || '';

  // Bind buttons
  $('#bits_refresh_btn')?.addEventListener('click', e => { e.preventDefault(); refreshBits(); });
  $('#subs_add_btn')?.addEventListener('click', e => { e.preventDefault(); addOrUpdateSub(); });
  $('#subs_reset_btn')?.addEventListener('click', e => { e.preventDefault(); resetSubs(); });
  $('#twitch_save_btn')?.addEventListener('click', e => { e.preventDefault(); saveTwitchCreds(); });
  $('#save_urls_btn')?.addEventListener('click', e => { e.preventDefault(); saveSocialUrls(); });
  
  // Spotify connect button
  const spotifyConnectBtn = document.querySelector('.spotify-btn');
  if (spotifyConnectBtn) {
    spotifyConnectBtn.onclick = connectSpotify;
  }
});
