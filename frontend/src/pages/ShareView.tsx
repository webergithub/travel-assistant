import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useI18n } from "../i18n";
import { useToast } from "../components/toast";
import MapPanel, { type MapFocus } from "../components/MapPanel";
import { useTripWeather } from "../components/useWeather";
import { exportCsv, isWeChat, openPrintView } from "../export";
import { dayColor, TYPE_ICONS, weatherText, type Item } from "../types";

interface SharedTrip {
  title: string;
  destination: string;
  days: number;
  startDate: string | null;
  notes: string;
  ownerName: string;
}

export default function ShareView() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const { data: weather } = useTripWeather(trip?.destination || "", trip?.startDate || null, trip?.days || 0);

  useEffect(() => {
    if (!slug) return;
    api
      .getShared(slug)
      .then((r) => { setTrip(r.trip); setItems(r.items); })
      .catch(() => setError(t("share_notfound")));
  }, [slug]);

  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-stone-400">{error}</p>
        <Link to="/" className="text-amber-300 hover:underline text-sm mt-3 inline-block">{t("make_own")}</Link>
      </div>
    );
  }
  if (!trip) return <p className="text-stone-500 p-10">{t("loading")}</p>;

  const byDay = new Map<number, Item[]>();
  for (const it of items) {
    if (!byDay.has(it.dayIndex)) byDay.set(it.dayIndex, []);
    byDay.get(it.dayIndex)!.push(it);
  }

  const fmtDate = (d: number) => {
    if (!trip.startDate) return "";
    const dt = new Date(trip.startDate);
    dt.setDate(dt.getDate() + d);
    return dt.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", weekday: "short" });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-53px)]">
      <div className="lg:w-[46%] lg:min-w-[420px] lg:max-w-[560px] overflow-y-auto p-4 space-y-3">
        <div>
          <h1 className="text-xl font-bold">{trip.title}</h1>
          <p className="text-sm text-stone-400 mt-1">
            📍 {trip.destination} · {trip.days} {t("day_unit")}
            {trip.startDate ? ` · ${String(trip.startDate).slice(0, 10)}` : ""}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {t("shared_by")} {trip.ownerName} ·{" "}
            <Link to="/" className="text-amber-300 hover:underline">{t("make_own")}</Link>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                if (isWeChat()) return toast(t("wechat_hint"));
                if (!openPrintView(trip, items, t, lang, weather)) toast(t("print_blocked"));
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-700/50 text-xs"
            >
              {t("export_print")}
            </button>
            <button
              onClick={() => {
                if (isWeChat()) return toast(t("wechat_hint"));
                exportCsv(trip, items, t, lang);
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-700/50 text-xs"
            >
              {t("export_csv")}
            </button>
          </div>
        </div>

        {(byDay.get(-1) || []).length > 0 && (
          <section className="rounded-2xl border border-stone-800/80 bg-[#100d0a] p-3">
            <h3 className="font-semibold text-sm mb-2 px-1">{t("wishlist")}</h3>
            <div className="space-y-2">
              {(byDay.get(-1) || []).map((it) => (
                <ReadonlyCard key={it.id} item={it} onFocus={setFocus} />
              ))}
            </div>
          </section>
        )}

        {Array.from({ length: trip.days }, (_, d) => (
          <section key={d} className="rounded-2xl border border-stone-800/80 bg-[#100d0a] p-3">
            <header className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: dayColor(d) }} />
              <h3 className="font-semibold text-sm">{t("day_n", { n: d + 1 })}</h3>
              <span className="text-xs text-stone-500">
                {[fmtDate(d), weatherText(weather?.[d])].filter(Boolean).join(" · ")}
              </span>
            </header>
            <div className="space-y-2">
              {(byDay.get(d) || []).map((it) => (
                <ReadonlyCard key={it.id} item={it} onFocus={setFocus} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex-1 h-[320px] lg:h-auto">
        <MapPanel items={items} focus={focus} onTileFallback={() => toast(t("map_fallback"))} />
      </div>
    </div>
  );
}

function ReadonlyCard({ item, onFocus }: { item: Item; onFocus: (f: MapFocus) => void }) {
  const { t } = useI18n();
  return (
    <div
      onClick={() => item.lat != null && onFocus({ lat: item.lat, lng: item.lng!, label: item.title })}
      className="border border-stone-800 rounded-xl p-3 bg-[#14110d] cursor-pointer hover:border-amber-700/40"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span>{TYPE_ICONS[item.type]}</span>
        {item.startTime && <span className="mono text-xs text-amber-300">{item.startTime}</span>}
        <span className="font-medium text-sm">{item.title}</span>
        {item.cost > 0 && <span className="text-xs text-stone-400">¥{item.cost}</span>}
        {item.verified === "OK" && <span className="text-[10px] text-emerald-400">{t("verified_ok")}</span>}
        {item.verified === "UNVERIFIED" && <span className="text-[10px] text-stone-400">{t("verified_unverified")}</span>}
      </div>
      {item.note && <p className="text-xs text-stone-400 mt-1">{item.note}</p>}
    </div>
  );
}
