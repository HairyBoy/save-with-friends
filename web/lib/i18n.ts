// Universal language setting for the app. One toggle (English ⇄ Colombian Spanish)
// drives every screen's wording. Spanish copy is Colombian register on purpose
// (e.g. "plata" for money) since the first users are on MiniPay in Colombia.
//
// Savings noun convention: a savings activity is a "Vault" (EN, locked-up metaphor —
// friends hold keys) / "Alcancía" (ES).

export const LANGS = ["en", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

/** Human label for each language, shown on the flipper itself (always both, un-translated). */
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  es: "Español",
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

const en = {
  nav: { mine: "Mine", create: "Create", friends: "Friends", me: "Me" },

  onboarding: {
    brand: "Save with Friends",
    valueProp:
      "Lock money in a Vault toward a goal, earn while you wait, and save together with friends.",
    getStarted: "Get started",
  },

  home: {
    title: "My Vaults",
    totalSaved: "Total saved",
    totalAmount: "[ total amount ]",
    agentUpdate: "Agent's daily update",
    agentUpdateBody: "[ what the agent did today + why ]",
    yourVaults: "Your Vaults",
    details: "details",
    create: "Create a Vault",
  },

  create: {
    cancel: "Cancel",
    title: "Create a Vault",
    iconLabel: "Choose an icon",
    nameLabel: "Name",
    namePlaceholder: "e.g. Trip to Cartagena",
    goalLabel: "Goal",
    goalCurrency: "USD",
    goalHint: "Minimum goal of $5",
    depositLabel: "Starting Amount",
    depositHint: "Minimum $1 to open the vault",
    deadlineLabel: "Unlock timer",
    preset1w: "1 week",
    preset1m: "1 month",
    preset3m: "3 months",
    presetCustom: "Custom",
    friendsLabel: "Friends with keys",
    friendsHint: "They hold a key to approve an early unlock",
    unlockNote:
      "Funds unlock either when the goal is met, the timer ends, or when a friend unlocks the vault for you.",
    summaryTitle: "Preview",
    summaryNamePlaceholder: "Your Vault",
    summaryGoal: "Goal",
    summaryLocked: "Starting amount",
    summaryUnlocksBy: "Unlocks by",
    summaryApprovers: "Key holders",
    summaryNone: "None yet",
    submit: "Create Vault",
  },

  friends: {
    title: "Friends",
    pendingApprovals: "Pending approvals",
    pendingBody: "[ a friend asked to unlock early — approve or decline ]",
    activity: "Friends' activity",
    recentActivity: "[ recent Vault activity ]",
  },

  friendDetail: {
    back: "Friends",
    titlePrefix: "Friend:",
    progress: "[ their Vault progress ]",
    statusLine: "[ goal · progress · on-pace status ]",
    cheer: "👏 Cheer them on",
  },

  vaultDetail: {
    back: "My Vaults",
    titlePrefix: "Vault #",
    namePlaceholder: "[ name ]",
    pigPlaceholder: "[ pig filling up · progress ring ]",
    savedGoal: "[ saved / goal ]",
    unlocksWhen: "Unlocks when",
    goalReached: "🎯 goal reached",
    timerEnds: "⏳ timer ends",
    friendApproves: "🤝 a friend approves early exit",
    yieldEarned: "Yield earned",
    yieldBody: "[ earned while locked ]",
    deposit: "Deposit",
    requestEarlyExit: "Request early exit",
  },

  profile: {
    title: "Me",
    account: "MiniPay account",
    addressHint: "[ address hint · 0x1234…abcd ]",
    language: "Language",
    terms: "Terms & Privacy",
    support: "Support",
    viewOnboarding: "View onboarding",
  },
};

// Colombian Spanish. Keep keys identical to `en` — the type is derived from `en`,
// so a missing key here is a compile error.
const es: typeof en = {
  nav: { mine: "Mías", create: "Crear", friends: "Amigos", me: "Yo" },

  onboarding: {
    brand: "Ahorra con Amigos",
    valueProp:
      "Guarda tu plata en una Alcancía para una meta, gana mientras esperas y ahorra junto a tus amigos.",
    getStarted: "Comenzar",
  },

  home: {
    title: "Mis Alcancías",
    totalSaved: "Total ahorrado",
    totalAmount: "[ monto total ]",
    agentUpdate: "Resumen diario del agente",
    agentUpdateBody: "[ qué hizo el agente hoy + por qué ]",
    yourVaults: "Tus Alcancías",
    details: "detalles",
    create: "Crear una Alcancía",
  },

  create: {
    cancel: "Cancelar",
    title: "Crear una Alcancía",
    iconLabel: "Elige un ícono",
    nameLabel: "Nombre",
    namePlaceholder: "ej. Viaje a Cartagena",
    goalLabel: "Meta",
    goalCurrency: "USD",
    goalHint: "Meta mínima de $5",
    depositLabel: "Monto inicial",
    depositHint: "Mínimo $1 para abrir la alcancía",
    deadlineLabel: "Temporizador",
    preset1w: "1 semana",
    preset1m: "1 mes",
    preset3m: "3 meses",
    presetCustom: "Personalizado",
    friendsLabel: "Amigos con llave",
    friendsHint: "Tienen una llave para aprobar una apertura anticipada",
    unlockNote:
      "Los fondos se abren cuando alcanzas la meta, termina el temporizador, o cuando un amigo abre la alcancía por ti.",
    summaryTitle: "Vista previa",
    summaryNamePlaceholder: "Tu Alcancía",
    summaryGoal: "Meta",
    summaryLocked: "Monto inicial",
    summaryUnlocksBy: "Se abre antes de",
    summaryApprovers: "Con llave",
    summaryNone: "Ninguno aún",
    submit: "Crear Alcancía",
  },

  friends: {
    title: "Amigos",
    pendingApprovals: "Aprobaciones pendientes",
    pendingBody: "[ un amigo pidió abrir antes — aprueba o rechaza ]",
    activity: "Actividad de tus amigos",
    recentActivity: "[ actividad reciente de Alcancías ]",
  },

  friendDetail: {
    back: "Amigos",
    titlePrefix: "Amigo:",
    progress: "[ su progreso de Alcancía ]",
    statusLine: "[ meta · progreso · estado de ritmo ]",
    cheer: "👏 Anímalo",
  },

  vaultDetail: {
    back: "Mis Alcancías",
    titlePrefix: "Alcancía #",
    namePlaceholder: "[ nombre ]",
    pigPlaceholder: "[ el cerdito se llena · anillo de progreso ]",
    savedGoal: "[ ahorrado / meta ]",
    unlocksWhen: "Se abre cuando",
    goalReached: "🎯 se alcanza la meta",
    timerEnds: "⏳ termina el temporizador",
    friendApproves: "🤝 un amigo aprueba la apertura anticipada",
    yieldEarned: "Rendimiento ganado",
    yieldBody: "[ ganado mientras estaba bloqueado ]",
    deposit: "Depositar",
    requestEarlyExit: "Solicitar apertura anticipada",
  },

  profile: {
    title: "Yo",
    account: "Cuenta de MiniPay",
    addressHint: "[ dirección · 0x1234…abcd ]",
    language: "Idioma",
    terms: "Términos y Privacidad",
    support: "Soporte",
    viewOnboarding: "Ver introducción",
  },
};

export type Messages = typeof en;

export const messages: Record<Lang, Messages> = { en, es };
