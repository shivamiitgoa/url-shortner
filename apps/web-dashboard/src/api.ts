import { AnalyticsResponse, UrlItem } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL;

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listUrls(token: string): Promise<UrlItem[]> {
  const res = await request<{ items: UrlItem[] }>("/v1/urls", token);
  return res.items;
}

export async function createUrl(
  token: string,
  payload: { longUrl: string; customAlias?: string; expiresAt?: string | null; redirectType?: 301 | 302 }
): Promise<UrlItem> {
  return request<UrlItem>("/v1/urls", token, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUrl(
  token: string,
  code: string,
  payload: { status?: "ACTIVE" | "DISABLED"; expiresAt?: string | null; redirectType?: 301 | 302 }
): Promise<UrlItem> {
  return request<UrlItem>(`/v1/urls/${code}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteUrl(token: string, code: string): Promise<void> {
  await request<void>(`/v1/urls/${code}`, token, { method: "DELETE" });
}

export async function fetchAnalytics(token: string, code: string, from: string, to: string): Promise<AnalyticsResponse> {
  return request<AnalyticsResponse>(`/v1/analytics/${code}?from=${from}&to=${to}`, token);
}
