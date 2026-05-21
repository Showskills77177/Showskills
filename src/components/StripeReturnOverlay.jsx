/** Full-page feedback while confirming a Stripe redirect return (avoids empty dialog backdrop). */
export function StripeReturnOverlay({ status, message }) {
  if (!status) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071512]/95 px-6"
      role="status"
      aria-live="polite"
      aria-busy={status === 'confirming'}
    >
      <div className="w-full max-w-md rounded-2xl border border-teal-500/30 bg-stone-950 px-6 py-8 text-center shadow-2xl">
        {status === 'confirming' ? (
          <>
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400"
              aria-hidden
            />
            <p className="mt-4 text-lg font-semibold text-stone-100">Confirming your payment</p>
            <p className="mt-2 text-sm text-stone-400">Please wait — do not close this page.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-amber-100">Payment not completed</p>
            <p className="mt-2 text-sm text-stone-400">{message || 'You can try again from the entry form.'}</p>
          </>
        )}
      </div>
    </div>
  )
}
