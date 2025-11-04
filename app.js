/* app.js - Frontend logic for A.S.I.A.
   - client-side auth (localStorage)
   - send chat to backend /chat
   - fetch history from /history and filter by user_id
*/

const API_BASE = ""; // change if backend at other host

// --- Helpers: crypto hash for passwords (SHA-256) ---
async function sha256(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : 'u-'+Date.now() }

// --- Local users storage helper ---
function loadUsers(){
  try{ return JSON.parse(localStorage.getItem("asia_users")||"{}") }catch(e){return {}}
}
function saveUsers(users){ localStorage.setItem("asia_users", JSON.stringify(users)) }

// --- Auth state ---
function getAuth(){ return JSON.parse(localStorage.getItem("asia_session")||"null") }
function setAuth(obj){ localStorage.setItem("asia_session", JSON.stringify(obj)) }
function clearAuth(){ localStorage.removeItem("asia_session") }

// --- DOM elements ---
const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const tryBtn = document.getElementById("tryBtn");
const authBtn = document.getElementById("authBtn");
const authModal = document.getElementById("authModal");
const closeAuth = document.getElementById("closeAuth");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMsg = document.getElementById("authMsg");
const userGreeting = document.getElementById("userGreeting");
const logoutBtn = document.getElementById("logoutBtn");
const historyItems = document.getElementById("historyItems");
const historyToggle = document.getElementById("historyToggle");
const themeToggle = document.getElementById("themeToggle");

// --- UI helpers ---
function appendMessage(text, cls="bot"){
  const d = document.createElement("div");
  d.className = `message ${cls}`;
  d.textContent = text;
  chatBox.appendChild(d);
  chatBox.scrollTop = chatBox.scrollHeight;
  return d;
}

function renderAuthState(){
  const session = getAuth();
  if(session){
    userGreeting.innerText = `Signed in as ${session.name} (${session.email})`;
    authBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    userGreeting.innerText = "Not signed in";
    authBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }
  loadHistoryForUser();
}

// --- Chat sending ---
async function sendChat(message, options = {anon:false}){
  if(!message || !message.trim()) return;
  appendMessage(message, "user");
  const botDiv = appendMessage("Typing...", "bot");
  const session = getAuth();
  const payload = { message };
  if(!options.anon && session && session.user_id) payload.user_id = session.user_id;

  try{
    const res = await fetch(API_BASE + "/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    botDiv.textContent = data.response || data.answer || "Sorry, no response.";
    // If logged in and backend stores history, refresh history
    if(payload.user_id) setTimeout(()=>loadHistoryForUser(), 400);
  }catch(err){
    console.error(err);
    botDiv.textContent = "Error: Cannot connect to server.";
  }
}

// --- Event listeners ---
sendBtn.addEventListener("click", ()=>sendChat(userInput.value, {anon:false}) && (userInput.value=""));
userInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ sendBtn.click(); userInput.value=""; }});

tryBtn.addEventListener("click", ()=>{
  const sample = "Hello A.S.I.A. — tell me something interesting.";
  sendChat(sample, {anon:true});
});

// open auth modal
authBtn.addEventListener("click", ()=>{ authModal.setAttribute("aria-hidden","false"); });
closeAuth.addEventListener("click", ()=>{ authModal.setAttribute("aria-hidden","true"); authMsg.innerText=""; });

// tabs
tabLogin.addEventListener("click", ()=>{ tabLogin.classList.add("active"); tabRegister.classList.remove("active"); loginForm.classList.remove("hidden"); registerForm.classList.add("hidden"); });
tabRegister.addEventListener("click", ()=>{ tabRegister.classList.add("active"); tabLogin.classList.remove("active"); registerForm.classList.remove("hidden"); loginForm.classList.add("hidden"); });

// login form submit
loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  authMsg.innerText = "Signing in...";
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const pwd = document.getElementById("loginPassword").value;
  const users = loadUsers();
  if(!users[email]){ authMsg.innerText = "Account not found."; return; }
  const hash = await sha256(pwd);
  if(hash !== users[email].hash){ authMsg.innerText = "Wrong password."; return; }
  // success
  setAuth({ user_id: users[email].id, email, name: users[email].name });
  authMsg.innerText = "Signed in.";
  renderAuthState();
  setTimeout(()=>authModal.setAttribute("aria-hidden","true"),300);
});

// register form submit
registerForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  authMsg.innerText = "Creating account...";
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const pwd = document.getElementById("regPassword").value;
  if(!name || !email || !pwd){ authMsg.innerText = "Complete all fields."; return; }
  const users = loadUsers();
  if(users[email]){ authMsg.innerText = "Account already exists."; return; }
  const hash = await sha256(pwd);
  const id = uid();
  users[email] = { id, name, hash };
  saveUsers(users);
  setAuth({ user_id: id, email, name });
  authMsg.innerText = "Account created and signed in.";
  renderAuthState();
  setTimeout(()=>authModal.setAttribute("aria-hidden","true"),400);
});

// logout
logoutBtn.addEventListener("click", ()=>{
  clearAuth();
  renderAuthState();
});

// history toggle (scrolls to left panel on small screens)
historyToggle.addEventListener("click", ()=>{
  const left = document.getElementById("leftPanel");
  if(window.innerWidth < 900){
    left.style.display = left.style.display === "block" ? "none" : "block";
    setTimeout(()=>left.scrollIntoView({behavior:"smooth"}),100);
  } else left.scrollIntoView({behavior:"smooth"});
});

// theme toggle
themeToggle.addEventListener("change", ()=>{
  if(themeToggle.checked) document.documentElement.style.setProperty("--bg","#071023");
  else document.documentElement.style.setProperty("--bg","#0f172a");
});

// --- History: calls backend /history and filters by user_id ---
async function loadHistoryForUser(){
  historyItems.innerHTML = "Loading history...";
  const session = getAuth();
  if(!session || !session.user_id){ historyItems.innerHTML = "Sign in to see saved chats."; return; }
  try{
    const res = await fetch(API_BASE + "/history");
    const data = await res.json();
    // data may be array of rows or {history:[]}
    const rows = Array.isArray(data) ? data : (data.history || data);
    // rows: each row likely [ts,user_id,query,response] or object - normalize:
    const filtered = rows.filter(r=>{
      if(Array.isArray(r)) return (r[1]||"") === session.user_id;
      if(typeof r === "object" && r.user_id) return r.user_id === session.user_id;
      // fallback: if string includes user id
      return JSON.stringify(r).includes(session.user_id);
    }).slice(0,40);

    if(!filtered.length) { historyItems.innerHTML = "No saved chats yet."; return; }

    historyItems.innerHTML = "";
    filtered.forEach(r=>{
      let ts,q,resText;
      if(Array.isArray(r)){ ts = new Date(r[0]*1000).toLocaleString(); q = r[2]; resText = (r[3]||"").slice(0,160); }
      else { ts = new Date(r.ts*1000).toLocaleString(); q = r.query || ""; resText = (r.response||"").slice(0,160); }
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `<div style="font-size:12px;color:#9aa4b2">${ts}</div><div style="font-weight:600;margin-top:6px">${q}</div><div style="font-size:13px;color:#bfc9d6;margin-top:6px">${resText}...</div>`;
      item.addEventListener("click", ()=> {
        appendMessage(q,"user");
        appendMessage(resText,"bot");
      });
      historyItems.appendChild(item);
    });

  }catch(err){
    historyItems.innerText = "Could not load history.";
    console.error(err);
  }
}

// initial render
renderAuthState();

// load last saved history for signed in user every minute
setInterval(()=>{ if(getAuth()) loadHistoryForUser(); }, 60_000);
