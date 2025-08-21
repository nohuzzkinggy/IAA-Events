/* ---------------------------
   CONFIG
---------------------------- */
const DISCORD_CLIENT_ID = "1408022676521357322";
const REDIRECT_URI = "https://nohuzzkinggy.github.io/IAA-Events/";
const OAUTH_SCOPES = ["identify"];

// Admin whitelist — only these users can create/delete events
const ADMIN_WHITELIST = [
  "927302486518296647" // your Discord ID
];

/* ---------------------------
   SIMPLE STORE (localStorage)
---------------------------- */
const STORAGE_KEY = "scraprun.events.v1";

function loadEvents(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    // Seed with default event
    const seed = [{
      id: crypto.randomUUID(),
      title: "Scraprun",
      host: "AA_KKINGVRR",
      date: new Date(Date.now() + 7*24*3600*1000).toISOString(),
      location: "Online",
      imageUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=1600&auto=format&fit=crop",
      description: "A fast-paced run — bring your A-game. Meet other players and have fun.",
      isFree: true,
      createdBy: "system"
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); }
  catch { return []; }
}

function saveEvents(events){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

// global events variable
let EVENTS = loadEvents();

/* ---------------------------
   AUTH (Discord implicit flow)
---------------------------- */
function buildAuthURL(){
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: OAUTH_SCOPES.join(" "),
    prompt: "none"
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

function parseHashToken(){
  if(!window.location.hash) return null;
  const h = new URLSearchParams(window.location.hash.substring(1));
  if(h.get("access_token")){
    const token = {
      access_token: h.get("access_token"),
      token_type: h.get("token_type"),
      expires_in: Number(h.get("expires_in") || 0),
      obtained_at: Date.now()
    };
    history.replaceState({}, document.title, window.location.pathname);
    sessionStorage.setItem("discord_token", JSON.stringify(token));
    return token;
  }
  return null;
}

function getSavedToken(){
  const raw = sessionStorage.getItem("discord_token");
  if(!raw) return null;
  try{
    const t = JSON.parse(raw);
    const ageSec = (Date.now() - (t.obtained_at || Date.now())) / 1000;
    if(t.expires_in && ageSec > t.expires_in) {
      sessionStorage.removeItem("discord_token");
      return null;
    }
    return t;
  }catch{ return null; }
}

async function fetchDiscordUser(token){
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  if(!res.ok) throw new Error("Failed to fetch Discord user");
  return await res.json();
}

function avatarUrl(user){
  if(!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
}

/* ---------------------------
   RENDERING
---------------------------- */

function renderEvents(user){
  const container = document.getElementById("events");
  container.innerHTML = "";
  EVENTS.forEach(ev => {
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      <div style="position:relative;">
        ${ev.isFree ? '<span class="badge">Free</span>' : ''}
        <img src="${ev.imageUrl}" alt="Event image">
      </div>
      <div class="event-card-content">
        <h3>${ev.title}</h3>
        <p class="date">${new Date(ev.date).toLocaleString()} • ${ev.location}</p>
        <p class="host">Hosted by ${ev.host}</p>
        <p class="description">${ev.description}</p>
      </div>
      <button>Details</button>
    `;

    if(user && ADMIN_WHITELIST.includes(user.id)){
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.style.background = "var(--warn)";
      del.style.marginLeft = "16px";
      del.onclick = () => {
        EVENTS = EVENTS.filter(e => e.id !== ev.id);
        saveEvents(EVENTS);
        renderEvents(user);
      };
      card.appendChild(del);
    }
    container.appendChild(card);
  });
}


function renderUserArea(user){
  const area = document.getElementById("user-area");
  if(!user){
    area.innerHTML = `<button id="login-btn">Login with Discord</button>`;
    document.getElementById("login-btn").onclick = () => {
      window.location.href = buildAuthURL();
    };
    document.getElementById("admin-panel").style.display = "none";
    return;
  }

  area.innerHTML = `
    <img src="${avatarUrl(user)}" alt="avatar" width="32" height="32">
    <span>${user.username}#${user.discriminator}</span>
    <button id="logout-btn">Logout</button>
  `;

  document.getElementById("logout-btn").onclick = () => {
    sessionStorage.removeItem("discord_token");
    location.reload();
  };

  if(ADMIN_WHITELIST.includes(user.id)){
    document.getElementById("admin-panel").style.display = "block";
  } else {
    document.getElementById("admin-panel").style.display = "none";
  }
}

/* ---------------------------
   INIT
---------------------------- */
async function init(){
  let token = parseHashToken() || getSavedToken();
  let user = null;

  if(token){
    try { user = await fetchDiscordUser(token); }
    catch { sessionStorage.removeItem("discord_token"); }
  }

  renderUserArea(user);
  renderEvents(user);

  // Admin create event
  const form = document.getElementById("create-event-form");
  form.onsubmit = (e) => {
    e.preventDefault();
    const newEv = {
      id: crypto.randomUUID(),
      title: document.getElementById("event-title").value,
      host: document.getElementById("event-host").value,
      date: document.getElementById("event-date").value,
      location: document.getElementById("event-location").value,
      imageUrl: document.getElementById("event-image").value,
      description: document.getElementById("event-description").value,
      isFree: true,
      createdBy: user.id
    };
    EVENTS.push(newEv);
    saveEvents(EVENTS);
    renderEvents(user);
    form.reset();
  };
}

window.onload = init;
