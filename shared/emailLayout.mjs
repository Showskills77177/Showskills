/** Editable newsletter email copy (stored in site_layout_config as page id `emails`). */

export const EMAIL_LAYOUT_PAGE_ID = 'emails'

export function defaultEmailLayout() {
  return {
    version: 1,
    welcome: {
      subject: 'Welcome to ShowSkills Rewards',
      headline: "You're on the list",
      subtitle: 'Giveaways & prize draws',
      greeting: 'Hi there,',
      paragraph1:
        'Thanks for subscribing to ShowSkills Rewards — free email updates about giveaways, competitions, and prize draws.',
      paragraph2: 'No account is needed. Use the same email you signed up with when you enter any promotion.',
      ctaLabel: 'View competitions',
      ctaPath: '/competitions',
    },
    campaign: {
      defaultSubject: 'News from ShowSkills Rewards',
      bodyHtml:
        '<p style="margin:0 0 14px;color:#d6d3d1">We have news about giveaways and prize draws for you.</p><p style="margin:0;color:#d6d3d1">Check the site for the latest competitions — good luck.</p>',
    },
  }
}

function mergeSection(base, input) {
  if (!input || typeof input !== 'object') return base
  const out = { ...base }
  for (const key of Object.keys(base)) {
    if (typeof input[key] === 'string') out[key] = input[key].trim()
  }
  return out
}

function stripLegacyCampaignHeaderFields(campaign) {
  if (!campaign || typeof campaign !== 'object') return campaign
  const out = { ...campaign }
  delete out.headline
  delete out.subtitle
  return out
}

export function mergeEmailLayout(input) {
  const base = defaultEmailLayout()
  if (!input || typeof input !== 'object') return base
  return {
    version: 1,
    welcome: mergeSection(base.welcome, input.welcome),
    campaign: stripLegacyCampaignHeaderFields(mergeSection(base.campaign, input.campaign)),
  }
}
