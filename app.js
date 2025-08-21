/* ---------------------------
   CONFIG — YOUR DETAILS
---------------------------- */
const DISCORD_CLIENT_ID = "1408022676521357322";
const REDIRECT_URI = "https://nohuzzkinggy.github.io/IAA-Events/";
const OAUTH_SCOPES = ["identify"]; // only need the user's id & username

// Admin whitelist — only these users can create/delete events
const ADMIN_WHITELIST = [
  "927302486518296647" // 👈 your Discord User ID
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
  return await res.json();
}

function avatarUrl(user){
  if(!user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
}

/* ---------------------------
   RENDERING & EVENTS
---------------------------- */
// keep the rest of the rendering/event-handling code unchanged from before
