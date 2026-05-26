/**
 * Hosted PNG icons for HTML email (email clients do not load React/icon fonts).
 * Icons8 Fluency — stable CDN URLs, 96px source scaled in markup.
 */
export const EMAIL_ICONS = {
  trophy: 'https://img.icons8.com/fluency/96/trophy.png',
  crown: 'https://img.icons8.com/fluency/96/crown.png',
  sparkles: 'https://img.icons8.com/fluency/96/sparkling.png',
  fireworks: 'https://img.icons8.com/fluency/96/firework.png',
  ticket: 'https://img.icons8.com/fluency/96/ticket.png',
  phone: 'https://img.icons8.com/fluency/48/phone.png',
  star: 'https://img.icons8.com/fluency/48/star.png',
}

/** @param {string} src @param {string} alt @param {number} [size] */
export function emailIconImg(src, alt, size = 40) {
  const w = size
  const h = size
  return `<img src="${src}" alt="${alt}" width="${w}" height="${h}" style="display:inline-block;width:${w}px;height:${h}px;border:0;vertical-align:middle" />`
}
