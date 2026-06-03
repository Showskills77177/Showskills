import { useEffect, useState } from 'react'
import { PurchaseEmailPreview } from '../../components/admin/PurchaseEmailPreview'
import { apiFetch } from '../../lib/api'
import { mergeEmailLayout } from '../../../shared/emailLayout.mjs'

export default function TestEmailPage() {
  const [emailLayout, setEmailLayout] = useState(null)

  useEffect(() => {
    apiFetch('/api/admin/site-pages')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (res.ok) setEmailLayout(mergeEmailLayout(j.pages?.emails))
      })
      .catch(() => {})
  }, [])

  return <PurchaseEmailPreview newsletterLayout={emailLayout} />
}
