"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";

type Avatar = {
  id: string;
  height_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  fit_pref: "tight" | "regular" | "loose";
};

export default function AvatarPage() {
  const sp = useSearchParams();
  const returnUrlRaw = sp.get("returnUrl") || "https://www.zalando.de/";
  const extId = sp.get("extId") || ""; // IMPORTANT for redirect into extension

  const safeReturnUrl = useMemo(() => {
    try {
      const u = new URL(returnUrlRaw);
      if (u.hostname.endsWith("zalando.de")) return returnUrlRaw;
      return "https://www.zalando.de/";
    } catch {
      return "https://www.zalando.de/";
    }
  }, [returnUrlRaw]);

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [heightCm, setHeightCm] = useState<number | "">("");
  const [chestCm, setChestCm] = useState<number | "">("");
  const [waistCm, setWaistCm] = useState<number | "">("");
  const [hipsCm, setHipsCm] = useState<number | "">("");
  const [fitPref, setFitPref] = useState<"tight" | "regular" | "loose">(
    "regular",
  );

  useEffect(() => {
    const t = getToken();
    if (!t) {
      window.location.href = `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}&extId=${encodeURIComponent(extId)}`;
      return;
    }
    setToken(t);

    (async () => {
      try {
        const res = await apiGet<{ avatar: Avatar | null }>("/avatar", t);
        if (res.avatar) {
          setHeightCm(res.avatar.height_cm ?? "");
          setChestCm(res.avatar.chest_cm ?? "");
          setWaistCm(res.avatar.waist_cm ?? "");
          setHipsCm(res.avatar.hips_cm ?? "");
          setFitPref(res.avatar.fit_pref ?? "regular");
        }
      } catch (e: any) {
        setStatus(e.message || "Failed to load avatar");
      }
    })();
  }, [safeReturnUrl, extId]);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 620 }}>
      <h1>Avatar Builder (MVP)</h1>
      <p style={{ color: "#444" }}>
        For now we save your measurements (later we add real 3D).
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <label>
          Height (cm)
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="number"
            value={heightCm}
            onChange={(e) =>
              setHeightCm(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>

        <label>
          Chest (cm)
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="number"
            value={chestCm}
            onChange={(e) =>
              setChestCm(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>

        <label>
          Waist (cm)
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="number"
            value={waistCm}
            onChange={(e) =>
              setWaistCm(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>

        <label>
          Hips (cm)
          <input
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            type="number"
            value={hipsCm}
            onChange={(e) =>
              setHipsCm(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>

        <label>
          Fit preference
          <select
            style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={fitPref}
            onChange={(e) => setFitPref(e.target.value as any)}
          >
            <option value="tight">Tight</option>
            <option value="regular">Regular</option>
            <option value="loose">Loose</option>
          </select>
        </label>
      </div>

      <div
        style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <button
          style={{ padding: 10 }}
          onClick={async () => {
            if (!token) return;
            setStatus(null);
            try {
              await apiPost(
                "/avatar",
                {
                  heightCm: heightCm === "" ? null : heightCm,
                  chestCm: chestCm === "" ? null : chestCm,
                  waistCm: waistCm === "" ? null : waistCm,
                  hipsCm: hipsCm === "" ? null : hipsCm,
                  fitPref,
                },
                token,
              );
              setStatus("Saved ✓");
            } catch (e: any) {
              setStatus(e.message || "Save failed");
            }
          }}
        >
          Save
        </button>

        <button
          style={{ padding: 10 }}
          onClick={async () => {
            if (!token) return;
            setStatus(null);

            try {
              // 1) Save avatar measurements
              await apiPost(
                "/avatar",
                {
                  heightCm: heightCm === "" ? null : heightCm,
                  chestCm: chestCm === "" ? null : chestCm,
                  waistCm: waistCm === "" ? null : waistCm,
                  hipsCm: hipsCm === "" ? null : hipsCm,
                  fitPref,
                },
                token,
              );

              // 2) Create one-time code
              const res = await apiPost<{ code: string; expiresAt: number }>(
                "/auth/create-one-time-code",
                {},
                token,
              );

              // 3) Redirect into extension callback page (auto-login)
              if (!extId) {
                // fallback if extId missing
                window.location.href = safeReturnUrl;
                return;
              }

              const callbackUrl =
                `chrome-extension://${extId}/callback.html` +
                `?code=${encodeURIComponent(res.code)}` +
                `&returnUrl=${encodeURIComponent(safeReturnUrl)}`;

              window.location.href = callbackUrl;
            } catch (e: any) {
              setStatus(e.message || "Finish failed");
            }
          }}
        >
          Finish & Return
        </button>

        <button
          style={{ padding: 10 }}
          onClick={() => {
            clearToken();
            window.location.href = `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}&extId=${encodeURIComponent(extId)}`;
          }}
        >
          Log out
        </button>
      </div>

      {status && (
        <p
          style={{
            marginTop: 12,
            color: status.includes("✓") ? "green" : "crimson",
          }}
        >
          {status}
        </p>
      )}
    </main>
  );
}
