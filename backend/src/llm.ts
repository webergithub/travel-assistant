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

// 演示模式（G-AI-2/PR-P1-1）：不调用 LLM，返回按目的地参数化的固定样例草稿。
// 用途：平台未配 key 时让访客完整体验「生成→预览→应用」流程，同时作为测试夹具。
export function mockItinerary(destination: string, days: number, lang: "zh" | "en"): ItineraryDraft {
  const zh = lang === "zh";
  const tpl: Omit<DraftItem, "searchQuery">[][] = [
    [
      { type: "SIGHT", title: zh ? `${destination}地标广场` : `${destination} Landmark Square`, note: zh ? "上午打卡，建议 2 小时" : "Morning visit, ~2h", startTime: "09:00", cost: 0 },
      { type: "FOOD", title: zh ? "本地招牌午餐" : "Local signature lunch", note: zh ? "尝当地特色" : "Try the local specialty", startTime: "12:00", cost: 60 },
      { type: "SIGHT", title: zh ? `${destination}历史街区` : `${destination} Old Town`, note: zh ? "下午漫步" : "Afternoon stroll", startTime: "14:00", cost: 0 },
      { type: "NOTE", title: zh ? "傍晚休整" : "Evening rest", note: zh ? "回酒店休息，附近晚餐" : "Back to hotel, dinner nearby", startTime: "18:00", cost: 80 },
    ],
    [
      { type: "SIGHT", title: zh ? `${destination}博物馆` : `${destination} Museum`, note: zh ? "了解本地历史，约 3 小时" : "Local history, ~3h", startTime: "09:30", cost: 40 },
      { type: "FOOD", title: zh ? "老字号小吃街" : "Classic food street", note: zh ? "边走边吃" : "Street food crawl", startTime: "12:30", cost: 50 },
      { type: "SIGHT", title: zh ? "城市观景台" : "City viewpoint", note: zh ? "黄昏景色最佳" : "Best at dusk", startTime: "16:30", cost: 30 },
    ],
    [
      { type: "TRANSPORT", title: zh ? "近郊一日往返" : "Day trip to outskirts", note: zh ? "公共交通约 1 小时" : "~1h by public transit", startTime: "08:30", cost: 20 },
      { type: "SIGHT", title: zh ? "自然风景区" : "Nature park", note: zh ? "徒步 + 野餐" : "Hike + picnic", startTime: "10:00", cost: 25 },
      { type: "FOOD", title: zh ? "返程特色晚餐" : "Dinner back in town", note: zh ? "提前订位" : "Reserve ahead", startTime: "19:00", cost: 100 },
    ],
  ];
  const out: DraftDay[] = [];
  for (let d = 0; d < Math.min(days, 10); d++) {
    const base = tpl[d % tpl.length];
    out.push({
      day: d + 1,
      theme: zh ? `演示：第 ${d + 1} 天` : `Demo: day ${d + 1}`,
      items: base.map((it) => ({ ...it, searchQuery: "" })),
    });
  }
  return {
    days: out,
    tips: [
      zh
        ? "⚠ 这是演示数据，未调用 AI、未做地图核验。配置 Claude API Key 后可生成真实行程。"
        : "⚠ Demo data — no AI call, no map verification. Add a Claude API Key for real itineraries.",
    ],
  };
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
