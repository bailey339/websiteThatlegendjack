/* ===== Utilities ===== */
function safe(fn){ try{ fn(); }catch(e){ console.warn(e); } }
function $(sel){ return document.querySelector(sel); }
function showSection(id){
  document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target){ 
    target.classList.remove('hidden'); 
    window.scrollTo({top:0,behavior:'smooth'}); 
  }
  updateStaffChatVisibility();
}

/* ===== Staff Authentication ===== */
let currentStaff = null;

async function checkStaffAuth() {
  try {
    const response = await fetch('/api/staff/check');
    const data = await response.json();
    
    if (data.loggedIn) {
      currentStaff = { username: data.user, role: data.role };
      applyStaffUI();
      loadStaffChat();
      startChatPolling();
    } else {
      currentStaff = null;
      applyStaffUI();
    }
  } catch (error) {
    console.warn('Auth check failed:', error);
    currentStaff = null;
    applyStaffUI();
  }
}

async function doStaffLogin(e) {
  if (e) e.preventDefault();
  const username = $('#staffUsername')?.value?.trim() || '';
  const password = $('#staffPassword')?.value?.trim() || '';
  
  if (!username || !password) {
    alert('Please enter username and password');
    return;
  }
  
  try {
    const response = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentStaff = { username: data.user, role: data.role };
      applyStaffUI();
      loadStaffChat();
      startChatPolling();
      if (window.location.pathname === '/login.html') {
        window.location.href = '/';
      }
    } else {
      alert('Login failed: ' + (data.error || 'Invalid credentials'));
    }
  } catch (error) {
    alert('Login error: ' + error.message);
  }
}

async function doStaffLogout() {
  try {
    await fetch('/api/staff/logout', { method: 'POST' });
    currentStaff = null;
    applyStaffUI();
    stopChatPolling();
  } catch (error) {
    console.warn('Logout error:', error);
  }
}

function applyStaffUI() {
  const isStaff = currentStaff !== null;
  
  // Update login/logout buttons
  safe(() => {
    const loginBtn = $('#loginBtn');
    const logoutBtn = $('#logoutBtn');
    if (loginBtn) loginBtn.classList.toggle('hidden', isStaff);
    if (logoutBtn) logoutBtn.classList.toggle('hidden', !isStaff);
  });
  
  safe(() => {
    const usernameDisplay = $('#staffUsernameDisplay');
    if (usernameDisplay) usernameDisplay.textContent = isStaff ? currentStaff.username : '';
  });
  
  // Show/hide staff controls
  safe(() => {
    const aboutBox = $('#about-box');
    if (aboutBox) aboutBox.contentEditable = isStaff ? 'true' : 'false';
  });
  
  safe(() => {
    const subsControls = $('#subs-controls');
    if (subsControls) subsControls.classList.toggle('hidden', !isStaff);
  });
  
  safe(() => {
    const adminControls = $('#admin-controls');
    if (adminControls) adminControls.classList.toggle('hidden', !isStaff);
    
    // Add Spotify controls for staff
    if (adminControls && isStaff && !adminControls.querySelector('#spotify-controls')) {
      const spotifyControls = document.createElement('div');
      spotifyControls.id = 'spotify-controls';
      spotifyControls.style.marginTop = '1rem';
      spotifyControls.style.paddingTop = '1rem';
      spotifyControls.style.borderTop = '1px solid rgba(255,255,255,0.2)';
      spotifyControls.innerHTML = `
        <h4>Spotify Controls</h4>
        <div class="row">
          <button id="connect-spotify-btn" class="spotify-btn">Connect Spotify</button>
          <button id="disconnect-spotify-btn" style="background: #444;">Disconnect Spotify</button>
        </div>
      `;
      adminControls.appendChild(spotifyControls);
      
      // Add event listeners for the new buttons
      document.getElementById('connect-spotify-btn').addEventListener('click', connectSpotify);
      document.getElementById('disconnect-spotify-btn').addEventListener('click', disconnectSpotify);
    }
  });
  
  updateStaffChatVisibility();
  
  if (isStaff) {
    loadSocialLinksForEdit();
  }
}

/* ===== Staff Chat Visibility ===== */
function updateStaffChatVisibility() {
  const staffChat = $('#staff-chat-container');
  if (!staffChat) return;
  
  const isHomePage = !$('#home').classList.contains('hidden');
  const shouldShow = currentStaff && isHomePage;
  
  if (shouldShow) {
    staffChat.classList.remove('hidden');
    staffChat.classList.add('visible');
  } else {
    staffChat.classList.add('hidden');
    staffChat.classList.remove('visible');
  }
}

/* ===== Staff Chat ===== */
let chatPollInterval = null;

function startChatPolling() {
  stopChatPolling();
  chatPollInterval = setInterval(loadStaffChat, 3000);
}

function stopChatPolling() {
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

async function loadStaffChat() {
  if (!currentStaff) return;
  
  try {
    const response = await fetch('/api/staff/messages');
    const messages = await response.json();
    
    const chatBox = $('#staff-chat-messages');
    if (!chatBox) return;
    
    chatBox.innerHTML = messages.map(msg => `
      <div class="chat-message">
        <strong>${msg.username}:</strong> 
        <span>${msg.message}</span>
        <small>${new Date(msg.timestamp).toLocaleTimeString()}</small>
      </div>
    `).join('');
    
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    console.warn('Failed to load chat:', error);
  }
}

async function sendStaffMessage() {
  if (!currentStaff) return;
  
  const input = $('#staff-chat-input');
  const message = input?.value?.trim();
  
  if (!message) return;
  
  try {
    const response = await fetch('/api/staff/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (response.ok) {
      input.value = '';
      loadStaffChat();
    } else {
      alert('Failed to send message');
    }
  } catch (error) {
    alert('Error sending message: ' + error.message);
  }
}

/* ===== Gifted Subs (Database) ===== */
async function loadSubs() {
  try {
    const response = await fetch('/api/subs');
    const subs = await response.json();
    renderSubs(subs);
  } catch (error) {
    console.warn('Failed to load subs:', error);
    const subsList = $('#subs-list');
    if (subsList) subsList.innerHTML = 'Error loading subs';
  }
}

async function addOrUpdateSub() {
  const username = $('#sub_user')?.value?.trim();
  const gifts = parseInt($('#sub_gifts')?.value || '0', 10);
  
  if (!username || isNaN(gifts)) {
    alert('Enter username and valid gifts number');
    return;
  }
  
  try {
    const response = await fetch('/api/subs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, gifts })
    });
    
    if (response.ok) {
      const subUser = $('#sub_user');
      const subGifts = $('#sub_gifts');
      if (subUser) subUser.value = '';
      if (subGifts) subGifts.value = '';
      loadSubs();
    } else {
      alert('Failed to update subs');
    }
  } catch (error) {
    alert('Error updating subs: ' + error.message);
  }
}

async function resetSubs() {
  if (!confirm('Reset all gifted subs?')) return;
  
  try {
    const response = await fetch('/api/subs', { method: 'DELETE' });
    
    if (response.ok) {
      loadSubs();
    } else {
      alert('Failed to reset subs');
    }
  } catch (error) {
    alert('Error resetting subs: ' + error.message);
  }
}

function renderSubs(subs) {
  const box = $('#subs-list');
  if (!box) return;
  
  if (!subs.length) {
    box.innerHTML = 'No subs yet.';
    return;
  }
  
  const html = `<table>
    <thead><tr><th>#</th><th>User</th><th>Gifted</th></tr></thead>
    <tbody>
      ${subs.map((s, i) => `
        <tr><td>${i + 1}</td><td>${s.username}</td><td>${s.gifts}</td></tr>
      `).join('')}
    </tbody>
  </table>`;
  
  box.innerHTML = html;
}

/* ===== Twitch Bits (Server-side) ===== */
async function refreshBits() {
  const listEl = $('#bits-list');
  if (!listEl) return;
  
  const count = Math.min(Math.max(parseInt($('#bits_count')?.value || '10', 10), 1), 10);
  
  listEl.innerHTML = '<p>Loading…</p>';
  
  try {
    const response = await fetch(`/api/twitch/bits?count=${count}&period=all`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API error');
    }
    
    if (!data.data || data.data.length === 0) {
      listEl.innerHTML = '<p>No results.</p>';
      return;
    }
    
    const rows = data.data.map(entry => `
      <tr>
        <td>${entry.rank}</td>
        <td>${entry.user_name || entry.user_login || entry.user_id}</td>
        <td>${entry.score}</td>
      </tr>
    `).join('');
    
    listEl.innerHTML = `<table>
      <thead><tr><th>#</th><th>User</th><th>Bits</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (err) {
    listEl.innerHTML = `
      <div style="padding:.6rem;background:rgba(0,0,0,.35);border-radius:8px">
        <p><strong>Error:</strong> ${err.message}</p>
        <p>Twitch credentials need to be configured on the server.</p>
      </div>`;
  }
}

/* ===== Partnered Servers ===== */
async function loadPartneredServers() {
  try {
    const response = await fetch('/api/partnered-servers');
    const servers = await response.json();
    renderPartneredServers(servers);
  } catch (error) {
    console.warn('Failed to load partnered servers:', error);
    const serversList = $('#partnered-servers-list');
    if (serversList) serversList.innerHTML = 'Error loading partnered servers';
  }
}

function renderPartneredServers(servers) {
  const container = $('#partnered-servers-list');
  if (!container) return;
  
  if (!servers.length) {
    container.innerHTML = '<p>No partnered servers configured yet.</p>';
    return;
  }
  
  const html = servers.map(server => `
    <div class="server-card">
      <div class="server-image">
        ${server.image ? `<img src="${server.image}" alt="${server.name}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/80x80/9C824A/FFFFFF?text=Error'">` : '<div class="no-image">No Image</div>'}
      </div>
      <div class="server-info">
        <h4>${server.name}</h4>
        <p>${server.description}</p>
      </div>
      <a href="${server.inviteLink}" target="_blank" class="join-btn">Join Server</a>
    </div>
  `).join('');
  
  container.innerHTML = html;
}

/* ===== Global About Me ===== */
async function loadAbout(){
  try {
    const r = await fetch('/api/about');
    const data = await r.json();
    const aboutBox = $('#about-box');
    if (aboutBox && data.html) aboutBox.innerHTML = data.html;
  } catch {
    const aboutBox = $('#about-box');
    if (aboutBox) aboutBox.innerHTML = '<p>Welcome to my stream!</p>';
  }
}

function toggleAboutEdit(enable=true){
  safe(() => {
    const aboutBox = $('#about-box');
    if (aboutBox) aboutBox.contentEditable = enable ? 'true' : 'false';
  });
  safe(() => {
    const saveRow = $('#about-save-row');
    if (saveRow) saveRow.classList.toggle('hidden', !enable);
  });
}

function saveAbout(){
  const aboutBox = $('#about-box');
  const html = aboutBox?.innerHTML || '';
  
  fetch('/api/about', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      toggleAboutEdit(false);
      alert('About saved');
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
    
    document.querySelectorAll('.social').forEach(link => {
      const platform = link.getAttribute('aria-label')?.toLowerCase();
      if (platform && links[platform]) {
        link.href = links[platform];
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
    
    const twitchUrl = $('#social-twitch-url');
    const tiktokUrl = $('#social-tiktok-url');
    const kickUrl = $('#social-kick-url');
    const onlyfansUrl = $('#social-onlyfans-url');
    
    if (twitchUrl) twitchUrl.value = links.twitch || '';
    if (tiktokUrl) tiktokUrl.value = links.tiktok || '';
    if (kickUrl) kickUrl.value = links.kick || '';
    if (onlyfansUrl) onlyfansUrl.value = links.onlyfans || '';
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      alert('Social links updated');
      loadSocialLinks();
    } else {
      alert('Failed to update social links');
    }
  })
  .catch(() => alert('Error updating social links'));
}

/* ===== Twitch Embed ===== */
const TWITCH_CHANNEL = 'ThatLegendJackk';
let twitchEmbed = null;

function initTwitch(){
  const el = document.getElementById('twitch-player');
  if (!el) return;
  if (typeof Twitch === 'undefined' || !Twitch.Embed){ 
    setTimeout(initTwitch, 250); 
    return; 
  }
  if (twitchEmbed) return;
  
  const parentHost = location.hostname || 'localhost';
  twitchEmbed = new Twitch.Embed('twitch-player', {
    width:'100%', height:'100%', channel: TWITCH_CHANNEL, layout:'video', muted:true,
    parent:[parentHost],
  });
}

/* ===== Discord Presence ===== */
let DISCORD_USER_ID = '';
let lanyardWs = null;

async function loadDiscordConfig(){
  try{
    const cfg = await fetch('/api/config').then(r => r.json());
    DISCORD_USER_ID = cfg?.discord_user_id || '';
    
    const discordStatus = $('#discord-status');
    
    if (DISCORD_USER_ID) {
      if (discordStatus) discordStatus.textContent = 'Discord: Loading...';
      connectLanyard();
    } else {
      if (discordStatus) discordStatus.textContent = 'Discord: Not Configured';
    }
  }catch(e){ 
    console.warn('Failed to load Discord config:', e);
    const discordStatus = $('#discord-status');
    if (discordStatus) discordStatus.textContent = 'Discord: Error';
  }
}

function connectLanyard(){
  if (!DISCORD_USER_ID) return;
  
  if (lanyardWs) lanyardWs.close();
  
  const discordStatus = $('#discord-status');
  if (discordStatus) discordStatus.textContent = 'Discord: Connecting...';
  
  lanyardWs = new WebSocket('wss://api.lanyard.rest/socket');
  
  lanyardWs.addEventListener('open', () => {
    lanyardWs.send(JSON.stringify({
      op: 2,
      d: { subscribe_to_id: DISCORD_USER_ID }
    }));
  });
  
  lanyardWs.addEventListener('message', (event) => {
    try{
      const data = JSON.parse(event.data);
      
      if (data.op === 1) {
        // Heartbeat request
        lanyardWs.send(JSON.stringify({ op: 3 }));
        return;
      }
      
      if (data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE') {
        const status = data.d?.discord_status || 'offline';
        const activities = data.d?.activities || [];
        
        const statusEl = $('#discord-status');
        if (statusEl) {
          // Only show Discord status, NOT Spotify info
          let statusText = `Discord: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
          
          // Add custom status if available
          const customStatus = activities.find(a => a.type === 4);
          if (customStatus && customStatus.state) {
            statusText += ` - ${customStatus.state}`;
          }
          
          statusEl.textContent = statusText;
        }
      }
    }catch(e){
      console.warn('Lanyard message error:', e);
    }
  });
  
  lanyardWs.addEventListener('close', () => {
    const discordStatus = $('#discord-status');
    if (discordStatus) discordStatus.textContent = 'Discord: Reconnecting...';
    setTimeout(connectLanyard, 5000);
  });
  
  lanyardWs.addEventListener('error', () => {
    const discordStatus = $('#discord-status');
    if (discordStatus) discordStatus.textContent = 'Discord: Connection Error';
  });
}

/* ===== Spotify Live Status (Server-wide) ===== */
let spotifyTimer = null;

async function updateSpotify(){
  const el = $('#spotify-track');
  if (!el) return;
  
  try {
    const r = await fetch('/api/spotify/now-playing');
    
    if (r.status === 401) {
      el.textContent = 'Spotify: Not Connected';
      el.title = 'Staff can connect Spotify in admin controls';
      el.classList.remove('scrolling');
      return;
    }
    
    if (r.ok) {
      const data = await r.json();
      
      if (!data || data.playing === false || !data.item) {
        el.textContent = 'Spotify: Not Playing';
        el.title = 'Spotify: Not Playing';
        el.classList.remove('scrolling');
      } else {
        const name = data.item?.name || 'Unknown Track';
        const artists = (data.item?.artists || []).map(a => a.name).join(', ') || 'Unknown Artist';
        const fullText = `🎵 ${name} - ${artists}`;
        
        el.textContent = fullText;
        el.title = fullText;
        
        if (fullText.length > 30) {
          el.classList.add('scrolling');
        } else {
          el.classList.remove('scrolling');
        }
      }
    } else {
      el.textContent = 'Spotify: Error';
      el.title = 'Spotify: Error';
      el.classList.remove('scrolling');
    }
  } catch (error) {
    console.warn('Spotify update error:', error);
    el.textContent = 'Spotify: Offline';
    el.title = 'Spotify: Offline';
    el.classList.remove('scrolling');
  }
  
  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotify, 10000);
}

// Test function to manually check Spotify status
async function testSpotify() {
  console.log('Testing Spotify connection...');
  try {
    const response = await fetch('/api/spotify/now-playing');
    console.log('Spotify response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Spotify data:', data);
      
      if (data && data.item) {
        console.log('Now playing:', data.item.name, '-', data.item.artists.map(a => a.name).join(', '));
      } else {
        console.log('Spotify not playing or no data');
      }
    } else {
      console.log('Spotify API error:', response.status);
    }
  } catch (error) {
    console.log('Spotify test error:', error);
  }
}

// Spotify control functions
function connectSpotify() {
  window.open('/auth/spotify/login', '_blank');
}

async function disconnectSpotify() {
  if (!confirm('Disconnect Spotify for everyone?')) return;
  
  try {
    const response = await fetch('/api/spotify/disconnect', {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('Spotify disconnected');
      updateSpotify(); // Refresh the display
    } else {
      alert('Failed to disconnect Spotify');
    }
  } catch (error) {
    alert('Error disconnecting Spotify: ' + error.message);
  }
}

/* ===== Event Binding ===== */
function bindEvents() {
  // Navigation buttons
  document.querySelectorAll('.nav-box.about').forEach(btn => {
    btn.addEventListener('click', function() {
      showSection('about');
    });
  });
  
  document.querySelectorAll('.nav-box.leaderboards').forEach(btn => {
    btn.addEventListener('click', function() {
      showSection('leaderboards');
      refreshBits(); // Load bits when showing leaderboards
    });
  });
  
  document.querySelectorAll('.nav-box.partnered').forEach(btn => {
    btn.addEventListener('click', function() {
      showSection('partnered');
      loadPartneredServers();
    });
  });
  
  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      showSection('home');
    });
  });
  
  // Bits refresh button
  const bitsRefreshBtn = $('#bits_refresh_btn');
  if (bitsRefreshBtn) {
    bitsRefreshBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      refreshBits(); 
    });
  }
  
  // Subs buttons
  const subsAddBtn = $('#subs_add_btn');
  if (subsAddBtn) {
    subsAddBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      addOrUpdateSub(); 
    });
  }
  
  const subsResetBtn = $('#subs_reset_btn');
  if (subsResetBtn) {
    subsResetBtn.addEventListener('click', function(e) { 
      e.preventDefault(); 
      resetSubs(); 
    });
  }
  
  // Social links update button
  const socialUpdateBtn = document.querySelector('#admin-controls button');
  if (socialUpdateBtn && !socialUpdateBtn.id) {
    socialUpdateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      updateSocialLinks();
    });
  }
  
  // About buttons
  const aboutSaveBtn = document.querySelector('#about-save-row button:first-child');
  if (aboutSaveBtn) {
    aboutSaveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      saveAbout();
    });
  }
  
  const aboutCancelBtn = document.querySelector('#about-save-row button:last-child');
  if (aboutCancelBtn) {
    aboutCancelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      toggleAboutEdit(false);
    });
  }
  
  // Staff chat
  const staffChatSend = $('#staff-chat-send');
  if (staffChatSend) {
    staffChatSend.addEventListener('click', function(e) { 
      e.preventDefault(); 
      sendStaffMessage(); 
    });
  }
  
  const staffChatInput = $('#staff-chat-input');
  if (staffChatInput) {
    staffChatInput.addEventListener('keypress', function(e) { 
      if (e.key === 'Enter') sendStaffMessage(); 
    });
  }
  
  // Logout button
  const logoutBtn = $('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      doStaffLogout();
    });
  }
  
  // Login form (if on login page)
  const loginForm = document.querySelector('form[onsubmit*="doStaffLogin"]');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      doStaffLogin(e);
    });
  }
}

/* ===== Boot ===== */
window.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing...');
  
  showSection('home');
  loadAbout();
  loadSocialLinks();
  loadSubs();

  // Twitch embed
  if (typeof Twitch === 'undefined') {
    const twitchScript = document.createElement('script');
    twitchScript.src = 'https://embed.twitch.tv/embed/v1.js';
    twitchScript.onload = function() { 
      console.log('Twitch script loaded');
      initTwitch(); 
    };
    document.head.appendChild(twitchScript);
  } else { 
    initTwitch(); 
  }

  // Discord + Spotify
  loadDiscordConfig();
  updateSpotify();

  // Check staff authentication
  checkStaffAuth();

  // Bind all event listeners
  bindEvents();
  
  console.log('Initialization complete');
});
