/**
 * Builds the English i18n catalog from code defaults + shared content modules.
 * Run: node scripts/build-i18n-catalog.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FAQ_PAGE_SUBTITLE,
  FAQ_PAGE_TITLE,
  FAQ_SECTIONS,
} from '../shared/faqContent.mjs'
import { defaultHomepageLayout } from '../shared/homepageLayout.mjs'
import {
  defaultCompetitionsPageLayout,
  defaultContactPageLayout,
  defaultFaqPageLayout,
  defaultShirtGiveawayPageLayout,
  defaultSiteShell,
} from '../shared/sitePageLayout.mjs'
import { CONTACT_TOPICS } from '../shared/siteContact.mjs'
import { TICKET_BUNDLES } from '../shared/ticketBundles.mjs'
import {
  WORLD_CUP_BALL_ELIGIBILITY_NOTICE,
  WORLD_CUP_BALL_PAGE_INTRO,
  WORLD_CUP_BALL_PUBLIC_STEPS,
  WORLD_CUP_BALL_TERMS_SECTIONS,
  defaultWorldCupBallGiveawayPageLayout,
  WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT,
} from '../shared/worldCupBallGiveawayRules.mjs'
import { WORLD_CUP_BALL_QUESTION_BANK } from '../shared/worldCupBallQuestionBank.mjs'
import {
  FOOTER_NO_PURCHASE_NOTICE,
  NO_PURCHASE_ENTRY_NOTICE,
} from '../shared/competitionCopy.mjs'
import { UK_AVAILABILITY_NOTICE } from '../shared/siteAvailability.mjs'
import { TICKET_PURCHASE_NON_REFUND_NOTICE } from '../shared/ticketCheckoutNotice.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../shared/i18n/locales')

/** @param {Record<string, string>} target @param {Record<string, string>} source */
function assign(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim()) target[key] = value
  }
}

function buildCoreUi() {
  return {
    'nav.home': 'Home',
    'nav.competitions': 'Competitions',
    'nav.faq': 'FAQ',
    'nav.terms': 'T&C',
    'footer.competitions': 'Competitions',
    'footer.newsletter': 'Newsletter',
    'footer.contact': 'Contact',
    'footer.faq': 'FAQ',
    'footer.terms': 'Full terms & privacy',
    'footer.ticketTerms': 'Paid ticket terms',
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
    'home.enterBundleUnavailable':
      'Bundle draw entry is available in the UK only. Try our free international giveaways.',
    'entry.paidUkOnly':
      'Paid ticket bundles are only available in the United Kingdom. Please enter a free international giveaway instead.',
    'common.close': 'Close',
    'common.loading': 'Loading…',
    'common.submit': 'Submit',
    'common.subscribe': 'Subscribe',
    'common.joining': 'Joining…',
    'common.email': 'Email',
    'common.emailPlaceholder': 'you@example.com',
    'common.winner': 'Winner',
    'common.brandName': 'ShowSkills Rewards',
    'form.invalidEmail': 'Enter a valid email address.',
    'form.nameRequired': 'Please enter your name.',
    'form.messageMinLength': 'Please enter a message (at least 10 characters).',
    'form.networkError': 'Network error. Check your connection and try again.',
    'newsletter.pageTitle': 'ShowSkills Rewards',
    'newsletter.pageIntro':
      'Free email updates about giveaways, competitions, and prize draws. You do not need a ShowSkills account — just your email.',
    'newsletter.alreadySubscribed':
      'Already subscribed? Use the preferences or unsubscribe link in any email we send, or',
    'newsletter.contactUs': 'contact us',
    'home.prizeLineup': 'Prize lineup',
    'home.shirtLink': 'Free shirt giveaway',
    'home.wcBall.rulesLink': 'Full rules & how to win',
    'home.wcBall.tagFree': 'Free entry',
    'home.wcBall.tagQuestions': '{count} skill questions',
    'home.wcBall.tagWin': 'Win the ball',
    'wcBall.oneAttemptShort': WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT,
    'wcBall.hosts': 'FIFA World Cup 2026',
    'wcBall.hostNations': 'USA · Canada · Mexico',
    'wcBall.atAGlance.free': 'Free to enter — worldwide, ages 16+',
    'wcBall.atAGlance.noVpn': 'No VPNs or proxies',
    'wcBall.atAGlance.delivery': 'Delivery details only if you win',
    'wcBall.howToWin': 'How to win',
    'wcBall.readTerms': 'Read full terms',
    'wcBall.startQuiz': 'Enter the quiz',
    'bundles.entryRoute': 'Entry route',
    'bundles.tapToChoose': 'Tap to choose',
    'bundles.chooseHow': 'Choose how to enter',
    'bundles.payForTickets': 'Pay for tickets',
    'bundles.enterFreeOnline': 'enter free online',
    'bundles.enterByPost': 'enter by post',
    'newsletter.footerLead':
      'Join ShowSkills Rewards for giveaway and competition news.',
    'newsletter.pageLead':
      'Join ShowSkills Rewards for giveaway and competition news. No account needed.',
    'newsletter.subscribed': 'You are subscribed. Check your inbox for updates.',
    'newsletter.unavailable':
      'Newsletter signup is not available right now. Please try again in a few minutes.',
    'newsletter.failed': 'Could not subscribe',
    'newsletter.subscriptionFailed': 'Subscription failed',
    'newsletter.ariaLabel': 'Newsletter signup',
    'contact.eyebrow': 'Get in touch',
    'contact.title': 'Contact us',
    'contact.preferEmail': 'Prefer email? Write to',
    'contact.postalTitle': 'Free postal entry address',
    'contact.postalHint':
      'Same as {address} — one entry per person; include competition name and skill answers in your post.',
    'contact.sentTitle': 'Message sent',
    'contact.sentBody': 'Thank you — we received your message and will reply to the email you provided.',
    'contact.nameLabel': 'Your name',
    'contact.emailLabel': 'Email address',
    'contact.topicLabel': 'Topic',
    'contact.messageLabel': 'Message',
    'contact.sendLabel': 'Send message',
    'contact.sendingLabel': 'Sending…',
    'contact.faqHint': 'Many answers are in our',
    'contact.faqLink': 'FAQ',
    'faq.helpCentre': 'Help centre',
    'faq.viewCompetitions': 'View rewards & competitions',
    'faq.fullTerms': 'Full terms & privacy',
    'faq.searchLabel': 'Search questions',
    'faq.searchPlaceholder': 'Search rewards, tickets, quiz, winners…',
    'faq.noResults': 'No questions match your search — try different words or browse a topic below.',
    'faq.oneResult': '1 question found',
    'faq.manyResults': '{count} questions found',
    'faq.allTopics': 'All topics',
    'faq.popularHeading': 'Popular questions',
    'faq.stillNeedHelp': 'Still need help?',
    'faq.contactUs': 'Contact us',
    'faq.readTerms': 'Read full terms',
    'terms.title': 'Terms & conditions',
    'terms.privacyTitle': 'Privacy Policy',
    'terms.lastUpdated': 'Last updated: 18 June 2026',
    'cards.enterCompetition': 'Enter this competition',
    'cards.featuredMainPrize': 'Featured · Main prize',
    'cards.freeEntryOnly': 'Free entry routes only',
    'cards.paidBundlesAvailable': 'Paid ticket bundles available',
    'cards.fromPrice': 'From {price}',
    'cards.fromToPrice': 'From {min} · bundles to {max}',
    'cards.defaultSummary':
      'Pay for ticket bundles or use free entry routes, then answer three skill questions to qualify for the draw.',
    'home.promoLive': 'Live promotion',
    'home.spec.iphone.label': 'iPhone 17 Pro Max',
    'home.spec.iphone.body':
      'Unlocked, 6.9-inch display, 512GB model. Estimated retail value £1,399.',
    'home.spec.colour.label': 'Colour substitution',
    'home.spec.colour.body':
      'If the shown colour is unavailable, an equivalent colour such as black or another available finish may be supplied.',
    'home.spec.case.label': '24K gold case',
    'home.spec.case.body':
      'Premium gold-style case for the iPhone 17 Pro Max, included as part of the prize stack.',
    'home.spec.football.label': 'Museum signed football',
    'home.spec.football.body':
      'Certified Ronaldo museum-style signed football, presented as a collector item with the bundle.',
    'legal.ukAvailability': UK_AVAILABILITY_NOTICE,
    'legal.noPurchase': NO_PURCHASE_ENTRY_NOTICE,
    'legal.footerNoPurchase': FOOTER_NO_PURCHASE_NOTICE,
    'legal.ticketNonRefund': TICKET_PURCHASE_NON_REFUND_NOTICE,
    'wcBall.pageIntro': WORLD_CUP_BALL_PAGE_INTRO,
    'wcBall.eligibility': WORLD_CUP_BALL_ELIGIBILITY_NOTICE,
  }
}

function buildLayoutKeys() {
  const out = {}
  const shell = defaultSiteShell()
  out['layout.shell.tagline'] = shell.headerTagline
  out['layout.shell.disclaimer'] = shell.footer.disclaimer

  const home = defaultHomepageLayout()
  const hi = home.blocks.hero_intro
  out['layout.home.promo_strip.livePromotionLabel'] = home.blocks.promo_strip.livePromotionLabel
  out['layout.home.hero_intro.brandTitle'] = hi.brandTitle
  out['layout.home.hero_intro.headline'] = hi.headline
  out['layout.home.hero_intro.consolationCopy'] = hi.consolationCopy
  out['layout.home.hero_intro.helperCopy'] = hi.helperCopy
  out['layout.home.hero_intro.prizeLineupLabel'] = hi.prizeLineupLabel
  out['layout.home.hero_intro.shirtLinkLabel'] = hi.shirtLinkLabel
  out['layout.home.hero_prizes.ctaBlurb'] = home.blocks.hero_prizes.ctaBlurb
  out['layout.home.hero_prizes.ctaButtonLabel'] = home.blocks.hero_prizes.ctaButtonLabel
  out['layout.home.hero_details.title'] = home.blocks.hero_details.title
  out['layout.home.iphone_17_pro_panel.badgeLabel'] = home.blocks.iphone_17_pro_panel.badgeLabel
  out['layout.home.iphone_17_pro_panel.ctaButtonLabel'] = home.blocks.iphone_17_pro_panel.ctaButtonLabel
  out['layout.home.world_cup_ball_panel.badgeLabel'] = home.blocks.world_cup_ball_panel.badgeLabel
  out['layout.home.world_cup_ball_panel.ctaButtonLabel'] = home.blocks.world_cup_ball_panel.ctaButtonLabel
  const hub = home.blocks.competitions_hub
  out['layout.home.competitions_hub.title'] = hub.title
  out['layout.home.competitions_hub.subtitle'] = hub.subtitle
  out['layout.home.competitions_hub.paidTitle'] = hub.paidTitle
  out['layout.home.competitions_hub.paidSubtitle'] = hub.paidSubtitle
  out['layout.home.competitions_hub.freeTitle'] = hub.freeTitle
  out['layout.home.competitions_hub.freeSubtitle'] = hub.freeSubtitle
  out['layout.home.competitions_hub.separatorLabel'] = hub.separatorLabel
  out['layout.home.winners_panel.title'] = home.blocks.winners_panel.title
  out['layout.home.winners_panel.subtitle'] = home.blocks.winners_panel.subtitle

  const comp = defaultCompetitionsPageLayout()
  out['layout.competitions.title'] = comp.title
  out['layout.competitions.intro'] = comp.intro
  out['layout.competitions.sections.paid.title'] = comp.sections.paid.title
  out['layout.competitions.sections.paid.subtitle'] = comp.sections.paid.subtitle
  out['layout.competitions.sections.free.title'] = comp.sections.free.title
  out['layout.competitions.sections.free.subtitle'] = comp.sections.free.subtitle
  out['layout.competitions.faqLinkLabel'] = comp.faqLinkLabel
  out['layout.competitions.jumpLinkLabel'] = comp.jumpLinkLabel

  const faq = defaultFaqPageLayout()
  out['layout.faq.title'] = faq.title
  out['layout.faq.subtitle'] = faq.subtitle

  const contact = defaultContactPageLayout()
  out['layout.contact.eyebrow'] = contact.eyebrow
  out['layout.contact.title'] = contact.title
  out['layout.contact.intro'] = contact.intro

  const shirt = defaultShirtGiveawayPageLayout()
  out['layout.shirt.badge'] = shirt.badge
  out['layout.shirt.title'] = shirt.title
  out['layout.shirt.intro'] = shirt.intro
  out['layout.shirt.ctaButtonLabel'] = shirt.ctaButtonLabel
  out['layout.shirt.howToTitle'] = shirt.howToTitle

  const wc = defaultWorldCupBallGiveawayPageLayout()
  out['layout.wcBall.badge'] = wc.badge
  out['layout.wcBall.title'] = wc.title
  out['layout.wcBall.intro'] = wc.intro
  out['layout.wcBall.ctaButtonLabel'] = wc.ctaButtonLabel
  out['layout.wcBall.howToTitle'] = wc.howToTitle

  return out
}

function buildFaqKeys() {
  const out = {}
  out['faq.page.title'] = FAQ_PAGE_TITLE
  out['faq.page.subtitle'] = FAQ_PAGE_SUBTITLE
  for (const section of FAQ_SECTIONS) {
    out[`faq.section.${section.id}.title`] = section.title
    out[`faq.section.${section.id}.summary`] = section.summary
    for (const item of section.items) {
      out[`faq.item.${item.id}.question`] = item.question
      out[`faq.item.${item.id}.answer`] = item.answer
    }
  }
  return out
}

function buildBundleKeys() {
  const out = {}
  for (const bundle of TICKET_BUNDLES) {
    out[`bundles.${bundle.id}.title`] = bundle.title
    out[`bundles.${bundle.id}.line1`] = bundle.line1
    if (bundle.line2) out[`bundles.${bundle.id}.line2`] = bundle.line2
    bundle.bullets.forEach((bullet, i) => {
      out[`bundles.${bundle.id}.bullet.${i}`] = bullet
    })
  }
  return out
}

function buildContactTopicKeys() {
  const out = {}
  for (const topic of CONTACT_TOPICS) {
    out[`contact.topic.${topic.id}`] = topic.label
  }
  return out
}

function buildWcBallKeys() {
  const out = {}
  WORLD_CUP_BALL_TERMS_SECTIONS.forEach((section, i) => {
    out[`wcBall.terms.${i}.title`] = section.title
    out[`wcBall.terms.${i}.body`] = section.body
  })
  WORLD_CUP_BALL_PUBLIC_STEPS.forEach((step) => {
    out[`wcBall.step.${step.num}.title`] = step.title
    out[`wcBall.step.${step.num}.detail`] = step.detail
  })
  return out
}

function buildQuizKeys() {
  const out = {}
  for (const q of WORLD_CUP_BALL_QUESTION_BANK) {
    const key = q.questionKey
    out[`wcBall.quiz.${key}.prompt`] = q.prompt
    if (Array.isArray(q.choices)) {
      q.choices.forEach((choice, i) => {
        out[`wcBall.quiz.${key}.choice.${i}`] = choice
      })
    }
  }
  return out
}

function serializeMessages(messages) {
  const keys = Object.keys(messages).sort()
  const lines = keys.map((key) => {
    const value = messages[key]
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `  '${key}': '${escaped}',`
  })
  return `/** Auto-generated — run: node scripts/build-i18n-catalog.mjs */\n\n/** @type {Record<string, string>} */\nexport const EN_MESSAGES = {\n${lines.join('\n')}\n}\n`
}

export function buildEnglishCatalog() {
  const messages = {}
  assign(messages, buildCoreUi())
  assign(messages, buildLayoutKeys())
  assign(messages, buildFaqKeys())
  assign(messages, buildBundleKeys())
  assign(messages, buildContactTopicKeys())
  assign(messages, buildWcBallKeys())
  assign(messages, buildQuizKeys())
  return messages
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT_DIR, { recursive: true })
  const messages = buildEnglishCatalog()
  const outPath = join(OUT_DIR, 'en.mjs')
  writeFileSync(outPath, serializeMessages(messages), 'utf8')
  console.log(`Wrote ${Object.keys(messages).length} keys to ${outPath}`)
}
