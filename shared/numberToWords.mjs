/** Converts a non-negative whole-dollar amount to cheque-style words, e.g. 60 -> "Sixty US Dollars and 00/100". */
const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function chunkToWords(n) {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const r = n % 10
    return TENS[t] + (r ? `-${ONES[r]}` : '')
  }
  const h = Math.floor(n / 100)
  const r = n % 100
  return `${ONES[h]} Hundred${r ? ` ${chunkToWords(r)}` : ''}`
}

/** Whole-number-to-words, supports up to billions. */
export function numberToWords(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0))
  if (n === 0) return 'Zero'
  const scales = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
    [1, ''],
  ]
  let remaining = n
  const parts = []
  for (const [scale, label] of scales) {
    const count = Math.floor(remaining / scale)
    if (count > 0) {
      parts.push(`${chunkToWords(count)}${label ? ` ${label}` : ''}`)
      remaining -= count * scale
    }
  }
  return parts.join(' ')
}

/** Cheque-style USD amount in words, e.g. 60 -> "Sixty US Dollars and 00/100". Supports cents. */
export function numberToUsdWords(amount) {
  const value = Math.max(0, Number(amount) || 0)
  const dollars = Math.floor(value)
  const cents = Math.round((value - dollars) * 100)
  const centsLabel = String(cents).padStart(2, '0')
  return `${numberToWords(dollars)} US Dollars and ${centsLabel}/100`
}
