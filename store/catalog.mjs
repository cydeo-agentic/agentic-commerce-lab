// The Zinc Store catalog. Prices are integer cents: money is never a float in this codebase (PRD PRICE-1).
export const PRODUCTS = [
  { sku: 'keyboard', name: 'Aurora Mechanical Keyboard', tagline: 'Hot-swap switches, aluminum frame.', priceCents: 12900, tone: ['#c7d2fe', '#6366f1'] },
  { sku: 'headphones', name: 'Halo ANC Headphones', tagline: '40 hours, adaptive noise cancelling.', priceCents: 24999, tone: ['#fbcfe8', '#db2777'] },
  { sku: 'hub', name: 'Dock 8-in-1 USB-C Hub', tagline: 'HDMI 4K, Ethernet, 100 W pass-through.', priceCents: 4900, tone: ['#bae6fd', '#0284c7'] },
  { sku: 'webcam', name: 'Lumen 4K Webcam', tagline: 'Auto-framing, dual mics.', priceCents: 8950, tone: ['#bbf7d0', '#16a34a'] },
  { sku: 'lightbar', name: 'Beam Monitor Light Bar', tagline: 'No glare, auto-dimming.', priceCents: 5995, tone: ['#fde68a', '#d97706'] },
  { sku: 'stand', name: 'Arc Laptop Stand', tagline: 'One piece of recycled aluminum.', priceCents: 2500, tone: ['#e5e7eb', '#4b5563'] },
  { sku: 'mat', name: 'Felt Desk Mat', tagline: 'Merino wool, 90 × 40 cm.', priceCents: 1999, tone: ['#fed7aa', '#ea580c'] },
  { sku: 'cable', name: 'Braided USB-C Cable', tagline: '2 m, 240 W, 40 Gbps.', priceCents: 1250, tone: ['#ddd6fe', '#7c3aed'] },
];

export const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));

// Product art: small inline SVGs so the store never depends on an image host.
const ART = {
  keyboard: '<rect x="18" y="44" width="124" height="52" rx="10" fill="url(#g)"/>' +
    Array.from({ length: 18 }, (_, i) => `<rect x="${28 + (i % 9) * 12}" y="${54 + Math.floor(i / 9) * 14}" width="9" height="9" rx="2" fill="#fff" opacity=".85"/>`).join('') +
    '<rect x="46" y="82" width="68" height="8" rx="2" fill="#fff" opacity=".85"/>',
  headphones: '<path d="M38 92V74a42 42 0 0 1 84 0v18" stroke="url(#g)" stroke-width="10" fill="none" stroke-linecap="round"/>' +
    '<rect x="28" y="84" width="24" height="34" rx="10" fill="url(#g)"/><rect x="108" y="84" width="24" height="34" rx="10" fill="url(#g)"/>',
  hub: '<rect x="40" y="40" width="80" height="62" rx="14" fill="url(#g)"/>' +
    '<rect x="54" y="58" width="14" height="6" rx="2" fill="#fff"/><rect x="74" y="58" width="14" height="6" rx="2" fill="#fff"/><rect x="94" y="58" width="12" height="6" rx="2" fill="#fff"/>' +
    '<circle cx="62" cy="80" r="4" fill="#fff"/><circle cx="80" cy="80" r="4" fill="#fff"/><rect x="92" y="77" width="14" height="6" rx="2" fill="#fff"/><path d="M80 102v22" stroke="url(#g)" stroke-width="6" stroke-linecap="round"/>',
  webcam: '<circle cx="80" cy="66" r="34" fill="url(#g)"/><circle cx="80" cy="66" r="15" fill="#0f172a"/><circle cx="85" cy="61" r="5" fill="#fff" opacity=".7"/>' +
    '<rect x="62" y="104" width="36" height="8" rx="4" fill="url(#g)"/>',
  lightbar: '<rect x="26" y="46" width="108" height="14" rx="7" fill="url(#g)"/><path d="M40 66l-12 40M120 66l12 40" stroke="#fde68a" stroke-width="3" opacity=".9"/>' +
    '<rect x="30" y="104" width="100" height="16" rx="4" fill="#e5e7eb"/>',
  stand: '<path d="M36 112h88" stroke="url(#g)" stroke-width="8" stroke-linecap="round"/><path d="M58 112l28-58h30" stroke="url(#g)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  mat: '<rect x="20" y="52" width="120" height="56" rx="12" fill="url(#g)"/><rect x="28" y="60" width="104" height="40" rx="8" fill="#fff" opacity=".18"/>',
  cable: '<path d="M30 100c30 0 30-48 60-48s30 48 40 48" stroke="url(#g)" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<rect x="16" y="94" width="18" height="12" rx="3" fill="url(#g)"/><rect x="126" y="94" width="18" height="12" rx="3" fill="url(#g)"/>',
};

export function productArt(p) {
  const [from, to] = p.tone;
  // Gradient ids are document-wide, so each product gets its own (otherwise every card paints the first gradient).
  const id = `g-${p.sku}`;
  return `<svg viewBox="0 0 160 150" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `${(ART[p.sku] ?? '').replaceAll('url(#g)', `url(#${id})`)}</svg>`;
}
