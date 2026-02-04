"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const sp = useSearchParams();
  const returnUrl = sp.get("returnUrl") || "";
  const state = sp.get("state") || "";
  const extId = sp.get("extId") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next =
    `/avatar?returnUrl=${encodeURIComponent(returnUrl)}` +
    `&state=${encodeURIComponent(state)}` +
    `&extId=${encodeURIComponent(extId)}`;

  const signupLink =
    `/signup?returnUrl=${encodeURIComponent(returnUrl)}` +
    `&state=${encodeURIComponent(state)}` +
    `&extId=${encodeURIComponent(extId)}`;

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 420 }}>
      <h1>Log in</h1>

      <label>Email</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <label>Password</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
      />

      <button
        style={{ padding: 10, width: "100%" }}
        disabled={loading}
        onClick={async () => {
          setStatus(null);
          setLoading(true);
          try {
            const res = await apiPost<{ token: string }>("/auth/login", {
              email,
              password,
            });
            saveToken(res.token);
            window.location.href = next;
          } catch (e: any) {
            setStatus(e?.message || "Login failed");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Logging in..." : "Log in"}
      </button>

      {status && <p style={{ color: "crimson", marginTop: 12 }}>{status}</p>}

      <p style={{ marginTop: 12 }}>
        No account? <a href={signupLink}>Sign up</a>
      </p>
    </main>
  );
}
