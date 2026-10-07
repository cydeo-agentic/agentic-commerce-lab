// The Zinc Store catalog. Prices are integer cents: money is never a float in this codebase (PRD PRICE-1).
// `category` picks the shelf a product sits on; every product renders exactly once, so its test ids stay unique.
export const CATEGORIES = [
  { id: 'phones', title: 'Phones.', lead: 'Pick one and put checkout to the test.' },
  { id: 'accessories', title: 'Accessories.', lead: 'Essentials that pair perfectly with your phone.' },
  { id: 'desk', title: 'Desk setup.', lead: 'Gear for people who ship.' },
];

export const PRODUCTS = [
  // Phones
  { sku: 'phonepro', category: 'phones', isNew: true, name: 'Zinc Phone Pro', tagline: 'Brushed aluminum. Three 48 MP cameras.', priceCents: 99900, tone: ['#e9e4dc', '#b9ad9c'], colors: ['#c9bfb1', '#3b3b3d', '#e6e6e6', '#5b6a7a'] },
  { sku: 'phoneair', category: 'phones', isNew: true, name: 'Zinc Phone Air', tagline: 'The thinnest phone we have ever made.', priceCents: 89900, tone: ['#e3eef8', '#a9c3dc'], colors: ['#b8cfe4', '#f2efe8', '#e8dcc4', '#1f1f21'] },
  { sku: 'phone', category: 'phones', name: 'Zinc Phone', tagline: 'All-day battery. A camera that just gets it.', priceCents: 79900, tone: ['#dfe9e3', '#9fb8a8'], colors: ['#a9c2b3', '#c8b7d8', '#f4f4f2', '#2b2b2d'] },
  { sku: 'phonelite', category: 'phones', name: 'Zinc Phone Lite', tagline: 'Everything you need. Nothing you don’t.', priceCents: 59900, tone: ['#f7f7f7', '#d2d2d6'], colors: ['#f4f4f2', '#2b2b2d'] },
  // Accessories
  { sku: 'case', category: 'accessories', isNew: true, name: 'Clear Case with Magnetic Ring', tagline: 'Crystal clear. Snaps to every charger.', priceCents: 4900, tone: ['#f4f8fb', '#c9d6e2'] },
  { sku: 'charger', category: 'accessories', name: 'Magnetic Charger (1 m)', tagline: 'Snaps on. Charges up to 25 W.', priceCents: 3900, tone: ['#ffffff', '#d9d9de'] },
  { sku: 'adapter', category: 'accessories', name: '30W USB-C Power Adapter', tagline: 'Fast charge from 0 to 50% in 30 minutes.', priceCents: 3900, tone: ['#ffffff', '#dcdce0'] },
  { sku: 'earbuds', category: 'accessories', isNew: true, name: 'Zinc Buds Pro', tagline: 'Active noise cancelling. Six hours per charge.', priceCents: 24900, tone: ['#ffffff', '#dedee3'] },
  { sku: 'wallet', category: 'accessories', name: 'Leather Card Wallet', tagline: 'Holds three cards. Attaches magnetically.', priceCents: 5900, tone: ['#c98b5e', '#7d4a2b'] },
  { sku: 'glass', category: 'accessories', name: 'Screen Guard', tagline: 'Edge-to-edge tempered glass.', priceCents: 2995, tone: ['#eef4fa', '#b7c7d8'] },
  // Desk setup (the original Zinc Store catalog; labs and the answer key use these)
  { sku: 'keyboard', category: 'desk', name: 'Aurora Mechanical Keyboard', tagline: 'Hot-swap switches, aluminum frame.', priceCents: 12900, tone: ['#f1f1f3', '#b8b8bf'] },
  { sku: 'headphones', category: 'desk', name: 'Halo ANC Headphones', tagline: '40 hours, adaptive noise cancelling.', priceCents: 24999, tone: ['#e6e8ee', '#8e94a3'] },
  { sku: 'hub', category: 'desk', name: 'Dock 8-in-1 USB-C Hub', tagline: 'HDMI 4K, Ethernet, 100 W pass-through.', priceCents: 4900, tone: ['#e2e3e8', '#8a8d97'] },
  { sku: 'webcam', category: 'desk', name: 'Lumen 4K Webcam', tagline: 'Auto-framing, dual mics.', priceCents: 8950, tone: ['#3a3a3e', '#151517'] },
  { sku: 'lightbar', category: 'desk', name: 'Beam Monitor Light Bar', tagline: 'No glare, auto-dimming.', priceCents: 5995, tone: ['#4a4a50', '#1c1c1f'] },
  { sku: 'stand', category: 'desk', name: 'Arc Laptop Stand', tagline: 'One piece of recycled aluminum.', priceCents: 2500, tone: ['#eeeef1', '#a9a9b1'] },
  { sku: 'mat', category: 'desk', name: 'Felt Desk Mat', tagline: 'Merino wool, 90 × 40 cm.', priceCents: 1999, tone: ['#8d8f96', '#55575d'] },
  { sku: 'cable', category: 'desk', name: 'Braided USB-C Cable', tagline: '2 m, 240 W, 40 Gbps.', priceCents: 1250, tone: ['#fafafa', '#cfcfd4'] },
];

export const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));

// Product renders: inline SVGs so the store never depends on an image host.
// url(#b) is the product's body gradient, url(#s) its soft floor shadow; both get a per-product id below.
const lens = (cx, cy, r = 7) => `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#2a2a2e"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0c0c10"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#1f2a44"/><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#fff" opacity=".55"/>`;
const phoneFront = (x, wall) => `<rect x="${x}" y="22" width="78" height="158" rx="17" fill="#1d1d1f"/>` +
  `<rect x="${x + 4}" y="26" width="70" height="150" rx="14" fill="url(#${wall})"/>` +
  `<rect x="${x + 27}" y="31" width="24" height="7" rx="3.5" fill="#0b0b0d"/>` +
  `<text x="${x + 27}" y="64" text-anchor="middle" font-family="-apple-system,Helvetica,Arial" font-size="13" font-weight="300" fill="#fff" opacity=".92">9:41</text>`;
const phoneBack = (x, cams) => `<rect x="${x}" y="14" width="80" height="162" rx="18" fill="url(#b)"/>` +
  `<rect x="${x + 0.5}" y="14.5" width="79" height="161" rx="17.5" fill="none" stroke="#fff" stroke-opacity=".55"/>${cams}`;
const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="5" fill="url(#s)"/>`;

const ART = {
  phonepro: (id) => shadow(124, 186, 74) + phoneFront(58, `w-${id}`) +
    phoneBack(110, '<rect x="118" y="22" width="40" height="42" rx="11" fill="#000" opacity=".12"/>' + lens(129, 33) + lens(129, 53) + lens(147, 43) +
      '<circle cx="148" cy="28" r="2.4" fill="#f5f5f7" opacity=".8"/>'),
  phoneair: (id) => shadow(124, 186, 74) + phoneFront(58, `w-${id}`) +
    phoneBack(110, '<rect x="114" y="20" width="72" height="22" rx="11" fill="#000" opacity=".1"/>' + lens(126, 31, 6) + '<circle cx="146" cy="31" r="2.2" fill="#f5f5f7" opacity=".8"/>'),
  phone: (id) => shadow(124, 186, 74) + phoneFront(58, `w-${id}`) +
    phoneBack(110, '<rect x="118" y="22" width="26" height="42" rx="11" fill="#000" opacity=".1"/>' + lens(131, 33, 6.5) + lens(131, 53, 6.5)),
  phonelite: (id) => shadow(124, 186, 74) + phoneFront(58, `w-${id}`) + phoneBack(110, lens(128, 32, 6.5)),
  case: () => shadow(120, 186, 50) +
    '<rect x="78" y="12" width="84" height="168" rx="20" fill="url(#b)" opacity=".55"/><rect x="78.5" y="12.5" width="83" height="167" rx="19.5" fill="none" stroke="#9fb3c6" stroke-width="2"/>' +
    '<rect x="86" y="20" width="44" height="46" rx="12" fill="#fff" stroke="#b9c8d6" stroke-width="2"/>' +
    '<circle cx="120" cy="108" r="30" fill="none" stroke="#c0c6cf" stroke-width="5"/><rect x="117" y="140" width="6" height="16" rx="3" fill="#c0c6cf"/>' +
    '<path d="M92 30 L104 170" stroke="#fff" stroke-width="6" opacity=".55" stroke-linecap="round"/>',
  charger: () => shadow(108, 160, 60) +
    '<path d="M136 120 C 190 120, 200 60, 160 50 S 120 40, 150 20" stroke="#e8e8ec" stroke-width="7" fill="none" stroke-linecap="round"/>' +
    '<circle cx="104" cy="112" r="46" fill="url(#b)"/><circle cx="104" cy="112" r="46" fill="none" stroke="#c4c4ca" stroke-width="2"/>' +
    '<circle cx="104" cy="112" r="34" fill="#f6f6f8"/><circle cx="104" cy="112" r="22" fill="none" stroke="#dcdce1" stroke-width="2"/>' +
    '<rect x="146" y="14" width="10" height="16" rx="3" fill="#d4d4d9"/>',
  adapter: () => shadow(120, 176, 54) +
    '<rect x="74" y="56" width="92" height="104" rx="18" fill="url(#b)"/><rect x="74.5" y="56.5" width="91" height="103" rx="17.5" fill="none" stroke="#c9c9cf"/>' +
    '<rect x="92" y="30" width="8" height="30" rx="2" fill="#c7c7cc"/><rect x="140" y="30" width="8" height="30" rx="2" fill="#c7c7cc"/>' +
    '<rect x="108" y="100" width="24" height="9" rx="4.5" fill="#2c2c30"/><rect x="111" y="103" width="18" height="3" rx="1.5" fill="#6b6b70"/>',
  earbuds: () => shadow(120, 178, 72) +
    '<rect x="74" y="96" width="92" height="74" rx="30" fill="url(#b)"/><rect x="74.5" y="96.5" width="91" height="73" rx="29.5" fill="none" stroke="#cfcfd5"/>' +
    '<path d="M75 120 H165" stroke="#d6d6db" stroke-width="1.5"/><circle cx="120" cy="142" r="2.5" fill="#b8e0b0"/>' +
    '<g transform="translate(46 30) rotate(-14 16 30)"><rect x="12" y="24" width="10" height="44" rx="5" fill="#fbfbfd" stroke="#d2d2d7"/><ellipse cx="16" cy="20" rx="15" ry="17" fill="#fbfbfd" stroke="#d2d2d7"/><ellipse cx="7" cy="22" rx="5" ry="7" fill="#e3e3e8"/><rect x="14" y="58" width="6" height="3" rx="1.5" fill="#c7c7cc"/></g>' +
    '<g transform="translate(162 30) rotate(14 16 30)"><rect x="12" y="24" width="10" height="44" rx="5" fill="#fbfbfd" stroke="#d2d2d7"/><ellipse cx="16" cy="20" rx="15" ry="17" fill="#fbfbfd" stroke="#d2d2d7"/><ellipse cx="7" cy="22" rx="5" ry="7" fill="#e3e3e8"/><rect x="14" y="58" width="6" height="3" rx="1.5" fill="#c7c7cc"/></g>',
  wallet: () => shadow(120, 176, 56) +
    '<rect x="82" y="34" width="72" height="44" rx="6" fill="#2f5d9c"/><rect x="88" y="44" width="16" height="12" rx="2" fill="#e3c06a"/>' +
    '<rect x="70" y="56" width="100" height="112" rx="16" fill="url(#b)"/><path d="M70 82 Q120 98 170 82" stroke="#5e3520" stroke-width="2" fill="none" opacity=".6"/>' +
    '<rect x="76" y="62" width="88" height="100" rx="12" fill="none" stroke="#e8c4a6" stroke-dasharray="3 4" opacity=".7"/>',
  glass: () => shadow(120, 182, 60) +
    '<g transform="skewX(-10) translate(26 0)"><rect x="76" y="16" width="86" height="164" rx="18" fill="url(#b)" opacity=".7"/>' +
    '<rect x="76.5" y="16.5" width="85" height="163" rx="17.5" fill="none" stroke="#9fb3c6" stroke-width="2"/><rect x="106" y="26" width="26" height="7" rx="3.5" fill="#9fb3c6" opacity=".6"/>' +
    '<path d="M92 40 L120 160" stroke="#fff" stroke-width="10" opacity=".6" stroke-linecap="round"/><path d="M128 40 L140 90" stroke="#fff" stroke-width="5" opacity=".5" stroke-linecap="round"/></g>',
  keyboard: () => shadow(120, 150, 106) +
    '<rect x="14" y="70" width="212" height="74" rx="12" fill="url(#b)"/><rect x="14.5" y="70.5" width="211" height="73" rx="11.5" fill="none" stroke="#a3a3aa"/>' +
    Array.from({ length: 42 }, (_, i) => `<rect x="${24 + (i % 14) * 14}" y="${78 + Math.floor(i / 14) * 15}" width="11" height="11" rx="2.5" fill="#2b2b2f"/>`).join('') +
    '<rect x="66" y="124" width="108" height="11" rx="2.5" fill="#2b2b2f"/>',
  headphones: () => shadow(120, 182, 62) +
    '<path d="M70 120 V96 a50 50 0 0 1 100 0 V120" stroke="url(#b)" stroke-width="12" fill="none" stroke-linecap="round"/>' +
    '<path d="M76 74 a50 50 0 0 1 88 0" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>' +
    '<rect x="52" y="108" width="40" height="64" rx="18" fill="url(#b)"/><rect x="148" y="108" width="40" height="64" rx="18" fill="url(#b)"/>' +
    '<rect x="62" y="118" width="20" height="44" rx="10" fill="#2a2c33" opacity=".35"/><rect x="158" y="118" width="20" height="44" rx="10" fill="#2a2c33" opacity=".35"/>',
  hub: () => shadow(120, 168, 70) +
    '<rect x="54" y="70" width="132" height="84" rx="16" fill="url(#b)"/><rect x="54.5" y="70.5" width="131" height="83" rx="15.5" fill="none" stroke="#fff" stroke-opacity=".5"/>' +
    '<rect x="72" y="96" width="22" height="9" rx="2" fill="#1d1d1f"/><rect x="102" y="96" width="22" height="9" rx="2" fill="#1d1d1f"/><rect x="132" y="96" width="14" height="8" rx="4" fill="#1d1d1f"/><rect x="154" y="96" width="14" height="8" rx="4" fill="#1d1d1f"/>' +
    '<rect x="72" y="118" width="26" height="16" rx="2" fill="#1d1d1f"/><rect x="106" y="120" width="18" height="10" rx="2" fill="#1d1d1f"/><circle cx="160" cy="126" r="4" fill="#1d1d1f"/>' +
    '<path d="M120 70 V40 Q120 28 132 28 H160" stroke="#8a8d97" stroke-width="7" fill="none" stroke-linecap="round"/>',
  webcam: () => shadow(120, 176, 56) +
    '<rect x="62" y="58" width="116" height="56" rx="28" fill="url(#b)"/><circle cx="120" cy="86" r="20" fill="#0a0a0c"/><circle cx="120" cy="86" r="11" fill="#1d2b4f"/>' +
    '<circle cx="114" cy="80" r="4" fill="#fff" opacity=".5"/><circle cx="160" cy="86" r="3" fill="#30d158"/>' +
    '<path d="M104 114 L96 168 H144 L136 114" fill="#2a2a2e"/>',
  lightbar: () => shadow(120, 176, 70) +
    '<path d="M84 70 L60 160 M156 70 L180 160" stroke="#ffe8a8" stroke-width="22" opacity=".25" stroke-linecap="round"/>' +
    '<rect x="34" y="52" width="172" height="20" rx="10" fill="url(#b)"/><rect x="44" y="68" width="152" height="4" rx="2" fill="#fff6d6"/>' +
    '<path d="M120 72 V102" stroke="#2a2a2e" stroke-width="8"/><rect x="52" y="104" width="136" height="60" rx="8" fill="#e8e8ec"/><rect x="58" y="110" width="124" height="48" rx="4" fill="#1d1d1f"/>',
  stand: () => shadow(120, 168, 80) +
    '<path d="M54 160 H186" stroke="url(#b)" stroke-width="10" stroke-linecap="round"/>' +
    '<path d="M86 160 L132 64 H180" stroke="url(#b)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M64 120 L150 52" stroke="#c7c7cc" stroke-width="5" stroke-linecap="round"/>',
  mat: () => shadow(120, 158, 100) +
    '<rect x="16" y="78" width="208" height="74" rx="14" fill="url(#b)"/><rect x="24" y="86" width="192" height="58" rx="10" fill="none" stroke="#fff" stroke-opacity=".18" stroke-dasharray="2 4"/>' +
    '<rect x="150" y="96" width="44" height="30" rx="6" fill="#f5f5f7" opacity=".9"/>',
  cable: () => shadow(120, 168, 80) +
    '<path d="M50 140 C 50 60, 120 60, 120 110 S 190 160, 190 80" stroke="url(#b)" stroke-width="9" fill="none" stroke-linecap="round"/>' +
    '<rect x="42" y="136" width="16" height="30" rx="5" fill="#e8e8ec" stroke="#c7c7cc"/><rect x="182" y="54" width="16" height="30" rx="5" fill="#e8e8ec" stroke="#c7c7cc"/>',
};

export function productArt(p) {
  const [from, to] = p.tone;
  // Gradient ids are document-wide, so each product gets its own (otherwise every card paints the first gradient).
  const id = p.sku;
  const art = (ART[p.sku]?.(id) ?? '').replaceAll('url(#b)', `url(#b-${id})`).replaceAll('url(#s)', `url(#s-${id})`);
  return `<svg viewBox="0 0 240 200" aria-hidden="true"><defs>` +
    `<linearGradient id="b-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>` +
    `<radialGradient id="s-${id}"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="w-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${to}"/><stop offset=".55" stop-color="#3a3f6b"/><stop offset="1" stop-color="#0f1226"/></linearGradient>` +
    `</defs>${art}</svg>`;
}
