// 行程导出：CSV（Excel/递签行程单）与打印视图（浏览器另存为 PDF）
import type { DayWeather, Item } from "./types";
import { TYPE_ICONS, weatherText } from "./types";

export interface ExportTrip {
  title: string;
  destination: string;
  days: number;
  startDate: string | null;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function fmtDate(startDate: string | null, dayIndex: number, lang: string): string {
  if (!startDate) return "";
  const d = new Date(String(startDate).slice(0, 10));
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "trip";
}

function scheduled(items: Item[]): Item[] {
  return items
    .filter((i) => i.dayIndex >= 0)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.sortOrder - b.sortOrder);
}

// —— CSV ——
export function exportCsv(trip: ExportTrip, items: Item[], t: T, lang: string) {
  const header = [
    t("csv_day"), t("csv_date"), t("csv_time"), t("csv_type"),
    t("csv_title"), t("csv_note"), t("csv_cost"), t("csv_address"),
  ];
  // 防 CSV 公式注入（G-SEC-1）：= + - @ 开头的值前缀单引号，Excel 按文本处理
  const q = (v: string | number) => {
    let s = String(v).replace(/"/g, '""');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s}"`;
  };
  const rows = scheduled(items).map((i) =>
    [
      t("day_n", { n: i.dayIndex + 1 }),
      fmtDate(trip.startDate, i.dayIndex, lang),
      i.startTime,
      t(`type_${i.type}`),
      i.title,
      i.note,
      i.cost || "",
      i.address,
    ].map(q).join(",")
  );
  const total = scheduled(items).reduce((s, i) => s + i.cost, 0);
  rows.push(["", "", "", "", t("print_total"), "", total, ""].map(q).join(","));
  const csv = "\uFEFF" + [header.map(q).join(","), ...rows].join("\r\n"); // BOM 让 Excel 正确识别中文

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${safeName(trip.title)}-itinerary.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// —— 打印视图（另存为 PDF）——
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 返回 false = 弹窗被拦截，调用方应提示用户（G-UX-2）
export function openPrintView(
  trip: ExportTrip,
  items: Item[],
  t: T,
  lang: string,
  weather: (DayWeather | null)[] | null
): boolean {
  const list = scheduled(items);
  const total = list.reduce((s, i) => s + i.cost, 0);

  const daysHtml = Array.from({ length: trip.days }, (_, d) => {
    const dayItems = list.filter((i) => i.dayIndex === d);
    const w = weather?.[d] ? ` · ${weatherText(weather[d])}` : "";
    const rows = dayItems
      .map(
        (i) => `<tr>
          <td class="time">${esc(i.startTime)}</td>
          <td class="type">${TYPE_ICONS[i.type]} ${esc(t(`type_${i.type}`))}</td>
          <td><b>${esc(i.title)}</b>${i.note ? `<div class="note">${esc(i.note)}</div>` : ""}${
            i.address ? `<div class="addr">${esc(i.address)}</div>` : ""
          }</td>
          <td class="cost">${i.cost ? `¥${i.cost}` : ""}</td>
        </tr>`
      )
      .join("");
    return `<h2>${esc(t("day_n", { n: d + 1 }))} <span class="sub">${esc(
      fmtDate(trip.startDate, d, lang)
    )}${esc(w)}</span></h2>
    ${dayItems.length ? `<table>${rows}</table>` : `<p class="empty">—</p>`}`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="${lang === "zh" ? "zh-CN" : "en"}"><head><meta charset="utf-8">
<title>${esc(trip.title)}</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; color: #1a1a1a; max-width: 720px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 18px; }
  h2 { font-size: 15px; border-bottom: 2px solid #c9944a; padding-bottom: 4px; margin: 18px 0 8px; }
  h2 .sub { font-weight: normal; color: #888; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .time { width: 52px; color: #b07a2e; font-variant-numeric: tabular-nums; }
  .type { width: 72px; color: #555; white-space: nowrap; }
  .cost { width: 70px; text-align: right; color: #555; }
  .note { color: #555; font-size: 12px; margin-top: 2px; }
  .addr { color: #999; font-size: 11px; margin-top: 2px; }
  .empty { color: #bbb; }
  .total { text-align: right; font-size: 14px; margin-top: 14px; }
  .foot { color: #aaa; font-size: 11px; margin-top: 24px; text-align: center; }
  @media print { body { margin: 0 auto; } }
</style></head><body>
<h1>${esc(trip.title)}</h1>
<div class="meta">📍 ${esc(trip.destination)} · ${trip.days} ${esc(t("day_unit"))}${
    trip.startDate ? ` · ${esc(String(trip.startDate).slice(0, 10))}` : ""
  }</div>
${daysHtml}
${total > 0 ? `<div class="total">${esc(t("print_total"))}: <b>¥${Math.round(total)}</b></div>` : ""}
<div class="foot">TripMate · opcstudio.cc/travel</div>
<script>setTimeout(() => window.print(), 350);</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
