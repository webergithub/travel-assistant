import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import { store } from "./api";
import { ToastProvider } from "./components/toast";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import ShareView from "./pages/ShareView";
import Login from "./pages/Login";

function ApiKeyButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(store.getApiKey());
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/30 text-amber-300 hover:bg-amber-500/10"
        title={t("key_title")}
      >
        🔑 {t("keyBtn")}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="bg-[#171210] border border-amber-800/30 rounded-2xl p-6 w-[min(92vw,440px)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">{t("key_title")}</h3>
            <p className="text-xs text-stone-400 mb-3">{t("key_desc")}</p>
            <input
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-black/40 border border-stone-700 rounded-lg px-3 py-2 mono text-sm"
            />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-stone-400">{t("cancel")}</button>
              <button
                onClick={() => { store.setApiKey(val.trim()); setOpen(false); }}
                className="px-4 py-1.5 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-medium"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const { t, lang, toggle } = useI18n();
  const nav = useNavigate();
  return (
    <nav className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-amber-900/20 sticky top-0 bg-[#0d0a07]/85 backdrop-blur z-40">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-bold text-lg tracking-tight">
          <span className="text-amber-400">{t("brand1")}</span>{t("brand2")}
        </Link>
        <a href="/" className="hidden sm:inline text-xs text-stone-500 hover:text-amber-300">
          {t("back_home")}
        </a>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggle}
          className="text-xs px-3 py-1.5 rounded-lg border border-amber-700/30 text-amber-300 hover:bg-amber-500/10"
        >
          {lang === "zh" ? "EN" : "中文"}
        </button>
        <ApiKeyButton />
        {user ? (
          <>
            <span className="text-sm text-stone-300 hidden sm:inline">👤 {user.displayName}</span>
            <button onClick={() => { logout(); nav("/"); }} className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 hover:bg-stone-800">
              {t("logout")}
            </button>
          </>
        ) : (
          <Link to="/login" className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-medium">
            {t("login")}
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trip/:id" element={<Editor />} />
          <Route path="/s/:slug" element={<ShareView />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}
