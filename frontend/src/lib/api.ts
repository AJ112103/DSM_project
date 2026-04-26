// Resolve the backend base URL. Browser hits the Render backend directly
// (the old /api/* Vercel rewrite was removed because it added ~500ms of
// proxy overhead). NEXT_PUBLIC_API_URL is the env-driven override; the
// production fallback exists so the deploy keeps working even if the env
// var hasn't been set yet in Vercel project settings.
const PROD_FALLBACK = "https://wacmr-api.onrender.com";
const API_BASE = typeof window !== "undefined" 
  ? (process.env.NEXT_PUBLIC_API_URL || (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? PROD_FALLBACK : ""))
  : (process.env.NEXT_PUBLIC_API_URL || "");

export async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  // Backend returns {error: "..."} as HTTP 200 for missing data — throw so useQuery treats it as error
  if (data && typeof data === "object" && "error" in data && Object.keys(data).length === 1) {
    throw new Error(data.error);
  }
  return data;
}

export async function postAPI(path: string, body: unknown) {
  return fetchAPI(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function streamAPI(path: string, body: unknown) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Exported so call sites that build URLs by hand (e.g. simulate attribution)
// pick up the same resolution rules.
export const apiBase = API_BASE;
