export function paidTicketNumbersForEmail(db, email) {
  const row = db
    .prepare(
      `SELECT t.id, t.quantity, t.payment_status
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = lower(?) AND t.payment_status = 'paid'
       ORDER BY COALESCE(t.purchased_at, t.created_at) DESC
       LIMIT 1`,
    )
    .get(email)
  if (!row) return { ticket: null, numbers: [] }
  const numbers = db
    .prepare(
      `SELECT ticket_number FROM ticket_numbers WHERE ticket_id = ? ORDER BY slot_index ASC`,
    )
    .all(row.id)
    .map((r) => r.ticket_number)
  return { ticket: row, numbers }
}
