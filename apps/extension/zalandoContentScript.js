// If Zalando doesn't update :checked immediately, we keep last clicked size.
let lastPickedSizeToken = "";

// -------- page detection ----------
function isProbablyProductPage() {
  if (
    location.hostname.endsWith("zalando.de") &&
    location.pathname.includes("/p/")
  )
    return true;

  const ogType =
    document
      .querySelector('meta[property="og:type"]')
      ?.getAttribute("content") || "";
  if (ogType.toLowerCase().includes("product")) return true;

  return false;
}

// -------- product info ----------
function getProductTitle() {
  const h1 = document.querySelector("h1")?.textContent?.trim();
  if (h1) return h1;

  const og = document
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
    ?.trim();
  if (og) return og;

  return document.title?.trim() || "Unknown product";
}

function getBrand() {
  const brandMeta = document
    .querySelector('meta[property="product:brand"]')
    ?.getAttribute("content")
    ?.trim();
  if (brandMeta) return brandMeta;

  const og =
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.trim() || "";
  if (og.includes("-")) {
    const maybe = og.split("-")[0].trim();
    if (maybe.length > 1 && maybe.length < 40) return maybe;
  }
  return "";
}

// -------- robust size parsing (NO word boundaries) ----------
function parseSizeTokenFromString(s) {
  const t = String(s || "").toUpperCase();

  // 1) Letter sizes: order matters (longest first)
  const letterSizes = [
    "XXXXL",
    "XXXL",
    "XXL",
    "XL",
    "L",
    "M",
    "S",
    "XS",
    "XXS",
  ];
  for (const sz of letterSizes) {
    if (t.includes(sz)) return sz;
  }

  // 2) Jeans formats W32L34 or W32/L34
  const m3 = t.match(/W(\d{2})\s*\/?\s*L(\d{2})/);
  if (m3) return `W${m3[1]} L${m3[2]}`;

  // 3) Numeric sizes: 32/34, 42.5, 42
  const m2 = t.match(/(\d{2}\/\d{2})/);
  if (m2) return m2[1];

  const m25 = t.match(/(\d{2}\.5)/);
  if (m25) return m25[1];

  const mNum = t.match(/(\d{2})/);
  if (mNum) return mNum[1];

  return "";
}

function getSelectedSize() {
  // Zalando size picker: checkboxes with name="size-picker"
  const picked = document.querySelector('input[name="size-picker"]:checked');
  if (picked) {
    const token =
      parseSizeTokenFromString(picked.id || "") ||
      parseSizeTokenFromString(picked.value || "");
    if (token) return token;
  }

  // fallback: last click captured
  if (lastPickedSizeToken) return lastPickedSizeToken;

  // other layouts fallback (best-effort)
  const aria =
    document.querySelector('[role="radiogroup"] [aria-checked="true"]') ||
    document.querySelector('[role="listbox"] [aria-selected="true"]') ||
    document.querySelector('button[aria-pressed="true"]');
  if (aria) {
    const token = parseSizeTokenFromString((aria.textContent || "").trim());
    if (token) return token;
  }

  const select = document.querySelector(
    'select[name*="size" i], select[id*="size" i], select',
  );
  if (select && select.selectedOptions && select.selectedOptions.length) {
    const token = parseSizeTokenFromString(
      select.selectedOptions[0].textContent || "",
    );
    if (token) return token;
  }

  return "";
}

// -------- ui helpers ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -------- overlay ----------
function createOverlay() {
  const root = document.createElement("div");
  root.id = "fit-avatar-overlay";
  root.style.position = "fixed";
  root.style.right = "16px";
  root.style.bottom = "16px";
  root.style.width = "300px";
  root.style.zIndex = "2147483647";
  root.style.background = "white";
  root.style.border = "1px solid rgba(0,0,0,0.15)";
  root.style.borderRadius = "14px";
  root.style.boxShadow = "0 10px 30px rgba(0,0,0,0.15)";
  root.style.fontFamily = "system-ui, Arial";
  root.style.padding = "12px";

  root.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between;">
      <div style="font-weight:700;">Fit Avatar</div>
      <button id="fa_close" style="border:none;background:transparent;cursor:pointer;font-size:16px;">✕</button>
    </div>

    <div id="fa_product" style="margin-top:8px;font-size:12px;color:#111;line-height:1.35;"></div>
    <div id="fa_status" style="font-size:12px;color:#444;margin-top:8px;">Ready.</div>

    <button id="fa_check" style="margin-top:10px;width:100%;padding:10px;border-radius:10px;border:1px solid #ddd;background:#111;color:#fff;cursor:pointer;">
      Check my avatar
    </button>

    <button id="fa_open_editor" style="margin-top:8px;width:100%;padding:10px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#111;cursor:pointer;">
      Open avatar editor
    </button>

    <div id="fa_result" style="margin-top:10px;font-size:12px;color:#111;line-height:1.4;"></div>
  `;

  document.documentElement.appendChild(root);

  const $ = (sel) => root.querySelector(sel);

  function renderProductInfo() {
    const title = getProductTitle();
    const brand = getBrand();
    const size = getSelectedSize();

    $("#fa_product").innerHTML = `
      <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(title)}</div>
      ${brand ? `<div style="color:#555;">Brand: <b>${escapeHtml(brand)}</b></div>` : ""}
      <div style="color:#555;">Selected size: <b>${escapeHtml(size || "—")}</b>${size ? "" : " (pick a size)"}</div>
    `;
  }

  $("#fa_close").addEventListener("click", () => root.remove());

  $("#fa_open_editor").addEventListener("click", () => {
    const returnUrl = encodeURIComponent(location.href);
    const url = `http://localhost:3000/avatar?returnUrl=${returnUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#fa_check").addEventListener("click", () => {
    $("#fa_status").textContent = "Loading avatar…";
    $("#fa_result").textContent = "";

    chrome.runtime.sendMessage({ type: "FIT_AVATAR_GET_ME" }, (meRes) => {
      if (chrome.runtime.lastError) {
        $("#fa_status").textContent = "Extension error.";
        $("#fa_result").textContent = chrome.runtime.lastError.message;
        return;
      }
      if (!meRes?.ok) {
        $("#fa_status").textContent = "Not logged in.";
        $("#fa_result").innerHTML =
          `Open the extension popup and log in / create your avatar first.`;
        return;
      }

      chrome.runtime.sendMessage({ type: "FIT_AVATAR_GET_AVATAR" }, (avRes) => {
        if (!avRes?.ok) {
          $("#fa_status").textContent = "Could not load avatar.";
          $("#fa_result").textContent = avRes?.error || "Unknown error";
          return;
        }

        const a = avRes.avatar;
        $("#fa_status").textContent = `Logged in as ${meRes.me.user.email}`;

        const size = getSelectedSize();
        const sizeLine = size
          ? `<div>Selected size: <b>${escapeHtml(size)}</b></div>`
          : `<div>Selected size: <b>—</b></div>`;

        if (!a) {
          $("#fa_result").innerHTML = `
            <div style="font-weight:700;margin-bottom:6px;">No avatar data yet</div>
            ${sizeLine}
            <div style="margin-top:8px;color:#666;">Open avatar editor and save measurements.</div>
          `;
          return;
        }

        $("#fa_result").innerHTML = `
          <div style="font-weight:700;margin-bottom:6px;">Avatar loaded ✅</div>
          ${sizeLine}
          <div style="margin-top:8px;">
            Height: <b>${a.height_cm ?? "—"} cm</b><br/>
            Chest: <b>${a.chest_cm ?? "—"} cm</b><br/>
            Waist: <b>${a.waist_cm ?? "—"} cm</b><br/>
            Hips: <b>${a.hips_cm ?? "—"} cm</b><br/>
            Fit pref: <b>${a.fit_pref ?? "—"}</b>
          </div>
        `;

        renderProductInfo();
      });
    });
  });

  // Debounced updates
  let timer = null;
  const scheduleRender = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(renderProductInfo, 120);
  };

  // Capture size clicks reliably:
  // any click inside a size-picker label/input sets lastPickedSizeToken from id/value.
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target;

      // If click happens inside label tied to size-picker
      const label = target?.closest?.('label[for^="size-picker-"]');
      if (label) {
        const forId = label.getAttribute("for");
        if (forId) {
          const input = document.getElementById(forId);
          if (input && input.getAttribute("name") === "size-picker") {
            const token =
              parseSizeTokenFromString(input.id || "") ||
              parseSizeTokenFromString(input.value || "");
            if (token) lastPickedSizeToken = token;
          }
        }
      } else {
        // Or click directly on the input
        const input = target?.closest?.('input[name="size-picker"]');
        if (input) {
          const token =
            parseSizeTokenFromString(input.id || "") ||
            parseSizeTokenFromString(input.value || "");
          if (token) lastPickedSizeToken = token;
        }
      }

      scheduleRender();
    },
    true,
  );

  document.addEventListener("change", scheduleRender, true);

  // Light DOM observer (no attributes)
  const mo = new MutationObserver(scheduleRender);
  if (document.body)
    mo.observe(document.body, { subtree: true, childList: true });

  renderProductInfo();
  return root;
}

// -------- init ----------
(function init() {
  if (!location.hostname.endsWith("zalando.de")) return;

  setTimeout(() => {
    if (!isProbablyProductPage()) return;
    if (document.getElementById("fit-avatar-overlay")) return;
    createOverlay();
  }, 1200);
})();
