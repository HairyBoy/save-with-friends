"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import type { LegalDoc as LegalDocType } from "@/lib/legal";

// Renders a long-form legal document (Terms or Privacy) in the app's chrome.
// The caller passes the bilingual pair; we pick EN/ES from the language toggle
// so legal copy follows the same language the rest of the App is showing.
export function LegalDoc({ doc }: { doc: { en: LegalDocType; es: LegalDocType } }) {
  const { lang } = useLanguage();
  const d = lang === "es" ? doc.es : doc.en;

  return (
    <div className="flex flex-col">
      <TopBar
        title={d.title}
        left={
          <Link href="/profile" aria-label={d.title} className={topBarActionClass}>
            ←
          </Link>
        }
      />

      <article className="flex flex-col gap-5 px-5 py-6 text-sm leading-relaxed text-neutral-700">
        <p className="text-xs text-neutral-400">
          {d.lastUpdatedLabel}: {d.lastUpdated}
        </p>

        {d.intro.map((p, i) => (
          <p key={`intro-${i}`}>{p}</p>
        ))}

        {d.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold text-neutral-900">{section.heading}</h2>
            {section.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
