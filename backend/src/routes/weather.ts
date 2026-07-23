import { Router } from "express";
import { z } from "zod";
import { getForecast } from "../weather.js";

export const weatherRouter = Router();

const qSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.coerce.number().int().min(1).max(30),
});

weatherRouter.get("/", async (req, res) => {
  const parsed = qSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "参数不合法", code: "VALIDATION" });
  const { lat, lng, start, days } = parsed.data;
  try {
    const forecast = await getForecast(lat, lng, start, days);
    res.json({ days: forecast });
  } catch (e: any) {
    res.status(502).json({ error: "天气服务暂不可用", code: "WEATHER_UNAVAILABLE", detail: String(e?.message || e) });
  }
});
