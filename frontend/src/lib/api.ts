const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
