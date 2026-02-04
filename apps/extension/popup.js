const API_BASE = "http://127.0.0.1:4000";
const KEY_TOKEN = "fit_avatar_token_v1";

function $(id) {
  return document.getElementById(id);
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.className = `small ${kind}`;
  el.textContent = msg;
}

async function getToken() {
  const data = await chrome.storage.local.get(KEY_TOKEN);
  return data[KEY_TOKEN] || null;
}

async function setToken(token) {
  await chrome.storage.local.set({ [KEY_TOKEN]: token });
}

async function clearToken() {
  await chrome.storage.local.remove(KEY_TOKEN);
}

function showLoggedInUI() {
  $("avatarCard").style.display = "block";
  $("loginCard").style.display = "none";
}

function showLoggedOutUI() {
  $("avatarCard").style.display = "none";
  $("loginCard").style.display = "block";
}

function fmt(cm) {
  if (cm === null || cm === undefined) return "—";
  return `${cm} cm`;
}

async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Auth failed");
  return data;
}

async function fetchAvatar(token) {
  const res = await fetch(`${API_BASE}/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to fetch avatar");
  return data;
}

async function refreshAll() {
  const token = await getToken();
  if (!token) {
    setStatus("Not logged in.");
    showLoggedOutUI();
    return;
  }

  try {
    setStatus("Loading…");
    const me = await fetchMe(token);
    const av = await fetchAvatar(token);

    setStatus(`Logged in: ${me.user.email}`, "ok");
    showLoggedInUI();

    const a = av.avatar || null;

    $("m_height").textContent = a ? fmt(a.height_cm) : "—";
    $("m_chest").textContent = a ? fmt(a.chest_cm) : "—";
    $("m_waist").textContent = a ? fmt(a.waist_cm) : "—";
    $("m_hips").textContent = a ? fmt(a.hips_cm) : "—";
    $("m_fit").textContent = a?.fit_pref ? String(a.fit_pref) : "—";
  } catch (e) {
    setStatus(String(e.message || e), "err");
    showLoggedOutUI();
  }
}

$("openEditorBtn").addEventListener("click", async () => {
  // Open avatar editor on your site
  const url =
    "http://localhost:3000/avatar?returnUrl=" +
    encodeURIComponent("https://www.zalando.de/");
  await chrome.tabs.create({ url });
});

$("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  setStatus("Logged out.", "ok");
  showLoggedOutUI();
});

$("refreshBtn").addEventListener("click", async () => {
  await refreshAll();
});

$("createAvatarBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const returnUrl = encodeURIComponent(tab?.url || "https://www.zalando.de/");
  const state = encodeURIComponent(Math.random().toString(16).slice(2));

  const url = `http://localhost:3000/signup?returnUrl=${returnUrl}&state=${state}`;
  await chrome.tabs.create({ url });
});

$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;

  setStatus("Logging in…");
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Login failed");

    await setToken(data.token);
    await refreshAll();
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
});

// init
refreshAll();
