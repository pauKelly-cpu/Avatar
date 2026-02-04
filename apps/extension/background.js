const API_BASE = "http://localhost:4000";
const KEY_TOKEN = "fit_avatar_token_v1";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || message.type !== "FIT_AVATAR_EXCHANGE") return;

      const { code } = message;

      const res = await fetch(`${API_BASE}/auth/exchange-code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Exchange failed");

      await chrome.storage.local.set({ [KEY_TOKEN]: data.token });

      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message || e) });
    }
  })();

  return true;
});
