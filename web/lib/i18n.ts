// Universal language setting for the app. One toggle (English ⇄ Colombian Spanish)
// drives every screen's wording. Spanish copy is Colombian register on purpose
// (e.g. "plata" for money) since the first users are on MiniPay in Colombia.
//
// Savings noun convention: a savings activity is a "PiggyBank" (EN) / "Alcancía" (ES).

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
      "Lock money in a PiggyBank toward a goal, earn while you wait, and save together with friends.",
    getStarted: "Get started",
  },

  home: {
    title: "My PiggyBanks",
    totalSaved: "Total saved",
    totalAmount: "[ total amount ]",
    agentUpdate: "Agent's daily update",
    agentUpdateBody: "[ what the agent did today + why ]",
    yourPiggyBanks: "Your PiggyBanks",
    details: "details",
    create: "Create a PiggyBank",
  },

  create: {
    cancel: "Cancel",
    title: "Create a PiggyBank",
    step1: "Step 1 · [ name your PiggyBank ]",
    step2: "Step 2 · [ target amount ]",
    step3: "Step 3 · [ deadline / timer ]",
    step4: "Step 4 · [ pick accountability friends ]",
    submit: "Create PiggyBank",
  },

  friends: {
    title: "Friends",
    pendingApprovals: "Pending approvals",
    pendingBody: "[ a friend asked to unlock early — approve or decline ]",
    activity: "Friends' activity",
    recentActivity: "[ recent PiggyBank activity ]",
  },

  friendDetail: {
    back: "Friends",
    titlePrefix: "Friend:",
    progress: "[ their PiggyBank progress ]",
    statusLine: "[ goal · progress · on-pace status ]",
    cheer: "👏 Cheer them on",
  },

  piggybankDetail: {
    back: "My PiggyBanks",
    titlePrefix: "PiggyBank #",
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
    yourPiggyBanks: "Tus Alcancías",
    details: "detalles",
    create: "Crear una Alcancía",
  },

  create: {
    cancel: "Cancelar",
    title: "Crear una Alcancía",
    step1: "Paso 1 · [ nombra tu Alcancía ]",
    step2: "Paso 2 · [ monto objetivo ]",
    step3: "Paso 3 · [ fecha límite / temporizador ]",
    step4: "Paso 4 · [ elige amigos de apoyo ]",
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

  piggybankDetail: {
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
