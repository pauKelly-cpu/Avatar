const API_BASE = "http://127.0.0.1:4000";
const KEY_TOKEN = "fit_avatar_token_v1";

async function getToken() {
  const data = await chrome.storage.local.get(KEY_TOKEN);
  return data[KEY_TOKEN] || null;
}

async function setToken(token) {
  await chrome.storage.local.set({ [KEY_TOKEN]: token });
}

async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${path}`);
  return data;
}

async function apiPost(path, body, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed: ${path}`);
  return data;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || !message.type) return;

      // 1) Website -> extension: exchange one-time code for token
      if (message.type === "FIT_AVATAR_EXCHANGE") {
        const { code } = message;
        const data = await apiPost("/auth/exchange-code", { code }, null);
        await setToken(data.token);
        return sendResponse({ ok: true });
      }

      // 2) Content script/popup: get auth status
      if (message.type === "FIT_AVATAR_GET_TOKEN") {
        const token = await getToken();
        return sendResponse({ ok: true, token });
      }

      // 3) Content script/popup: get current user
      if (message.type === "FIT_AVATAR_GET_ME") {
        const token = await getToken();
        if (!token) return sendResponse({ ok: false, error: "Not logged in" });
        const me = await apiGet("/me", token);
        return sendResponse({ ok: true, me });
      }

      // 4) Content script/popup: get avatar
      if (message.type === "FIT_AVATAR_GET_AVATAR") {
        const token = await getToken();
        if (!token) return sendResponse({ ok: false, error: "Not logged in" });
        const av = await apiGet("/avatar", token);
        return sendResponse({ ok: true, avatar: av.avatar || null });
      }
    } catch (e) {
      return sendResponse({ ok: false, error: String(e.message || e) });
    }
  })();

  return true; // async sendResponse
});
