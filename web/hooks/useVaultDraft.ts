"use client";

import { useSyncExternalStore } from "react";

export type PresetKey = "1w" | "1m" | "3m" | "custom";

export type VaultDraft = {
  icon: string;
  name: string;
  goal: string;
  deposit: string;
  preset: PresetKey | null;
  deadline: string; // yyyy-mm-dd
  friends: string[]; // selected friend ids (keyholders)
};

export const DEFAULT_ICON = "🔒";

const EMPTY: VaultDraft = {
  icon: DEFAULT_ICON,
  name: "",
  goal: "",
  deposit: "",
  preset: null,
  deadline: "",
  friends: [],
};

// In-memory draft for the Create form. Lives in the JS module, so it survives
// client-side tab navigation (leave Create, come back, still filled) but is
// wiped when the app fully reloads or closes. resetVaultDraft() clears it on
// Cancel / submit. Not persisted to storage on purpose.
let draft: VaultDraft = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setVaultDraft(patch: Partial<VaultDraft>) {
  draft = { ...draft, ...patch };
  emit();
}

export function resetVaultDraft() {
  draft = EMPTY;
  emit();
}

export function useVaultDraft() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => draft,
    () => EMPTY,
  );
}
