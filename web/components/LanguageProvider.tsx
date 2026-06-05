"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_LANG,
  isLang,
  messages,
  type Lang,
  type Messages,
} from "@/lib/i18n";

const STORAGE_KEY = "swf.lang";

// The language lives in a tiny external store backed by localStorage so it
// survives launches (MiniPay keeps the WebView around) and so React can sync to
// it via useSyncExternalStore — no setState-in-effect, no hydration mismatch.
const listeners = new Set<() => void>();
let current: Lang | null = null;

function readLang(): Lang {
  if (current !== null) return current;
  const stored =
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  current = isLang(stored) ? stored : DEFAULT_LANG;
  return current;
}

function writeLang(next: Lang) {
  current = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type LanguageContextValue = {
  lang: Lang;
  /** Active translation table for the current language. */
  t: Messages;
  setLang: (lang: Lang) => void;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Universal language setting — one toggle drives every screen's wording. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Server renders the default so SSR and the first client paint match; the store
  // re-renders with the persisted choice right after hydration.
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => writeLang(next), []);
  const toggle = useCallback(() => writeLang(readLang() === "en" ? "es" : "en"), []);

  return (
    <LanguageContext.Provider value={{ lang, t: messages[lang], setLang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
