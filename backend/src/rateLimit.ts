// 轻量固定窗口限流（内存版，单进程足够；G-OPS-3）
// DISABLE_RATE_LIMIT=1 时旁路（测试环境用）
import type { NextFunction, Request, Response } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: (req: Request) => string; // 默认按 IP；可按用户 id
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let lastPrune = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.DISABLE_RATE_LIMIT === "1") return next();

    const now = Date.now();
    // 惰性清理过期桶，防内存增长
    if (now - lastPrune > opts.windowMs) {
      lastPrune = now;
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const key = opts.key ? opts.key(req) : ip;

    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((b.resetAt - now) / 1000));
      return res.status(429).json({ error: "请求过于频繁，请稍后再试", code: "RATE_LIMITED" });
    }
    next();
  };
}
