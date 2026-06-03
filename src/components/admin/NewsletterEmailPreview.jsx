import { useMemo } from 'react'
import { EmailHtmlPreviewFrame } from './EmailHtmlPreviewFrame'
import {
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  welcomeEmailSubject,
  buildCampaignEmailHtml,
  buildCampaignEmailText,
  campaignDefaultSubject,
  NEWSLETTER_EMAIL_SAMPLE,
} from '../../../shared/newsletterEmail.mjs'
import { mergeEmailLayout } from '../../../shared/emailLayout.mjs'

const EMAIL_KINDS = [
  { id: 'welcome', label: 'Welcome (new subscriber)' },
  { id: 'campaign', label: 'Campaign broadcast' },
]

/**
 * @param {{ layout?: object, emailKind?: string, onEmailKindChange?: (id: string) => void, campaignBodyHtml?: string, campaignImages?: object[] }} props
 */
export function NewsletterEmailPreview({
  layout: layoutProp,
  emailKind = 'welcome',
  onEmailKindChange,
  campaignBodyHtml,
  campaignImages,
}) {
  const layout = useMemo(() => mergeEmailLayout(layoutProp), [layoutProp])
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : NEWSLETTER_EMAIL_SAMPLE.siteUrl
  const urls = {
    siteUrl,
    preferencesUrl: NEWSLETTER_EMAIL_SAMPLE.preferencesUrl.replace(
      NEWSLETTER_EMAIL_SAMPLE.siteUrl,
      siteUrl,
    ),
    unsubscribeUrl: NEWSLETTER_EMAIL_SAMPLE.unsubscribeUrl.replace(
      NEWSLETTER_EMAIL_SAMPLE.siteUrl,
      siteUrl,
    ),
  }

  const { html, text, subject, description } = useMemo(() => {
    if (emailKind === 'campaign') {
      const body = campaignBodyHtml ?? layout.campaign.bodyHtml
      return {
        html: buildCampaignEmailHtml(layout, { ...urls, bodyHtml: body, campaignImages }),
        text: buildCampaignEmailText(layout, { bodyHtml: body, campaignImages, ...urls }),
        subject: campaignDefaultSubject(layout),
        description:
          'Broadcast to active subscribers. Inner content is the editable block; header, logo, and footer links match ticket emails.',
      }
    }
    return {
      html: buildWelcomeEmailHtml(layout, urls),
      text: buildWelcomeEmailText(layout, urls),
      subject: welcomeEmailSubject(layout),
      description: 'Sent when someone subscribes (footer, newsletter page, shirt giveaway, or paid opt-in).',
    }
  }, [emailKind, layout, urls, campaignBodyHtml, campaignImages])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {onEmailKindChange ? (
          <label className="flex items-center gap-2 text-sm text-stone-400">
            Template
            <select
              value={emailKind}
              onChange={(e) => onEmailKindChange(e.target.value)}
              className="max-w-[16rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
            >
              {EMAIL_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="text-sm text-stone-500">{description}</p>
      </div>
      <p className="text-sm text-stone-500">
        Subject: <span className="font-mono text-stone-300">{subject}</span>
      </p>
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="min-w-0">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">HTML preview</h2>
          <EmailHtmlPreviewFrame html={html} title="Newsletter email HTML preview" />
        </section>
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Plain text</h2>
          <pre className="max-h-[min(720px,80vh)] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-stone-400">
            {text}
          </pre>
        </section>
      </div>
    </div>
  )
}
