import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { apiErrText, useI18n } from "../i18n";
import { useToast } from "../components/toast";
import type { Trip } from "../types";

function NewTripModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Trip) => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { trip } = await api.createTrip({
        title: title.trim() || `${destination.trim()} · ${days}${t("day_unit")}`,
        destination: destination.trim(),
        days,
        startDate: startDate || null,
      });
      onCreated(trip);
    } catch (err: any) {
      toast(apiErrText(err, t));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#171210] border border-amber-800/30 rounded-2xl p-6 w-[min(92vw,460px)] space-y-3"
      >
        <h3 className="text-lg font-semibold">{t("nt_title")}</h3>
        <div>
          <label className="text-xs text-stone-400">{t("nt_dest")}</label>
          <input
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={t("nt_dest_ph")}
            className="mt-1 w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-stone-400">{t("nt_name")}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("nt_name_ph")}
            className="mt-1 w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-stone-400">{t("nt_days")}</label>
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="mt-1 w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-stone-400">{t("nt_start")}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-stone-400">{t("cancel")}</button>
          <button disabled={busy} className="px-4 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-medium disabled:opacity-50">
            {busy ? t("processing") : t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Home() {
  const { t, lang } = useI18n();
  const { user, guest } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.listTrips().then((r) => setTrips(r.trips)).catch((e) => toast(apiErrText(e, t)));
  }, [user]);

  const del = async (id: string) => {
    if (!confirm(t("confirm_del_trip"))) return;
    await api.deleteTrip(id);
    setTrips((ts) => (ts ? ts.filter((x) => x.id !== id) : ts));
  };

  const tryGuest = async () => {
    try {
      await guest(lang);
    } catch (e: any) {
      toast(apiErrText(e, t));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          {t("hero_a")}
          <span className="text-amber-400">{t("hero_b")}</span>
        </h1>
        <p className="text-stone-400 mt-3 max-w-2xl">{t("hero_sub")}</p>
        {!user && (
          <div className="mt-6 flex items-center gap-4">
            <button onClick={tryGuest} className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-semibold">
              {t("guest_try")}
            </button>
            <Link to="/login" className="text-sm text-amber-300 hover:underline">
              {t("login")}
            </Link>
          </div>
        )}
        {!user && <p className="text-xs text-stone-500 mt-3">{t("guest_hint")}</p>}
      </header>

      {user && (
        <>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">{t("my_trips")}</h2>
            <button onClick={() => setShowNew(true)} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black text-sm font-semibold">
              {t("new_trip")}
            </button>
          </div>
          {trips === null ? (
            <p className="text-stone-500">{t("loading")}</p>
          ) : trips.length === 0 ? (
            <p className="text-stone-500">{t("trips_empty")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips.map((tr) => (
                <div
                  key={tr.id}
                  className="group border border-amber-900/25 hover:border-amber-600/40 rounded-2xl p-5 bg-[#12100c] cursor-pointer transition"
                  onClick={() => nav(`/trip/${tr.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg leading-snug">{tr.title}</h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); del(tr.id); }}
                      className="opacity-0 group-hover:opacity-100 text-stone-500 hover:text-red-400 text-sm"
                      title={t("del")}
                    >
                      🗑
                    </button>
                  </div>
                  <p className="text-sm text-stone-400 mt-1.5">
                    📍 {tr.destination} · {tr.days} {t("day_unit")}
                    {tr.startDate ? ` · ${String(tr.startDate).slice(0, 10)}` : ""}
                  </p>
                  <p className="text-xs text-stone-500 mt-2">
                    {tr._count?.items ?? 0} {t("items_unit")}
                    {tr.shareSlug ? " · 🔗" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewTripModal
          onClose={() => setShowNew(false)}
          onCreated={(tr) => { setShowNew(false); nav(`/trip/${tr.id}`); }}
        />
      )}
    </div>
  );
}
