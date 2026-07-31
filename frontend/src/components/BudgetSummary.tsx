import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { curSymbol, TYPE_ICONS, type Item, type ItemType } from "../types";

// 预算汇总（PR-P2-1）：按类型 / 按天两种视图，币种符号跟随行程
export default function BudgetSummary({ items, currency }: { items: Item[]; currency: string }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"type" | "day">("type");
  const sym = curSymbol(currency);

  const scheduled = useMemo(() => items.filter((i) => i.dayIndex >= 0 && i.cost > 0), [items]);
  const total = useMemo(() => scheduled.reduce((s, i) => s + i.cost, 0), [scheduled]);

  const byType = useMemo(() => {
    const m = new Map<ItemType, number>();
    for (const i of scheduled) m.set(i.type, (m.get(i.type) || 0) + i.cost);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [scheduled]);

  const byDay = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of scheduled) m.set(i.dayIndex, (m.get(i.dayIndex) || 0) + i.cost);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [scheduled]);

  if (total === 0) return null;
  const rows = mode === "type" ? byType.map(([k, v]) => [`${TYPE_ICONS[k as ItemType]} ${t(`type_${k}`)}`, v] as const)
    : byDay.map(([d, v]) => [t("day_n", { n: d + 1 }), v] as const);
  const maxV = Math.max(...rows.map((r) => r[1]), 1);

  return (
    <div className="rounded-2xl border border-amber-900/25 bg-[#12100c] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-amber-300">
          {t("budget_title")} {sym}{Math.round(total).toLocaleString()}
        </span>
        <div className="flex gap-1 text-[11px]">
          <button
            onClick={() => setMode("type")}
            className={`px-2 py-0.5 rounded ${mode === "type" ? "bg-amber-600/80 text-black" : "text-stone-400 hover:text-amber-300"}`}
          >
            {t("budget_by_type")}
          </button>
          <button
            onClick={() => setMode("day")}
            className={`px-2 py-0.5 rounded ${mode === "day" ? "bg-amber-600/80 text-black" : "text-stone-400 hover:text-amber-300"}`}
          >
            {t("budget_by_day")}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, v], i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate text-stone-300">{label}</span>
            <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
              <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${(v / maxV) * 100}%` }} />
            </div>
            <span className="w-16 text-right text-stone-400 tabular-nums">{sym}{Math.round(v).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
