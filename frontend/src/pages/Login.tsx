import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { apiErrText, useI18n } from "../i18n";

export default function Login() {
  const { t, lang } = useI18n();
  const { loginWith, guest } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, displayName: displayName || undefined });
      loginWith(r.token, r.user);
      nav("/");
    } catch (err: any) {
      setError(apiErrText(err, t));
    } finally {
      setBusy(false);
    }
  };

  const tryGuest = async () => {
    setBusy(true);
    try {
      await guest(lang);
      nav("/");
    } catch (err: any) {
      setError(apiErrText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-14">
      <h1 className="text-2xl font-bold mb-2">{mode === "login" ? t("login_title") : t("register_title")}</h1>
      <p className="text-sm text-stone-400 mb-6">{t("auth_hint")}</p>
      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("nickname_ph")}
            className="w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2.5 text-sm"
          />
        )}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("email_ph")}
          className="w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password_ph")}
          className="w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2.5 text-sm"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-semibold disabled:opacity-50"
        >
          {busy ? t("processing") : mode === "login" ? t("login_title") : t("register_title")}
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-2 text-sm">
        <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-amber-300 hover:underline text-left">
          {mode === "login" ? t("to_register") : t("to_login")}
        </button>
        <button onClick={tryGuest} disabled={busy} className="text-stone-400 hover:text-amber-300 text-left">
          {t("or_guest")}
        </button>
      </div>
    </div>
  );
}
