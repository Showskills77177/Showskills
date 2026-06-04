import { POSTAL_ENTRY_ADDRESS } from '../../competitionData'
import { defaultPostalName } from '../../../shared/competitionEntryMethods.mjs'

/**
 * @param {{
 *   allowPaidEntry: boolean,
 *   allowFreeOnline: boolean,
 *   allowPostalEntry: boolean,
 *   postalCompetitionName: string,
 *   competitionTitle?: string,
 *   onChange: (patch: Record<string, unknown>) => void,
 * }} props
 */
export function CompetitionEntryMethodsEditor({
  allowPaidEntry,
  allowFreeOnline,
  allowPostalEntry,
  postalCompetitionName,
  competitionTitle = '',
  onChange,
  giveawayMode = false,
}) {
  const postalPreview = postalCompetitionName?.trim() || defaultPostalName(competitionTitle) || 'Your competition name'

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        {giveawayMode
          ? 'Free entry routes only — £0 card-verified online entry and/or free postal entry into the same draw pool.'
          : 'Same entry routes as the Signed Football Legend Bundle — paid ticket bundles, £0 card-verified free online entry, and free postal entry into the same draw pool.'}
      </p>
      <div className={`grid gap-2 ${giveawayMode ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {!giveawayMode ? (
        <label className="flex cursor-pointer gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={allowPaidEntry !== false}
            onChange={(e) => onChange({ allowPaidEntry: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-stone-100">Paid ticket bundles</span>
            <span className="mt-0.5 block text-xs text-stone-500">PayPal / card checkout with bundle prices below.</span>
          </span>
        </label>
        ) : null}
        <label className="flex cursor-pointer gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={Boolean(allowFreeOnline)}
            onChange={(e) => onChange({ allowFreeOnline: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-stone-100">Free online (£0 verify)</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Card verification, address, then three skill questions — same draw.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={Boolean(allowPostalEntry)}
            onChange={(e) => onChange({ allowPostalEntry: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-stone-100">Free postal entry</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Entrants post details + answers to {POSTAL_ENTRY_ADDRESS}.
            </span>
          </span>
        </label>
      </div>
      {allowPostalEntry ? (
        <label className="block text-sm text-stone-400">
          Name on postal entries
          <input
            value={postalCompetitionName || ''}
            onChange={(e) => onChange({ postalCompetitionName: e.target.value })}
            placeholder={defaultPostalName(competitionTitle) || 'Prize name — ShowSkills Rewards'}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-stone-100"
          />
          <span className="mt-1 block text-xs text-stone-500">
            Entrants must write this on their envelope: <span className="text-stone-400">{postalPreview}</span>
          </span>
        </label>
      ) : null}
    </div>
  )
}
