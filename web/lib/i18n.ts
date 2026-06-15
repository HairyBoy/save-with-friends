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
  nav: { mine: "Mine", create: "Create", friends: "Friends", me: "Me", prize: "Prize" },

  onboarding: {
    brand: "Save with Friends",
    valueProp:
      "Lock money in a Vault toward a goal, earn while you wait, and save together with friends.",
    getStarted: "Get started",
  },

  home: {
    title: "My Vaults",
    currentlySaving: "Currently saving",
    savedAllTime: "Saved all time",
    agentUpdate: "Agent's daily update",
    agentUpdateBody: "[ what the agent did today + why ]",
    yourVaults: "Your Vaults",
    sharedVaults: "Shared Vaults",
    pending: "Pending",
    invitedBy: "Invited by",
    members: "members",
    details: "details",
    create: "Create a Vault",
  },

  create: {
    clear: "Clear",
    title: "Create a Vault",
    typeLabel: "Vault type",
    typeSolo: "Just me",
    typeShared: "Shared",
    inviteLabel: "Invite friends",
    inviteHint: "They join, contribute, and everyone must unlock together.",
    splitLabel: "Split when unlocked",
    splitEqual: "Equally",
    splitContribution: "By contribution",
    iconLabel: "Choose an icon",
    nameLabel: "Name",
    namePlaceholder: "e.g. Trip to Cartagena",
    goalLabel: "Goal",
    goalCurrency: "USD",
    goalHint: "Minimum goal of $5",
    depositLabel: "Starting Amount",
    depositHint: "Minimum $1 to open the vault",
    available: "Available",
    insufficientFunds: "That's more than you have in your wallet",
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
    submitting: "Creating…",
    submitError: "Couldn't create the vault. Please try again.",
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
    unlockConditions: "Unlock Conditions",
    goalReached: "Goal is reached",
    unlocks: "unlocks",
    aFriend: "A friend",
    yieldEarned: "Yield earned",
    yieldBody: "[ earned while locked ]",
    deposit: "Deposit",
    requestUnlock: "Request Unlock",
    withdraw: "Withdraw",
    depositTitle: "Add to this vault",
    add: "Add",
    cancel: "Cancel",
    processing: "Working…",
    depositError: "Couldn't add funds. Please try again.",
    withdrawError: "Couldn't withdraw. Please try again.",
    earlyExitSoon:
      "Unlocking early needs your friends to hold on-chain keys — that arrives with shared vaults.",
    devTimeTravel: "Dev: time travel",
    devClock: "Chain clock",
    devSkipWeek: "+1 week",
    devSkipMonth: "+1 month",
    devSkipYear: "+1 year",
    members: "Members",
    contributions: "Contributions",
    receives: "Receives",
    accept: "Accept",
    decline: "Decline",
  },

  profile: {
    title: "Me",
    account: "MiniPay account",
    addressHint: "[ address hint · 0x1234…abcd ]",
    balancesTitle: "Your money",
    personalVaults: "In your personal vaults",
    sharedReceiving: "Receiving from shared vaults",
    walletBalance: "In your wallet",
    totalBalance: "Total",
    language: "Language",
    terms: "Terms & Privacy",
    support: "Support",
    viewOnboarding: "View onboarding",
  },

  prize: {
    title: "Prize",
    prizeToday: "Today's prize",
    yourChance: "Your chance of winning",
    entriesLabel: "Your entries",
    howItWorksTitle: "How it works",
    howItWorksBody:
      "Every $1 you keep locked today counts as one entry — the more you save, the better your odds.",
    drawNote: "Drawn every day at midnight.",
  },
};

// Colombian Spanish. Keep keys identical to `en` — the type is derived from `en`,
// so a missing key here is a compile error.
const es: typeof en = {
  nav: { mine: "Mías", create: "Crear", friends: "Amigos", me: "Yo", prize: "Premio" },

  onboarding: {
    brand: "Ahorra con Amigos",
    valueProp:
      "Guarda tu plata en una Alcancía para una meta, gana mientras esperas y ahorra junto a tus amigos.",
    getStarted: "Comenzar",
  },

  home: {
    title: "Mis Alcancías",
    currentlySaving: "Ahorro actual",
    savedAllTime: "Ahorrado en total",
    agentUpdate: "Resumen diario del agente",
    agentUpdateBody: "[ qué hizo el agente hoy + por qué ]",
    yourVaults: "Tus Alcancías",
    sharedVaults: "Alcancías compartidas",
    pending: "Pendiente",
    invitedBy: "Invitado por",
    members: "miembros",
    details: "detalles",
    create: "Crear una Alcancía",
  },

  create: {
    clear: "Limpiar",
    title: "Crear una Alcancía",
    typeLabel: "Tipo de alcancía",
    typeSolo: "Solo yo",
    typeShared: "Compartida",
    inviteLabel: "Invita amigos",
    inviteHint: "Se unen, aportan, y todos deben abrir juntos.",
    splitLabel: "Repartir al abrir",
    splitEqual: "En partes iguales",
    splitContribution: "Según aporte",
    iconLabel: "Elige un ícono",
    nameLabel: "Nombre",
    namePlaceholder: "ej. Viaje a Cartagena",
    goalLabel: "Meta",
    goalCurrency: "USD",
    goalHint: "Meta mínima de $5",
    depositLabel: "Monto inicial",
    depositHint: "Mínimo $1 para abrir la alcancía",
    available: "Disponible",
    insufficientFunds: "Es más de lo que tienes en tu billetera",
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
    submitting: "Creando…",
    submitError: "No se pudo crear la alcancía. Inténtalo de nuevo.",
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
    unlockConditions: "Condiciones de apertura",
    goalReached: "Se alcanza la meta",
    unlocks: "la abre",
    aFriend: "Un amigo",
    yieldEarned: "Rendimiento ganado",
    yieldBody: "[ ganado mientras estaba bloqueado ]",
    deposit: "Depositar",
    requestUnlock: "Solicitar apertura",
    withdraw: "Retirar",
    depositTitle: "Agregar a esta alcancía",
    add: "Agregar",
    cancel: "Cancelar",
    processing: "Procesando…",
    depositError: "No se pudieron agregar fondos. Inténtalo de nuevo.",
    withdrawError: "No se pudo retirar. Inténtalo de nuevo.",
    earlyExitSoon:
      "Abrir antes necesita que tus amigos tengan llaves on-chain — llega con las alcancías compartidas.",
    devTimeTravel: "Dev: viajar en el tiempo",
    devClock: "Reloj de la cadena",
    devSkipWeek: "+1 semana",
    devSkipMonth: "+1 mes",
    devSkipYear: "+1 año",
    members: "Miembros",
    contributions: "Aportes",
    receives: "Recibe",
    accept: "Aceptar",
    decline: "Rechazar",
  },

  profile: {
    title: "Yo",
    account: "Cuenta de MiniPay",
    addressHint: "[ dirección · 0x1234…abcd ]",
    balancesTitle: "Tu dinero",
    personalVaults: "En tus alcancías personales",
    sharedReceiving: "Recibirás de compartidas",
    walletBalance: "En tu billetera",
    totalBalance: "Total",
    language: "Idioma",
    terms: "Términos y Privacidad",
    support: "Soporte",
    viewOnboarding: "Ver introducción",
  },

  prize: {
    title: "Premio",
    prizeToday: "Premio de hoy",
    yourChance: "Tu probabilidad de ganar",
    entriesLabel: "Tus entradas",
    howItWorksTitle: "Cómo funciona",
    howItWorksBody:
      "Cada $1 que mantienes guardado hoy cuenta como una entrada — entre más ahorras, mejores son tus probabilidades.",
    drawNote: "Se sortea todos los días a medianoche.",
  },
};

export type Messages = typeof en;

export const messages: Record<Lang, Messages> = { en, es };
