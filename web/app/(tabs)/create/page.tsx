"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TopBar, topBarActionClass } from "@/components/TopBar";
import { useFriends } from "@/hooks/useVaults";
import {
  resetVaultDraft,
  setVaultDraft,
  useVaultDraft,
  type PresetKey,
} from "@/hooks/useVaultDraft";

// Create a Vault (a tab — the draft survives leaving/returning to the tab, and
// clears on Cancel/submit or when the app closes). Single scrolling form: icon,
// name, USD goal, the starting amount locked now, an unlock timer, and friends
// who hold keys — with a live preview. Goals/deposits are in USD.

const ICONS = ["🔒", "🏦", "💰", "🐷", "✈️", "💻", "🎓", "🏠", "🎁"] as const;

const GOAL_MIN = 5;
const DEPOSIT_MIN = 1;

// Returns an ISO yyyy-mm-dd offset from today. Called only from event handlers
// (never during render) so it can't cause a hydration mismatch.
function isoFromNow({ days = 0, months = 0 }: { days?: number; months?: number }) {
  const d = new Date();
  if (days) d.setDate(d.getDate() + days);
  if (months) d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function CreateVaultScreen() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { friends: friendOptions, isLoading: friendsLoading } = useFriends();
  const draft = useVaultDraft();
  const { icon, name, goal, deposit, preset, deadline, friends } = draft;

  const goalNum = Number(goal);
  const depositNum = Number(deposit);
  const valid = name.trim().length > 0 && goalNum >= GOAL_MIN && depositNum >= DEPOSIT_MIN;
  // Flag an amount hint red once something's been typed that isn't a valid amount
  // at/above its minimum (an empty field stays neutral). `!(x >= min)` also catches
  // NaN from non-numeric input.
  const goalInvalid = goal.trim() !== "" && !(goalNum >= GOAL_MIN);
  const depositInvalid = deposit.trim() !== "" && !(depositNum >= DEPOSIT_MIN);

  const numLocale = lang === "es" ? "es-CO" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale, { maximumFractionDigits: 2 });
  const deadlineDisplay = deadline
    ? new Date(`${deadline}T00:00:00`).toLocaleDateString(numLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const approverNames = friendOptions
    .filter((f) => friends.includes(f.id))
    .map((f) => f.name);

  function pickPreset(key: PresetKey) {
    if (key === "1w") setVaultDraft({ preset: key, deadline: isoFromNow({ days: 7 }) });
    else if (key === "1m") setVaultDraft({ preset: key, deadline: isoFromNow({ months: 1 }) });
    else if (key === "3m") setVaultDraft({ preset: key, deadline: isoFromNow({ months: 3 }) });
    else setVaultDraft({ preset: key }); // "custom" reveals the date input below
  }

  function toggleFriend(id: string) {
    setVaultDraft({
      friends: friends.includes(id) ? friends.filter((f) => f !== id) : [...friends, id],
    });
  }

  function clearForm() {
    resetVaultDraft();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    // TODO: create the Vault on-chain (savings-lock contract) + lock the starting
    // amount once the contract exists. For now, clear the draft and return home.
    resetVaultDraft();
    router.push("/");
  }

  const presets: { key: PresetKey; label: string }[] = [
    { key: "1w", label: t.create.preset1w },
    { key: "1m", label: t.create.preset1m },
    { key: "3m", label: t.create.preset3m },
    { key: "custom", label: t.create.presetCustom },
  ];

  const fieldClass =
    "w-full rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm shadow-sm backdrop-blur-md outline-none transition placeholder:text-neutral-400 focus:border-primary/50";
  const labelClass = "text-sm font-medium text-neutral-700";
  const amountWrap =
    "flex items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-md transition focus-within:border-primary/50";

  return (
    <div className="flex flex-col">
      <TopBar
        title={t.create.title}
        left={
          <button type="button" onClick={clearForm} className={topBarActionClass}>
            {t.create.clear}
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-5 py-6">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="v-name" className={labelClass}>
            {t.create.nameLabel}
          </label>
          <input
            id="v-name"
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setVaultDraft({ name: e.target.value })}
            placeholder={t.create.namePlaceholder}
            className={fieldClass}
          />
        </div>

        {/* Icon */}
        <div className="flex flex-col gap-2">
          <p className={labelClass}>{t.create.iconLabel}</p>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setVaultDraft({ icon: ic })}
                aria-pressed={icon === ic}
                className={`grid h-11 w-11 place-items-center rounded-xl border text-xl backdrop-blur-md transition ${
                  icon === ic
                    ? "border-primary bg-primary-tint shadow-sm"
                    : "border-white/60 bg-white/60"
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Goal (USD) */}
        <div className="flex flex-col gap-2">
          <label htmlFor="v-goal" className={labelClass}>
            {t.create.goalLabel}
          </label>
          <div className={amountWrap}>
            <span className="text-neutral-400">$</span>
            <input
              id="v-goal"
              type="text"
              inputMode="decimal"
              value={goal}
              onChange={(e) => setVaultDraft({ goal: e.target.value })}
              placeholder="0"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            <span className="text-xs font-semibold text-neutral-400">{t.create.goalCurrency}</span>
          </div>
          <p className={`text-xs ${goalInvalid ? "text-red-500" : "text-neutral-400"}`}>
            {t.create.goalHint}
          </p>
        </div>

        {/* Starting amount (initial deposit, min $1) */}
        <div className="flex flex-col gap-2">
          <label htmlFor="v-deposit" className={labelClass}>
            {t.create.depositLabel}
          </label>
          <div className={amountWrap}>
            <span className="text-neutral-400">$</span>
            <input
              id="v-deposit"
              type="text"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setVaultDraft({ deposit: e.target.value })}
              placeholder="1"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            <span className="text-xs font-semibold text-neutral-400">{t.create.goalCurrency}</span>
          </div>
          <p className={`text-xs ${depositInvalid ? "text-red-500" : "text-neutral-400"}`}>
            {t.create.depositHint}
          </p>
        </div>

        {/* Unlock timer */}
        <div className="flex flex-col gap-2">
          <p className={labelClass}>{t.create.deadlineLabel}</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p.key)}
                aria-pressed={preset === p.key}
                className={`rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition ${
                  preset === p.key
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-white/60 bg-white/60 text-neutral-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <input
              type="date"
              value={deadline}
              onChange={(e) => setVaultDraft({ deadline: e.target.value })}
              className={fieldClass}
            />
          )}
        </div>

        {/* Friends with keys */}
        <div className="flex flex-col gap-2">
          <p className={labelClass}>{t.create.friendsLabel}</p>
          <div className="flex flex-wrap gap-2">
            {friendsLoading
              ? [0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-9 w-24 animate-pulse rounded-xl border border-white/60 bg-white/60"
                  />
                ))
              : friendOptions.map((f) => {
                  const on = friends.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFriend(f.id)}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition ${
                        on
                          ? "border-primary bg-primary-tint text-primary-dark shadow-sm"
                          : "border-white/60 bg-white/60 text-neutral-700"
                      }`}
                    >
                      <span>{on ? "🔑" : "👤"}</span>
                      {f.name}
                    </button>
                  );
                })}
          </div>
          <p className="text-xs text-neutral-400">{t.create.friendsHint}</p>
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-2">
          <p className={labelClass}>{t.create.summaryTitle}</p>
          <div className="flex flex-col gap-3 rounded-2xl border border-primary-light/60 bg-primary-tint/70 p-4 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl">
                {icon}
              </span>
              <span className={`text-sm font-semibold ${name.trim() ? "text-neutral-900" : "text-neutral-400"}`}>
                {name.trim() || t.create.summaryNamePlaceholder}
              </span>
            </div>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t.create.summaryGoal}</dt>
                <dd className="font-medium text-primary-dark">
                  ${fmt(goalNum > 0 ? goalNum : 0)} {t.create.goalCurrency}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t.create.summaryLocked}</dt>
                <dd className="font-medium text-primary-dark">
                  ${fmt(depositNum > 0 ? depositNum : 0)} {t.create.goalCurrency}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t.create.summaryUnlocksBy}</dt>
                <dd className="font-medium text-neutral-700">{deadlineDisplay ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-neutral-500">{t.create.summaryApprovers}</dt>
                <dd className="text-right font-medium text-neutral-700">
                  {approverNames.length ? approverNames.join(", ") : t.create.summaryNone}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-center text-xs text-neutral-500">{t.create.unlockNote}</p>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-sm font-medium text-white shadow-lg shadow-emerald-600/20 transition disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {t.create.submit}
        </button>
      </form>
    </div>
  );
}
