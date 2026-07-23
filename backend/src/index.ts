import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const PORT = Number(process.env.PORT || 4100);

// 兜底：async 路由里未捕获的 Promise 拒绝（如数据库故障）只记日志，不允许压垮进程
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// PlaceCache 过期清理：启动时 + 每日一次（G-DATA-5）
async function cleanPlaceCache() {
  try {
    const r = await prisma.placeCache.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    });
    if (r.count > 0) console.log(`   PlaceCache 清理过期 ${r.count} 条`);
  } catch (e) {
    console.error("[cleanPlaceCache]", e);
  }
}
cleanPlaceCache();
setInterval(cleanPlaceCache, 24 * 3600 * 1000).unref();

createApp().listen(PORT, () => {
  console.log(`✅ TripMate 后端运行在 http://localhost:${PORT}`);
  console.log(`   平台 LLM key: ${process.env.ANTHROPIC_API_KEY ? "已配置" : "未配置（需用户自带）"}`);
});
