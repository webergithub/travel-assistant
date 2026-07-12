// 统一 API 客户端：自动带 JWT 与（可选）用户自带 LLM key
import type { AiDraft, DayWeather, GeoPlace, Item, PublicUser, Trip } from "./types";

const TOKEN_KEY = "tripmate_token";
const USER_KEY = "tripmate_user";
const APIKEY_KEY = "tripmate_user_apikey";

export const store = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
  getUser: (): PublicUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (u: PublicUser) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clearUser: () => localStorage.removeItem(USER_KEY),
  getApiKey: () => localStorage.getItem(APIKEY_KEY) || "",
  setApiKey: (k: string) => localStorage.setItem(APIKEY_KEY, k),
};

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  const token = store.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // BASE_URL: dev="/"；prod="/travel/"（nginx 反代剥前缀）
  const base = `${import.meta.env.BASE_URL}api`.replace(/\/\/+/, "/");
  const res = await fetch(`${base}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || `请求失败 (${res.status})`);
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; platformKey: boolean }>("/health"),

  register: (body: { email: string; password: string; displayName?: string }) =>
    request<{ token: string; user: PublicUser }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: PublicUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  guest: (lang: string) =>
    request<{ token: string; user: PublicUser }>("/auth/guest", { method: "POST", body: JSON.stringify({ lang }) }),

  listTrips: () => request<{ trips: Trip[] }>("/trips"),
  createTrip: (body: { title: string; destination: string; days: number; startDate?: string | null }) =>
    request<{ trip: Trip }>("/trips", { method: "POST", body: JSON.stringify(body) }),
  getTrip: (id: string) => request<{ trip: Trip; items: Item[] }>(`/trips/${id}`),
  updateTrip: (id: string, body: Partial<Pick<Trip, "title" | "destination" | "days" | "notes"> & { startDate: string | null }>) =>
    request<{ trip: Trip }>(`/trips/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTrip: (id: string) => request<{ ok: boolean }>(`/trips/${id}`, { method: "DELETE" }),
  shareTrip: (id: string, enable: boolean) =>
    request<{ shareSlug: string | null }>(`/trips/${id}/share`, { method: "POST", body: JSON.stringify({ enable }) }),

  addItem: (tripId: string, body: Partial<Item> & { dayIndex: number; title: string }) =>
    request<{ item: Item }>(`/trips/${tripId}/items`, { method: "POST", body: JSON.stringify(body) }),
  bulkItems: (tripId: string, mode: "append" | "replace", items: Omit<Item, "id" | "sortOrder">[]) =>
    request<{ items: Item[] }>(`/trips/${tripId}/items/bulk`, { method: "POST", body: JSON.stringify({ mode, items }) }),
  updateItem: (tripId: string, itemId: string, body: Partial<Item>) =>
    request<{ item: Item }>(`/trips/${tripId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteItem: (tripId: string, itemId: string) =>
    request<{ ok: boolean }>(`/trips/${tripId}/items/${itemId}`, { method: "DELETE" }),
  reorder: (tripId: string, moves: { id: string; dayIndex: number; sortOrder: number }[]) =>
    request<{ items: Item[] }>(`/trips/${tripId}/reorder`, { method: "POST", body: JSON.stringify({ moves }) }),

  searchPlaces: (q: string) => request<{ results: GeoPlace[] }>(`/places/search?q=${encodeURIComponent(q)}`),

  weather: (lat: number, lng: number, start: string, days: number) =>
    request<{ days: (DayWeather | null)[] }>(`/weather?lat=${lat}&lng=${lng}&start=${start}&days=${days}`),

  getShared: (slug: string) =>
    request<{ trip: { title: string; destination: string; days: number; startDate: string | null; notes: string; ownerName: string }; items: Item[] }>(
      `/share/${slug}`
    ),

  aiItinerary: (body: { destination: string; days: number; prefs?: string; lang: "zh" | "en" }) => {
    const headers: Record<string, string> = {};
    const k = store.getApiKey();
    if (k) headers["x-user-api-key"] = k;
    return request<AiDraft>("/ai/itinerary", { method: "POST", headers, body: JSON.stringify(body) });
  },
};
