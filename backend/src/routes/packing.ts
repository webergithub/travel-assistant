import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import { generatePacking } from "../llm.js";
import { rateLimit } from "../rateLimit.js";

export const packingRouter = Router();
packingRouter.use(requireAuth);

const CATEGORIES = ["DOCS", "CLOTHES", "ELECTRONICS", "TOILETRIES", "MEDS", "OTHER"] as const;

const itemSchema = z.object({
  text: z.string().min(1).max(120),
  category: z.enum(CATEGORIES).default("OTHER"),
  checked: z.boolean().default(false),
});

async function ownTrip(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.ownerId !== userId) return null;
  return trip;
}

const ordered = { orderBy: [{ sortOrder: "asc" as const }] };

// 列表
packingRouter.get("/:tripId", async (req, res) => {
  const trip = await ownTrip(req.params.tripId, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在", code: "TRIP_NOT_FOUND" });
  const items = await prisma.packingItem.findMany({ where: { tripId: trip.id }, ...ordered });
  res.json({ items });
});

// 新增单项
packingRouter.post("/:tripId", async (req, res) => {
  const trip = await ownTrip(req.params.tripId, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在", code: "TRIP_NOT_FOUND" });
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  const max = await prisma.packingItem.aggregate({ where: { tripId: trip.id }, _max: { sortOrder: true } });
  const item = await prisma.packingItem.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? -1) + 1, tripId: trip.id },
  });
  res.json({ item });
});

// 勾选/改文字
packingRouter.put("/:tripId/:itemId", async (req, res) => {
  const trip = await ownTrip(req.params.tripId, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在", code: "TRIP_NOT_FOUND" });
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  const found = await prisma.packingItem.findFirst({ where: { id: req.params.itemId, tripId: trip.id } });
  if (!found) return res.status(404).json({ error: "清单项不存在", code: "PACK_NOT_FOUND" });
  const item = await prisma.packingItem.update({ where: { id: found.id }, data: parsed.data });
  res.json({ item });
});

// 删除
packingRouter.delete("/:tripId/:itemId", async (req, res) => {
  const trip = await ownTrip(req.params.tripId, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在", code: "TRIP_NOT_FOUND" });
  await prisma.packingItem.deleteMany({ where: { id: req.params.itemId, tripId: trip.id } });
  res.json({ ok: true });
});

// AI 生成打包清单（按目的地/天数/季节）；按用户限流
const aiLimiter = rateLimit({ windowMs: 3600_000, max: 20, key: (req) => `pack:${req.user?.id || "anon"}` });
packingRouter.post("/:tripId/generate", aiLimiter, async (req, res) => {
  const trip = await ownTrip(req.params.tripId, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在", code: "TRIP_NOT_FOUND" });
  const body = z.object({ lang: z.enum(["zh", "en"]).default("zh"), demo: z.boolean().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "参数不合法", code: "VALIDATION" });

  const userApiKey = (req.headers["x-user-api-key"] as string | undefined)?.trim() || undefined;
  const month = trip.startDate ? new Date(trip.startDate).getMonth() + 1 : undefined;

  let list;
  try {
    list = await generatePacking({
      destination: trip.destination,
      days: trip.days,
      month,
      lang: body.data.lang,
      userApiKey,
      demo: body.data.demo === true,
    });
  } catch (e: any) {
    if (e?.code === "NO_API_KEY") return res.status(402).json({ error: "未配置 LLM Key", code: "NO_API_KEY" });
    if (e?.code === "BAD_AI_JSON") return res.status(502).json({ error: "AI 输出解析失败，请重试", code: "BAD_AI_JSON" });
    return res.status(502).json({ error: "AI 调用失败", code: "AI_FAILED" });
  }

  // 追加到现有清单（去重：同文字不重复加）
  const existing = new Set(
    (await prisma.packingItem.findMany({ where: { tripId: trip.id }, select: { text: true } })).map((x) => x.text.trim())
  );
  let order = (await prisma.packingItem.aggregate({ where: { tripId: trip.id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
  const toCreate = list.filter((it) => it.text && !existing.has(it.text.trim())).slice(0, 60);
  await prisma.$transaction(
    toCreate.map((it) =>
      prisma.packingItem.create({
        data: {
          text: it.text.slice(0, 120),
          category: CATEGORIES.includes(it.category as any) ? it.category : "OTHER",
          source: "AI",
          sortOrder: ++order,
          tripId: trip.id,
        },
      })
    )
  );
  const items = await prisma.packingItem.findMany({ where: { tripId: trip.id }, ...ordered });
  res.json({ items, added: toCreate.length, demo: body.data.demo === true });
});
