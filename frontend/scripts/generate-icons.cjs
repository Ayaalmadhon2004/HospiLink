/* Generates the PWA / favicon PNGs from the HospiLink mark. Reproducible: `npm run icons`.
 * Uses the Chromium that ships with Playwright (no extra dependency, no network). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const BRAND = '#0b3c34';
const ACCENT = '#14b8a6';

// The glyph (cross + pulse) in a 512 box, without background.
const GLYPH = `
  <path d="M208 96h96a16 16 0 0 1 16 16v96h96a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16h-96v96a16 16 0 0 1-16 16h-96a16 16 0 0 1-16-16v-96h-96a16 16 0 0 1-16-16v-96a16 16 0 0 1 16-16h96v-96a16 16 0 0 1 16-16z" fill="#fff"/>
  <path d="M84 268h92l32-64 48 124 36-80 20 20h116" fill="none" stroke="${ACCENT}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`;

// rounded: transparent corners (any / favicon). full: full-bleed square. scale < 1 shrinks the glyph (maskable safe zone).
const svg = ({ rounded, scale }) => {
  const t = 256 - 256 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BRAND}"/>
  <g transform="translate(${t} ${t}) scale(${scale})">${GLYPH}</g></svg>`;
};

// Maskable: platforms crop to a circle of 80% of the width, so keep the whole glyph inside the inner ~60%.
const TARGETS = [
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'maskable-192.png', size: 192, rounded: false, scale: 0.62 },
  { file: 'maskable-512.png', size: 512, rounded: false, scale: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.82 },
  { file: 'favicon-32.png', size: 32, rounded: true, scale: 1 },
  { file: 'favicon-48.png', size: 48, rounded: true, scale: 1 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const t of TARGETS) {
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent"><div style="width:${t.size}px;height:${t.size}px">${svg(t).replace(
        'width="512" height="512"',
        `width="${t.size}" height="${t.size}"`,
      )}</div></body></html>`,
    );
    await page.screenshot({ path: path.join(OUT, t.file), omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
    fs.statSync(path.join(OUT, t.file));
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
