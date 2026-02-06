// Runs on http://localhost:3000/*
// Listens for a message from the website and forwards it to the extension background.

window.addEventListener("message", (event) => {
  // Only accept messages from the same page
  if (event.source !== window) return;

  const msg = event.data;
  if (!msg || msg.type !== "FIT_AVATAR_CODE") return;

  const { code, returnUrl } = msg;

  chrome.runtime.sendMessage(
    { type: "FIT_AVATAR_EXCHANGE", code },
    (response) => {
      // Reply back to the page so it knows if it worked
      window.postMessage(
        {
          type: "FIT_AVATAR_CODE_RESULT",
          ok: !!response?.ok,
          error: response?.error || null,
          returnUrl,
        },
        "*",
      );
    },
  );
});
