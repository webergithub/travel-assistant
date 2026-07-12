import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastCtx {
  toast: (msg: string) => void;
}
const Ctx = createContext<ToastCtx>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1200] bg-[#1c1712] border border-amber-700/40 text-amber-100 text-sm px-4 py-2.5 rounded-xl shadow-xl">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
