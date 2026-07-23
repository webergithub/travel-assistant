// API 集成测试（G-ENG-1/PR-P1-2）：独立 test.db，真实 Express 实例，覆盖历史返工点。
// 运行：npm test（脚本先 prisma db push --force-reset 建库，再以 DISABLE_RATE_LIMIT=1 跑本文件）
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./test.db";
process.env.JWT_SECRET = "test-secret";

const { createApp } = await import("../src/app.js");
const { rateLimit } = await import("../src/rateLimit.js");

let server: Server;
let base: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  if (typeof addr === "string" || !addr) throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}/api`;
});

after(() => server?.close());

interface Res<T = any> {
  status: number;
  body: T;
}
async function req<T = any>(path: string, opts: RequestInit = {}, token?: string): Promise<Res<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as any) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${base}${path}`, { ...opts, headers });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as T };
}

test("health 触库返回 ok/db", async () => {
  const r = await req("/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.db, "ok");
});

test("游客一键账号 → me 回显", async () => {
  const g = await req("/auth/guest", { method: "POST", body: JSON.stringify({ lang: "zh" }) });
  assert.equal(g.status, 200);
  assert.ok(g.body.token);
  assert.equal(g.body.user.isGuest, true);
  const me = await req("/auth/me", {}, g.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, g.body.user.id);
});

test("注册/重复注册/错误密码登录（错误码）", async () => {
  const email = `u${Date.now()}@t.dev`;
  const r1 = await req("/auth/register", { method: "POST", body: JSON.stringify({ email, password: "secret1" }) });
  assert.equal(r1.status, 200);
  const r2 = await req("/auth/register", { method: "POST", body: JSON.stringify({ email, password: "secret1" }) });
  assert.equal(r2.status, 409);
  assert.equal(r2.body.code, "EMAIL_TAKEN");
  const r3 = await req("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "wrong99" }) });
  assert.equal(r3.status, 401);
  assert.equal(r3.body.code, "BAD_CREDENTIALS");
});

test("行程 CRUD + 属主隔离(404) + 未登录(401)", async () => {
  const a = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;
  const b = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;

  const anon = await req("/trips");
  assert.equal(anon.status, 401);
  assert.equal(anon.body.code, "UNAUTHORIZED");

  const c = await req("/trips", { method: "POST", body: JSON.stringify({ title: "东京", destination: "东京", days: 3 }) }, a);
  assert.equal(c.status, 200);
  const id = c.body.trip.id;

  const other = await req(`/trips/${id}`, {}, b);
  assert.equal(other.status, 404);
  assert.equal(other.body.code, "TRIP_NOT_FOUND");

  const upd = await req(`/trips/${id}`, { method: "PUT", body: JSON.stringify({ title: "东京5日" }) }, a);
  assert.equal(upd.body.trip.title, "东京5日");

  const del = await req(`/trips/${id}`, { method: "DELETE" }, a);
  assert.equal(del.body.ok, true);
  assert.equal((await req(`/trips/${id}`, {}, a)).status, 404);
});

test("行程项：添加/排序/bulk replace 保留想去清单", async () => {
  const tk = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;
  const trip = (await req("/trips", { method: "POST", body: JSON.stringify({ title: "t", destination: "d", days: 2 }) }, tk)).body.trip;

  const wish = await req(`/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify({ dayIndex: -1, title: "愿望点" }) }, tk);
  const i1 = await req(`/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify({ dayIndex: 0, title: "A" }) }, tk);
  const i2 = await req(`/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify({ dayIndex: 0, title: "B" }) }, tk);
  assert.equal(i2.body.item.sortOrder, i1.body.item.sortOrder + 1);

  // 交换次序
  const ro = await req(
    `/trips/${trip.id}/reorder`,
    {
      method: "POST",
      body: JSON.stringify({
        moves: [
          { id: i1.body.item.id, dayIndex: 0, sortOrder: 1 },
          { id: i2.body.item.id, dayIndex: 0, sortOrder: 0 },
        ],
      }),
    },
    tk
  );
  const day0 = ro.body.items.filter((x: any) => x.dayIndex === 0).map((x: any) => x.title);
  assert.deepEqual(day0, ["B", "A"]);

  // replace 清空已排期、保留清单
  const bulk = await req(
    `/trips/${trip.id}/items/bulk`,
    { method: "POST", body: JSON.stringify({ mode: "replace", items: [{ dayIndex: 0, title: "新A", type: "SIGHT", note: "", startTime: "", cost: 0, address: "", verified: "NONE", source: "AI" }] }) },
    tk
  );
  const titles = bulk.body.items.map((x: any) => x.title).sort();
  assert.deepEqual(titles, ["愿望点", "新A"]);
  void wish;
});

test("天数收缩：越界项自动回流想去清单（G-DATA-3）", async () => {
  const tk = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;
  const trip = (await req("/trips", { method: "POST", body: JSON.stringify({ title: "t", destination: "d", days: 5 }) }, tk)).body.trip;
  await req(`/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify({ dayIndex: 4, title: "第五天的点" }) }, tk);

  const upd = await req(`/trips/${trip.id}`, { method: "PUT", body: JSON.stringify({ days: 3 }) }, tk);
  assert.equal(upd.body.movedToWishlist, 1);
  const got = await req(`/trips/${trip.id}`, {}, tk);
  const moved = got.body.items.find((x: any) => x.title === "第五天的点");
  assert.equal(moved.dayIndex, -1);
});

test("分享：开启可匿名读，关闭后 404（错误码）", async () => {
  const tk = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;
  const trip = (await req("/trips", { method: "POST", body: JSON.stringify({ title: "分享测试", destination: "d", days: 1 }) }, tk)).body.trip;

  const on = await req(`/trips/${trip.id}/share`, { method: "POST", body: JSON.stringify({ enable: true }) }, tk);
  assert.ok(on.body.shareSlug);
  const pub = await req(`/share/${on.body.shareSlug}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.trip.title, "分享测试");

  await req(`/trips/${trip.id}/share`, { method: "POST", body: JSON.stringify({ enable: false }) }, tk);
  const gone = await req(`/share/${on.body.shareSlug}`);
  assert.equal(gone.status, 404);
  assert.equal(gone.body.code, "SHARE_NOT_FOUND");
});

test("AI：无 key 402；demo 模式返回演示草稿不核验", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const tk = (await req("/auth/guest", { method: "POST", body: "{}" })).body.token;

  const real = await req("/ai/itinerary", { method: "POST", body: JSON.stringify({ destination: "东京", days: 2 }) }, tk);
  assert.equal(real.status, 402);
  assert.equal(real.body.code, "NO_API_KEY");

  const demo = await req("/ai/itinerary", { method: "POST", body: JSON.stringify({ destination: "东京", days: 2, demo: true }) }, tk);
  assert.equal(demo.status, 200);
  assert.equal(demo.body.demo, true);
  assert.equal(demo.body.days.length, 2);
  assert.ok(demo.body.days[0].items.length >= 3);
  assert.ok(demo.body.days[0].items.every((x: any) => x.verified === "NONE"));
  assert.ok(String(demo.body.tips[0]).includes("演示"));
});

test("places 参数校验不打外网", async () => {
  const r = await req("/places/search?q=");
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "VALIDATION");
});

test("限流中间件：窗口内超额 429（单元）", () => {
  const prevFlag = process.env.DISABLE_RATE_LIMIT;
  delete process.env.DISABLE_RATE_LIMIT; // 单测限流本体，不受旁路影响
  const mw = rateLimit({ windowMs: 60_000, max: 2 });
  const mkRes = () => {
    const r: any = { statusCode: 200, headers: {} as Record<string, unknown>, body: null };
    r.setHeader = (k: string, v: unknown) => (r.headers[k] = v);
    r.status = (c: number) => ((r.statusCode = c), r);
    r.json = (b: unknown) => ((r.body = b), r);
    return r;
  };
  const fakeReq: any = { headers: {}, socket: { remoteAddress: "1.2.3.4" } };
  let passed = 0;
  for (let i = 0; i < 3; i++) {
    const res = mkRes();
    mw(fakeReq, res, () => passed++);
    if (i < 2) assert.equal(res.statusCode, 200);
    else {
      assert.equal(res.statusCode, 429);
      assert.equal(res.body.code, "RATE_LIMITED");
    }
  }
  assert.equal(passed, 2);
  if (prevFlag !== undefined) process.env.DISABLE_RATE_LIMIT = prevFlag;
});
