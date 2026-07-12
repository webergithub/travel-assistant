import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { signToken, requireAuth } from "../auth.js";

export const authRouter = Router();

const credsSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
  displayName: z.string().min(1).max(40).optional(),
});

authRouter.post("/register", async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, displayName } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "该邮箱已注册" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName: displayName || email.split("@")[0] },
  });

  const pub = { id: user.id, email: user.email, displayName: user.displayName };
  res.json({ token: signToken(pub), user: pub });
});

authRouter.post("/login", async (req, res) => {
  const parsed = credsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "邮箱或密码错误" });
  }

  const pub = { id: user.id, email: user.email, displayName: user.displayName, isGuest: user.isGuest };
  res.json({ token: signToken(pub), user: pub });
});

// 一键游客：免注册直接体验，行程照常存云端（游客账号仅本浏览器持有 token）
authRouter.post("/guest", async (req, res) => {
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
