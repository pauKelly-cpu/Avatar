const API_BASE = "http://localhost:4000";
const KEY_TOKEN = "fit_avatar_token_v1";

function setStatus(msg, kind = "") {
  const el = document.getElementById("status");
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

async function refreshStatus() {
  const token = await getToken();
  if (!token) return setStatus("Not logged in.");

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Auth failed");
    setStatus(`Logged in: ${data.user.email}`, "ok");
  } catch {
    setStatus("Token invalid. Please log in again.", "err");
  }
}

document
  .getElementById("createAvatarBtn")
  .addEventListener("click", async () => {
    // Get current page so we can return to it
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const returnUrl = encodeURIComponent(tab?.url || "https://www.zalando.de/");
    const state = encodeURIComponent(Math.random().toString(16).slice(2));
    const extId = encodeURIComponent(chrome.runtime.id);

    // We send extId so the website knows where to redirect on Finish
    const url = `http://localhost:3000/signup?returnUrl=${returnUrl}&state=${state}&extId=${extId}`;
    await chrome.tabs.create({ url });
  });

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await clearToken();
  setStatus("Logged out.", "ok");
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setStatus("Logging in...");
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Login failed");

    await setToken(data.token);
    setStatus("Logged in ✓", "ok");
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
});

refreshStatus();
