export function ErrorBanner({ message }) {
  return (
    <p className="rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200" role="alert">
      {message}
    </p>
  )
}
