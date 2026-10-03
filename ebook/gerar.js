/* Gera ebook/pagina-instalacao.pdf (com link clicável) e .png a partir do HTML.
   Uso: npm install --no-save playwright && npx playwright install chromium && node ebook/gerar.js */
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2.5 });
  await page.goto("file://" + path.join(__dirname, "pagina-instalacao.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(__dirname, "pagina-instalacao.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.screenshot({ path: path.join(__dirname, "pagina-instalacao.png"), fullPage: false });
  await browser.close();
  console.log("Gerado: ebook/pagina-instalacao.pdf e ebook/pagina-instalacao.png");
})();
