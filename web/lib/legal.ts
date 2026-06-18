// Legal copy for the Terms of Service and Privacy Policy pages.
//
// Kept out of i18n.ts on purpose: this is long-form prose, not interface
// strings, and it changes on its own cadence (legal review, not product copy).
// Each document is bilingual (EN / es-CO) and rendered by <LegalDoc>.
//
// Facts these documents rely on — keep them true to how the app actually works:
//  - Non-custodial. Funds live in smart contracts on Celo and in the user's own
//    MiniPay wallet. Neutron Crypto LLC never holds, moves, or controls funds.
//  - Off-chain we store only cosmetic data: a display name, vault names/emojis,
//    and the friends list. No private keys, no money.
//  - Keyholder model: friends a user designates can help unlock a shared Vault.

export const OPERATOR = "Neutron Crypto LLC";
export const CONTACT_EMAIL = "support@neutroncrypto.com";
export const LAST_UPDATED = "June 18, 2026";
export const LAST_UPDATED_ES = "18 de junio de 2026";

export type LegalSection = { heading: string; body: string[] };

export type LegalDoc = {
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
};

type Bilingual = { en: LegalDoc; es: LegalDoc };

export const terms: Bilingual = {
  en: {
    title: "Terms of Service",
    lastUpdatedLabel: "Last updated",
    lastUpdated: LAST_UPDATED,
    intro: [
      `Save with Friends ("the App") is operated by ${OPERATOR} ("we", "us"). By using the App you agree to these Terms. If you do not agree, please do not use the App.`,
    ],
    sections: [
      {
        heading: "1. What the App does",
        body: [
          "Save with Friends helps you set savings goals and lock stablecoins toward them in on-chain Vaults on the Celo network. You can save on your own or invite friends to act as keyholders who help unlock a shared Vault.",
          "The App is a self-custody interface. It is not a bank, broker, custodian, or money transmitter, and it does not offer investment, financial, tax, or legal advice.",
        ],
      },
      {
        heading: "2. Your wallet and your funds",
        body: [
          "You access the App through your own MiniPay wallet. You are solely responsible for your wallet, your recovery method, and every transaction you approve.",
          "We never take custody of your funds. Stablecoins you lock stay in smart contracts on the Celo blockchain and in your own wallet. We cannot move, freeze, reverse, or recover your funds, and we cannot reverse a blockchain transaction once it is confirmed.",
        ],
      },
      {
        heading: "3. Keyholders and shared Vaults",
        body: [
          "A shared Vault may require one or more friends you designate as keyholders to help unlock it under the rules you set when you create it. Choose keyholders you trust. We are not a party to the arrangements you make with your friends and are not responsible for their actions or availability.",
        ],
      },
      {
        heading: "4. Network fees and stablecoins",
        body: [
          "Transactions on Celo incur a network fee, which MiniPay handles in a supported stablecoin. We do not control these fees. The App works with the stablecoins supported by MiniPay; we do not guarantee the value, availability, or stability of any stablecoin.",
        ],
      },
      {
        heading: "5. Prizes and rewards",
        body: [
          "Where the App offers a prize or reward feature, it is provided as-is and may be changed, suspended, or ended at any time. Rewards are not interest, yield, or a promise of return, and eligibility may depend on your location and applicable rules.",
        ],
      },
      {
        heading: "6. Acceptable use",
        body: [
          "You agree to use the App only for lawful purposes, to provide accurate information, and not to misuse, attack, or interfere with the App or attempt to access it in an unauthorized way. You must be old enough to enter a binding contract where you live, and you must not use the App where doing so would break the law.",
        ],
      },
      {
        heading: "7. Experimental software; no warranty",
        body: [
          "The App and the underlying smart contracts are provided “as is” and “as available,” without warranties of any kind. Blockchain software is experimental and may contain bugs. Use it at your own risk.",
        ],
      },
      {
        heading: "8. Limitation of liability",
        body: [
          "To the maximum extent permitted by law, we are not liable for any loss of funds, profits, or data, or for any indirect or consequential damages, arising from your use of the App, the Celo network, your wallet, or any smart contract.",
        ],
      },
      {
        heading: "9. Changes to these Terms",
        body: [
          "We may update these Terms from time to time. The “Last updated” date shows when they last changed. Continuing to use the App after a change means you accept the updated Terms.",
        ],
      },
      {
        heading: "10. Contact",
        body: [`Questions about these Terms? Email us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
  es: {
    title: "Términos del Servicio",
    lastUpdatedLabel: "Última actualización",
    lastUpdated: LAST_UPDATED_ES,
    intro: [
      `Ahorra con Amigos ("la App") es operada por ${OPERATOR} ("nosotros"). Al usar la App aceptas estos Términos. Si no estás de acuerdo, por favor no uses la App.`,
    ],
    sections: [
      {
        heading: "1. Qué hace la App",
        body: [
          "Ahorra con Amigos te ayuda a fijar metas de ahorro y a bloquear estables para alcanzarlas en alcancías en la red Celo. Puedes ahorrar por tu cuenta o invitar amigos como guardianes de llave que ayudan a abrir una alcancía compartida.",
          "La App es una interfaz de autocustodia. No es un banco, comisionista, custodio ni transmisor de dinero, y no ofrece asesoría de inversión, financiera, tributaria ni legal.",
        ],
      },
      {
        heading: "2. Tu billetera y tu dinero",
        body: [
          "Accedes a la App a través de tu propia billetera MiniPay. Eres el único responsable de tu billetera, de tu método de recuperación y de cada transacción que apruebas.",
          "Nunca tomamos custodia de tu dinero. Los estables que bloqueas permanecen en contratos inteligentes en la cadena Celo y en tu propia billetera. No podemos mover, congelar, revertir ni recuperar tu dinero, y no podemos revertir una transacción una vez confirmada en la cadena.",
        ],
      },
      {
        heading: "3. Guardianes y alcancías compartidas",
        body: [
          "Una alcancía compartida puede requerir que uno o más amigos que designes como guardianes ayuden a abrirla según las reglas que fijes al crearla. Elige guardianes en quienes confíes. No somos parte de los acuerdos que hagas con tus amigos ni somos responsables de sus acciones o disponibilidad.",
        ],
      },
      {
        heading: "4. Costos de red y estables",
        body: [
          "Las transacciones en Celo tienen un costo de red, que MiniPay gestiona en un estable compatible. No controlamos estos costos. La App funciona con los estables que MiniPay admite; no garantizamos el valor, la disponibilidad ni la estabilidad de ningún estable.",
        ],
      },
      {
        heading: "5. Premios y recompensas",
        body: [
          "Cuando la App ofrezca una función de premio o recompensa, se brinda tal cual y puede cambiar, suspenderse o terminarse en cualquier momento. Las recompensas no son intereses, rendimiento ni promesa de retorno, y la elegibilidad puede depender de tu ubicación y de las reglas aplicables.",
        ],
      },
      {
        heading: "6. Uso aceptable",
        body: [
          "Aceptas usar la App solo para fines lícitos, dar información veraz, y no usar indebidamente, atacar ni interferir con la App, ni intentar acceder a ella de forma no autorizada. Debes tener la edad suficiente para celebrar un contrato vinculante donde vives, y no debes usar la App donde hacerlo infrinja la ley.",
        ],
      },
      {
        heading: "7. Software experimental; sin garantías",
        body: [
          "La App y los contratos inteligentes subyacentes se brindan “tal cual” y “según disponibilidad”, sin garantías de ningún tipo. El software de blockchain es experimental y puede tener errores. Úsalo bajo tu propio riesgo.",
        ],
      },
      {
        heading: "8. Limitación de responsabilidad",
        body: [
          "En la máxima medida permitida por la ley, no somos responsables por ninguna pérdida de fondos, ganancias o datos, ni por daños indirectos o consecuentes, derivados de tu uso de la App, la red Celo, tu billetera o cualquier contrato inteligente.",
        ],
      },
      {
        heading: "9. Cambios a estos Términos",
        body: [
          "Podemos actualizar estos Términos de vez en cuando. La fecha de “Última actualización” indica cuándo cambiaron por última vez. Si sigues usando la App tras un cambio, aceptas los Términos actualizados.",
        ],
      },
      {
        heading: "10. Contacto",
        body: [`¿Dudas sobre estos Términos? Escríbenos a ${CONTACT_EMAIL}.`],
      },
    ],
  },
};

export const privacy: Bilingual = {
  en: {
    title: "Privacy Policy",
    lastUpdatedLabel: "Last updated",
    lastUpdated: LAST_UPDATED,
    intro: [
      `This Privacy Policy explains what ${OPERATOR} ("we", "us") collects when you use Save with Friends ("the App") and what we do with it. We keep this short because the App is designed to collect as little as possible.`,
    ],
    sections: [
      {
        heading: "1. What we collect",
        body: [
          "Profile basics: a display name you choose, and the names and emojis you give your Vaults.",
          "Your friends list: the friends and keyholders you add inside the App.",
          "A wallet address: your public Celo address, used to connect your activity to your Vaults. A public address is not a private key.",
          "Basic technical data: standard logs your browser or device sends when loading a web app (for example, general usage and error information).",
        ],
      },
      {
        heading: "2. What we do NOT collect",
        body: [
          "We never collect or store your private keys, recovery phrase, or wallet password. We never take custody of your funds. We do not ask for government ID, and we do not sell your personal information.",
        ],
      },
      {
        heading: "3. How we use it",
        body: [
          "We use this information only to make the App work: to show your Vaults and balances, to display your friends and keyholders by name instead of a raw address, and to keep the App reliable and secure.",
        ],
      },
      {
        heading: "4. The blockchain is public",
        body: [
          "Transactions you make are recorded on the Celo blockchain, which is public and permanent. Anyone can view on-chain activity tied to a wallet address. We do not control the blockchain and cannot delete or alter on-chain data.",
        ],
      },
      {
        heading: "5. Sharing and service providers",
        body: [
          "We use third-party providers to run the App, such as hosting and database services that store the cosmetic data described above. They process data only to provide their service to us. We may also disclose information if required by law.",
        ],
      },
      {
        heading: "6. Data retention and your choices",
        body: [
          "We keep off-chain data while you use the App. You can ask us to delete the off-chain data we hold about you (your display name, Vault labels, and friends list) by emailing us. Note that data already written to the blockchain cannot be deleted.",
        ],
      },
      {
        heading: "7. Children",
        body: [
          "The App is not intended for anyone below the age required to use it where they live, and we do not knowingly collect their information.",
        ],
      },
      {
        heading: "8. Changes",
        body: [
          "We may update this Policy. The “Last updated” date shows when it last changed.",
        ],
      },
      {
        heading: "9. Contact",
        body: [
          `Questions or a deletion request? Email us at ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  es: {
    title: "Política de Privacidad",
    lastUpdatedLabel: "Última actualización",
    lastUpdated: LAST_UPDATED_ES,
    intro: [
      `Esta Política de Privacidad explica qué recopila ${OPERATOR} ("nosotros") cuando usas Ahorra con Amigos ("la App") y qué hacemos con ello. La mantenemos corta porque la App está diseñada para recopilar lo menos posible.`,
    ],
    sections: [
      {
        heading: "1. Qué recopilamos",
        body: [
          "Datos básicos de perfil: un nombre para mostrar que tú eliges, y los nombres y emojis que les pones a tus alcancías.",
          "Tu lista de amigos: los amigos y guardianes que agregas dentro de la App.",
          "Una dirección de billetera: tu dirección pública de Celo, usada para vincular tu actividad con tus alcancías. Una dirección pública no es una llave privada.",
          "Datos técnicos básicos: registros estándar que tu navegador o dispositivo envía al cargar una app web (por ejemplo, información general de uso y de errores).",
        ],
      },
      {
        heading: "2. Qué NO recopilamos",
        body: [
          "Nunca recopilamos ni guardamos tus llaves privadas, tu frase de recuperación ni la contraseña de tu billetera. Nunca tomamos custodia de tu dinero. No pedimos documento de identidad y no vendemos tu información personal.",
        ],
      },
      {
        heading: "3. Cómo lo usamos",
        body: [
          "Usamos esta información solo para que la App funcione: mostrar tus alcancías y saldos, presentar a tus amigos y guardianes por su nombre en vez de una dirección, y mantener la App confiable y segura.",
        ],
      },
      {
        heading: "4. La cadena es pública",
        body: [
          "Las transacciones que haces quedan registradas en la cadena Celo, que es pública y permanente. Cualquiera puede ver la actividad en cadena vinculada a una dirección. No controlamos la cadena y no podemos borrar ni alterar datos en cadena.",
        ],
      },
      {
        heading: "5. Compartir y proveedores",
        body: [
          "Usamos proveedores externos para operar la App, como servicios de alojamiento y base de datos que almacenan los datos cosméticos descritos arriba. Ellos procesan los datos solo para prestarnos su servicio. También podemos divulgar información si la ley lo exige.",
        ],
      },
      {
        heading: "6. Conservación y tus opciones",
        body: [
          "Conservamos los datos fuera de cadena mientras uses la App. Puedes pedirnos que borremos los datos fuera de cadena que tenemos sobre ti (tu nombre, las etiquetas de tus alcancías y tu lista de amigos) escribiéndonos. Ten en cuenta que los datos ya escritos en la cadena no se pueden borrar.",
        ],
      },
      {
        heading: "7. Menores",
        body: [
          "La App no está dirigida a quienes no tengan la edad requerida para usarla donde viven, y no recopilamos su información a sabiendas.",
        ],
      },
      {
        heading: "8. Cambios",
        body: [
          "Podemos actualizar esta Política. La fecha de “Última actualización” indica cuándo cambió por última vez.",
        ],
      },
      {
        heading: "9. Contacto",
        body: [
          `¿Dudas o una solicitud de borrado? Escríbenos a ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};
