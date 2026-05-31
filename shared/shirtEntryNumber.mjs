/** Public-facing shirt giveaway entry number (one per draw chance). */
export function formatShirtEntryNumber(serial) {
  const s = String(serial).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `SG-${s}`
}
