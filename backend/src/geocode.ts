// Nominatim (OpenStreetMap) 地理编码：串行队列限速 + SQLite 缓存
// 用途：1) POI 搜索  2) AI 生成行程后的「地点真实性核验」（防幻觉第一道防线）
import { prisma } from "./db.js";

const UA = "TripMate/0.1 (https://opcstudio.cc/travel/; weber1128@gmail.com)";
const MIN_GAP_MS = 1100; // Nominatim 政策：最多 1 req/s
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

export interface GeoPlace {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  kind: string; // nominatim 的 type，如 attraction / restaurant
}

let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

async function fetchNominatim(q: string, limit: number): Promise<GeoPlace[]> {
  const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}` +
    `&accept-language=zh,en&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`geocode failed: ${res.status}`);
  const arr = (await res.json()) as any[];
  return arr.map((r) => ({
    name: r.name || String(r.display_name || "").split(",")[0].trim(),
    displayName: r.display_name || "",
    lat: Number(r.lat),
    lng: Number(r.lon),
    kind: r.type || "",
  }));
}

// 对外入口：先查缓存，未命中则进串行队列请求
export async function searchPlaces(q: string, limit = 6): Promise<GeoPlace[]> {
  const key = `${limit}:${q.trim().toLowerCase()}`;
  const cached = await prisma.placeCache.findUnique({ where: { query: key } });
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    return JSON.parse(cached.resultJson) as GeoPlace[];
  }

  const task = chain.then(
    () => fetchNominatim(q, limit),
    () => fetchNominatim(q, limit) // 前一个失败不影响本次
  );
  chain = task.catch(() => {}); // 队列继续
  const results = await task;

  await prisma.placeCache.upsert({
    where: { query: key },
    create: { query: key, resultJson: JSON.stringify(results) },
    update: { resultJson: JSON.stringify(results), createdAt: new Date() },
  });
  return results;
}

// AI 地点核验三态（G-MAP-2）：OK=找到 / NOT_FOUND=地图查无此地 / UNVERIFIED=核验服务不可用
// 区分后两者，避免把「服务故障」冤枉成「地点不存在」误导用户删除真实地点
export type VerifyStatus = "OK" | "NOT_FOUND" | "UNVERIFIED";

export async function verifyPlace(
  searchQuery: string
): Promise<{ status: VerifyStatus; place?: GeoPlace }> {
  try {
    const results = await searchPlaces(searchQuery, 1);
    if (results.length > 0) return { status: "OK", place: results[0] };
    return { status: "NOT_FOUND" };
  } catch {
    return { status: "UNVERIFIED" };
  }
}
