// Fit Avatar - Zalando content script (FULL FILE)

// If Zalando doesn't update :checked immediately, we keep last clicked size.
let lastPickedSizeToken = "";

// -------- page detection ----------
function isProbablyProductPage() {
  // 1) Zalando PDP almost always has one of these
  if (document.querySelector('input[name="size-picker"]')) return true;
  if (document.querySelector('[data-testid="pdp-size-picker-trigger"]'))
    return true;
  if (document.querySelector('[data-testid="pdp-accordion-size_fit"]'))
    return true;

  // 2) Often the title exists + add-to-bag button etc (best-effort)
  const h1 = document.querySelector("h1");
  if (h1 && (h1.textContent || "").trim().length > 0) {
    // if size picker trigger exists somewhere later, it’s PDP
    const maybe = document.querySelector('button[id="picker-trigger"], button');
    if (maybe) return true;
  }

  // 3) meta (optional)
  const ogTypeEl = document.querySelector('meta[property="og:type"]');
  const ogType = ogTypeEl ? ogTypeEl.getAttribute("content") || "" : "";
  if (String(ogType).toLowerCase().includes("product")) return true;

  // 4) last fallback: typical Zalando product urls end with .html
  if (
    location.hostname.endsWith("zalando.de") &&
    location.pathname.endsWith(".html")
  )
    return true;

  return false;
}

// -------- product info ----------
function getProductTitle() {
  const h1El = document.querySelector("h1");
  const h1 = h1El ? (h1El.textContent || "").trim() : "";
  if (h1) return h1;

  const ogEl = document.querySelector('meta[property="og:title"]');
  const og = ogEl ? (ogEl.getAttribute("content") || "").trim() : "";
  if (og) return og;

  const t = (document.title || "").trim();
  return t || "Unknown product";
}

function getBrand() {
  const brandEl = document.querySelector('meta[property="product:brand"]');
  const brandMeta = brandEl
    ? (brandEl.getAttribute("content") || "").trim()
    : "";
  if (brandMeta) return brandMeta;

  const ogEl = document.querySelector('meta[property="og:title"]');
  const og = ogEl ? (ogEl.getAttribute("content") || "").trim() : "";
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
  for (let i = 0; i < letterSizes.length; i++) {
    const sz = letterSizes[i];
    if (t.indexOf(sz) !== -1) return sz;
  }

  // 2) Jeans formats W32L34 or W32/L34
  const m3 = t.match(/W(\d{2})\s*\/?\s*L(\d{2})/);
  if (m3) return "W" + m3[1] + " L" + m3[2];

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

function tryGetZalandoSizeAdvisorText() {
  const acc = document.querySelector('[data-testid="pdp-accordion-size_fit"]');
  if (!acc) return "";

  const txt = (acc.innerText || "").trim();
  if (!txt) return "";

  return txt.slice(0, 2500);
}

function hasSizeAdvisorOnPage() {
  const acc = document.querySelector('[data-testid="pdp-accordion-size_fit"]');
  if (!acc) return false;

  const txt = (acc.innerText || "").toLowerCase();
  return (
    txt.indexOf("größenberater") !== -1 ||
    txt.indexOf("groessenberater") !== -1 ||
    txt.indexOf("passform") !== -1 ||
    txt.indexOf("fit") !== -1
  );
}

function openGroessenberater() {
  const acc = document.querySelector('[data-testid="pdp-accordion-size_fit"]');
  if (!acc) return false;

  const btns = Array.from(acc.querySelectorAll("button"));
  let btn = null;
  for (let i = 0; i < btns.length; i++) {
    const t = (btns[i].textContent || "").toLowerCase();
    if (
      t.indexOf("größenberater öffnen") !== -1 ||
      t.indexOf("groessenberater öffnen") !== -1
    ) {
      btn = btns[i];
      break;
    }
  }

  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function findGroessentabelleOverlay() {
  // Find the top-most fixed overlay that actually has "Größentabelle" text
  const els = Array.from(document.querySelectorAll("body *"));
  let best = null;

  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const s = getComputedStyle(el);
    if (s.position !== "fixed") continue;

    const z = parseInt(s.zIndex || "0", 10);
    if (!Number.isFinite(z) || z < 1000) continue;

    const r = el.getBoundingClientRect();
    if (r.width < 250 || r.height < 250) continue;

    const t = (el.innerText || "").trim();
    if (!t) continue;

    if (
      t.indexOf("Größentabelle") !== -1 ||
      t.indexOf("Groessentabelle") !== -1
    ) {
      if (!best || t.length > best.text.length) {
        best = { el: el, text: t, z: z };
      }
    }
  }

  return best; // { el, text, z } or null
}

function getGroessentabelleText() {
  const o = findGroessentabelleOverlay();
  return o && o.text ? o.text : "";
}

function tryParseMeasurementsFromGroessentabelle(sizeToken) {
  const txt = getGroessentabelleText();
  if (!txt) return null;

  const size = String(sizeToken || "")
    .toUpperCase()
    .trim();

  const lines = txt
    .split("\n")
    .map(function (l) {
      return l.trim();
    })
    .filter(function (l) {
      return Boolean(l);
    });

  // Find the "Körpermaße" section
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().indexOf("körpermaße") !== -1) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  // Header line must include BRUSTUMFANG
  const header = lines[start + 1] || "";
  if (header.toLowerCase().indexOf("brustumfang") === -1) return null;

  // Rows follow (tab-separated). Find row where INT matches size.
  for (let i = start + 2; i < lines.length; i++) {
    const row = lines[i];

    if (row.toLowerCase().indexOf("größentabelle") !== -1) break;

    const cols = row
      .split("\t")
      .map(function (c) {
        return c.trim();
      })
      .filter(function (c) {
        return Boolean(c);
      });

    if (cols.length < 5) continue;

    const eu = cols[0];
    const intSize = String(cols[1] || "").toUpperCase();
    const chest = Number(cols[2]);
    const waist = Number(cols[3]);
    const hips = Number(cols[4]);

    if (intSize !== size) continue;
    if (!(Number.isFinite(chest) && chest > 30 && chest < 200)) continue;
    if (!(Number.isFinite(waist) && waist > 30 && waist < 200)) continue;

    return {
      chestCm: chest,
      waistCm: waist,
      hipsCm: Number.isFinite(hips) ? hips : null,
      raw:
        "EU " +
        eu +
        " INT " +
        intSize +
        " Brust " +
        chest +
        " Taille " +
        waist +
        " Hüfte " +
        hips,
    };
  }

  // Optional fallback: match by EU if selected "44" etc
  const euWanted = /^\d{2}$/.test(size) ? size : null;
  if (euWanted) {
    for (let i = start + 2; i < lines.length; i++) {
      const row = lines[i];
      const cols = row
        .split("\t")
        .map(function (c) {
          return c.trim();
        })
        .filter(function (c) {
          return Boolean(c);
        });
      if (cols.length < 5) continue;
      if (cols[0] !== euWanted) continue;

      const chest = Number(cols[2]);
      const waist = Number(cols[3]);
      const hips = Number(cols[4]);

      if (!Number.isFinite(chest) || !Number.isFinite(waist)) continue;

      return {
        chestCm: chest,
        waistCm: waist,
        hipsCm: Number.isFinite(hips) ? hips : null,
        raw:
          "EU " +
          cols[0] +
          " INT " +
          cols[1] +
          " Brust " +
          chest +
          " Taille " +
          waist +
          " Hüfte " +
          hips,
      };
    }
  }

  return null;
}

function openSizeAdvisorAccordion() {
  const acc = document.querySelector('[data-testid="pdp-accordion-size_fit"]');
  if (!acc) return false;

  const btn = acc.querySelector("h2 > button, button");
  if (!btn) return false;

  const expanded = btn.getAttribute("aria-expanded");
  if (expanded === "true") return true;

  btn.click();
  return true;
}

// -------- FIT LOGIC ----------
function inferTopTypeFromTitle(title) {
  const t = String(title || "").toLowerCase();
  if (
    t.indexOf("hoodie") !== -1 ||
    t.indexOf("kapuzen") !== -1 ||
    t.indexOf("sweat") !== -1
  )
    return "hoodie";
  if (
    t.indexOf("t-shirt") !== -1 ||
    t.indexOf("tshirt") !== -1 ||
    t.indexOf("tee") !== -1
  )
    return "tshirt";
  return "top";
}

function getFitHintFromPage() {
  const nodes = Array.from(
    document.querySelectorAll("span, div, p, dt, dd, li"),
  );

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const t = (el.textContent || "").trim();
    if (!t) continue;

    if (/^Passform\s*:/i.test(t) || /^Fit\s*:/i.test(t)) {
      const lower = t.toLowerCase();
      if (lower.indexOf("oversized") !== -1 || lower.indexOf("weit") !== -1)
        return "oversized";
      if (lower.indexOf("slim") !== -1 || lower.indexOf("eng") !== -1)
        return "slim";
      if (lower.indexOf("regular") !== -1 || lower.indexOf("normal") !== -1)
        return "regular";
    }
  }

  const dts = Array.from(document.querySelectorAll("dt"));
  for (let i = 0; i < dts.length; i++) {
    const dt = dts[i];
    const label = (dt.textContent || "").trim().toLowerCase();
    if (label === "passform" || label === "fit") {
      const dd = dt.nextElementSibling;
      const val = (dd ? dd.textContent : "").trim().toLowerCase();
      if (val.indexOf("oversized") !== -1 || val.indexOf("weit") !== -1)
        return "oversized";
      if (val.indexOf("slim") !== -1 || val.indexOf("eng") !== -1)
        return "slim";
      if (val.indexOf("regular") !== -1 || val.indexOf("normal") !== -1)
        return "regular";
    }
  }

  return "";
}

function fitHintEaseAdjustmentCm(hint, topType) {
  if (hint === "oversized") return topType === "tshirt" ? 8 : 10;
  if (hint === "slim") return -6;
  return 0;
}

const TOP_SIZE_CHART_REGULAR = {
  XXS: { chest: 84, waist: 72 },
  XS: { chest: 88, waist: 76 },
  S: { chest: 96, waist: 84 },
  M: { chest: 104, waist: 92 },
  L: { chest: 112, waist: 100 },
  XL: { chest: 120, waist: 108 },
  XXL: { chest: 128, waist: 116 },
  XXXL: { chest: 136, waist: 124 },
  XXXXL: { chest: 144, waist: 132 },
};

function predictTopFit(args) {
  const avatar = args.avatar;
  const sizeToken = args.sizeToken;
  const title = args.title;

  const normalized = String(sizeToken || "")
    .toUpperCase()
    .trim();
  if (!TOP_SIZE_CHART_REGULAR[normalized]) {
    return {
      ok: false,
      reason:
        "Not supported yet for this size format (supports only XXS–XXXXL).",
    };
  }

  const topType = inferTopTypeFromTitle(title);
  const fitHint = getFitHintFromPage();
  openSizeAdvisorAccordion();

  const parsed = tryParseMeasurementsFromGroessentabelle(normalized);
  const base = TOP_SIZE_CHART_REGULAR[normalized];
  const hintAdj = fitHintEaseAdjustmentCm(fitHint, topType);

  let chartChest = base.chest;
  let chartWaist = base.waist;
  let usedRealChart = false;
  let chartDebug = "";

  if (parsed) {
    chartChest = parsed.chestCm;
    chartWaist = parsed.waistCm;
    usedRealChart = true;
    chartDebug = parsed.raw || "";
  }

  const bodyChest = Number(
    avatar && avatar.chest_cm != null ? avatar.chest_cm : NaN,
  );
  const bodyWaist = Number(
    avatar && avatar.waist_cm != null ? avatar.waist_cm : NaN,
  );

  if (!Number.isFinite(bodyChest) || !Number.isFinite(bodyWaist)) {
    return {
      ok: false,
      reason:
        "Missing chest/waist in your avatar. Add them in the avatar editor.",
    };
  }

  const easeChest = chartChest + hintAdj - bodyChest;
  const easeWaist = chartWaist + hintAdj - bodyWaist;
  const worstEase = Math.min(easeChest, easeWaist);

  const T =
    topType === "hoodie"
      ? { tight: 0, loose: 12 }
      : topType === "tshirt"
        ? { tight: 0, loose: 10 }
        : { tight: 0, loose: 10 };

  let verdict = "OK";
  if (worstEase < T.tight) verdict = "Tight";
  else if (worstEase >= T.loose) verdict = "Loose";

  const confidence = usedRealChart ? "High" : "Low";

  const why =
    "Compared to Zalando Körpermaße for size " +
    normalized +
    ": chest " +
    chartChest +
    " vs you " +
    bodyChest +
    " (" +
    Math.round(easeChest) +
    "cm), waist " +
    chartWaist +
    " vs you " +
    bodyWaist +
    " (" +
    Math.round(easeWaist) +
    "cm).";

  return {
    ok: true,
    verdict: verdict,
    confidence: confidence,
    details: {
      usedRealChart: usedRealChart,
      chartDebug: chartDebug,

      topType: topType,
      fitHint: fitHint,
      hintAdj: hintAdj,

      chartChest: chartChest,
      chartWaist: chartWaist,
      bodyChest: bodyChest,
      bodyWaist: bodyWaist,
      easeChest: easeChest,
      easeWaist: easeWaist,
      why: why,
    },
  };
}

// -------- ui helpers ----------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  const $ = function (sel) {
    return root.querySelector(sel);
  };

  function renderProductInfo() {
    const title = getProductTitle();
    const brand = getBrand();
    const size = getSelectedSize();

    const brandLine = brand
      ? `<div style="color:#555;">Brand: <b>${escapeHtml(brand)}</b></div>`
      : "";

    $("#fa_product").innerHTML = `
      <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(title)}</div>
      ${brandLine}
      <div style="color:#555;">Selected size: <b>${escapeHtml(size || "—")}</b>${size ? "" : " (pick a size)"}</div>
    `;
  }

  $("#fa_close").addEventListener("click", function () {
    root.remove();
  });

  $("#fa_open_editor").addEventListener("click", function () {
    const returnUrl = encodeURIComponent(location.href);
    const url = "http://localhost:3000/avatar?returnUrl=" + returnUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  });

  $("#fa_check").addEventListener("click", function () {
    $("#fa_status").textContent = "Loading avatar…";
    $("#fa_result").textContent = "";

    chrome.runtime.sendMessage({ type: "FIT_AVATAR_GET_ME" }, function (meRes) {
      if (chrome.runtime.lastError) {
        $("#fa_status").textContent = "Extension error.";
        $("#fa_result").textContent = chrome.runtime.lastError.message;
        return;
      }
      if (!meRes || !meRes.ok) {
        $("#fa_status").textContent = "Not logged in.";
        $("#fa_result").innerHTML =
          "Open the extension popup and log in / create your avatar first.";
        return;
      }

      chrome.runtime.sendMessage(
        { type: "FIT_AVATAR_GET_AVATAR" },
        function (avRes) {
          if (!avRes || !avRes.ok) {
            $("#fa_status").textContent = "Could not load avatar.";
            $("#fa_result").textContent =
              (avRes && avRes.error) || "Unknown error";
            return;
          }

          const a = avRes.avatar;
          $("#fa_status").textContent =
            "Logged in as " +
            (meRes.me && meRes.me.user ? meRes.me.user.email : "");

          const size = getSelectedSize();
          const title = getProductTitle();

          if (!size) {
            $("#fa_result").innerHTML = `
            <div style="font-weight:700;margin-bottom:6px;">Pick a size first</div>
            <div style="color:#666;">Select Größe on Zalando, then click “Check my avatar”.</div>
          `;
            renderProductInfo();
            return;
          }

          if (!a) {
            $("#fa_result").innerHTML = `
            <div style="font-weight:700;margin-bottom:6px;">No avatar data yet</div>
            <div>Selected size: <b>${escapeHtml(size)}</b></div>
            <div style="margin-top:8px;color:#666;">Open avatar editor and save measurements.</div>
          `;
            renderProductInfo();
            return;
          }

          let pred = predictTopFit({
            avatar: a,
            sizeToken: size,
            title: title,
          });

          if (!pred.ok) {
            $("#fa_result").innerHTML = `
            <div style="font-weight:700;margin-bottom:6px;">Fit result (v1)</div>
            <div>Selected size: <b>${escapeHtml(size)}</b></div>
            <div style="margin-top:8px;color:#b00020;"><b>Can’t compute:</b> ${escapeHtml(pred.reason)}</div>
          `;
            renderProductInfo();
            return;
          }

          const verdict = pred.verdict;
          const conf = pred.confidence;

          $("#fa_result").innerHTML = `
          <div style="font-weight:700;margin-bottom:6px;">Fit result (v1)</div>
          <div>Selected size: <b>${escapeHtml(size)}</b></div>

          <div style="margin-top:8px;font-size:14px;">
            Result: <b>${escapeHtml(verdict)}</b>
            <span style="color:#666;">(confidence: ${escapeHtml(conf)})</span>
          </div>

          <div style="margin-top:6px;color:#666;">
            Fit hint: <b>${escapeHtml(pred.details.fitHint || "unknown")}</b>
          </div>

          <div style="margin-top:6px;color:#666;">
            Why: <span style="color:#444;">${escapeHtml(pred.details.why || "")}</span>
          </div>

          <div style="margin-top:10px;color:#666;">
            ${pred.details.usedRealChart ? "Using Zalando Größentabelle (Körpermaße) ✅" : "Using fallback chart (MVP)."}
          </div>

          <div style="margin-top:10px;padding:8px;border:1px dashed #ddd;border-radius:10px;color:#444;">
            <div style="font-weight:700;margin-bottom:4px;">Debug</div>

            <div>Top type: <b>${escapeHtml(pred.details.topType)}</b></div>
            <div>Fit hint: <b>${escapeHtml(pred.details.fitHint || "unknown")}</b> (adj: ${pred.details.hintAdj} cm)</div>

            <div>Chest ease: <b>${Math.round(pred.details.easeChest)}</b> cm</div>
            <div>Waist ease: <b>${Math.round(pred.details.easeWaist)}</b> cm</div>

            <div>Used real chart: <b>${pred.details.usedRealChart ? "yes" : "no"}</b></div>

            <div>Overlay found: <b>${findGroessentabelleOverlay() ? "yes" : "no"}</b></div>
            <div>Größentabelle text length: <b>${getGroessentabelleText().length}</b></div>

            ${
              pred.details.chartDebug
                ? `<div style="margin-top:6px;color:#777;">Chart snippet: ${escapeHtml(pred.details.chartDebug)}</div>`
                : ""
            }

            <div style="margin-top:6px;">
              Size advisor found: <b>${hasSizeAdvisorOnPage() ? "yes" : "no"}</b>
            </div>

            <div>Advisor text length: <b>${
              typeof tryGetZalandoSizeAdvisorText === "function"
                ? tryGetZalandoSizeAdvisorText().length
                : 0
            }</b></div>
          </div>
        `;

          renderProductInfo();

          // If not yet real chart, open Größenberater and retry once
          if (!pred.details.usedRealChart && hasSizeAdvisorOnPage()) {
            $("#fa_status").textContent = "Opening Größentabelle…";
            openGroessenberater();

            setTimeout(function () {
              pred = predictTopFit({
                avatar: a,
                sizeToken: size,
                title: title,
              });

              if (pred.ok && pred.details.usedRealChart) {
                $("#fa_status").textContent =
                  "Logged in as " +
                  (meRes.me && meRes.me.user ? meRes.me.user.email : "");

                $("#fa_result").innerHTML = `
                <div style="font-weight:700;margin-bottom:6px;">Fit result (v1)</div>
                <div>Selected size: <b>${escapeHtml(size)}</b></div>

                <div style="margin-top:8px;font-size:14px;">
                  Result: <b>${escapeHtml(pred.verdict)}</b>
                  <span style="color:#666;">(confidence: ${escapeHtml(pred.confidence)})</span>
                </div>

                <div style="margin-top:6px;color:#666;">
                  Fit hint: <b>${escapeHtml(pred.details.fitHint || "unknown")}</b>
                </div>

                <div style="margin-top:6px;color:#666;">
                  Why: <span style="color:#444;">${escapeHtml(pred.details.why || "")}</span>
                </div>

                <div style="margin-top:10px;color:#666;">
                  Using Zalando Größentabelle (Körpermaße) ✅
                </div>

                <div style="margin-top:10px;padding:8px;border:1px dashed #ddd;border-radius:10px;color:#444;">
                  <div style="font-weight:700;margin-bottom:4px;">Debug</div>

                  <div>Top type: <b>${escapeHtml(pred.details.topType)}</b></div>
                  <div>Fit hint: <b>${escapeHtml(pred.details.fitHint || "unknown")}</b> (adj: ${pred.details.hintAdj} cm)</div>

                  <div>Chest ease: <b>${Math.round(pred.details.easeChest)}</b> cm</div>
                  <div>Waist ease: <b>${Math.round(pred.details.easeWaist)}</b> cm</div>

                  <div>Used real chart: <b>${pred.details.usedRealChart ? "yes" : "no"}</b></div>

                  ${
                    pred.details.chartDebug
                      ? `<div style="margin-top:6px;color:#777;">Chart snippet: ${escapeHtml(pred.details.chartDebug)}</div>`
                      : ""
                  }
                </div>
              `;

                renderProductInfo();
              } else {
                $("#fa_status").textContent =
                  "Logged in as " +
                  (meRes.me && meRes.me.user ? meRes.me.user.email : "");
              }
            }, 700);
          }
        },
      );
    });
  });

  // Debounced updates
  let timer = null;
  function scheduleRender() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      renderProductInfo();
    }, 120);
  }

  // Capture size clicks reliably (NO optional chaining)
  document.addEventListener(
    "click",
    function (e) {
      const target = e.target;

      // label click
      let label = null;
      if (target && typeof target.closest === "function") {
        label = target.closest('label[for^="size-picker-"]');
      }

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
        // input click
        let input = null;
        if (target && typeof target.closest === "function") {
          input = target.closest('input[name="size-picker"]');
        }
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

  // Light DOM observer
  const mo = new MutationObserver(scheduleRender);
  if (document.body) {
    mo.observe(document.body, { subtree: true, childList: true });
  }

  // First render
  renderProductInfo();

  return root;
}

// -------- init ----------
(function init() {
  if (!location.hostname.endsWith("zalando.de")) return;

  // small delay because PDP is heavy + client-rendered
  setTimeout(function () {
    if (!isProbablyProductPage()) return;
    if (document.getElementById("fit-avatar-overlay")) return;
    createOverlay();
  }, 1200);
})();
