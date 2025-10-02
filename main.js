/* ===== Spotify Live Status (Server-wide) ===== */
let spotifyTimer = null;

async function updateSpotify(){
  const el = $('#spotify-track');
  if (!el) return;
  
  try {
    const r = await fetch('/api/spotify/now-playing');
    
    if (r.status === 401) {
      // Check if Spotify is connected at all
      const statusResponse = await fetch('/api/spotify/status');
      const status = await statusResponse.json();
      
      if (!status.connected) {
        el.textContent = 'Spotify: Not Connected';
        el.title = 'Click staff login to connect Spotify';
        el.classList.remove('scrolling');
        
        // Make it clickable for staff to connect
        if (currentStaff) {
          el.style.cursor = 'pointer';
          el.onclick = () => {
            window.open('/auth/spotify/login', '_blank');
          };
        }
      } else {
        el.textContent = 'Spotify: Not Playing';
        el.title = 'Spotify: Not Playing';
        el.classList.remove('scrolling');
      }
      return;
    }
    
    if (r.ok) {
      const data = await r.json();
      
      if (data.error === 'not_connected' || !data || data.playing === false || !data.item) {
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
      el.textContent = 'Spotify: API Error';
      el.title = 'Spotify: API Error';
      el.classList.remove('scrolling');
    }
  } catch (error) {
    el.textContent = 'Spotify: Offline';
    el.title = 'Spotify: Offline';
    el.classList.remove('scrolling');
  }
  
  clearTimeout(spotifyTimer);
  spotifyTimer = setTimeout(updateSpotify, 10000);
}

// Add to applyStaffUI function to show Spotify controls
function applyStaffUI() {
  const isStaff = currentStaff !== null;
  
  // ... existing code ...
  
  // Add Spotify disconnect button for staff
  safe(() => {
    const adminControls = $('#admin-controls');
    if (adminControls && isStaff) {
      // Add Spotify controls if not already there
      if (!adminControls.querySelector('#spotify-controls')) {
        const spotifyControls = document.createElement('div');
        spotifyControls.id = 'spotify-controls';
        spotifyControls.style.marginTop = '1rem';
        spotifyControls.style.paddingTop = '1rem';
        spotifyControls.style.borderTop = '1px solid rgba(255,255,255,0.2)';
        spotifyControls.innerHTML = `
          <h4>Spotify Controls</h4>
          <div class="row">
            <button onclick="connectSpotify()" class="spotify-btn">Connect Spotify</button>
            <button onclick="disconnectSpotify()" style="background: #444;">Disconnect Spotify</button>
          </div>
        `;
        adminControls.appendChild(spotifyControls);
      }
    }
  });
}

// Spotify control functions
async function connectSpotify() {
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
