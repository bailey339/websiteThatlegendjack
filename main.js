/* ========= SPA Router ========= */
function showSection(id) {
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  // keep admin/staff panels visible state
  showAuth(); showPanels();
}

/* ========= Users/session helpers (localStorage) ========= */
function loadUsers(){ try{return JSON.parse(localStorage.getItem('users')||'[]')}catch{return[]} }
function saveUsers(arr){ localStorage.setItem('users', JSON.stringify(arr)); }
function isLoggedIn(){ return localStorage.getItem('staffSession')==='true'; }
function role(){ return localStorage.getItem('staffRole')||'viewer'; }

/* Seed admin user once if none exist */
(function seedAdmin(){
  const existing = loadUsers();
  if (!existing.some(u => u.role === 'admin')) {
    existing.push({ username: "ThatLegendJack", password: "BooBear24/7", role: "admin" });
    saveUsers(existing);
  }
})();

/* ========= Auth UI ========= */
function showAuth(){
  const box=document.getElementById('authBox');
  if(!box) return;
  if(isLoggedIn()){
    const name=localStorage.getItem('staffName')||'staff';
    box.innerHTML=`<button onclick="logout()">Logout (${name})</button>`;
  }else{
    box.innerHTML=`<a href="#" onclick="showSection('login')">Login</a>`;
  }
}
function showPanels(){
  const staff = isLoggedIn();
  const r = role();
  const sp = document.getElementById('staffPanel');
  const ap = document.getElementById('adminPanel');
  if (sp) sp.style.display = staff ? 'block':'none';
  if (ap) ap.style.display = (staff && r==='admin') ? 'block':'none';
  if(staff){
    const who = document.getElementById('who');
    const badge = document.getElementById('roleBadge');
    if (who) who.textContent = localStorage.getItem('staffName')||'staff';
    if (badge) badge.textContent = r;
    prefillInputs();
    if(r==='admin') renderUsers();
  }
}

/* ========= Login page logic ========= */
(function wireLogin(){
  const btn = document.getElementById('go');
  if (!btn) return;
  btn.onclick = () => {
    const u = document.getElementById('u').value.trim();
    const p = document.getElementById('p').value.trim();
    const msg = document.getElementById('msg');
    const user = loadUsers().find(x => x.username===u && x.password===p);
    if(user){
      localStorage.setItem('staffSession','true');
      localStorage.setItem('staffName',user.username);
      localStorage.setItem('staffRole',user.role);
      if (msg) msg.textContent="✅ Logged in.";
      showAuth(); showPanels();
      showSection('home');
    }else{
      if (msg) msg.textContent="❌ Invalid credentials";
    }
  };
})();

function logout(){
  localStorage.removeItem('staffSession');
  localStorage.removeItem('staffName');
  localStorage.removeItem('staffRole');
  showAuth(); showPanels();
}

/* ========= Admin user management ========= */
function renderUsers(){
  const list=document.getElementById('userList');
  if (!list) return;
  const users=loadUsers();
  list.innerHTML='';
  users.forEach((u,i)=>{
    const row=document.createElement('div');
    row.style.display='flex'; row.style.justifyContent='space-between'; row.style.margin='.3rem 0';
    row.innerHTML=`<div>${u.username} <span class="badge">${u.role}</span></div>
      <button onclick="removeUser(${i})" style="background:#444;color:#fff;border:none;border-radius:8px;padding:.35rem .6rem">Remove</button>`;
    if(u.role==='admin') row.querySelector('button').disabled=true;
    list.appendChild(row);
  });
}
function addStaff(){
  if(!isLoggedIn() || role()!=='admin') return;
  const u=document.getElementById('newUser').value.trim();
  const p=document.getElementById('newPass').value.trim();
  if(!u||!p) return;
  const users=loadUsers();
  if(users.some(x=>x.username===u)) return alert('User already exists.');
  users.push({username:u,password:p,role:'staff'});
  saveUsers(users);
  document.getElementById('newUser').value=''; document.getElementById('newPass').value='';
  renderUsers();
}
function removeUser(idx){
  if(!isLoggedIn() || role()!=='admin') return;
  const users=loadUsers();
  users.splice(idx,1);
  saveUsers(users);
  renderUsers();
}

/* ========= Social links + images ========= */
const socialKeys=['twitch','tiktok','kick','onlyfans'];
function applyLinks(){
  socialKeys.forEach(k=>{
    const url = localStorage.getItem('link_'+k);
    const a = document.getElementById('link_'+k);
    if(url && a) a.href = url;
  });
}
function applyImages(){
  ['twitch','tiktok','kick'].forEach(k=>{
    const saved = localStorage.getItem('img_'+k);
    const img = document.getElementById('img_'+k);
    if(saved && img) img.src = saved;
  });
}
function saveLink(key){
  if(!isLoggedIn()) return;
  const el = document.getElementById('in_'+key);
  const a = document.getElementById('link_'+key);
  if(!el || !a) return;
  const val=el.value.trim(); if(!val) return;
  localStorage.setItem('link_'+key,val);
  a.href=val;
}
function saveImg(key){
  if(!isLoggedIn()) return;
  const el=document.getElementById('imgurl_'+key);
  const img=document.getElementById('img_'+key);
  if(!el || !img) return;
  const val=el.value.trim(); if(!val) return;
  localStorage.setItem('img_'+key, val);
  img.src = val;
}

/* ========= Discord status text ========= */
function saveText(targetId,inputId){
  if(!isLoggedIn()) return;
  const el=document.getElementById(inputId);
  const target=document.getElementById(targetId);
  if(!el || !target) return;
  const val=el.value.trim(); if(!val) return;
  localStorage.setItem(targetId,val);
  target.textContent=val;
}

/* ========= Prefill inputs ========= */
function prefillInputs(){
  socialKeys.forEach(k=>{
    const el=document.getElementById('in_'+k);
    const a=document.getElementById('link_'+k);
    if(el && a){ el.value = localStorage.getItem('link_'+k) || a.href; }
  });
  ['twitch','tiktok','kick'].forEach(k=>{
    const el=document.getElementById('imgurl_'+k);
    if(el) el.value = localStorage.getItem('img_'+k) || "";
  });
  const st = localStorage.getItem('discord-status');
  const ds = document.getElementById('discord-status');
  const inD = document.getElementById('in_discord');
  if (st && ds) ds.textContent = st;
  if (inD) inD.value = st || (ds ? ds.textContent : '');
  const tokBox = document.getElementById('spotify_token');
  if (tokBox) tokBox.value = localStorage.getItem('spotify_access_token') || "";
}

/* ========= Spotify Now Playing ========= */
function saveSpotifyToken(){
  if(!isLoggedIn()) return;
  const box = document.getElementById('spotify_token');
  if (!box) return;
  const t = (box.value || "").trim();
  if(!t) return;
  localStorage.setItem('spotify_access_token', t);
  updateSpotifyNowPlaying(true);
}
let spotifyTimer = null;
async function fetchSpotifyCurrentlyPlaying(token){
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  if(res.status === 204) return null;
  if(!res.ok){
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}
async function updateSpotifyNowPlaying(){
  const token = localStorage.getItem('spotify_access_token') || '';
  const el = document.getElementById('spotify-track');
  if(!el) return;
  if(!token){
    el.textContent = 'Spotify: Not Connected';
  } else {
    try{
      const data = await fetchSpotifyCurrentlyPlaying(token);
      if(!data || !data.item){
        el.textContent = 'Spotify: Not Playing';
      }else{
        const name = data.item.name;
        const artists = (data.item.artists||[]).map(a=>a.name).join(', ');
        el.textContent = `${name} — ${artists}`;
      }
    }catch(err){
      console.error('Spotify error:', err);
      el.textContent = 'Spotify: Re-auth needed';
    }
  }
  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotifyNowPlaying, 15000);
}

/* ========= Twitch Embed + Live status (Helix) ========= */
const TWITCH_CHANNEL  = 'ThatLegendJackk';
const TW_LS_CLIENT_ID = 'twitch_client_id';
const TW_LS_TOKEN     = 'twitch_access_token';
let twitchPlayer = null;
let liveCheckTimer = null;

function createTwitchPlayer(){
  if(twitchPlayer) return twitchPlayer;
  const host = location.hostname || 'localhost';
  if (typeof Twitch === 'undefined' || !Twitch.Embed) return null;
  twitchPlayer = new Twitch.Embed("twitch-player", {
    width: "100%", height: "100%",
    channel: TWITCH_CHANNEL, layout: "video", muted: true,
    parent: [host]
  });
  return twitchPlayer;
}
async function helixGet(path, params = {}){
  const CLIENT_ID = localStorage.getItem(TW_LS_CLIENT_ID) || '';
  const TOKEN     = localStorage.getItem(TW_LS_TOKEN) || '';
  if(!CLIENT_ID || !TOKEN) return { missingCreds:true };
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  Object.entries(params).forEach(([k,v])=>{ if(v!==undefined && v!==null && v!=='') url.searchParams.set(k,v); });
  const res = await fetch(url, { headers: { 'Client-Id': CLIENT_ID, 'Authorization': `Bearer ${TOKEN}` } });
  if(!res.ok){ const body = await res.text(); throw new Error(`${res.status} ${res.statusText}: ${body}`); }
  return res.json();
}
function setOfflineOverlay(show){
  const el = document.getElementById('twitch-offline');
  if(!el) return;
  if(show) el.classList.add('offline-show'); else el.classList.remove('offline-show');
}
async function updateTwitchLiveStatus(){
  try{
    const result = await helixGet('streams', { user_login: TWITCH_CHANNEL });
    if(result && result.missingCreds){
      createTwitchPlayer();
      setOfflineOverlay(false); // no creds → just show player
    } else {
      const live = Array.isArray(result.data) && result.data.length > 0;
      createTwitchPlayer();
      setOfflineOverlay(!live);
    }
  }catch(err){
    console.error('Twitch live check error:', err);
    setOfflineOverlay(true);
  }finally{
    clearTimeout(liveCheckTimer);
    liveCheckTimer = setTimeout(updateTwitchLiveStatus, 60000);
  }
}

/* ========= Leaderboards: Bits + Gifted Subs ========= */
/* Bits credentials persistence */
const LS_CLIENT_ID = 'twitch_client_id';
const LS_TOKEN     = 'twitch_access_token';
let CLIENT_ID = "";
let TOKEN     = "";

function loadBitsCreds(){
  CLIENT_ID = localStorage.getItem(LS_CLIENT_ID) || "";
  TOKEN     = localStorage.getItem(LS_TOKEN) || "";
  const ciEl = document.getElementById('ci');
  const tkEl = document.getElementById('tk');
  if (ciEl) ciEl.value = CLIENT_ID;
  if (tkEl) tkEl.value = TOKEN;
}
function saveBitsCreds(ci, tk){
  localStorage.setItem(LS_CLIENT_ID, ci);
  localStorage.setItem(LS_TOKEN, tk);
  CLIENT_ID = ci; TOKEN = tk;
}

async function helix(path, params = {}) {
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url, { headers: { "Client-Id": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` } });
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status} ${res.statusText}: ${body}`); }
  return res.json();
}
async function getUsersMap(userIds) {
  if (!userIds.length) return new Map();
  const url = new URL("https://api.twitch.tv/helix/users");
  userIds.forEach(id => url.searchParams.append("id", id));
  const res = await fetch(url, { headers: { "Client-Id": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(await res.text());
  const { data } = await res.json();
  const map = new Map();
  for (const u of data) map.set(u.id, u);
  return map;
}
async function updateBitsLeaderboard() {
  const setup = document.getElementById('bitsSetup');
  const tbody = document.querySelector("#bits-table tbody");
  if (!tbody) return;
  if (!(CLIENT_ID && TOKEN)) {
    if (setup) setup.style.display = 'block';
    tbody.innerHTML = `<tr><td colspan="3">Please add your <strong>Client ID</strong> and <strong>Access Token</strong> above.</td></tr>`;
    return;
  }
  try {
    const { data: entries } = await helix("bits/leaderboard", { count: 10, period: "all" });
    const ids = [...new Set(entries.map(e => e.user_id).filter(Boolean))];
    const usersMap = await getUsersMap(ids);
    tbody.innerHTML = entries.map(e => {
      const u = usersMap.get(e.user_id);
      const name = u?.display_name || u?.login || e.user_id;
      return `<tr><td>${e.rank}</td><td>${name}</td><td>${(+e.score).toLocaleString()}</td></tr>`;
    }).join('');
    if (setup) setup.style.display = 'none';
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    if (setup) setup.style.display = 'block';
    tbody.innerHTML = `<tr><td colspan="3">Error: ${err.message}</td></tr>`;
  }
}
(function wireBitsSetup(){
  const apply = document.getElementById('apply');
  const clear = document.getElementById('clear');
  if (apply) apply.addEventListener('click', ()=>{
    const ci = (document.getElementById('ci').value || "").trim();
    const tk = (document.getElementById('tk').value || "").trim();
    if(!ci || !tk){ alert("Please paste both CLIENT_ID and ACCESS TOKEN (bits:read)."); return; }
    saveBitsCreds(ci, tk);
    updateBitsLeaderboard();
  });
  if (clear) clear.addEventListener('click', ()=>{
    if(!confirm("Clear saved Client ID and Access Token from this browser?")) return;
    localStorage.removeItem(LS_CLIENT_ID);
    localStorage.removeItem(LS_TOKEN);
    CLIENT_ID = ""; TOKEN = "";
    const ciEl=document.getElementById('ci'); const tkEl=document.getElementById('tk');
    if (ciEl) ciEl.value = ""; if (tkEl) tkEl.value = "";
    const setup = document.getElementById('bitsSetup');
    if (setup) setup.style.display = 'block';
    updateBitsLeaderboard();
  });
})();

/* Gifted Subs (admin editable) */
const SUBS_KEY='giftedSubsTable';
function loadSubs(){ try{return JSON.parse(localStorage.getItem(SUBS_KEY)||'[]')}catch{return[]} }
function saveSubs(arr){ localStorage.setItem(SUBS_KEY, JSON.stringify(arr)); }
function renderSubs(){
  const body=document.getElementById('subs-body');
  if (!body) return;
  const data=loadSubs().sort((a,b)=>b.count-a.count);
  body.innerHTML='';
  if(!data.length){ body.innerHTML='<tr><td colspan="4">No entries yet</td></tr>'; }
  const isAdmin = isLoggedIn() && role()==='admin';
  data.forEach((row,i)=>{
    const safeUser = String(row.user).replace(/'/g,"&#39;");
    body.insertAdjacentHTML('beforeend',
      `<tr><td>${i+1}</td><td>${row.user}</td><td>${row.count}</td>
       <td class="adminCol">${isAdmin?`<button onclick="removeSub('${safeUser}')">Remove</button>`:''}</td></tr>`);
  });
  document.querySelectorAll('.adminCol').forEach(td=> td.style.display=(isLoggedIn() && role()==='admin')?'table-cell':'none');
  const sa = document.getElementById('subsAdmin');
  if (sa) sa.style.display = (isLoggedIn() && role()==='admin') ? 'block' : 'none';
}
function addSub(){
  if(!(isLoggedIn() && role()==='admin')) return;
  const u=document.getElementById('subUser').value.trim();
  const c=parseInt(document.getElementById('subCount').value,10);
  if(!u||isNaN(c)) return;
  const d=loadSubs();
  const idx=d.findIndex(x=>x.user.toLowerCase()===u.toLowerCase());
  if(idx>-1){ d[idx].count=c } else { d.push({user:u,count:c}) }
  saveSubs(d);
  document.getElementById('subUser').value=''; document.getElementById('subCount').value='';
  renderSubs();
}
function removeSub(user){
  if(!(isLoggedIn() && role()==='admin')) return;
  const d=loadSubs().filter(x=>x.user!==user);
  saveSubs(d);
  renderSubs();
}
function clearSubs(){
  if(!(isLoggedIn() && role()==='admin')) return;
  if(confirm('Clear all gifted subs?')){ saveSubs([]); renderSubs(); }
}

/* ========= About content (staff editable) ========= */
const ABOUT_KEY='about_content';
function loadAbout(){
  const val=localStorage.getItem(ABOUT_KEY) || "Welcome to my About page!";
  const view=document.getElementById('view');
  if (view) view.textContent=val;
}
function saveAbout(){
  if(!isLoggedIn()) return;
  const txt=document.getElementById('aboutTxt');
  if(!txt) return;
  const v=txt.value.trim();
  if(!v) return;
  localStorage.setItem(ABOUT_KEY,v);
  loadAbout();
  alert('Saved.');
}
function setupAbout(){
  loadAbout();
  const staff = isLoggedIn();
  const ed = document.getElementById('editor');
  const txt = document.getElementById('aboutTxt');
  if (ed) ed.style.display = staff ? 'block':'none';
  if (txt && staff) txt.value = localStorage.getItem(ABOUT_KEY)||'';
}

/* ========= Boot ========= */
window.addEventListener('DOMContentLoaded', () => {
  // Default route
  showSection('home');

  // Socials & images
  applyLinks();
  applyImages();

  // Panels/auth
  showAuth();
  showPanels();

  // Saved discord text
  const savedDiscord=localStorage.getItem('discord-status');
  if(savedDiscord){
    const ds = document.getElementById('discord-status');
    if (ds) ds.textContent=savedDiscord;
  }

  // Twitch embed
  function ensureTwitch() {
    if (typeof Twitch === 'undefined' || !Twitch.Embed) return setTimeout(ensureTwitch, 200);
    createTwitchPlayer();
    updateTwitchLiveStatus();
  }
  ensureTwitch();

  // Spotify poll
  updateSpotifyNowPlaying();

  // Leaderboards
  loadBitsCreds();
  updateBitsLeaderboard();
  setInterval(updateBitsLeaderboard, 60000);
  renderSubs();

  // About
  setupAbout();
});
