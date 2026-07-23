import { Router } from "express";
import { prisma } from "../db.js";

export const shareRouter = Router();

// 只读分享：凭 slug 访问，无需登录
shareRouter.get("/:slug", async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { shareSlug: req.params.slug },
    include: { owner: { select: { displayName: true } } },
  });
  if (!trip) return res.status(404).json({ error: "分享链接不存在或已关闭", code: "SHARE_NOT_FOUND" });
  const items = await prisma.itineraryItem.findMany({
    where: { tripId: trip.id },
    orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
  });
  res.json({
    trip: {
      title: trip.title,
      destination: trip.destination,
      days: trip.days,
      startDate: trip.startDate,
      notes: trip.notes,
      ownerName: trip.owner.displayName,
    },
    items,
  });
});
