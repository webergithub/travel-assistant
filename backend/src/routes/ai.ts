import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { generateItinerary, type ItineraryDraft } from "../llm.js";
import { verifyPlace } from "../geocode.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

const reqSchema = z.object({
  destination: z.string().min(1).max(80),
  days: z.number().int().min(1).max(10),
  prefs: z.string().max(500).optional(),
  lang: z.enum(["zh", "en"]).default("zh"),
});

// 需要地图核验的类型（NOTE/TRANSPORT 不是具体地点）
const VERIFIABLE = new Set(["SIGHT", "FOOD", "HOTEL"]);
const MAX_VERIFY = 40; // 核验总量上限（Nominatim 1req/s，防止超长等待）

// 生成 → 逐项核验 → 返回草稿（不落库；由前端确认后 bulk 写入）
aiRouter.post("/itinerary", async (req, res) => {
  const parsed = reqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const userApiKey = (req.headers["x-user-api-key"] as string | undefined)?.trim() || undefined;

  let draft: ItineraryDraft;
  try {
    draft = await generateItinerary({ ...parsed.data, userApiKey });
  } catch (e: any) {
    if (e?.code === "NO_API_KEY") {
      return res.status(402).json({ error: "未配置 LLM Key", code: "NO_API_KEY" });
    }
    if (e?.code === "BAD_AI_JSON") {
      return res.status(502).json({ error: "AI 输出解析失败，请重试", code: "BAD_AI_JSON" });
    }
    return res.status(502).json({ error: `AI 调用失败: ${String(e?.message || e).slice(0, 200)}` });
  }

  // 防幻觉核验：AI 推荐的每个具体地点都到地图上找一遍
  let verifiedCount = 0;
  const out = [];
  for (const day of draft.days) {
    const items = [];
    for (const it of Array.isArray(day.items) ? day.items : []) {
      const base = {
        dayIndex: (Number(day.day) || 1) - 1,
        type: VERIFIABLE.has(it.type) || it.type === "TRANSPORT" || it.type === "NOTE" ? it.type : "SIGHT",
        title: String(it.title || "").slice(0, 120),
        note: String(it.note || "").slice(0, 2000),
        startTime: String(it.startTime || "").slice(0, 5),
        cost: Math.max(0, Number(it.cost) || 0),
        source: "AI" as const,
        lat: null as number | null,
        lng: null as number | null,
        address: "",
        verified: "NONE" as "NONE" | "OK" | "FAIL",
      };
      if (!base.title) continue;
      if (VERIFIABLE.has(base.type) && verifiedCount < MAX_VERIFY) {
        verifiedCount++;
        const q = String(it.searchQuery || `${base.title} ${parsed.data.destination}`).slice(0, 120);
        const v = await verifyPlace(q);
        if (v.ok && v.place) {
          base.verified = "OK";
          base.lat = v.place.lat;
          base.lng = v.place.lng;
          base.address = v.place.displayName.slice(0, 300);
        } else {
          base.verified = "FAIL";
        }
      }
      items.push(base);
    }
    out.push({ day: Number(day.day) || 1, theme: String(day.theme || ""), items });
  }

  res.json({ days: out, tips: draft.tips.map((t) => String(t)).slice(0, 8) });
});
