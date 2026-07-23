import { useEffect, useState } from "react";
import { api } from "../api";
import type { DayWeather } from "../types";

export interface TripWeather {
  data: (DayWeather | null)[] | null;
  failed: boolean; // true = 尝试过但失败（降级可见，G-UX-2）
}

// 目的地天气：先地理编码目的地（走已有缓存代理），再取 Open-Meteo 预报。
// 失败不打断行程编辑，但通过 failed 标志让界面显示「天气暂不可用」。
export function useTripWeather(
  destination: string,
  startDate: string | null,
  days: number
): TripWeather {
  const [state, setState] = useState<TripWeather>({ data: null, failed: false });

  useEffect(() => {
    let dead = false;
    if (!destination || !startDate) {
      setState({ data: null, failed: false });
      return;
    }
    (async () => {
      try {
        const { results } = await api.searchPlaces(destination);
        if (dead) return;
        if (!results[0]) {
          setState({ data: null, failed: true });
          return;
        }
        const { days: forecast } = await api.weather(
          results[0].lat,
          results[0].lng,
          String(startDate).slice(0, 10),
          Math.min(days, 30)
        );
        if (!dead) setState({ data: forecast, failed: false });
      } catch {
        if (!dead) setState({ data: null, failed: true });
      }
    })();
    return () => {
      dead = true;
    };
  }, [destination, startDate, days]);

  return state;
}
