"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { LANGS, LANG_LABELS } from "@/lib/i18n";

// Segmented English ⇄ Español flipper. Both labels always show in their own
// language so it reads the same whichever mode you're in. Reused on the profile
// (settings) and onboarding screens, wired to the same universal setting.
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex rounded-lg border border-neutral-200 p-0.5 ${className}`}
    >
      {LANGS.map((option) => {
        const active = lang === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(option)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-neutral-900 text-white" : "text-neutral-500"
            }`}
          >
            {LANG_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
