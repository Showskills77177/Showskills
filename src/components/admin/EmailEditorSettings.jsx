import { EditorField, editorInputClass } from './DraggableSectionList'

/** Settings drawer fields for site editor → Newsletter emails tab. */
export function EmailEditorSettings({ layout, onChange, previewKind = 'welcome', onPreviewKindChange }) {
  const welcome = layout?.welcome || {}
  const campaign = layout?.campaign || {}

  function patchWelcome(patch) {
    onChange({ welcome: { ...welcome, ...patch } })
  }

  function patchCampaign(patch) {
    onChange({ campaign: { ...campaign, ...patch } })
  }

  return (
    <div className="space-y-8">
      {onPreviewKindChange ? (
        <label className="flex items-center gap-2 text-sm text-stone-400">
          Preview
          <select
            value={previewKind}
            onChange={(e) => onPreviewKindChange(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-stone-200"
          >
            <option value="welcome">Welcome email</option>
            <option value="campaign">Campaign email</option>
          </select>
        </label>
      ) : null}
      <section className="rounded-xl border border-lime-500/20 bg-lime-950/15 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-lime-300/80">Welcome email</h2>
        <p className="mt-1 text-xs text-stone-500">Sent after subscribe. Matches ticket email styling.</p>
        <div className="mt-4 grid gap-3">
          <EditorField label="Subject">
            <input
              value={welcome.subject || ''}
              onChange={(e) => patchWelcome({ subject: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Headline">
            <input
              value={welcome.headline || ''}
              onChange={(e) => patchWelcome({ headline: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Subtitle">
            <input
              value={welcome.subtitle || ''}
              onChange={(e) => patchWelcome({ subtitle: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Greeting">
            <input
              value={welcome.greeting || ''}
              onChange={(e) => patchWelcome({ greeting: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Paragraph 1">
            <textarea
              rows={3}
              value={welcome.paragraph1 || ''}
              onChange={(e) => patchWelcome({ paragraph1: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Paragraph 2">
            <textarea
              rows={3}
              value={welcome.paragraph2 || ''}
              onChange={(e) => patchWelcome({ paragraph2: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Button label">
            <input
              value={welcome.ctaLabel || ''}
              onChange={(e) => patchWelcome({ ctaLabel: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Button path">
            <input
              value={welcome.ctaPath || ''}
              onChange={(e) => patchWelcome({ ctaPath: e.target.value })}
              className={editorInputClass()}
              placeholder="/competitions"
            />
          </EditorField>
        </div>
      </section>

      <section className="rounded-xl border border-lime-500/20 bg-lime-950/15 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-lime-300/80">Campaign email</h2>
        <p className="mt-1 text-xs text-stone-500">
          Default subject and inner HTML for broadcasts. Override subject when sending below on the Newsletter admin page.
        </p>
        <div className="mt-4 grid gap-3">
          <EditorField label="Default subject">
            <input
              value={campaign.defaultSubject || ''}
              onChange={(e) => patchCampaign({ defaultSubject: e.target.value })}
              className={editorInputClass()}
            />
          </EditorField>
          <EditorField label="Default body">
            <textarea
              rows={8}
              value={campaign.bodyHtml || ''}
              onChange={(e) => patchCampaign({ bodyHtml: e.target.value })}
              className={editorInputClass()}
            />
            <p className="mt-1 text-xs text-stone-500">
              Plain text keeps your line breaks and paragraphs. Or use HTML tags for full control.
            </p>
          </EditorField>
        </div>
      </section>
    </div>
  )
}
