/** Public-facing individual draw ticket number (one per entry slot in a bundle). */
export function formatTicketNumber(serial) {
  const s = String(serial).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `SS-${s}`
}
