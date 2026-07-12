// Open-Meteo 天气预报代理（免 key）：预报范围今天起 16 天，范围外返回 null 占位
// 内存缓存 15 分钟，避免频繁转发

export interface DayWeather {
  date: string; // YYYY-MM-DD
  code: number; // WMO weather code
  tmax: number;
  tmin: number;
}

const cache = new Map<string, { at: number; data: (DayWeather | null)[] }>();
const TTL_MS = 15 * 60 * 1000;
const HORIZON_DAYS = 15;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getForecast(
  lat: number,
  lng: number,
  start: string,
  days: number
): Promise<(DayWeather | null)[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${start},${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const startD = new Date(`${start}T00:00:00Z`);
  if (isNaN(startD.getTime())) throw new Error("bad start date");

  const today = new Date(`${ymd(new Date())}T00:00:00Z`);
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000);

  // 行程各天的日期串
  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(ymd(new Date(startD.getTime() + i * 86400000)));

  // 与可预报窗口 [today, horizon] 求交集
  const reqDates = dates.filter((d) => d >= ymd(today) && d <= ymd(horizon));
  let byDate = new Map<string, DayWeather>();
  if (reqDates.length > 0) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto` +
      `&start_date=${reqDates[0]}&end_date=${reqDates[reqDates.length - 1]}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = (await res.json()) as any;
    const t = j?.daily?.time || [];
    for (let i = 0; i < t.length; i++) {
      byDate.set(t[i], {
        date: t[i],
        code: Number(j.daily.weather_code?.[i] ?? 0),
        tmax: Number(j.daily.temperature_2m_max?.[i] ?? 0),
        tmin: Number(j.daily.temperature_2m_min?.[i] ?? 0),
      });
    }
  }

  const data = dates.map((d) => byDate.get(d) ?? null);
  cache.set(key, { at: Date.now(), data });
  return data;
}
