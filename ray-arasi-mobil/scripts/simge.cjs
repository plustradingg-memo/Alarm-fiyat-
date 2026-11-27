// Uygulama simgelerini üretir (SVG → PNG). Kullanım: node scripts/simge.cjs  (Playwright ve Chromium gerekir)
// Çıktılar: assets/icon.png (iOS, opak 1024), android-icon-{background,foreground,monochrome}.png, splash-icon.png
'use strict';
const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'assets');
const H = 540; // ufuk
const gok = `<linearGradient id="gok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fb8f3"/><stop offset="0.55" stop-color="#bfe9ff"/></linearGradient>
  <linearGradient id="cim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93dc6e"/><stop offset="1" stop-color="#55ad42"/></linearGradient>
  <linearGradient id="kopru" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a4d"/><stop offset="1" stop-color="#f0702e"/></linearGradient>
  <linearGradient id="ayak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4efe4"/><stop offset="1" stop-color="#cfc6b4"/></linearGradient>`;
const zemin = (full) => full
  ? `<rect width="1024" height="1024" fill="url(#gok)"/><path d="M-40 ${H + 20} C 300 ${H - 40} 724 ${H - 40} 1064 ${H + 20} V1064 H-40Z" fill="url(#cim)"/>`
  : '';
const yol = () => {
  // perspektifli yol: alttan ufka daralır; ortada incelen beyaz kesikler
  let d = '';
  for (let k = 0; k < 7; k++) { const t0 = Math.pow(0.68, k), t1 = Math.pow(0.68, k + 0.55); const y0 = H + (1024 - H) * t0, y1 = H + (1024 - H) * t1; const w0 = 8 + 18 * t0, w1 = 8 + 18 * t1; d += `M${512 - w0 / 2} ${y0}L${512 + w0 / 2} ${y0}L${512 + w1 / 2} ${y1}L${512 - w1 / 2} ${y1}Z`; }
  return `<path d="M318 1024 L490 ${H - 6} L534 ${H - 6} L706 1024Z" fill="#5d6c7a"/>
  <path d="M318 1024 L490 ${H - 6}" stroke="#eef2f4" stroke-width="10"/><path d="M706 1024 L534 ${H - 6}" stroke="#eef2f4" stroke-width="10"/>
  <path d="${d}" fill="#ffffff"/>`;
};
const ust = (sade) => (sade ? '' : `
  <g fill="#ffffff"><circle cx="210" cy="250" r="62"/><circle cx="292" cy="214" r="84"/><circle cx="378" cy="258" r="56"/><rect x="210" y="250" width="168" height="64" rx="30"/></g>
  <g fill="#ffffff" opacity="0.9"><circle cx="738" cy="170" r="44"/><circle cx="800" cy="148" r="60"/><circle cx="858" cy="178" r="40"/><rect x="738" y="170" width="120" height="48" rx="22"/></g>
  <g><rect x="140" y="${H + 40}" width="16" height="70" rx="6" fill="#7a5a3a"/><circle cx="148" cy="${H + 20}" r="58" fill="#3f9a3a"/><circle cx="130" cy="${H + 4}" r="34" fill="#5cb84a"/></g>
  <g><rect x="868" y="${H + 50}" width="16" height="64" rx="6" fill="#7a5a3a"/><circle cx="876" cy="${H + 34}" r="50" fill="#3f9a3a"/><circle cx="892" cy="${H + 18}" r="28" fill="#5cb84a"/></g>`) + `
  <rect x="228" y="690" width="58" height="190" rx="8" fill="url(#ayak)"/><rect x="738" y="690" width="58" height="190" rx="8" fill="url(#ayak)"/>
  <path d="M-30 650 Q512 560 1054 650 L1054 722 Q512 632 -30 722Z" fill="url(#kopru)"/>
  <path d="M-30 650 Q512 560 1054 650" fill="none" stroke="#ffffff" stroke-width="14"/>
  <path d="M-30 618 Q512 528 1054 618" fill="none" stroke="#ffffff" stroke-width="9"/>
  ${Array.from({ length: 13 }, (_, i) => { const x = -30 + i * 90.33, t = (x + 30) / 1084, y = 650 - 180 * t * (1 - t); return `<rect x="${x - 4}" y="${y - 34}" width="8" height="34" fill="#ffffff"/>`; }).join('')}
  <g transform="translate(556 520) rotate(-4)">
    <rect x="0" y="22" width="150" height="54" rx="18" fill="#ffc531"/><path d="M28 24 L48 -6 H104 L126 24Z" fill="#ffc531"/>
    <path d="M40 22 L56 0 H76 V22Z M84 22 V0 H100 L116 22Z" fill="#bfe9ff"/>
    <circle cx="36" cy="78" r="17" fill="#2b3640"/><circle cx="114" cy="78" r="17" fill="#2b3640"/><circle cx="36" cy="78" r="7" fill="#d7dde2"/><circle cx="114" cy="78" r="7" fill="#d7dde2"/>
  </g>
  <g transform="translate(444 838)">
    <rect x="0" y="40" width="136" height="92" rx="26" fill="#e0342f"/><path d="M14 48 L30 6 H106 L122 48Z" fill="#e0342f"/>
    <path d="M30 44 L42 14 H94 L106 44Z" fill="#bfe9ff"/>
    <rect x="14" y="76" width="26" height="16" rx="8" fill="#fff6c8"/><rect x="96" y="76" width="26" height="16" rx="8" fill="#fff6c8"/>
    <rect x="46" y="100" width="44" height="10" rx="5" fill="#b52a26"/>
  </g>`;
const svg = (body, defs = gok) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${defs}</defs>${body}</svg>`;
const olc = (s, inner) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${inner}</g>`;
const S = 0.72; // Android uyarlanabilir simgede görünen orta bölge
const out = {
  'icon.png': [svg(zemin(true) + yol() + ust()), false],
  'android-icon-background.png': [svg(`<rect width="1024" height="1024" fill="url(#gok)"/><path d="M-40 ${512 + (H + 20 - 512) * S} C 300 ${512 + (H - 40 - 512) * S} 724 ${512 + (H - 40 - 512) * S} 1064 ${512 + (H + 20 - 512) * S} V1064 H-40Z" fill="url(#cim)"/>` + olc(S, yol())), false],
  'android-icon-foreground.png': [svg(olc(S, ust())), true],
  'android-icon-monochrome.png': [svg(olc(S, `<g fill="#ffffff">${ust(true).replace(/fill="[^"]*"/g, 'fill="#ffffff"').replace(/stroke="#ffffff"/g, 'stroke="#ffffff"')}</g>`)), true],
  'splash-icon.png': [svg(`<clipPath id="k"><rect x="0" y="0" width="1024" height="1024" rx="230"/></clipPath><g clip-path="url(#k)">${zemin(true) + yol() + ust()}</g>`), true],
};
fs.mkdirSync(path.join(A, 'kaynak'), { recursive: true });
fs.writeFileSync(path.join(A, 'kaynak', 'simge.svg'), out['icon.png'][0]);
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const [f, [s, saydam]] of Object.entries(out)) {
    await p.setContent(`<html><body style="margin:0;background:${saydam ? 'transparent' : '#fff'}">${s}</body></html>`);
    await p.screenshot({ path: path.join(A, f), omitBackground: saydam, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
    console.log('✓', f);
  }
  await b.close();
})();
