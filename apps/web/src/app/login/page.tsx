"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        onClick={() => alert("Next step: connect API")}
      >
        Log in
      </button>

      <p style={{ marginTop: 12 }}>
        No account? <a href="/signup">Sign up</a>
      </p>
    </main>
  );
}
