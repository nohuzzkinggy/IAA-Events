/* ---------------------------
   CONFIG — EDIT THESE
---------------------------- */
const DISCORD_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
const REDIRECT_URI = window.location.origin + window.location.pathname; // e.g. https://example.com/index.html
const OAUTH_SCOPES = ["identify"]; // we only need the user's id & username

// Add Discord User IDs here. Anyone in this list can create/delete events.
const ADMIN_WHITELIST = [
  // "123456789012345678", // <- your Discord user ID
];

/* ---------------------------
   SIMPLE STORE (localStorage)
---------------------------- */
const STORAGE_KEY = "scraprun.events.v1";

function loadEvents(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    // Seed with your sample event: Scraprun — hosted by AA_KKINGVRR
    const seed = [{
      id: crypto.randomUUID(),
      title: "Scraprun",
      host: "AA_KKINGVRR",
      date: new Date(Date.now() + 7*24*3600*1000).toISOString(), // +7 days
      location: "All servers",
      imageUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=1600&auto=format&fit=crop",
      description: "A fast-paced run — bring your A‑game. Meet other players and have fun.",
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
    // Clean the hash from the URL
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
    if(!t.access_token) return null;
    // naive expiry check
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
  return await res.json(); // { id, username, discriminator (legacy), global_name, avatar, ... }
}

function avatarUrl(user){
  if(!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
}

/* ---------------------------
   RENDERING
---------------------------- */
const eventsGrid = document.getElementById("eventsGrid");
const adminPanel = document.getElementById("adminPanel");
const loginBtn = document.getElementById("loginBtn");
const userArea = document.getElementById("userArea");
const eventForm = document.getElementById("eventForm");

let EVENTS = loadEvents();
let CURRENT_USER = null;
let IS_ADMIN = false;

function renderUserArea(){
  userArea.innerHTML = "";
  if(!CURRENT_USER){
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.id = "loginBtn";
    btn.textContent = "Login with Discord";
    btn.addEventListener("click", ()=> window.location.href = buildAuthURL());
    userArea.appendChild(btn);
    return;
  }
  const chip = document.createElement("div");
  chip.className = "user-chip";
  const img = document.createElement("img");
  img.src = avatarUrl(CURRENT_USER);
  const name = document.createElement("span");
  name.textContent = CURRENT_USER.global_name || CURRENT_USER.username;
  const adminTag = document.createElement("span");
  adminTag.style.fontSize = "12px";
  adminTag.style.color = "var(--muted)";
  adminTag.textContent = IS_ADMIN ? " (admin)" : "";
  const logout = document.createElement("button");
  logout.className = "btn ghost";
  logout.textContent = "Log out";
  logout.addEventListener("click", ()=>{
    sessionStorage.removeItem("discord_token");
    CURRENT_USER = null;
    IS_ADMIN = false;
    renderUserArea();
    renderAdminPanel();
  });
  chip.appendChild(img);
  chip.appendChild(name);
  chip.appendChild(adminTag);
  userArea.appendChild(chip);
  userArea.appendChild(logout);
}

function renderAdminPanel(){
  if(IS_ADMIN){
    adminPanel.classList.remove("hidden");
  } else {
    adminPanel.classList.add("hidden");
  }
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }catch{ return iso; }
}

function renderEvents(){
  eventsGrid.innerHTML = "";
  if(EVENTS.length === 0){
    const empty = document.createElement("div");
    empty.textContent = "No events yet.";
    eventsGrid.appendChild(empty);
    return;
  }

  // show soonest first
  const sorted = [...EVENTS].sort((a,b)=> new Date(a.date) - new Date(b.date));

  for(const ev of sorted){
    const card = document.createElement("article");
    card.className = "card";

    // top image
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = ev.imageUrl;
    img.alt = ev.title;
    thumb.appendChild(img);

    // badge "Free"
    if(ev.isFree){
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = "Free";
      thumb.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "body";

    const h3 = document.createElement("h3");
    h3.textContent = ev.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${fmtDate(ev.date)} • ${ev.location}`;

    const host = document.createElement("div");
    host.className = "meta";
    host.textContent = `Hosted by ${ev.host}`;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = ev.description || "";

    body.appendChild(h3);
    body.appendChild(meta);
    body.appendChild(host);
    body.appendChild(desc);

    const actions = document.createElement("div");
    actions.className = "actions";

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn";
    detailsBtn.textContent = "Details";
    detailsBtn.addEventListener("click", ()=>{
      alert(`${ev.title}\n\nHost: ${ev.host}\nWhen: ${fmtDate(ev.date)}\nWhere: ${ev.location}\n\n${ev.description || ""}`);
    });
    actions.appendChild(detailsBtn);

    if(IS_ADMIN){
      const del = document.createElement("button");
      del.className = "btn danger";
      del.textContent = "Delete";
      del.addEventListener("click", ()=>{
        if(confirm(`Delete "${ev.title}"?`)){
          EVENTS = EVENTS.filter(x => x.id !== ev.id);
          saveEvents(EVENTS);
          renderEvents();
        }
      });
      actions.appendChild(del);
    }

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(actions);

    eventsGrid.appendChild(card);
  }
}

/* ---------------------------
   FORM HANDLERS
---------------------------- */
eventForm?.addEventListener("submit", (e)=>{
  e.preventDefault();
  if(!IS_ADMIN) return alert("Only admins can create events.");

  const newEvent = {
    id: crypto.randomUUID(),
    title: document.getElementById("title").value.trim(),
    host: document.getElementById("host").value.trim(),
    date: document.getElementById("date").value,
    location: document.getElementById("location").value.trim(),
    imageUrl: document.getElementById("imageUrl").value.trim(),
    description: document.getElementById("description").value.trim(),
    isFree: document.getElementById("isFree").checked,
    createdBy: CURRENT_USER?.id || "unknown"
  };

  // basic guardrails
  if(!newEvent.title || !newEvent.host || !newEvent.date || !newEvent.location || !newEvent.imageUrl){
    return alert("Please fill all required fields.");
  }

  EVENTS.push(newEvent);
  saveEvents(EVENTS);
  e.target.reset();
  renderEvents();
});

/* ---------------------------
   BOOTSTRAP
---------------------------- */
(async function init(){
  // handle #access_token from Discord
  parseHashToken();

  // restore token and maybe fetch user
  const token = getSavedToken();
  if(token){
    try{
      const me = await fetchDiscordUser(token);
      CURRENT_USER = me;
      IS_ADMIN = ADMIN_WHITELIST.includes(me.id);
    }catch{
      // token invalid — clear it
      sessionStorage.removeItem("discord_token");
    }
  }

  // wire login button (if present in initial DOM)
  loginBtn?.addEventListener("click", ()=> window.location.href = buildAuthURL());

  renderUserArea();
  renderAdminPanel();
  renderEvents();
})();
