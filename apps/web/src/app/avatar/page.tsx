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

  const safeReturnUrl = useMemo(() => {
    try {
      const u = new URL(returnUrlRaw);
      // For MVP, only allow returning to zalando.de
      if (u.hostname.endsWith("zalando.de")) return returnUrlRaw;
      return "https://www.zalando.de/";
    } catch {
      return "https://www.zalando.de/";
    }
  }, [returnUrlRaw]);

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadingFinish, setLoadingFinish] = useState(false);

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
      window.location.href = `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
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
        setStatus(e?.message || "Failed to load avatar");
      }
    })();
  }, [safeReturnUrl]);

  async function saveAvatar() {
    if (!token) return;

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
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 620 }}>
      <h1>Avatar Builder (MVP)</h1>
      <p style={{ color: "#444" }}>
        Measurements are <b>circumference</b> (tape measure around your body):
        chest, waist, hips.
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
          Chest circumference (cm)
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
          Waist circumference (natural waist) (cm)
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
          Hips circumference (widest point) (cm)
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
              await saveAvatar();
              setStatus("Saved ✓");
            } catch (e: any) {
              setStatus(e?.message || "Save failed");
            }
          }}
        >
          Save
        </button>

        <button
          style={{ padding: 10 }}
          disabled={loadingFinish}
          onClick={async () => {
            if (!token) return;
            setStatus(null);
            setLoadingFinish(true);

            try {
              // 1) Save avatar
              await saveAvatar();

              // 2) Create one-time code
              const res = await apiPost<{ code: string; expiresAt: number }>(
                "/auth/create-one-time-code",
                {},
                token,
              );

              // 3) Send code to extension (contentScript listens on localhost:3000)
              window.postMessage(
                {
                  type: "FIT_AVATAR_CODE",
                  code: res.code,
                  returnUrl: safeReturnUrl,
                },
                "*",
              );

              // 4) Wait briefly for extension response, then return to Zalando anyway
              const onResult = (event: MessageEvent) => {
                if (event.source !== window) return;
                const data: any = event.data;
                if (!data || data.type !== "FIT_AVATAR_CODE_RESULT") return;

                window.removeEventListener("message", onResult);
                window.location.href = safeReturnUrl;
              };

              window.addEventListener("message", onResult);

              // Failsafe redirect no matter what
              setTimeout(() => {
                window.removeEventListener("message", onResult);
                window.location.href = safeReturnUrl;
              }, 1500);
            } catch (e: any) {
              setStatus(e?.message || "Finish failed");
              setLoadingFinish(false);
            }
          }}
        >
          {loadingFinish ? "Finishing..." : "Finish & Return"}
        </button>

        <button
          style={{ padding: 10 }}
          onClick={() => {
            clearToken();
            window.location.href = `/login?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
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
