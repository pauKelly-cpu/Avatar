"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function AvatarPage() {
  const sp = useSearchParams();
  const returnUrl = sp.get("returnUrl") || "https://www.zalando.de/";
  const state = sp.get("state") || "no-state-yet";

  const safeReturnUrl = useMemo(() => {
    // Minimal safety: only allow returning to Zalando in MVP
    try {
      const u = new URL(returnUrl);
      if (u.hostname.endsWith("zalando.de")) return returnUrl;
      return "https://www.zalando.de/";
    } catch {
      return "https://www.zalando.de/";
    }
  }, [returnUrl]);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 620 }}>
      <h1>Avatar Builder (MVP placeholder)</h1>
      <p>Next steps: build real 3D avatar + save it to the API.</p>

      <div
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginTop: 12,
        }}
      >
        <div>
          <b>returnUrl:</b> {safeReturnUrl}
        </div>
        <div>
          <b>state:</b> {state}
        </div>
      </div>

      <button
        style={{ padding: 10, marginTop: 16 }}
        onClick={() => {
          // For now we simply redirect back.
          // Next step: send a one-time code back to the extension before redirecting.
          window.location.href = safeReturnUrl;
        }}
      >
        Finish & Return
      </button>
    </main>
  );
}
