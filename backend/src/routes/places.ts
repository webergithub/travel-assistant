import { Router } from "express";
import { searchPlaces } from "../geocode.js";
import { rateLimit } from "../rateLimit.js";

export const placesRouter = Router();

// POI 搜索（Nominatim 代理 + 缓存），无需登录；限流保护上游 1req/s 配额
placesRouter.get("/search", rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "缺少查询词", code: "VALIDATION" });
  if (q.length > 120) return res.status(400).json({ error: "查询词过长", code: "VALIDATION" });
  try {
    const results = await searchPlaces(q, 6);
    res.json({ results });
  } catch (e: any) {
    res.status(502).json({ error: "地点搜索服务暂不可用", code: "GEO_UNAVAILABLE", detail: String(e?.message || e) });
  }
});
