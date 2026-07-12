import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// 与 OPC Studio 主站共享同一语言 key，进入子模块沿用主站语言
const LANG_KEY = "opcstudio_lang";
export type Lang = "zh" | "en";

type Dict = Record<string, string>;

const ZH: Dict = {
  brand1: "旅行",
  brand2: "助手",
  back_home: "← 返回主页",
  login: "登录 / 注册",
  logout: "退出",
  keyBtn: "Key",

  // 首页
  hero_a: "地图式",
  hero_b: "行程工作台",
  hero_sub: "AI 生成行程草稿，每个地点经地图核验真伪；逐日安排 · 地图可视化 · 一键分享。",
  my_trips: "我的行程",
  new_trip: "+ 新建行程",
  guest_try: "游客体验 →",
  guest_hint: "免注册直接开始，行程保存在云端（仅本浏览器可访问）",
  trips_empty: "还没有行程，点「新建行程」开始规划吧。",
  items_unit: "项安排",
  day_unit: "天",
  confirm_del_trip: "确定删除这个行程？不可撤销。",
  loading: "加载中…",

  // 新建行程
  nt_title: "新建行程",
  nt_name: "行程名称",
  nt_name_ph: "例如：东京五日游",
  nt_dest: "目的地（城市）",
  nt_dest_ph: "例如：东京",
  nt_days: "天数",
  nt_start: "出发日期（可选）",
  create: "创建",
  cancel: "取消",
  save: "保存",

  // 编辑器
  wishlist: "🌟 想去清单",
  wishlist_hint: "搜索地点加入，再拖到某一天",
  day_n: "第 {n} 天",
  add_item: "+ 添加",
  it_title_ph: "名称（景点/餐厅/备注…）",
  it_note_ph: "备注（可选）",
  search_ph: "搜索地点，如「浅草寺」…",
  searching: "搜索中…",
  no_results: "没找到，换个关键词试试",
  add_to_wishlist: "＋想去",
  locate: "定位",
  total_budget: "预算合计",
  share_btn: "🔗 分享",
  share_on: "已开启只读分享，链接已复制",
  share_off: "已关闭分享",
  copy_link: "复制链接",
  copied: "已复制",
  verified_ok: "✓ 地图已核验",
  verified_fail: "⚠ 未在地图找到",
  from_ai: "AI",
  del: "删除",
  drag_hint: "拖动卡片可在天与清单间移动",

  // AI 面板
  ai_btn: "✨ AI 生成行程",
  ai_title: "AI 行程草稿",
  ai_desc: "按目的地与偏好生成逐日行程；每个地点会到地图核验真伪，未找到的会标 ⚠，采纳前请自行确认。",
  ai_prefs: "偏好（可选）",
  ai_prefs_ph: "例如：亲子游 / 喜欢美食和博物馆 / 节奏慢一点…",
  ai_generate: "生成草稿",
  ai_generating: "生成中… 约 1 分钟（含逐个地点核验）",
  ai_apply_append: "＋ 追加到行程",
  ai_apply_replace: "⟳ 替换现有安排",
  ai_applied: "已写入行程",
  ai_discard: "丢弃",
  ai_tips: "实用提示",
  ai_confirm_replace: "将清空现有逐日安排（想去清单保留），确定替换？",
  toast_no_key: "未配置 LLM。点右上角 🔑 填入你的 Claude API Key 后重试。",
  toast_ai_fail: "AI 生成失败",

  // Key 弹窗
  key_title: "自带 Claude API Key",
  key_desc: "填写后 AI 生成用你自己的额度。仅保存在本浏览器，不上传。留空则用平台额度（若已配置）。",

  // 登录页
  login_title: "登录",
  register_title: "注册",
  auth_hint: "登录后行程云端保存、跨设备访问；也可以用游客模式直接体验。",
  nickname_ph: "昵称（可选）",
  email_ph: "邮箱",
  password_ph: "密码（至少 6 位）",
  processing: "处理中…",
  to_register: "没有账号？去注册",
  to_login: "已有账号？去登录",
  or_guest: "或者：游客一键体验 →",

  // 分享页
  shared_by: "分享自",
  share_notfound: "分享链接不存在或已关闭",
  make_own: "我也要规划 →",

  type_SIGHT: "景点",
  type_FOOD: "餐饮",
  type_HOTEL: "住宿",
  type_TRANSPORT: "交通",
  type_NOTE: "备注",
};

const EN: Dict = {
  brand1: "Trip",
  brand2: "Mate",
  back_home: "← Home",
  login: "Sign in",
  logout: "Sign out",
  keyBtn: "Key",

  hero_a: "Map-first ",
  hero_b: "trip workspace",
  hero_sub: "AI drafts your itinerary and every place is fact-checked on the map. Day-by-day planning · map view · one-click sharing.",
  my_trips: "My trips",
  new_trip: "+ New trip",
  guest_try: "Try as guest →",
  guest_hint: "No sign-up needed. Trips are saved in the cloud (accessible from this browser).",
  trips_empty: "No trips yet — click \"New trip\" to start planning.",
  items_unit: "items",
  day_unit: "days",
  confirm_del_trip: "Delete this trip? This cannot be undone.",
  loading: "Loading…",

  nt_title: "New trip",
  nt_name: "Trip name",
  nt_name_ph: "e.g. 5 days in Tokyo",
  nt_dest: "Destination (city)",
  nt_dest_ph: "e.g. Tokyo",
  nt_days: "Days",
  nt_start: "Start date (optional)",
  create: "Create",
  cancel: "Cancel",
  save: "Save",

  wishlist: "🌟 Wishlist",
  wishlist_hint: "Search places to add, then drag into a day",
  day_n: "Day {n}",
  add_item: "+ Add",
  it_title_ph: "Name (sight / restaurant / note…)",
  it_note_ph: "Note (optional)",
  search_ph: "Search places, e.g. “Senso-ji”…",
  searching: "Searching…",
  no_results: "No results — try another keyword",
  add_to_wishlist: "+ Wishlist",
  locate: "Locate",
  total_budget: "Budget total",
  share_btn: "🔗 Share",
  share_on: "Read-only sharing enabled, link copied",
  share_off: "Sharing disabled",
  copy_link: "Copy link",
  copied: "Copied",
  verified_ok: "✓ Map-verified",
  verified_fail: "⚠ Not found on map",
  from_ai: "AI",
  del: "Delete",
  drag_hint: "Drag cards between days and the wishlist",

  ai_btn: "✨ AI itinerary",
  ai_title: "AI itinerary draft",
  ai_desc: "Generates a day-by-day plan from your destination and preferences. Every place is checked against the map — unfound ones get ⚠; confirm before adopting.",
  ai_prefs: "Preferences (optional)",
  ai_prefs_ph: "e.g. family trip / love food & museums / slow pace…",
  ai_generate: "Generate draft",
  ai_generating: "Generating… ~1 min (incl. per-place verification)",
  ai_apply_append: "+ Append to trip",
  ai_apply_replace: "⟳ Replace current plan",
  ai_applied: "Added to your trip",
  ai_discard: "Discard",
  ai_tips: "Tips",
  ai_confirm_replace: "This clears the current day-by-day plan (wishlist kept). Replace?",
  toast_no_key: "No LLM configured. Click 🔑 top-right to add your Claude API Key, then retry.",
  toast_ai_fail: "AI generation failed",

  key_title: "Your Claude API Key",
  key_desc: "Once set, AI uses your own quota. Stored only in this browser, never uploaded. Leave empty to use the platform key (if configured).",

  login_title: "Sign in",
  register_title: "Register",
  auth_hint: "Signed in, trips are saved to the cloud across devices. Or just try guest mode.",
  nickname_ph: "Nickname (optional)",
  email_ph: "Email",
  password_ph: "Password (min 6 chars)",
  processing: "Processing…",
  to_register: "No account? Register",
  to_login: "Have an account? Sign in",
  or_guest: "Or: one-click guest mode →",

  shared_by: "Shared by",
  share_notfound: "This share link doesn't exist or was disabled",
  make_own: "Plan my own →",

  type_SIGHT: "Sight",
  type_FOOD: "Food",
  type_HOTEL: "Stay",
  type_TRANSPORT: "Transit",
  type_NOTE: "Note",
};

const DICTS: Record<Lang, Dict> = { zh: ZH, en: EN };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem(LANG_KEY) as Lang) || "zh");

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  };
  const toggle = () => setLang(lang === "zh" ? "en" : "zh");
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
