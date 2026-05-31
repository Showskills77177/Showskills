import { query } from './db.mjs'

/** Live checkout uses Cashflows — exclude Stripe/PayPal test and legacy rows from headline sales. */
export const PRODUCTION_SALES_PAYMENT_SQL = `p.status = 'successful' AND p.provider = 'cashflows'`

export async function loadProductionSalesTotals() {
  const [tickets, revenue, cashflowsPayments] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(t.quantity), 0)::int AS n
       FROM payments p
       JOIN tickets t ON t.id = p.ticket_id
       WHERE ${PRODUCTION_SALES_PAYMENT_SQL}`,
    ),
    query(
      `SELECT COALESCE(SUM(p.amount_pence), 0)::bigint AS a
       FROM payments p
       WHERE ${PRODUCTION_SALES_PAYMENT_SQL}`,
    ),
    query(
      `SELECT COUNT(*)::int AS c
       FROM payments p
       WHERE ${PRODUCTION_SALES_PAYMENT_SQL}`,
    ),
  ])

  return {
    ticketsSold: tickets.rows[0]?.n ?? 0,
    revenuePence: Number(revenue.rows[0]?.a ?? 0),
    cashflowsPaymentCount: cashflowsPayments.rows[0]?.c ?? 0,
    salesSource: 'cashflows',
  }
}
