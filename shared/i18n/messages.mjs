/** @typedef {Record<string, string>} MessageTable */

/** @type {MessageTable} */
const EN = {
  'nav.home': 'Home',
  'nav.competitions': 'Competitions',
  'nav.faq': 'FAQ',
  'nav.terms': 'T&C',
  'lang.label': 'Language',
  'region.paidUkOnlyTitle': 'Ticket bundles — UK only',
  'region.paidUkOnlyBody':
    'Paid ticket bundles and the Signed Legacy Bundle draw are available in the United Kingdom only. Free giveaways below are open worldwide.',
  'region.giveawaysWorldTitle': 'Giveaways open worldwide',
  'region.giveawaysWorldBody':
    'Enter our free skill giveaways from anywhere — including the World Cup Ball challenge and shirt promotions.',
  'region.bundlesUkBadge': 'UK only',
  'footer.paidUkOnly':
    'Paid ticket bundles and postal entry for prize draws are UK-only. Free giveaways are open internationally.',
  'footer.giveawaysInternational': 'Free giveaways are open to entrants worldwide.',
  'bundles.heading': 'Ticket bundles',
  'competitions.paidSection': 'Prize draw competitions',
  'competitions.freeSection': 'Free giveaways',
  'competitions.paidUkHidden': 'Paid prize draws are shown to UK visitors only.',
  'home.enterBundleUnavailable': 'Bundle draw entry is available in the UK only. Try our free international giveaways.',
  'entry.paidUkOnly':
    'Paid ticket bundles are only available in the United Kingdom. Please enter a free international giveaway instead.',
}

/** @type {Record<string, MessageTable>} */
export const SITE_MESSAGES = {
  en: EN,
  es: {
    ...EN,
    'nav.home': 'Inicio',
    'nav.competitions': 'Competiciones',
    'nav.faq': 'Preguntas',
    'nav.terms': 'Términos',
    'lang.label': 'Idioma',
    'region.paidUkOnlyTitle': 'Paquetes de entradas — solo Reino Unido',
    'region.paidUkOnlyBody':
      'Los paquetes de pago y el sorteo Signed Legacy Bundle solo están disponibles en el Reino Unido. Los sorteos gratuitos son mundiales.',
    'region.giveawaysWorldTitle': 'Sorteos abiertos en todo el mundo',
    'region.giveawaysWorldBody':
      'Participa en nuestros sorteos de habilidad gratis desde cualquier lugar, incluido el desafío del balón del Mundial.',
    'region.bundlesUkBadge': 'Solo Reino Unido',
    'footer.paidUkOnly':
      'Los paquetes de pago y la entrada postal son solo para el Reino Unido. Los sorteos gratuitos son internacionales.',
    'footer.giveawaysInternational': 'Los sorteos gratuitos están abiertos en todo el mundo.',
    'bundles.heading': 'Paquetes de entradas',
    'competitions.paidSection': 'Sorteos de premios',
    'competitions.freeSection': 'Sorteos gratuitos',
    'competitions.paidUkHidden': 'Los sorteos de pago solo se muestran a visitantes del Reino Unido.',
    'home.enterBundleUnavailable':
      'La entrada al sorteo de paquetes solo está disponible en el Reino Unido. Prueba nuestros sorteos internacionales gratuitos.',
    'entry.paidUkOnly':
      'Los paquetes de pago solo están disponibles en el Reino Unido. Participa en un sorteo internacional gratuito.',
  },
  fr: {
    ...EN,
    'nav.home': 'Accueil',
    'nav.competitions': 'Compétitions',
    'nav.faq': 'FAQ',
    'nav.terms': 'CGU',
    'lang.label': 'Langue',
    'region.paidUkOnlyTitle': 'Lots de tickets — Royaume-Uni uniquement',
    'region.paidUkOnlyBody':
      'Les lots payants et le tirage Signed Legacy Bundle sont réservés au Royaume-Uni. Les jeux gratuits sont ouverts dans le monde entier.',
    'region.giveawaysWorldTitle': 'Jeux ouverts dans le monde',
    'region.giveawaysWorldBody':
      'Participez à nos jeux d’adresse gratuits partout, y compris le défi ballon de la Coupe du monde.',
    'region.bundlesUkBadge': 'Royaume-Uni seulement',
    'footer.paidUkOnly':
      'Les lots payants et la participation postale sont réservés au Royaume-Uni. Les jeux gratuits sont internationaux.',
    'footer.giveawaysInternational': 'Les jeux gratuits sont ouverts dans le monde entier.',
    'bundles.heading': 'Lots de tickets',
    'competitions.paidSection': 'Tirages au sort payants',
    'competitions.freeSection': 'Jeux gratuits',
    'competitions.paidUkHidden': 'Les tirages payants sont affichés aux visiteurs du Royaume-Uni uniquement.',
    'home.enterBundleUnavailable':
      'L’entrée au tirage bundle est disponible au Royaume-Uni seulement. Essayez nos jeux internationaux gratuits.',
    'entry.paidUkOnly':
      'Les lots payants sont disponibles au Royaume-Uni seulement. Participez à un jeu international gratuit.',
  },
  de: {
    ...EN,
    'nav.home': 'Start',
    'nav.competitions': 'Wettbewerbe',
    'nav.faq': 'FAQ',
    'nav.terms': 'AGB',
    'lang.label': 'Sprache',
    'region.paidUkOnlyTitle': 'Ticketpakete — nur UK',
    'region.paidUkOnlyBody':
      'Bezahlte Ticketpakete und die Signed Legacy Bundle-Verlosung sind nur im Vereinigten Königreich verfügbar. Kostenlose Gewinnspiele sind weltweit offen.',
    'region.giveawaysWorldTitle': 'Gewinnspiele weltweit',
    'region.giveawaysWorldBody':
      'Nimm von überall an unseren kostenlosen Skill-Gewinnspielen teil — einschließlich der WM-Ball-Challenge.',
    'region.bundlesUkBadge': 'Nur UK',
    'footer.paidUkOnly':
      'Bezahlte Pakete und Postteilnahme nur im UK. Kostenlose Gewinnspiele sind international.',
    'footer.giveawaysInternational': 'Kostenlose Gewinnspiele sind weltweit offen.',
    'bundles.heading': 'Ticketpakete',
    'competitions.paidSection': 'Preisverlosungen',
    'competitions.freeSection': 'Kostenlose Gewinnspiele',
    'competitions.paidUkHidden': 'Bezahlte Verlosungen werden nur für UK-Besucher angezeigt.',
    'home.enterBundleUnavailable':
      'Bundle-Verlosung nur im UK. Probiere unsere kostenlosen internationalen Gewinnspiele.',
    'entry.paidUkOnly':
      'Bezahlte Ticketpakete nur im UK. Bitte nimm an einem kostenlosen internationalen Gewinnspiel teil.',
  },
  pt: {
    ...EN,
    'nav.home': 'Início',
    'nav.competitions': 'Competições',
    'nav.faq': 'FAQ',
    'nav.terms': 'Termos',
    'lang.label': 'Idioma',
    'region.paidUkOnlyTitle': 'Pacotes de bilhetes — apenas Reino Unido',
    'region.paidUkOnlyBody':
      'Pacotes pagos e o sorteio Signed Legacy Bundle estão disponíveis apenas no Reino Unido. Sorteios gratuitos são mundiais.',
    'region.giveawaysWorldTitle': 'Sorteios abertos no mundo',
    'region.giveawaysWorldBody':
      'Participe dos nossos sorteios gratuitos de qualquer lugar, incluindo o desafio da bola da Copa do Mundo.',
    'region.bundlesUkBadge': 'Apenas Reino Unido',
    'footer.paidUkOnly':
      'Pacotes pagos e entrada postal são apenas no Reino Unido. Sorteios gratuitos são internacionais.',
    'footer.giveawaysInternational': 'Sorteios gratuitos estão abertos mundialmente.',
    'bundles.heading': 'Pacotes de bilhetes',
    'competitions.paidSection': 'Sorteios pagos',
    'competitions.freeSection': 'Sorteios gratuitos',
    'competitions.paidUkHidden': 'Sorteios pagos são mostrados apenas a visitantes do Reino Unido.',
    'home.enterBundleUnavailable':
      'Entrada no sorteio de pacotes disponível apenas no Reino Unido. Experimente nossos sorteios internacionais gratuitos.',
    'entry.paidUkOnly':
      'Pacotes pagos disponíveis apenas no Reino Unido. Participe de um sorteio internacional gratuito.',
  },
  it: {
    ...EN,
    'nav.home': 'Home',
    'nav.competitions': 'Competizioni',
    'nav.faq': 'FAQ',
    'nav.terms': 'Termini',
    'lang.label': 'Lingua',
    'region.paidUkOnlyTitle': 'Pacchetti biglietti — solo Regno Unito',
    'region.paidUkOnlyBody':
      'I pacchetti a pagamento e l’estrazione Signed Legacy Bundle sono solo nel Regno Unito. I giveaway gratuiti sono mondiali.',
    'region.giveawaysWorldTitle': 'Giveaway in tutto il mondo',
    'region.giveawaysWorldBody':
      'Partecipa ai nostri giveaway gratuiti da ovunque, inclusa la sfida del pallone dei Mondiali.',
    'region.bundlesUkBadge': 'Solo Regno Unito',
    'footer.paidUkOnly':
      'Pacchetti a pagamento e posta solo nel Regno Unito. I giveaway gratuiti sono internazionali.',
    'footer.giveawaysInternational': 'I giveaway gratuiti sono aperti in tutto il mondo.',
    'bundles.heading': 'Pacchetti biglietti',
    'competitions.paidSection': 'Estrazioni a premio',
    'competitions.freeSection': 'Giveaway gratuiti',
    'competitions.paidUkHidden': 'Le estrazioni a pagamento sono mostrate solo ai visitatori del Regno Unito.',
    'home.enterBundleUnavailable':
      'Ingresso al bundle solo nel Regno Unito. Prova i nostri giveaway internazionali gratuiti.',
    'entry.paidUkOnly':
      'Pacchetti a pagamento solo nel Regno Unito. Partecipa a un giveaway internazionale gratuito.',
  },
  nl: {
    ...EN,
    'nav.home': 'Home',
    'nav.competitions': 'Wedstrijden',
    'nav.faq': 'FAQ',
    'nav.terms': 'Voorwaarden',
    'lang.label': 'Taal',
    'region.paidUkOnlyTitle': 'Ticketbundels — alleen VK',
    'region.paidUkOnlyBody':
      'Betaalde bundels en de Signed Legacy Bundle-trekking zijn alleen in het Verenigd Koninkrijk. Gratis giveaways zijn wereldwijd.',
    'region.giveawaysWorldTitle': 'Giveaways wereldwijd open',
    'region.giveawaysWorldBody':
      'Doe mee aan gratis vaardigheidsgiveaways overal, inclusief de WK-bal-uitdaging.',
    'region.bundlesUkBadge': 'Alleen VK',
    'footer.paidUkOnly':
      'Betaalde bundels en postdeelname alleen in het VK. Gratis giveaways zijn internationaal.',
    'footer.giveawaysInternational': 'Gratis giveaways zijn wereldwijd open.',
    'bundles.heading': 'Ticketbundels',
    'competitions.paidSection': 'Betaalde prijstrekkingen',
    'competitions.freeSection': 'Gratis giveaways',
    'competitions.paidUkHidden': 'Betaalde trekkingen worden alleen aan VK-bezoekers getoond.',
    'home.enterBundleUnavailable':
      'Bundel-deelname alleen in het VK. Probeer onze gratis internationale giveaways.',
    'entry.paidUkOnly':
      'Betaalde bundels alleen in het VK. Doe mee aan een gratis internationale giveaway.',
  },
  pl: {
    ...EN,
    'nav.home': 'Strona główna',
    'nav.competitions': 'Konkursy',
    'nav.faq': 'FAQ',
    'nav.terms': 'Regulamin',
    'lang.label': 'Język',
    'region.paidUkOnlyTitle': 'Pakiety biletów — tylko Wielka Brytania',
    'region.paidUkOnlyBody':
      'Płatne pakiety i losowanie Signed Legacy Bundle są dostępne tylko w Wielkiej Brytanii. Darmowe konkursy są globalne.',
    'region.giveawaysWorldTitle': 'Konkursy otwarte na świecie',
    'region.giveawaysWorldBody':
      'Weź udział w darmowych konkursach umiejętności z dowolnego miejsca, w tym wyzwanie z piłką MŚ.',
    'region.bundlesUkBadge': 'Tylko UK',
    'footer.paidUkOnly':
      'Płatne pakiety i poczta tylko w UK. Darmowe konkursy są międzynarodowe.',
    'footer.giveawaysInternational': 'Darmowe konkursy są otwarte na całym świecie.',
    'bundles.heading': 'Pakiety biletów',
    'competitions.paidSection': 'Płatne losowania',
    'competitions.freeSection': 'Darmowe konkursy',
    'competitions.paidUkHidden': 'Płatne losowania widzą tylko odwiedzający z UK.',
    'home.enterBundleUnavailable':
      'Wejście do losowania pakietów tylko w UK. Spróbuj darmowych konkursów międzynarodowych.',
    'entry.paidUkOnly':
      'Płatne pakiety tylko w UK. Weź udział w darmowym konkursie międzynarodowym.',
  },
  ru: {
    ...EN,
    'nav.home': 'Главная',
    'nav.competitions': 'Конкурсы',
    'nav.faq': 'Вопросы',
    'nav.terms': 'Условия',
    'lang.label': 'Язык',
    'region.paidUkOnlyTitle': 'Пакеты билетов — только Великобритания',
    'region.paidUkOnlyBody':
      'Платные пакеты и розыгрыш Signed Legacy Bundle доступны только в Великобритании. Бесплатные розыгрыши открыты по всему миру.',
    'region.giveawaysWorldTitle': 'Розыгрыши по всему миру',
    'region.giveawaysWorldBody':
      'Участвуйте в бесплатных конкурсах навыков из любой страны, включая челлендж с мячом ЧМ.',
    'region.bundlesUkBadge': 'Только UK',
    'footer.paidUkOnly':
      'Платные пакеты и почтовый вход только для UK. Бесплатные розыгрыши международные.',
    'footer.giveawaysInternational': 'Бесплатные розыгрыши открыты по всему миру.',
    'bundles.heading': 'Пакеты билетов',
    'competitions.paidSection': 'Платные розыгрыши',
    'competitions.freeSection': 'Бесплатные розыгрыши',
    'competitions.paidUkHidden': 'Платные розыгрыши показываются только посетителям из UK.',
    'home.enterBundleUnavailable':
      'Вход в розыгрыш пакетов только в UK. Попробуйте бесплатные международные розыгрыши.',
    'entry.paidUkOnly':
      'Платные пакеты доступны только в UK. Участвуйте в бесплатном международном розыгрыше.',
  },
  ar: {
    ...EN,
    'nav.home': 'الرئيسية',
    'nav.competitions': 'المسابقات',
    'nav.faq': 'الأسئلة',
    'nav.terms': 'الشروط',
    'lang.label': 'اللغة',
    'region.paidUkOnlyTitle': 'حزم التذاكر — المملكة المتحدة فقط',
    'region.paidUkOnlyBody':
      'الحزم المدفوعة وسحب Signed Legacy Bundle متاحة في المملكة المتحدة فقط. المسابقات المجانية مفتوحة عالمياً.',
    'region.giveawaysWorldTitle': 'مسابقات مفتوحة عالمياً',
    'region.giveawaysWorldBody':
      'شارك في مسابقات المهارة المجانية من أي مكان، بما في ذلك تحدي كرة كأس العالم.',
    'region.bundlesUkBadge': 'المملكة المتحدة فقط',
    'footer.paidUkOnly':
      'الحزم المدفوعة والدخول البريدي للمملكة المتحدة فقط. المسابقات المجانية دولية.',
    'footer.giveawaysInternational': 'المسابقات المجانية مفتوحة للمشاركين حول العالم.',
    'bundles.heading': 'حزم التذاكر',
    'competitions.paidSection': 'سحوبات الجوائز المدفوعة',
    'competitions.freeSection': 'مسابقات مجانية',
    'competitions.paidUkHidden': 'السحوبات المدفوعة تظهر لزوار المملكة المتحدة فقط.',
    'home.enterBundleUnavailable':
      'الدخول لسحب الحزم متاح في المملكة المتحدة فقط. جرّب مسابقاتنا المجانية الدولية.',
    'entry.paidUkOnly':
      'الحزم المدفوعة متاحة في المملكة المتحدة فقط. شارك في مسابقة مجانية دولية.',
  },
  zh: {
    ...EN,
    'nav.home': '首页',
    'nav.competitions': '竞赛',
    'nav.faq': '常见问题',
    'nav.terms': '条款',
    'lang.label': '语言',
    'region.paidUkOnlyTitle': '门票套餐 — 仅限英国',
    'region.paidUkOnlyBody':
      '付费门票套餐和 Signed Legacy Bundle 抽奖仅在英国提供。免费赠品活动面向全球开放。',
    'region.giveawaysWorldTitle': '全球赠品活动',
    'region.giveawaysWorldBody': '可从任何地方参加我们的免费技能赠品活动，包括世界杯足球挑战。',
    'region.bundlesUkBadge': '仅限英国',
    'footer.paidUkOnly': '付费套餐和邮政报名仅限英国。免费赠品面向国际用户。',
    'footer.giveawaysInternational': '免费赠品向全球参与者开放。',
    'bundles.heading': '门票套餐',
    'competitions.paidSection': '付费抽奖',
    'competitions.freeSection': '免费赠品',
    'competitions.paidUkHidden': '付费抽奖仅向英国访客显示。',
    'home.enterBundleUnavailable': '套餐抽奖仅限英国。请尝试我们的免费国际赠品活动。',
    'entry.paidUkOnly': '付费门票套餐仅在英国提供。请参加免费的国际赠品活动。',
  },
  ja: {
    ...EN,
    'nav.home': 'ホーム',
    'nav.competitions': 'コンペ',
    'nav.faq': 'FAQ',
    'nav.terms': '規約',
    'lang.label': '言語',
    'region.paidUkOnlyTitle': 'チケットバンドル — 英国のみ',
    'region.paidUkOnlyBody':
      '有料バンドルと Signed Legacy Bundle 抽選は英国のみ。無料プレゼントは世界中で参加できます。',
    'region.giveawaysWorldTitle': '世界中で参加できるプレゼント',
    'region.giveawaysWorldBody':
      'ワールドカップボールチャレンジなど、無料スキルプレゼントにどこからでも参加できます。',
    'region.bundlesUkBadge': '英国のみ',
    'footer.paidUkOnly': '有料バンドルと郵送応募は英国のみ。無料プレゼントは国際的に開催。',
    'footer.giveawaysInternational': '無料プレゼントは世界中の参加者に開放されています。',
    'bundles.heading': 'チケットバンドル',
    'competitions.paidSection': '有料抽選',
    'competitions.freeSection': '無料プレゼント',
    'competitions.paidUkHidden': '有料抽選は英国の訪問者にのみ表示されます。',
    'home.enterBundleUnavailable':
      'バンドル抽選への参加は英国のみ。無料の国際プレゼントをお試しください。',
    'entry.paidUkOnly':
      '有料バンドルは英国のみ。無料の国際プレゼントにご参加ください。',
  },
  ko: {
    ...EN,
    'nav.home': '홈',
    'nav.competitions': '대회',
    'nav.faq': 'FAQ',
    'nav.terms': '약관',
    'lang.label': '언어',
    'region.paidUkOnlyTitle': '티켓 번들 — 영국 전용',
    'region.paidUkOnlyBody':
      '유료 번들과 Signed Legacy Bundle 추첨은 영국에서만 가능합니다. 무료 이벤트는 전 세계 참가 가능.',
    'region.giveawaysWorldTitle': '전 세계 무료 이벤트',
    'region.giveawaysWorldBody':
      '월드컵 공 챌린지를 포함한 무료 스킬 이벤트에 어디서나 참여하세요.',
    'region.bundlesUkBadge': '영국 전용',
    'footer.paidUkOnly': '유료 번들과 우편 응모는 영국 전용. 무료 이벤트는 국제 참가 가능.',
    'footer.giveawaysInternational': '무료 이벤트는 전 세계 참가자에게 열려 있습니다.',
    'bundles.heading': '티켓 번들',
    'competitions.paidSection': '유료 추첨',
    'competitions.freeSection': '무료 이벤트',
    'competitions.paidUkHidden': '유료 추첨은 영국 방문자에게만 표시됩니다.',
    'home.enterBundleUnavailable':
      '번들 추첨 참가는 영국에서만 가능합니다. 무료 국제 이벤트를 이용해 보세요.',
    'entry.paidUkOnly':
      '유료 번들은 영국에서만 가능합니다. 무료 국제 이벤트에 참여해 주세요.',
  },
  hi: {
    ...EN,
    'nav.home': 'होम',
    'nav.competitions': 'प्रतियोगिताएँ',
    'nav.faq': 'FAQ',
    'nav.terms': 'नियम',
    'lang.label': 'भाषा',
    'region.paidUkOnlyTitle': 'टिकट बंडल — केवल UK',
    'region.paidUkOnlyBody':
      'सशुल्क बंडल और Signed Legacy Bundle ड्रॉ केवल यूनाइटेड किंगडम में उपलब्ध हैं। मुफ्त गिवअवे विश्व स्तर पर खुले हैं।',
    'region.giveawaysWorldTitle': 'विश्व भर में खुले गिवअवे',
    'region.giveawaysWorldBody':
      'वर्ल्ड कप बॉल चैलेंज सहित हमारे मुफ्त स्किल गिवअवे में कहीं से भी भाग लें।',
    'region.bundlesUkBadge': 'केवल UK',
    'footer.paidUkOnly':
      'सशुल्क बंडल और डाक प्रविष्टि केवल UK। मुफ्त गिवअवे अंतरराष्ट्रीय हैं।',
    'footer.giveawaysInternational': 'मुफ्त गिवअवे दुनिया भर के प्रतिभागियों के लिए खुले हैं।',
    'bundles.heading': 'टिकट बंडल',
    'competitions.paidSection': 'सशुल्क ड्रॉ',
    'competitions.freeSection': 'मुफ्त गिवअवे',
    'competitions.paidUkHidden': 'सशुल्क ड्रॉ केवल UK आगंतुकों को दिखाए जाते हैं।',
    'home.enterBundleUnavailable':
      'बंडल ड्रॉ प्रविष्टि केवल UK में। हमारे मुफ्त अंतरराष्ट्रीय गिवअवे आज़माएँ।',
    'entry.paidUkOnly':
      'सशुल्क बंडल केवल UK में उपलब्ध। कृपया मुफ्त अंतरराष्ट्रीय गिवअवे में भाग लें।',
  },
  tr: {
    ...EN,
    'nav.home': 'Ana sayfa',
    'nav.competitions': 'Yarışmalar',
    'nav.faq': 'SSS',
    'nav.terms': 'Şartlar',
    'lang.label': 'Dil',
    'region.paidUkOnlyTitle': 'Bilet paketleri — yalnızca Birleşik Krallık',
    'region.paidUkOnlyBody':
      'Ücretli paketler ve Signed Legacy Bundle çekilişi yalnızca Birleşik Krallık’ta. Ücretsiz çekilişler dünya çapında açık.',
    'region.giveawaysWorldTitle': 'Dünya çapında çekilişler',
    'region.giveawaysWorldBody':
      'Dünya Kupası topu mücadelesi dahil ücretsiz beceri çekilişlerine her yerden katılın.',
    'region.bundlesUkBadge': 'Yalnızca UK',
    'footer.paidUkOnly':
      'Ücretli paketler ve posta girişi yalnızca UK. Ücretsiz çekilişler uluslararası.',
    'footer.giveawaysInternational': 'Ücretsiz çekilişler dünya genelindeki katılımcılara açıktır.',
    'bundles.heading': 'Bilet paketleri',
    'competitions.paidSection': 'Ücretli çekilişler',
    'competitions.freeSection': 'Ücretsiz çekilişler',
    'competitions.paidUkHidden': 'Ücretli çekilişler yalnızca UK ziyaretçilerine gösterilir.',
    'home.enterBundleUnavailable':
      'Paket çekilişi girişi yalnızca UK’de. Ücretsiz uluslararası çekilişlerimizi deneyin.',
    'entry.paidUkOnly':
      'Ücretli paketler yalnızca UK’de. Lütfen ücretsiz uluslararası bir çekilişe katılın.',
  },
  vi: {
    ...EN,
    'nav.home': 'Trang chủ',
    'nav.competitions': 'Cuộc thi',
    'nav.faq': 'FAQ',
    'nav.terms': 'Điều khoản',
    'lang.label': 'Ngôn ngữ',
    'region.paidUkOnlyTitle': 'Gói vé — chỉ Vương quốc Anh',
    'region.paidUkOnlyBody':
      'Gói trả phí và quay Signed Legacy Bundle chỉ có tại Vương quốc Anh. Giveaway miễn phí mở toàn cầu.',
    'region.giveawaysWorldTitle': 'Giveaway mở toàn cầu',
    'region.giveawaysWorldBody':
      'Tham gia giveaway kỹ năng miễn phí từ mọi nơi, bao gồm thử thách bóng World Cup.',
    'region.bundlesUkBadge': 'Chỉ UK',
    'footer.paidUkOnly':
      'Gói trả phí và gửi bưu điện chỉ dành cho UK. Giveaway miễn phí quốc tế.',
    'footer.giveawaysInternational': 'Giveaway miễn phí mở cho người tham gia trên toàn thế giới.',
    'bundles.heading': 'Gói vé',
    'competitions.paidSection': 'Quay thưởng trả phí',
    'competitions.freeSection': 'Giveaway miễn phí',
    'competitions.paidUkHidden': 'Quay thưởng trả phí chỉ hiển thị cho khách UK.',
    'home.enterBundleUnavailable':
      'Tham gia quay gói chỉ có tại UK. Hãy thử giveaway quốc tế miễn phí của chúng tôi.',
    'entry.paidUkOnly':
      'Gói trả phí chỉ có tại UK. Vui lòng tham gia giveaway quốc tế miễn phí.',
  },
  id: {
    ...EN,
    'nav.home': 'Beranda',
    'nav.competitions': 'Kompetisi',
    'nav.faq': 'FAQ',
    'nav.terms': 'Syarat',
    'lang.label': 'Bahasa',
    'region.paidUkOnlyTitle': 'Paket tiket — hanya Inggris Raya',
    'region.paidUkOnlyBody':
      'Paket berbayar dan undian Signed Legacy Bundle hanya di Inggris Raya. Giveaway gratis terbuka global.',
    'region.giveawaysWorldTitle': 'Giveaway terbuka di seluruh dunia',
    'region.giveawaysWorldBody':
      'Ikuti giveaway keterampilan gratis dari mana saja, termasuk tantangan bola Piala Dunia.',
    'region.bundlesUkBadge': 'Hanya UK',
    'footer.paidUkOnly':
      'Paket berbayar dan pos hanya UK. Giveaway gratis internasional.',
    'footer.giveawaysInternational': 'Giveaway gratis terbuka untuk peserta di seluruh dunia.',
    'bundles.heading': 'Paket tiket',
    'competitions.paidSection': 'Undian berbayar',
    'competitions.freeSection': 'Giveaway gratis',
    'competitions.paidUkHidden': 'Undian berbayar hanya ditampilkan untuk pengunjung UK.',
    'home.enterBundleUnavailable':
      'Masuk undian paket hanya di UK. Coba giveaway internasional gratis kami.',
    'entry.paidUkOnly':
      'Paket berbayar hanya di UK. Silakan ikuti giveaway internasional gratis.',
  },
  uk: {
    ...EN,
    'nav.home': 'Головна',
    'nav.competitions': 'Конкурси',
    'nav.faq': 'FAQ',
    'nav.terms': 'Умови',
    'lang.label': 'Мова',
    'region.paidUkOnlyTitle': 'Пакети квитків — лише Велика Британія',
    'region.paidUkOnlyBody':
      'Платні пакети та розіграш Signed Legacy Bundle доступні лише у Великій Британії. Безкоштовні розіграші відкриті світу.',
    'region.giveawaysWorldTitle': 'Розіграші по всьому світу',
    'region.giveawaysWorldBody':
      'Беріть участь у безкоштовних конкурсах навичок звідки завгодно, включно з челенджем м’яча ЧС.',
    'region.bundlesUkBadge': 'Лише UK',
    'footer.paidUkOnly':
      'Платні пакети та поштовий вхід лише для UK. Безкоштовні розіграші міжнародні.',
    'footer.giveawaysInternational': 'Безкоштовні розіграші відкриті для учасників у всьому світі.',
    'bundles.heading': 'Пакети квитків',
    'competitions.paidSection': 'Платні розіграші',
    'competitions.freeSection': 'Безкоштовні розіграші',
    'competitions.paidUkHidden': 'Платні розіграші показуються лише відвідувачам з UK.',
    'home.enterBundleUnavailable':
      'Вхід до розіграшу пакетів лише в UK. Спробуйте наші безкоштовні міжнародні розіграші.',
    'entry.paidUkOnly':
      'Платні пакети доступні лише в UK. Візьміть участь у безкоштовному міжнародному розіграші.',
  },
  ro: {
    ...EN,
    'nav.home': 'Acasă',
    'nav.competitions': 'Competiții',
    'nav.faq': 'FAQ',
    'nav.terms': 'Termeni',
    'lang.label': 'Limbă',
    'region.paidUkOnlyTitle': 'Pachete bilete — doar Regatul Unit',
    'region.paidUkOnlyBody':
      'Pachetele plătite și extragerea Signed Legacy Bundle sunt doar în Regatul Unit. Giveaway-urile gratuite sunt globale.',
    'region.giveawaysWorldTitle': 'Giveaway-uri deschise în lume',
    'region.giveawaysWorldBody':
      'Participă la giveaway-urile gratuite de skill de oriunde, inclusiv provocarea cu mingea CM.',
    'region.bundlesUkBadge': 'Doar UK',
    'footer.paidUkOnly':
      'Pachete plătite și poștă doar UK. Giveaway-urile gratuite sunt internaționale.',
    'footer.giveawaysInternational': 'Giveaway-urile gratuite sunt deschise participanților din întreaga lume.',
    'bundles.heading': 'Pachete bilete',
    'competitions.paidSection': 'Extrageri plătite',
    'competitions.freeSection': 'Giveaway-uri gratuite',
    'competitions.paidUkHidden': 'Extragerile plătite sunt afișate doar vizitatorilor din UK.',
    'home.enterBundleUnavailable':
      'Intrarea la extragerea pachetelor este doar în UK. Încearcă giveaway-urile internaționale gratuite.',
    'entry.paidUkOnly':
      'Pachetele plătite sunt disponibile doar în UK. Participă la un giveaway internațional gratuit.',
  },
  sv: {
    ...EN,
    'nav.home': 'Hem',
    'nav.competitions': 'Tävlingar',
    'nav.faq': 'FAQ',
    'nav.terms': 'Villkor',
    'lang.label': 'Språk',
    'region.paidUkOnlyTitle': 'Biljettpaket — endast Storbritannien',
    'region.paidUkOnlyBody':
      'Betalda paket och Signed Legacy Bundle-lottningen finns endast i Storbritannien. Gratis utlottningar är globala.',
    'region.giveawaysWorldTitle': 'Utlottningar öppna världen över',
    'region.giveawaysWorldBody':
      'Delta i våra gratis skicklighetsutlottningar var som helst, inklusive VM-bollutmaningen.',
    'region.bundlesUkBadge': 'Endast UK',
    'footer.paidUkOnly':
      'Betalda paket och post endast i UK. Gratis utlottningar är internationella.',
    'footer.giveawaysInternational': 'Gratis utlottningar är öppna för deltagare världen över.',
    'bundles.heading': 'Biljettpaket',
    'competitions.paidSection': 'Betalda utlottningar',
    'competitions.freeSection': 'Gratis utlottningar',
    'competitions.paidUkHidden': 'Betalda utlottningar visas endast för besökare i UK.',
    'home.enterBundleUnavailable':
      'Paketlottning endast i UK. Prova våra gratis internationella utlottningar.',
    'entry.paidUkOnly':
      'Betalda paket finns endast i UK. Delta i en gratis internationell utlottning.',
  },
}
