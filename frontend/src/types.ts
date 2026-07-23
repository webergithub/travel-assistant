export type ItemType = "SIGHT" | "FOOD" | "HOTEL" | "TRANSPORT" | "NOTE";
export type Verified = "NONE" | "OK" | "FAIL";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  isGuest?: boolean;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string | null;
  days: number;
  notes: string;
  shareSlug: string | null;
  updatedAt: string;
  _count?: { items: number };
}

export interface Item {
  id: string;
  dayIndex: number; // -1 = 想去清单
  sortOrder: number;
  type: ItemType;
  title: string;
  note: string;
  startTime: string;
  cost: number;
  lat: number | null;
  lng: number | null;
  address: string;
  verified: Verified;
  source: "USER" | "AI";
}

export interface GeoPlace {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  kind: string;
}

// AI 草稿（尚未落库）
export interface DraftItem {
  dayIndex: number;
  type: ItemType;
  title: string;
  note: string;
  startTime: string;
  cost: number;
  lat: number | null;
  lng: number | null;
  address: string;
  verified: Verified;
  source: "AI";
}
export interface AiDraft {
  days: { day: number; theme: string; items: DraftItem[] }[];
  tips: string[];
  demo?: boolean;
}

export interface DayWeather {
  date: string;
  code: number; // WMO weather code
  tmax: number;
  tmin: number;
}

// WMO 天气代码 → 表情
export function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫";
  if (code <= 57) return "🌦";
  if (code <= 67) return "🌧";
  if (code <= 77) return "🌨";
  if (code <= 82) return "🌧";
  if (code <= 86) return "🌨";
  if (code >= 95) return "⛈";
  return "🌡";
}

export function weatherText(w: DayWeather | null | undefined): string {
  if (!w) return "";
  return `${weatherIcon(w.code)} ${Math.round(w.tmax)}°/${Math.round(w.tmin)}°`;
}

export const TYPE_ICONS: Record<ItemType, string> = {
  SIGHT: "🏛",
  FOOD: "🍜",
  HOTEL: "🏨",
  TRANSPORT: "🚌",
  NOTE: "📝",
};

// 每天一个颜色（地图标记 & 列表标头共用）
export const DAY_COLORS = [
  "#e8b86d",
  "#7dd3a0",
  "#7db8e8",
  "#e87d7d",
  "#c77de8",
  "#e8d47d",
  "#7de8dd",
  "#e89b7d",
];
export const WISHLIST_COLOR = "#9b9184";
export const dayColor = (d: number) => (d < 0 ? WISHLIST_COLOR : DAY_COLORS[d % DAY_COLORS.length]);
