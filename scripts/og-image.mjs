/**
 * Regenerates public/og-image.png (the link-preview card with our avatars)
 * from the running site, so avatar changes show up in WhatsApp/iMessage
 * previews too. Rarely needed: after changing src/data/characters.ts.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run og-image
 */
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const SITE = process.env.SITE_URL ?? 'http://localhost:4173/gudauri-2027/';
const OUT = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Set CHROME_PATH to a Chrome/Chromium executable.');

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([
  { name: 'prefers-color-scheme', value: 'light' },
  { name: 'prefers-reduced-motion', value: 'reduce' },
]);
await page.goto(`${SITE}#/`, { waitUntil: 'networkidle0' });
await page.waitForSelector('.crew svg');
await page.evaluate(async () => {
  const faces = [...document.querySelectorAll('.crew svg')].map((s) => {
    const c = s.cloneNode(true);
    c.setAttribute('width', '150');
    c.setAttribute('height', '150');
    return c.outerHTML;
  });
  const map = document.querySelector('.backdrop')?.outerHTML ?? '';
  document.body.innerHTML = `
    ${map}
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 80px;font-family:Fredoka,system-ui,sans-serif;color:#0e2a47">
      <div style="display:flex;align-items:center;gap:18px;font-size:30px;font-weight:600;color:#9b1b40">❄️ 24–28 February 2027</div>
      <div style="font-size:120px;font-weight:700;line-height:1.05;margin:10px 0 6px">Gudauri <span style="color:#9b1b40">2027</span></div>
      <div style="font-size:34px;font-weight:500;color:#46607a;margin-bottom:34px">Ski trip companion · countdown, packing, game &amp; trip assistant</div>
      <div style="display:flex;gap:26px">${faces.join('')}</div>
    </div>`;
  await document.fonts.ready;
});
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();
console.log(`Wrote ${OUT}`);
