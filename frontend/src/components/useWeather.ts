import { useEffect, useState } from "react";
import { api } from "../api";
import type { DayWeather } from "../types";

// 目的地天气：先地理编码目的地（走已有缓存代理），再取 Open-Meteo 预报。
// 静默失败 —— 天气是增强信息，不应打断行程编辑。
export function useTripWeather(
  destination: string,
  startDate: string | null,
  days: number
): (DayWeather | null)[] | null {
  const [weather, setWeather] = useState<(DayWeather | null)[] | null>(null);

  useEffect(() => {
    let dead = false;
    if (!destination || !startDate) {
      setWeather(null);
      return;
    }
    (async () => {
      try {
        const { results } = await api.searchPlaces(destination);
        if (dead || !results[0]) return;
        const { days: forecast } = await api.weather(
          results[0].lat,
          results[0].lng,
          String(startDate).slice(0, 10),
          Math.min(days, 30)
        );
        if (!dead) setWeather(forecast);
      } catch {
        /* 静默 */
      }
    })();
    return () => {
      dead = true;
    };
  }, [destination, startDate, days]);

  return weather;
}
