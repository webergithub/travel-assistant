import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";

export const authRouter = Router();

const credsSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
  displayName: z.string().min(1).max(40).optional(),
});

// 限流（G-OPS-3）：注册/登录防暴力，guest 防脚本刷号
const authLimiter = rateLimit({ windowMs: 10 * 60_000, max: 20 });
const guestLimiter = rateLimit({ windowMs: 10 * 60_000, max: 10 });

authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  const { email, password, displayName } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "该邮箱已注册", code: "EMAIL_TAKEN" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName || email.split("@")[0] },
  });

  const pub = { id: user.id, email: user.email, displayName: user.displayName };
  res.json({ token: signToken(pub), user: pub });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = credsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "邮箱或密码错误", code: "BAD_CREDENTIALS" });
  }

  const pub = { id: user.id, email: user.email, displayName: user.displayName, isGuest: user.isGuest };
  res.json({ token: signToken(pub), user: pub });
});

// 一键游客：免注册直接体验，行程照常存云端（游客账号仅本浏览器持有 token）
authRouter.post("/guest", guestLimiter, async (req, res) => {
  const lang = req.body?.lang === "en" ? "en" : "zh";
  const suffix = randomBytes(3).toString("hex");
  const user = await prisma.user.create({
    data: {
      email: `guest_${suffix}_${Date.now()}@guest.tripmate`,
      passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 10),
      displayName: lang === "zh" ? `游客${suffix}` : `Guest-${suffix}`,
      isGuest: true,
    },
  });
  const pub = { id: user.id, email: user.email, displayName: user.displayName, isGuest: true };
  res.json({ token: signToken(pub), user: pub });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// 游客升级正式账号（G-DATA-2/PR-P0-4）：同一 user 行补邮箱密码，行程天然无损保留
authRouter.post("/upgrade", requireAuth, async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: "VALIDATION" });
  }
  const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!me) return res.status(401).json({ error: "需要登录", code: "UNAUTHORIZED" });
  if (!me.isGuest) return res.status(403).json({ error: "仅游客账号可升级", code: "NOT_GUEST" });

  const { email, password, displayName } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "该邮箱已注册", code: "EMAIL_TAKEN" });

  const user = await prisma.user.update({
    where: { id: me.id },
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: displayName || me.displayName,
      isGuest: false,
    },
  });
  const pub = { id: user.id, email: user.email, displayName: user.displayName, isGuest: false };
  res.json({ token: signToken(pub), user: pub });
});
