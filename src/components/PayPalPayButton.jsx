import { useEffect, useLayoutEffect, useRef } from 'react'

function useLatest(fn) {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return ref
}

function loadPayPalScript(clientId, currency) {
  const id = 'paypal-sdk-js'
  if (document.getElementById(id)) {
    return window.paypal ? Promise.resolve() : Promise.reject(new Error('PayPal SDK failed to load'))
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = id
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}`
    s.async = true
    s.onload = () => (window.paypal ? resolve() : reject(new Error('PayPal SDK unavailable')))
    s.onerror = () => reject(new Error('Could not load PayPal'))
    document.body.appendChild(s)
  })
}

/**
 * PayPal Smart Buttons for the paid bundle flow (server resolves bundleId → total).
 */
export function PayPalPayButton({
  clientId,
  currency,
  createOrderUrl,
  captureOrderUrl,
  bundleId,
  ticketQuantity,
  customerEmail,
  customerFullName,
  disabled,
  onPaid,
  onError,
}) {
  const containerRef = useRef(null)
  const buttonsRef = useRef(null)
  const onPaidRef = useLatest(onPaid)
  const onErrorRef = useLatest(onError)

  useEffect(() => {
    if (!clientId || disabled || !createOrderUrl || !captureOrderUrl) return undefined
    const root = containerRef.current
    if (!root) return undefined

    let cancelled = false

    ;(async () => {
      try {
        await loadPayPalScript(clientId, currency)
      } catch (e) {
        if (!cancelled) onErrorRef.current(e instanceof Error ? e.message : 'PayPal load error')
        return
      }
      if (cancelled || !root.isConnected || !window.paypal) return

      root.innerHTML = ''

      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          shape: 'rect',
          label: 'paypal',
          height: 44,
        },
        createOrder: async () => {
          const res = await fetch(createOrderUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bundleId }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(typeof data.error === 'string' ? data.error : 'Could not start PayPal checkout')
          }
          const orderID = data.orderID ?? data.id
          if (!orderID) throw new Error('Invalid PayPal response')
          return orderID
        },
        onApprove: async (data) => {
          const res = await fetch(captureOrderUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderID: data.orderID,
              bundleId,
              ticketQuantity: ticketQuantity ?? 1,
              customerEmail: customerEmail?.trim() || '',
              customerFullName: customerFullName?.trim() || '',
            }),
          })
          const cap = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(typeof cap.error === 'string' ? cap.error : 'PayPal capture failed')
          }
          onPaidRef.current()
        },
        onError: (err) => {
          const msg = err?.message || 'PayPal error'
          onErrorRef.current(msg)
        },
      })

      buttonsRef.current = buttons
      await buttons.render(root)
    })()

    return () => {
      cancelled = true
      try {
        buttonsRef.current?.close?.()
      } catch {
        /* ignore */
      }
      buttonsRef.current = null
      if (root.isConnected) root.innerHTML = ''
    }
  }, [
    clientId,
    currency,
    createOrderUrl,
    captureOrderUrl,
    bundleId,
    ticketQuantity,
    customerEmail,
    customerFullName,
    disabled,
    onPaidRef,
    onErrorRef,
  ])

  if (!clientId) return null

  if (disabled) {
    return (
      <p className="text-center text-xs text-stone-500">
        Tick &quot;I agree&quot; above to pay with PayPal.
      </p>
    )
  }

  return <div ref={containerRef} className="min-h-[44px] w-full [&_.paypal-buttons]:min-h-[44px]" />
}
