/* ===== Utilities ===== */
function showSection(id){
  document.querySelectorAll("section").forEach(s=>s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ===== Decor helpers ===== */
const decor = document.getElementById("decor-layer");
function clearDecor(){ decor.innerHTML=""; }
function rnd(min,max){ return Math.random()*(max-min)+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }
function createEmoji(char, sizePx, leftPct, topPct, classes="", style=""){
  const el=document.createElement("div");
  el.className=`decor-item ${classes}`;
  el.textContent=char;
  el.style.cssText=`font-size:${sizePx}px; left:${leftPct}%; top:${topPct}%; ${style}`;
  decor.appendChild(el);
  return el;
}

/* ===== Particles ===== */
tsParticles.load("particles",{
  background:{color:{value:"transparent"}},
  particles:{
    number:{value:45},
    size:{value:2},
    move:{enable:true,speed:.8},
    opacity:{value:.35},
    color:{value:"#ffffff"},
    links:{enable:true,color:"#ffffff",opacity:.15}
  }
});

/* ===== Twitch ===== */
let embed;
function initTwitch(){
  const parent = location.hostname || "localhost";
  embed = new Twitch.Embed("twitch-player", {
    width:"100%", height:"100%", channel:"ThatLegendJackk",
    layout:"video", autoplay:false, muted:true,
    parent:[parent, "localhost", "example.com", "thatlegendjack.dev"]
  });

  embed.addEventListener(Twitch.Embed.VIDEO_READY, ()=>{
    const player = embed.getPlayer();
    player.addEventListener("PLAY", ()=> document.getElementById("livePill").style.display="inline-flex");
    player.addEventListener("PAUSE", ()=> document.getElementById("livePill").style.display="none");
  });

  embed.addEventListener(Twitch.Embed.ONLINE, ()=>{
    document.getElementById("twitch-offline").classList.remove("offline-show");
    document.getElementById("livePill").style.display="inline-flex";
  });
  embed.addEventListener(Twitch.Embed.OFFLINE, ()=>{
    document.getElementById("twitch-offline").classList.add("offline-show");
    document.getElementById("livePill").style.display="none";
  });
}
window.addEventListener("load", initTwitch);

/* ===== Colour mode cycler (RGB / Dark / Light) ===== */
const colourModes=["theme-rgb","theme-dark","theme-light"]; let cm=0;
document.getElementById("themeBtn").onclick=()=>{
  document.body.classList.remove(...colourModes, ...seasonalModes);
  clearDecor();
  cm=(cm+1)%colourModes.length;
  document.body.classList.add(colourModes[cm]);
};

/* ===== Seasonal theme cycler (Christmas / Halloween / Easter) ===== */
const seasonalModes=["theme-christmas","theme-halloween","theme-easter"]; let sm=-1;
document.getElementById("seasonBtn").onclick=()=>{
  document.body.classList.remove(...colourModes, ...seasonalModes);
  sm=(sm+1)%seasonalModes.length;
  document.body.classList.add(seasonalModes[sm]);
  applySeasonalDecor(seasonalModes[sm]);
};

/* Random motion preset for emojis */
function randomMotion() {
  const dirs = [
    ["drift-right bob",  rnd(12,28)],  // L → R
    ["drift-left  bob",  rnd(12,28)],  // R → L
    ["flake",            rnd(10,24)],  // down with sway
  ];
  const [cls, dur] = pick(dirs);
  return { cls, dur };
}

/* ===== HALLOWEEN — spread everywhere ===== */
function renderHalloweenDecor(){
  clearDecor();

  // Pumpkins
  const pumpkins = 50;
  for (let i=0;i<pumpkins;i++){
    const {cls, dur} = randomMotion();
    createEmoji(
      "🎃", rnd(20,42), rnd(0,98), rnd(2,95),
      `${cls} wiggle`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`
    );
  }

  // Bats
  const bats = 60;
  for (let i=0;i<bats;i++){
    const {cls, dur} = randomMotion();
    createEmoji(
      "🦇", rnd(16,34), rnd(0,98), rnd(2,92),
      `${cls} wiggle`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`
    );
  }

  // Webs
  const webs = 14;
  for (let i=0;i<webs;i++){
    createEmoji(
      "🕸️", rnd(30,54), rnd(0,92), rnd(0,92),
      "spin",
      `opacity:${rnd(.4,.7).toFixed(2)}; animation-duration:${rnd(8,18).toFixed(2)}s;`
    );
  }

  // Spiders
  const spiders = 24;
  for (let i=0;i<spiders;i++){
    const {cls, dur} = randomMotion();
    createEmoji(
      "🕷️", rnd(16,26), rnd(0,98), rnd(0,92),
      `${cls} bob`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`
    );
  }
}

/* ===== CHRISTMAS — spread everywhere ===== */
function renderChristmasDecor(){
  clearDecor();

  // Snowflakes
  const flakes = 260;
  for(let i=0;i<flakes;i++){
    const el = document.createElement("div");
    el.className = "decor-item flake";
    el.textContent = pick(["❄️","❅","✨"]);
    const size = rnd(10,22);
    el.style.cssText = `
      left:${rnd(0,100)}%; top:${rnd(-10,100)}vh; font-size:${size}px;
      animation-duration:${rnd(8,22).toFixed(2)}s, ${rnd(3,7).toFixed(2)}s;
      animation-delay:${rnd(0,10).toFixed(2)}s, ${rnd(0,4).toFixed(2)}s;
    `;
    decor.appendChild(el);
  }

  // Santa
  createEmoji("🎅", rnd(36,54), rnd(0,98), rnd(4,40), "drift-right bob",
    `animation-duration:${rnd(18,26).toFixed(2)}s; animation-delay:${rnd(0,3).toFixed(2)}s;`);

  // Reindeer
  const herds = 18;
  for(let i=0;i<herds;i++){
    const {cls, dur} = randomMotion();
    createEmoji("🦌", rnd(22,32), rnd(0,98), rnd(2,92), `${cls} bob`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`);
  }

  // Candy (using 🍭)
  const canes = 36;
  for(let i=0;i<canes;i++){
    const {cls, dur} = randomMotion();
    createEmoji("🍭", rnd(18,28), rnd(0,98), rnd(2,92), `${cls} bob`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,8).toFixed(2)}s;`);
  }

  // Stars
  const stars = 40;
  for(let i=0;i<stars;i++){
    createEmoji("⭐", rnd(14,22), rnd(2,98), rnd(0,48), "wiggle",
      `animation-duration:${rnd(1.6,3.2).toFixed(2)}s; opacity:${rnd(.55,1).toFixed(2)};`);
  }
}

/* ===== EASTER — spread everywhere ===== */
function renderEasterDecor(){
  clearDecor();

  // Eggs/chicks/candy
  const eggs = 80;
  const eggSet = ["🥚","🐣","🐥","🐤","🍬"];
  for(let i=0;i<eggs;i++){
    const {cls, dur} = randomMotion();
    createEmoji(pick(eggSet), rnd(18,30), rnd(0,98), rnd(2,92),
      `${cls} bob`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`);
  }

  // Bunnies
  const bunnies = 28;
  for(let i=0;i<bunnies;i++){
    const {cls, dur} = randomMotion();
    createEmoji(pick(["🐰","🐇"]), rnd(24,34), rnd(0,98), rnd(10,92),
      `${cls}`,
      `animation-duration:${dur.toFixed(2)}s; animation-delay:${rnd(0,6).toFixed(2)}s;`);
  }

  // Flowers
  const flowers = 44;
  for(let i=0;i<flowers;i++){
    createEmoji(pick(["🌷","🌼","🌸","🌻"]), rnd(16,24), rnd(2,98), rnd(10,92),
      "bob",
      `animation-duration:${rnd(2.2,4.6).toFixed(2)}s;`);
  }

  // Balloons rising
  const balloons = 30;
  for(let i=0;i<balloons;i++){
    const el = createEmoji("🎈", rnd(16,26), rnd(0,100), rnd(70,100),
      "", "transition: transform 14s linear;");
    requestAnimationFrame(()=>{ el.style.transform = `translateY(-140vh)`; });
  }
}

/* ===== Seasonal decor switch ===== */
function applySeasonalDecor(mode){
  if(mode==="theme-halloween") renderHalloweenDecor();
  else if(mode==="theme-christmas") renderChristmasDecor();
  else if(mode==="theme-easter") renderEasterDecor();
  else clearDecor();
}

/* ===== Spotify REAL playback (embed) ===== */
function connectSpotify(){
  const embed = document.getElementById("spotify-embed");
  if(embed){
    embed.style.display = "block";
  }
  const trackLabel = document.getElementById("spotify-track");
  if(trackLabel){
    trackLabel.textContent = "Spotify player ready — press play in the widget";
  }
  const btn = document.querySelector("#spotify-connect .spotify-btn");
  if(btn){
    btn.textContent = "Spotify Connected";
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.style.cursor = "default";
  }
}

/* ===== Discord Presence (Lanyard) ===== */
const DISCORD_ID="000000000000000000"; // replace with your user ID if you want real presence
try{
  const ws=new WebSocket("wss://api.lanyard.rest/socket");
  ws.onopen=()=>ws.send(JSON.stringify({op:2,d:{subscribe_to_ids:[DISCORD_ID]}}));
  ws.onmessage=(ev)=>{
    const {t,d}=JSON.parse(ev.data||"{}");
    if(t==="INIT_STATE"||t==="PRESENCE_UPDATE"){
      const u=(t==="INIT_STATE")?d[DISCORD_ID]:d;
      if(!u) return;
      const m={online:"Online",idle:"Idle",dnd:"Do Not Disturb",offline:"Offline"};
      document.getElementById("discord-status").textContent=m[u.discord_status]||"Offline";
      const act=(u.activities||[]).find(a=>a.type===0||a.type===4);
      document.getElementById("discord-activity").textContent=act?(act.state||act.name):"";
    }
  };
}catch{}

/* ===== Leaderboards (demo/local) ===== */
function refreshBits(){
  const n=parseInt(document.getElementById("bits_count").value)||10;
  const list=document.getElementById("bits-list");
  list.innerHTML="<em>Fetching…</em>";
  setTimeout(()=>{
    const data=[
      ["UserA",1200],["UserB",880],["UserC",640],["UserD",420],["UserE",300],
      ["UserF",250],["UserG",210],["UserH",190],["UserI",170],["UserJ",160]
    ];
    list.innerHTML=data.slice(0,n).map((r,i)=>`<div class="flash">#${i+1} <b>${r[0]}</b> — ${r[1]} bits</div>`).join("");
  },400);
}

let subs=JSON.parse(localStorage.getItem("subsList")||"[]");
function renderSubs(){
  const list=document.getElementById("subs-list");
  if(!subs.length){list.textContent="No subs yet.";return;}
  list.innerHTML=subs
    .sort((a,b)=>b.count-a.count)
    .map((s,i)=>`<div class="flash">#${i+1} <b>${s.name}</b> — ${s.count} gifted</div>`)
    .join("");
}
function addOrUpdateSub(){
  const u=document.getElementById("sub_user").value.trim();
  const c=parseInt(document.getElementById("sub_gifts").value)||0;
  if(!u) return alert("Enter a username");
  const i=subs.findIndex(x=>x.name.toLowerCase()===u.toLowerCase());
  if(i>=0) subs[i].count=c; else subs.push({name:u,count:c});
  localStorage.setItem("subsList",JSON.stringify(subs)); renderSubs();
  confetti({particleCount:60,spread:70,origin:{y:.75}});
}
function resetSubs(){
  if(!confirm("Reset all subs?"))return;
  subs=[]; localStorage.removeItem("subsList"); renderSubs();
}
function saveTwitchCreds(){
  localStorage.setItem("twitchClientID",document.getElementById("twitch_client_id").value);
  localStorage.setItem("twitchToken",document.getElementById("twitch_access_token").value);
  alert("Saved!");
}

/* ===== Partnered servers (local + staff only form) ===== */

let partners=JSON.parse(localStorage.getItem("partners")||"[]");

function renderPartners(){
  const grid=document.getElementById("partner-grid");
  if(!grid) return;
  if(!partners.length){grid.innerHTML="<p>No partners yet.</p>";return;}
  grid.innerHTML=partners.map(p=>`
    <div class="partner-card">
      <img src="${p.logo}" alt="${p.name}">
      <div>
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <a href="${p.url}" target="_blank">Join</a>
      </div>
    </div>`).join("");
}

/**
 * Very simple helper: takes an invite URL and creates a
 * positive-sounding description + logo using a generic pattern.
 * In a real setup you'd call your backend to hit Discord's API.
 */
function buildPartnerFromInvite(inviteUrl){
  // crude server "slug" guess
  const slug = inviteUrl.replace(/https?:\/\/(www\.)?discord\.gg\//i,"").split(/[\/?#]/)[0] || "community";
  const name = slug
    .replace(/[-_]/g," ")
    .replace(/\s+/g," ")
    .trim()
    .replace(/^./,c=>c.toUpperCase());

  return {
    name: name || "Partnered Community",
    logo: "https://placehold.co/160x160?text=Server",
    url: inviteUrl,
    desc: `A welcoming, positive community focused on good vibes, support, and great conversations. Come hang out with the ${name || "server"} family!`
  };
}

function addPartnerFromInvite(e){
  e.preventDefault();
  const input = document.getElementById("partner_invite");
  const err   = document.getElementById("partner_err");
  err.textContent="";

  const url = input.value.trim();
  if(!url){
    err.textContent="Please paste a Discord invite link.";
    return;
  }
  if(!/https?:\/\/(www\.)?discord\.gg\//i.test(url)){
    err.textContent="That doesn’t look like a Discord invite URL.";
    return;
  }

  // Staff-only check (very simple – depends on localStorage flag)
  if(localStorage.getItem("staffSession")!=="true"){
    err.textContent="Only staff accounts can add partnered servers.";
    return;
  }

  const partner = buildPartnerFromInvite(url);
  partners.push(partner);
  localStorage.setItem("partners",JSON.stringify(partners));
  renderPartners();
  input.value="";
}

/* ===== Auth state (simple) ===== */
function doLogout(){
  localStorage.clear();
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("loginBtn").classList.remove("hidden");
  const subsControls=document.getElementById("subs-controls");
  const pf=document.getElementById("partner-form");
  if(subsControls) subsControls.classList.add("hidden");
  if(pf) pf.classList.add("hidden");
}

/* ===== Init ===== */
window.addEventListener("load", ()=>{
  if(localStorage.getItem("staffSession")==="true"){
    document.getElementById("logoutBtn").classList.remove("hidden");
    document.getElementById("loginBtn").classList.add("hidden");
    const subsControls=document.getElementById("subs-controls");
    const pf=document.getElementById("partner-form");
    if(subsControls) subsControls.classList.remove("hidden");
    if(pf) pf.classList.remove("hidden");
  }
  renderSubs();
  renderPartners();
  refreshBits();
});
