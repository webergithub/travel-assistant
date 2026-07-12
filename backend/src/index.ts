import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { optionalAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { tripsRouter } from "./routes/trips.js";
import { placesRouter } from "./routes/places.js";
import { shareRouter } from "./routes/share.js";
import { aiRouter } from "./routes/ai.js";
import { weatherRouter } from "./routes/weather.js";

const app = express();
const PORT = Number(process.env.PORT || 4100);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(optionalAuth);

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, platformKey: Boolean(process.env.ANTHROPIC_API_KEY) })
);

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
  console.log(`   托管前端静态资源: ${publicDir}`);
}

app.listen(PORT, () => {
  console.log(`✅ TripMate 后端运行在 http://localhost:${PORT}`);
  console.log(`   平台 LLM key: ${process.env.ANTHROPIC_API_KEY ? "已配置" : "未配置（需用户自带）"}`);
});
