function qs(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

(async () => {
  const msgEl = document.getElementById("msg");

  const code = qs("code");
  const returnUrl = qs("returnUrl") || "https://www.zalando.de/";

  if (!code) {
    msgEl.className = "err";
    msgEl.textContent = "Missing code.";
    return;
  }

  msgEl.textContent = "Logging in to the extension…";

  chrome.runtime.sendMessage(
    { type: "FIT_AVATAR_EXCHANGE", code },
    (response) => {
      if (chrome.runtime.lastError) {
        msgEl.className = "err";
        msgEl.textContent =
          "Extension error: " + chrome.runtime.lastError.message;
        return;
      }
      if (!response?.ok) {
        msgEl.className = "err";
        msgEl.textContent = "Login failed: " + (response?.error || "Unknown");
        return;
      }

      msgEl.className = "ok";
      msgEl.textContent = "Success! Returning you to Zalando…";
      location.href = returnUrl;
    },
  );
})();
