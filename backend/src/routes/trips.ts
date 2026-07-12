import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

export const tripsRouter = Router();
tripsRouter.use(requireAuth);

const ITEM_TYPES = ["SIGHT", "FOOD", "HOTEL", "TRANSPORT", "NOTE"] as const;

const tripSchema = z.object({
  title: z.string().min(1).max(80),
  destination: z.string().min(1).max(80),
  days: z.number().int().min(1).max(30),
  startDate: z.string().nullable().optional(), // "2026-08-01"
  notes: z.string().max(5000).optional(),
});

const itemSchema = z.object({
  dayIndex: z.number().int().min(-1).max(29),
  type: z.enum(ITEM_TYPES).default("SIGHT"),
  title: z.string().min(1).max(120),
  note: z.string().max(2000).default(""),
  startTime: z.string().max(5).default(""),
  cost: z.number().min(0).max(1000000).default(0),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  address: z.string().max(300).default(""),
  verified: z.enum(["NONE", "OK", "FAIL"]).default("NONE"),
  source: z.enum(["USER", "AI"]).default("USER"),
});

// 确认行程属于当前用户，否则 404
async function ownTrip(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.ownerId !== userId) return null;
  return trip;
}

const itemsOrdered = { orderBy: [{ dayIndex: "asc" as const }, { sortOrder: "asc" as const }] };

tripsRouter.get("/", async (req, res) => {
  const trips = await prisma.trip.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  res.json({ trips });
});

tripsRouter.post("/", async (req, res) => {
  const parsed = tripSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { title, destination, days, startDate, notes } = parsed.data;
  const trip = await prisma.trip.create({
    data: {
      title,
      destination,
      days,
      notes: notes || "",
      startDate: startDate ? new Date(startDate) : null,
      ownerId: req.user!.id,
    },
  });
  res.json({ trip });
});

tripsRouter.get("/:id", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const items = await prisma.itineraryItem.findMany({ where: { tripId: trip.id }, ...itemsOrdered });
  res.json({ trip, items });
});

tripsRouter.put("/:id", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const parsed = tripSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { startDate, ...rest } = parsed.data;
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
    },
  });
  res.json({ trip: updated });
});

tripsRouter.delete("/:id", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  await prisma.trip.delete({ where: { id: trip.id } });
  res.json({ ok: true });
});

// 开启/关闭只读分享链接
tripsRouter.post("/:id/share", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const enable = Boolean(req.body?.enable);
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: { shareSlug: enable ? trip.shareSlug || randomBytes(6).toString("hex") : null },
  });
  res.json({ shareSlug: updated.shareSlug });
});

// —— 行程项 ——

tripsRouter.post("/:id/items", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const max = await prisma.itineraryItem.aggregate({
    where: { tripId: trip.id, dayIndex: parsed.data.dayIndex },
    _max: { sortOrder: true },
  });
  const item = await prisma.itineraryItem.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? -1) + 1, tripId: trip.id },
  });
  res.json({ item });
});

// AI 草稿批量落库（追加或替换）
tripsRouter.post("/:id/items/bulk", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const body = z
    .object({ mode: z.enum(["append", "replace"]).default("append"), items: z.array(itemSchema).max(200) })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  await prisma.$transaction(async (tx) => {
    if (body.data.mode === "replace") {
      await tx.itineraryItem.deleteMany({ where: { tripId: trip.id, dayIndex: { gte: 0 } } });
    }
    // 每天现有最大序号
    const counters = new Map<number, number>();
    for (const it of body.data.items) {
      if (!counters.has(it.dayIndex)) {
        const max = await tx.itineraryItem.aggregate({
          where: { tripId: trip.id, dayIndex: it.dayIndex },
          _max: { sortOrder: true },
        });
        counters.set(it.dayIndex, (max._max.sortOrder ?? -1) + 1);
      }
      const order = counters.get(it.dayIndex)!;
      counters.set(it.dayIndex, order + 1);
      await tx.itineraryItem.create({ data: { ...it, sortOrder: order, tripId: trip.id } });
    }
  });
  const items = await prisma.itineraryItem.findMany({ where: { tripId: trip.id }, ...itemsOrdered });
  res.json({ items });
});

tripsRouter.put("/:id/items/:itemId", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const found = await prisma.itineraryItem.findFirst({ where: { id: req.params.itemId, tripId: trip.id } });
  if (!found) return res.status(404).json({ error: "行程项不存在" });
  const item = await prisma.itineraryItem.update({ where: { id: found.id }, data: parsed.data });
  res.json({ item });
});

tripsRouter.delete("/:id/items/:itemId", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  await prisma.itineraryItem.deleteMany({ where: { id: req.params.itemId, tripId: trip.id } });
  res.json({ ok: true });
});

// 拖拽/排序后的批量位置更新
tripsRouter.post("/:id/reorder", async (req, res) => {
  const trip = await ownTrip(req.params.id, req.user!.id);
  if (!trip) return res.status(404).json({ error: "行程不存在" });
  const body = z
    .object({
      moves: z.array(z.object({ id: z.string(), dayIndex: z.number().int().min(-1), sortOrder: z.number().int().min(0) })).max(300),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.issues[0].message });

  await prisma.$transaction(
    body.data.moves.map((m) =>
      prisma.itineraryItem.updateMany({
        where: { id: m.id, tripId: trip.id },
        data: { dayIndex: m.dayIndex, sortOrder: m.sortOrder },
      })
    )
  );
  const items = await prisma.itineraryItem.findMany({ where: { tripId: trip.id }, ...itemsOrdered });
  res.json({ items });
});
