// Claude 行程生成：输出严格 JSON（结构化数据是主体，AI 只是输入方式之一）
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export interface ItineraryRequest {
  destination: string;
  days: number;
  prefs?: string;
  lang: "zh" | "en";
  userApiKey?: string;
}

// AI 返回的行程草稿结构
export interface DraftItem {
  type: "SIGHT" | "FOOD" | "HOTEL" | "TRANSPORT" | "NOTE";
  title: string;
  note: string;
  startTime: string;
  cost: number;
  searchQuery: string; // 用于地图核验的检索词：'地点官方名 城市'
}
export interface DraftDay {
  day: number;
  theme: string;
  items: DraftItem[];
}
export interface ItineraryDraft {
  days: DraftDay[];
  tips: string[];
}

// 用户自带 key 优先；兼容普通 API Key 与 OAuth 订阅令牌
function resolveClient(userApiKey?: string): Anthropic {
  const key = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const err: any = new Error("NO_API_KEY");
    err.code = "NO_API_KEY";
    throw err;
  }
  if (key.startsWith("sk-ant-oat")) {
    return new Anthropic({
      apiKey: null,
      authToken: key,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  }
  return new Anthropic({ apiKey: key });
}

function buildSystem(lang: "zh" | "en"): string {
  const zh = `你是资深旅行规划师。根据用户的目的地、天数和偏好生成每日行程。

硬性规则：
1. 只输出一个 JSON 对象，不要 markdown 围栏，不要任何解释文字。
2. 只推荐真实存在、知名度较高的地点；没有把握的绝不编造。宁可少推荐，不可虚构。
3. 行程要地理合理：同一天的地点应彼此相近，按顺路顺序排列，考虑开放时间的常识（博物馆白天、夜市晚上）。
4. 每天 3-5 项，含至少一顿当地特色餐饮。节奏合理，不要塞满。
5. cost 为人均预估花费（人民币，门票/餐费；免费为 0）。
6. searchQuery 必须是「地点在地图上的常用官方名称 + 城市名」，便于地图检索核验。

JSON 结构：
{"days":[{"day":1,"theme":"当日主题","items":[{"type":"SIGHT|FOOD|HOTEL|TRANSPORT|NOTE","title":"地点/事项名","note":"一句话说明(含建议游玩时长或点单建议)","startTime":"09:00","cost":0,"searchQuery":"地点名 城市"}]}],"tips":["实用提示1","提示2","提示3"]}`;
  const en = `You are a senior travel planner. Create a day-by-day itinerary from the user's destination, days and preferences.

Hard rules:
1. Output ONE JSON object only. No markdown fences, no prose.
2. Recommend only real, well-known places; NEVER invent places you are unsure about. Fewer but real beats more but fabricated.
3. Be geographically sensible: cluster nearby places in the same day, order them along a route, respect common opening-hour sense.
4. 3-5 items per day incl. at least one local food stop. Keep a humane pace.
5. cost = estimated per-person spend in CNY (0 if free).
6. searchQuery must be "official place name + city" for map verification.

JSON shape:
{"days":[{"day":1,"theme":"...","items":[{"type":"SIGHT|FOOD|HOTEL|TRANSPORT|NOTE","title":"...","note":"one-liner incl. suggested duration","startTime":"09:00","cost":0,"searchQuery":"place city"}]}],"tips":["tip1","tip2","tip3"]}`;
  return lang === "zh" ? zh : en;
}

function stripCodeFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return (m ? m[1] : t).trim();
}

export async function generateItinerary(req: ItineraryRequest): Promise<ItineraryDraft> {
  const client = resolveClient(req.userApiKey);
  const userText =
    req.lang === "zh"
      ? `目的地：${req.destination}\n天数：${req.days} 天\n偏好：${req.prefs || "无特别偏好"}\n请生成行程 JSON。`
      : `Destination: ${req.destination}\nDays: ${req.days}\nPreferences: ${req.prefs || "none"}\nGenerate the itinerary JSON.`;

  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: 8000,
    system: buildSystem(req.lang),
    messages: [{ role: "user", content: userText }],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: ItineraryDraft;
  try {
    parsed = JSON.parse(stripCodeFence(text)) as ItineraryDraft;
  } catch {
    const err: any = new Error("AI 返回的不是有效 JSON");
    err.code = "BAD_AI_JSON";
    throw err;
  }
  if (!Array.isArray(parsed.days)) {
    const err: any = new Error("AI 返回缺少 days 数组");
    err.code = "BAD_AI_JSON";
    throw err;
  }
  parsed.tips = Array.isArray(parsed.tips) ? parsed.tips : [];
  return parsed;
}
