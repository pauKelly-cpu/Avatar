const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export type AuthResponse = { token: string };

export async function apiPost<T>(
  path: string,
  body: any,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
