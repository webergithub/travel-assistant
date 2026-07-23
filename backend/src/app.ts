import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { prisma } from "./db.js";
import { optionalAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { tripsRouter } from "./routes/trips.js";
import { placesRouter } from "./routes/places.js";
import { shareRouter } from "./routes/share.js";
import { aiRouter } from "./routes/ai.js";
import { weatherRouter } from "./routes/weather.js";

// 组装 Express 应用（不监听端口，便于测试注入）
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(optionalAuth);

  // 健康检查必须触库（KI-10 教训：不触库的 health 对库故障全绿）
  app.get("/api/health", async (_req, res) => {
    let db = "ok";
    try {
      await prisma.user.count();
    } catch {
      db = "fail";
    }
    res.status(db === "ok" ? 200 : 503).json({
      ok: db === "ok",
      db,
      platformKey: Boolean(process.env.ANTHROPIC_API_KEY),
      uptime: Math.round(process.uptime()),
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/trips", tripsRouter);
  app.use("/api/places", placesRouter);
  app.use("/api/share", shareRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/weather", weatherRouter);

  // 生产环境：同进程托管已构建前端（public/），非 /api 请求回退 index.html（配合 HashRouter）
  const publicDir = path.join(process.cwd(), "public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  return app;
}
