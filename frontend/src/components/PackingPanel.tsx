import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { apiErrText, useI18n } from "../i18n";
import { useToast } from "./toast";
import { PACK_CATS, type PackCategory, type PackItem } from "../types";

// 行前打包清单（PR-P2-2）：手动增删勾选 + AI 按目的地/季节生成
export default function PackingPanel({ tripId }: { tripId: string }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<PackItem[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const err = (e: any) => apiErrText(e, t);

  useEffect(() => {
    api.listPacking(tripId).then((r) => setItems(r.items)).catch((e) => toast(err(e)));
  }, [tripId]);

  const grouped = useMemo(() => {
    const m = new Map<PackCategory, PackItem[]>();
    for (const it of items || []) {
      if (!m.has(it.category)) m.set(it.category, []);
      m.get(it.category)!.push(it);
    }
    return m;
  }, [items]);

  const done = (items || []).filter((i) => i.checked).length;
  const total = (items || []).length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    try {
      const { item } = await api.addPacking(tripId, { text: v });
      setItems((p) => [...(p || []), item]);
      setText("");
    } catch (e: any) {
      toast(err(e));
    }
  };

  const toggle = async (it: PackItem) => {
    setItems((p) => (p || []).map((x) => (x.id === it.id ? { ...x, checked: !x.checked } : x)));
    try {
      await api.updatePacking(tripId, it.id, { checked: !it.checked });
    } catch (e: any) {
      setItems((p) => (p || []).map((x) => (x.id === it.id ? { ...x, checked: it.checked } : x)));
      toast(err(e));
    }
  };

  const del = async (it: PackItem) => {
    const prev = items;
    setItems((p) => (p || []).filter((x) => x.id !== it.id));
    try {
      await api.deletePacking(tripId, it.id);
    } catch (e: any) {
      setItems(prev);
      toast(err(e));
    }
  };

  const generate = async (demo: boolean) => {
    setBusy(true);
    try {
      const r = await api.generatePacking(tripId, lang, demo);
      setItems(r.items);
      toast(t("packing_added", { n: r.added }));
    } catch (e: any) {
      toast(err(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">{t("packing_title")}</h2>
        {total > 0 && (
          <span className="text-xs text-stone-400">{t("packing_progress", { done, total })}</span>
        )}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("packing_add_ph")}
          className="flex-1 bg-black/40 border border-stone-700 focus:border-amber-700/60 rounded-xl px-3 py-2 text-sm outline-none"
        />
        <button className="px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black text-sm font-medium">＋</button>
      </form>

      <div className="flex gap-2">
        <button
          onClick={() => generate(false)}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black text-xs font-semibold disabled:opacity-60"
        >
          {busy ? t("packing_generating") : t("packing_gen")}
        </button>
        <button
          onClick={() => generate(true)}
          disabled={busy}
          className="px-3 py-1.5 text-xs text-stone-500 hover:text-amber-300 disabled:opacity-60"
        >
          {t("packing_gen_demo")}
        </button>
      </div>

      {items === null ? (
        <p className="text-stone-500 text-sm">{t("loading")}</p>
      ) : total === 0 ? (
        <p className="text-stone-500 text-sm">{t("packing_empty")}</p>
      ) : (
        <div className="space-y-4">
          {PACK_CATS.filter((c) => grouped.has(c.key)).map((c) => (
            <div key={c.key}>
              <h3 className="text-xs font-semibold text-stone-400 mb-1.5">
                {c.icon} {t(`cat_${c.key}`)}
              </h3>
              <div className="space-y-1">
                {grouped.get(c.key)!.map((it) => (
                  <label
                    key={it.id}
                    className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#14110d] border border-stone-800 hover:border-amber-700/40 cursor-pointer"
                  >
                    <input type="checkbox" checked={it.checked} onChange={() => toggle(it)} className="accent-amber-500 w-4 h-4" />
                    <span className={`flex-1 text-sm ${it.checked ? "line-through text-stone-600" : ""}`}>{it.text}</span>
                    {it.source === "AI" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/30">AI</span>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); del(it); }}
                      className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-red-400 text-xs"
                    >
                      🗑
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
