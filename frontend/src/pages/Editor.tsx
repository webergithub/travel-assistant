import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { apiErrText, useI18n } from "../i18n";
import { useToast } from "../components/toast";
import MapPanel, { type MapFocus } from "../components/MapPanel";
import { useTripWeather } from "../components/useWeather";
import { exportCsv, openPrintView } from "../export";
import { dayColor, TYPE_ICONS, weatherText, type AiDraft, type GeoPlace, type Item, type ItemType, type Trip } from "../types";

const TYPES: ItemType[] = ["SIGHT", "FOOD", "HOTEL", "TRANSPORT", "NOTE"];

function fmtDayDate(startDate: string | null, dayIndex: number, lang: string): string {
  if (!startDate) return "";
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", weekday: "short" });
}

// —— 行程项卡片 ——
function ItemCard({
  item,
  onDelete,
  onSave,
  onFocus,
  onMove,
  draggable,
}: {
  item: Item;
  onDelete: () => void;
  onSave: (patch: Partial<Item>) => void;
  onFocus: () => void;
  onMove: (dir: -1 | 1) => void;
  draggable: boolean;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: item.title, note: item.note, startTime: item.startTime, cost: item.cost, type: item.type });

  useEffect(() => {
    setForm({ title: item.title, note: item.note, startTime: item.startTime, cost: item.cost, type: item.type });
  }, [item]);

  if (editing) {
    return (
      <div className="border border-amber-700/40 rounded-xl p-3 bg-black/30 space-y-2">
        <div className="flex gap-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ItemType })}
            className="bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {TYPE_ICONS[ty]} {t(`type_${ty}`)}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-sm w-28"
          />
          <input
            type="number"
            min={0}
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })}
            className="bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-sm w-24"
            title="¥"
          />
        </div>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
        />
        <input
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder={t("it_note_ph")}
          className="w-full bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-stone-400 px-2 py-1">{t("cancel")}</button>
          <button
            onClick={() => { onSave(form); setEditing(false); }}
            className="text-xs px-3 py-1 rounded-lg bg-amber-600 text-black font-medium"
          >
            {t("save")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).classList.add("tm-dragging");
      }}
      onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("tm-dragging")}
      onClick={onFocus}
      className="group border border-stone-800 hover:border-amber-700/50 rounded-xl p-3 bg-[#14110d] cursor-grab transition"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-6 select-none">{TYPE_ICONS[item.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.startTime && <span className="mono text-xs text-amber-300">{item.startTime}</span>}
            <span className="font-medium text-sm">{item.title}</span>
            {item.cost > 0 && <span className="text-xs text-stone-400">¥{item.cost}</span>}
            {item.source === "AI" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/30">{t("from_ai")}</span>
            )}
            {item.verified === "OK" && <span className="text-[10px] text-emerald-400">{t("verified_ok")}</span>}
            {item.verified === "FAIL" && <span className="text-[10px] text-orange-400">{t("verified_fail")}</span>}
          </div>
          {item.note && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{item.note}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onMove(-1)} className="text-stone-500 hover:text-amber-300 text-xs px-1" title="↑">↑</button>
          <button onClick={() => onMove(1)} className="text-stone-500 hover:text-amber-300 text-xs px-1" title="↓">↓</button>
          <button onClick={() => setEditing(true)} className="text-stone-500 hover:text-amber-300 text-xs px-1" title="✏️">✏️</button>
          <button onClick={onDelete} className="text-stone-500 hover:text-red-400 text-xs px-1" title={t("del")}>🗑</button>
        </div>
      </div>
    </div>
  );
}

// —— 每日分组容器（含想去清单 dayIndex=-1）——
function DaySection({
  dayIndex,
  title,
  subtitle,
  items,
  onDrop,
  children,
  addForm,
}: {
  dayIndex: number;
  title: string;
  subtitle?: string;
  items: Item[];
  onDrop: (itemId: string, dayIndex: number) => void;
  children: (item: Item) => React.ReactNode;
  addForm?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id, dayIndex);
      }}
      className={`rounded-2xl border border-stone-800/80 bg-[#100d0a] p-3 ${over ? "tm-drop-target" : ""}`}
    >
      <header className="flex items-center gap-2 mb-2 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dayColor(dayIndex) }} />
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && <span className="text-xs text-stone-500">{subtitle}</span>}
      </header>
      <div className="space-y-2">
        {items.map((it) => children(it))}
        {addForm}
      </div>
    </section>
  );
}

// —— 行内添加表单 ——
function AddItemForm({ onAdd, compact }: { onAdd: (title: string, type: ItemType) => Promise<void>; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ItemType>("SIGHT");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full text-left text-xs text-stone-500 hover:text-amber-300 px-2 py-1.5">
        {t("add_item")}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        await onAdd(title.trim(), type);
        setTitle("");
        setBusy(false);
        if (compact) setOpen(false);
      }}
      className="flex gap-1.5"
    >
      <select value={type} onChange={(e) => setType(e.target.value as ItemType)} className="bg-black/40 border border-stone-700 rounded-lg px-1.5 py-1.5 text-xs">
        {TYPES.map((ty) => (
          <option key={ty} value={ty}>{TYPE_ICONS[ty]}</option>
        ))}
      </select>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("it_title_ph")}
        className="flex-1 bg-black/40 border border-stone-700 rounded-lg px-2 py-1.5 text-xs"
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <button disabled={busy} className="text-xs px-2.5 rounded-lg bg-amber-600 text-black font-medium disabled:opacity-50">＋</button>
    </form>
  );
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const nav = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  // 搜索
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoPlace[] | null>(null);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrefs, setAiPrefs] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getTrip(id)
      .then((r) => { setTrip(r.trip); setItems(r.items); })
      .catch((e) => {
        toast(apiErrText(e, t));
        nav(e.status === 401 ? "/login" : "/");
      });
  }, [id]);

  const byDay = useMemo(() => {
    const m = new Map<number, Item[]>();
    for (const it of items) {
      if (!m.has(it.dayIndex)) m.set(it.dayIndex, []);
      m.get(it.dayIndex)!.push(it);
    }
    for (const list of m.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [items]);

  const budget = useMemo(() => items.filter((i) => i.dayIndex >= 0).reduce((s, i) => s + i.cost, 0), [items]);
  const { data: weather, failed: weatherFailed } = useTripWeather(trip?.destination || "", trip?.startDate || null, trip?.days || 0);
  const err = (e: any) => apiErrText(e, t);

  if (!trip) return <p className="text-stone-500 p-10">{t("loading")}</p>;

  const saveTrip = async (patch: Parameters<typeof api.updateTrip>[1]) => {
    try {
      const { trip: updated, movedToWishlist } = await api.updateTrip(trip.id, patch);
      setTrip((prev) => ({ ...prev!, ...updated }));
      // 天数收缩把越界项移回了想去清单：刷新列表并明示（G-DATA-3）
      if (movedToWishlist && movedToWishlist > 0) {
        const { items: fresh } = await api.getTrip(trip.id);
        setItems(fresh);
        toast(t("moved_wish", { n: movedToWishlist }));
      }
    } catch (e: any) {
      toast(err(e));
    }
  };

  const addItem = async (dayIndex: number, title: string, type: ItemType, place?: GeoPlace) => {
    try {
      const { item } = await api.addItem(trip.id, {
        dayIndex,
        title,
        type,
        ...(place ? { lat: place.lat, lng: place.lng, address: place.displayName.slice(0, 300), verified: "OK" as const } : {}),
      });
      setItems((prev) => [...prev, item]);
      if (place) setFocus({ lat: place.lat, lng: place.lng, label: place.name });
    } catch (e: any) {
      toast(err(e));
    }
  };

  // 乐观删除 + 失败回滚（G-UX-3）
  const delItem = async (item: Item) => {
    const prev = items;
    setItems((p) => p.filter((x) => x.id !== item.id));
    try {
      await api.deleteItem(trip.id, item.id);
    } catch (e: any) {
      setItems(prev);
      toast(err(e));
    }
  };

  const saveItem = async (item: Item, patch: Partial<Item>) => {
    try {
      const { item: updated } = await api.updateItem(trip.id, item.id, patch);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      toast(err(e));
    }
  };

  // 拖拽换天：放到目标天末尾
  const dropTo = async (itemId: string, dayIndex: number) => {
    const item = items.find((x) => x.id === itemId);
    if (!item || item.dayIndex === dayIndex) return;
    const target = byDay.get(dayIndex) || [];
    const newOrder = target.length ? Math.max(...target.map((x) => x.sortOrder)) + 1 : 0;
    setItems((prev) => prev.map((x) => (x.id === itemId ? { ...x, dayIndex, sortOrder: newOrder } : x)));
    try {
      const { items: fresh } = await api.reorder(trip.id, [{ id: itemId, dayIndex, sortOrder: newOrder }]);
      setItems(fresh);
    } catch (e: any) {
      toast(err(e));
    }
  };

  // 同天内上下移动
  const moveItem = async (item: Item, dir: -1 | 1) => {
    const list = byDay.get(item.dayIndex) || [];
    const idx = list.findIndex((x) => x.id === item.id);
    const other = list[idx + dir];
    if (!other) return;
    const moves = [
      { id: item.id, dayIndex: item.dayIndex, sortOrder: other.sortOrder },
      { id: other.id, dayIndex: other.dayIndex, sortOrder: item.sortOrder },
    ];
    setItems((prev) =>
      prev.map((x) => {
        const m = moves.find((mm) => mm.id === x.id);
        return m ? { ...x, sortOrder: m.sortOrder } : x;
      })
    );
    api.reorder(trip.id, moves).then((r) => setItems(r.items)).catch((e) => toast(err(e)));
  };

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const kw = q.trim();
    if (!kw) return;
    setSearching(true);
    setResults(null);
    try {
      const query = kw.includes(trip.destination) ? kw : `${kw} ${trip.destination}`;
      const { results: r } = await api.searchPlaces(query);
      setResults(r);
      if (r[0]) setFocus({ lat: r[0].lat, lng: r[0].lng, label: r[0].name });
    } catch (e: any) {
      toast(err(e));
    } finally {
      setSearching(false);
    }
  };

  const toggleShare = async () => {
    try {
      const enable = !trip.shareSlug;
      const { shareSlug } = await api.shareTrip(trip.id, enable);
      setTrip((prev) => ({ ...prev!, shareSlug }));
      if (shareSlug) {
        const url = `${location.origin}${location.pathname}#/s/${shareSlug}`;
        const copied = await navigator.clipboard.writeText(url).then(() => true).catch(() => false);
        toast(copied ? t("share_on") : t("copy_manual"));
        if (!copied) window.prompt(t("copy_manual"), url); // 剪贴板被拒时给可手动复制的兜底
      } else {
        toast(t("share_off"));
      }
    } catch (e: any) {
      toast(err(e));
    }
  };

  const copyShare = async () => {
    if (!trip.shareSlug) return;
    const url = `${location.origin}${location.pathname}#/s/${trip.shareSlug}`;
    const copied = await navigator.clipboard.writeText(url).then(() => true).catch(() => false);
    if (copied) toast(t("copied"));
    else window.prompt(t("copy_manual"), url);
  };

  const runAi = async (demo = false) => {
    setAiBusy(true);
    setAiDraft(null);
    try {
      const draft = await api.aiItinerary({
        destination: trip.destination,
        days: Math.min(trip.days, 10),
        prefs: aiPrefs || undefined,
        lang,
        ...(demo ? { demo: true } : {}),
      });
      setAiDraft(draft);
    } catch (e: any) {
      toast(err(e));
    } finally {
      setAiBusy(false);
    }
  };

  const applyAi = async (mode: "append" | "replace") => {
    if (!aiDraft) return;
    if (mode === "replace" && !confirm(t("ai_confirm_replace"))) return;
    try {
      const flat = aiDraft.days.flatMap((d) => d.items);
      const { items: fresh } = await api.bulkItems(trip.id, mode, flat as any);
      setItems(fresh);
      setAiDraft(null);
      setAiOpen(false);
      toast(t("ai_applied"));
    } catch (e: any) {
      toast(err(e));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-53px)]">
      {/* 左栏：行程列表 */}
      <div className="lg:w-[46%] lg:min-w-[420px] lg:max-w-[560px] overflow-y-auto p-4 space-y-3">
        {/* 行程头 */}
        <div className="space-y-2">
          <input
            ref={titleRef}
            defaultValue={trip.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== trip.title && saveTrip({ title: e.target.value.trim() })}
            className="w-full bg-transparent text-xl font-bold border-b border-transparent focus:border-amber-700/50 outline-none py-1"
          />
          <div className="flex items-center gap-3 flex-wrap text-sm text-stone-400">
            <span>📍 {trip.destination}</span>
            <label className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={30}
                value={trip.days}
                onChange={(e) => {
                  const d = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                  setTrip((prev) => ({ ...prev!, days: d }));
                  saveTrip({ days: d });
                }}
                className="w-14 bg-black/40 border border-stone-700 rounded px-1.5 py-0.5 text-xs"
              />
              {t("day_unit")}
            </label>
            <input
              type="date"
              value={trip.startDate ? String(trip.startDate).slice(0, 10) : ""}
              onChange={(e) => {
                setTrip((prev) => ({ ...prev!, startDate: e.target.value || null }));
                saveTrip({ startDate: e.target.value || null });
              }}
              className="bg-black/40 border border-stone-700 rounded px-1.5 py-0.5 text-xs"
            />
            {budget > 0 && (
              <span className="text-amber-300">
                {t("total_budget")} ¥{Math.round(budget)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAiOpen(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black text-xs font-semibold">
              {t("ai_btn")}
            </button>
            <button
              onClick={toggleShare}
              className={`px-3 py-1.5 rounded-lg border text-xs ${trip.shareSlug ? "border-emerald-700/50 text-emerald-300" : "border-stone-700 text-stone-300 hover:border-amber-700/50"}`}
            >
              {t("share_btn")}{trip.shareSlug ? " ✓" : ""}
            </button>
            {trip.shareSlug && (
              <button onClick={copyShare} className="text-xs text-stone-400 hover:text-amber-300">{t("copy_link")}</button>
            )}
            <button
              onClick={() => { if (!openPrintView(trip, items, t, lang, weather)) toast(t("print_blocked")); }}
              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-700/50 text-xs"
            >
              {t("export_print")}
            </button>
            <button
              onClick={() => exportCsv(trip, items, t, lang)}
              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-700/50 text-xs"
            >
              {t("export_csv")}
            </button>
            {weatherFailed && <span className="text-[11px] text-stone-500">{t("weather_unavail")}</span>}
          </div>
        </div>

        {/* 地点搜索 */}
        <form onSubmit={doSearch} className="relative">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search_ph")}
              className="flex-1 bg-black/40 border border-stone-700 focus:border-amber-700/60 rounded-xl px-3 py-2.5 text-sm outline-none"
            />
            <button type="submit" className="px-4 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-black text-sm font-semibold shrink-0">
              🔍
            </button>
          </div>
          {(searching || results) && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-[#171310] border border-stone-700 rounded-xl z-20 max-h-72 overflow-y-auto shadow-2xl">
              {searching && <p className="text-xs text-stone-500 p-3">{t("searching")}</p>}
              {results && results.length === 0 && <p className="text-xs text-stone-500 p-3">{t("no_results")}</p>}
              {results?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-black/30 border-b border-stone-800/60 last:border-0">
                  <button
                    type="button"
                    onClick={() => setFocus({ lat: r.lat, lng: r.lng, label: r.name })}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm truncate">{r.name}</p>
                    <p className="text-[11px] text-stone-500 truncate">{r.displayName}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { addItem(-1, r.name, "SIGHT", r); setResults(null); setQ(""); }}
                    className="text-xs px-2 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-black font-medium shrink-0"
                  >
                    {t("add_to_wishlist")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>
        <p className="text-[11px] text-stone-600">{t("drag_hint")}</p>

        {/* 想去清单 */}
        <DaySection
          dayIndex={-1}
          title={t("wishlist")}
          subtitle={t("wishlist_hint")}
          items={byDay.get(-1) || []}
          onDrop={dropTo}
          addForm={<AddItemForm onAdd={(title, type) => addItem(-1, title, type)} />}
        >
          {(it) => (
            <ItemCard
              key={it.id}
              item={it}
              draggable
              onDelete={() => delItem(it)}
              onSave={(patch) => saveItem(it, patch)}
              onMove={(dir) => moveItem(it, dir)}
              onFocus={() => it.lat != null && setFocus({ lat: it.lat!, lng: it.lng!, label: it.title })}
            />
          )}
        </DaySection>

        {/* 逐日 */}
        {Array.from({ length: trip.days }, (_, d) => (
          <DaySection
            key={d}
            dayIndex={d}
            title={t("day_n", { n: d + 1 })}
            subtitle={[fmtDayDate(trip.startDate, d, lang), weatherText(weather?.[d])].filter(Boolean).join(" · ")}
            items={byDay.get(d) || []}
            onDrop={dropTo}
            addForm={<AddItemForm compact onAdd={(title, type) => addItem(d, title, type)} />}
          >
            {(it) => (
              <ItemCard
                key={it.id}
                item={it}
                draggable
                onDelete={() => delItem(it)}
                onSave={(patch) => saveItem(it, patch)}
                onMove={(dir) => moveItem(it, dir)}
                onFocus={() => it.lat != null && setFocus({ lat: it.lat!, lng: it.lng!, label: it.title })}
              />
            )}
          </DaySection>
        ))}
      </div>

      {/* 右栏：地图 */}
      <div className="flex-1 h-[320px] lg:h-auto relative">
        <MapPanel
          items={items}
          focus={focus}
          onMarkerClick={(itemId) => {
            const it = items.find((x) => x.id === itemId);
            if (it?.lat != null) setFocus({ lat: it.lat, lng: it.lng!, label: it.title });
          }}
        />
      </div>

      {/* AI 抽屉 */}
      {aiOpen && (
        <div className="fixed inset-y-0 right-0 w-[min(94vw,460px)] bg-[#12100c] border-l border-amber-900/30 z-50 flex flex-col shadow-2xl">
          <header className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
            <h3 className="font-bold">{t("ai_title")}</h3>
            <button onClick={() => setAiOpen(false)} className="text-stone-500 hover:text-stone-300">✕</button>
          </header>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs text-stone-400 leading-relaxed">{t("ai_desc")}</p>
            {trip.days > 10 && <p className="text-xs text-orange-300">{t("ai_days_capped")}</p>}
            <div>
              <label className="text-xs text-stone-400">{t("ai_prefs")}</label>
              <textarea
                value={aiPrefs}
                onChange={(e) => setAiPrefs(e.target.value)}
                placeholder={t("ai_prefs_ph")}
                rows={3}
                className="mt-1 w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>
            <button
              onClick={() => runAi(false)}
              disabled={aiBusy}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold text-sm disabled:opacity-60"
            >
              {aiBusy ? t("ai_generating") : t("ai_generate")}
            </button>
            <button
              onClick={() => runAi(true)}
              disabled={aiBusy}
              className="w-full py-1.5 text-xs text-stone-500 hover:text-amber-300 disabled:opacity-60"
            >
              {t("ai_demo_btn")}
            </button>

            {aiDraft && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => applyAi("append")} className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-medium">
                    {t("ai_apply_append")}
                  </button>
                  <button onClick={() => applyAi("replace")} className="flex-1 py-2 rounded-lg border border-orange-700/60 text-orange-300 hover:bg-orange-900/20 text-sm">
                    {t("ai_apply_replace")}
                  </button>
                  <button onClick={() => setAiDraft(null)} className="px-3 py-2 text-xs text-stone-500 hover:text-stone-300">
                    {t("ai_discard")}
                  </button>
                </div>
                {aiDraft.days.map((d) => (
                  <div key={d.day}>
                    <h4 className="text-sm font-semibold mb-1.5" style={{ color: dayColor(d.day - 1) }}>
                      {t("day_n", { n: d.day })} {d.theme && <span className="text-stone-400 font-normal">· {d.theme}</span>}
                    </h4>
                    <div className="space-y-1.5">
                      {d.items.map((it, i) => (
                        <div key={i} className="border border-stone-800 rounded-lg px-3 py-2 bg-black/20">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span>{TYPE_ICONS[it.type]}</span>
                            {it.startTime && <span className="mono text-xs text-amber-300">{it.startTime}</span>}
                            <span className="font-medium">{it.title}</span>
                            {it.cost > 0 && <span className="text-xs text-stone-500">¥{it.cost}</span>}
                            {it.verified === "OK" && <span className="text-[10px] text-emerald-400">{t("verified_ok")}</span>}
                            {it.verified === "FAIL" && <span className="text-[10px] text-orange-400">{t("verified_fail")}</span>}
                          </div>
                          {it.note && <p className="text-xs text-stone-500 mt-1">{it.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {aiDraft.tips.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1.5 text-amber-300">💡 {t("ai_tips")}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-stone-400">
                      {aiDraft.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
