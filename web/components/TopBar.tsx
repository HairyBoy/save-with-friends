import type { ReactNode } from "react";

// Unified app header used on every screen: a thin emerald band with a centered
// title, an optional left action (cancel/back), and an optional right slot (the
// profile avatar). Keeps the title look identical across pages.
export function TopBar({
  title,
  left,
  right,
}: {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="rounded-b-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 pt-6 pb-5 text-white shadow-lg shadow-emerald-600/20">
      <div className="relative flex items-center justify-center">
        {left ? <div className="absolute left-0">{left}</div> : null}
        {title ? <h1 className="text-lg font-bold">{title}</h1> : null}
        {right ? <div className="absolute right-0">{right}</div> : null}
      </div>
    </header>
  );
}

// Shared styles for the header slot actions, so every page matches.
export const topBarActionClass =
  "rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/25";

export const topBarAvatarClass =
  "grid h-9 w-9 place-items-center rounded-full bg-white/20 text-base backdrop-blur-md transition hover:bg-white/30";
