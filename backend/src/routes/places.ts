import { Router } from "express";
import { searchPlaces } from "../geocode.js";

export const placesRouter = Router();

// POI 搜索（Nominatim 代理 + 缓存），无需登录
placesRouter.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "缺少查询词" });
  if (q.length > 120) return res.status(400).json({ error: "查询词过长" });
  try {
    const results = await searchPlaces(q, 6);
    res.json({ results });
  } catch (e: any) {
    res.status(502).json({ error: "地点搜索服务暂不可用", detail: String(e?.message || e) });
  }
});
