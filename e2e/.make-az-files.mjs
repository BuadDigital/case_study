// Session-local helper: make the files an A→Z browser run uploads — Arabic PDFs (deed, decree,
// delegation, survey report) and JPEG photos of distinct colours — into OUT.
// OUT=<dir> node e2e/.make-az-files.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

const pdfs = {
  "deed.pdf": "صك ملكية — اختبار كامل",
  "decree.pdf": "قرار المحكمة — اختبار كامل",
  "delegation.pdf": "خطاب التكليف — اختبار كامل",
  "survey-report.pdf": "تقرير الرفع المساحي — اختبار كامل",
  "deposit-certificate.pdf": "شهادة إيداع التقرير — اختبار كامل",
};
for (const [name, title] of Object.entries(pdfs)) {
  await page.setContent(
    `<html dir="rtl"><body style="font-family:Arial;padding:60px"><h1>${title}</h1><p>مستند اختبار أُنشئ للتجربة المحلية فقط.</p></body></html>`,
  );
  await page.pdf({ path: path.join(OUT, name), format: "A4" });
}

const colors = ["#8a6d3b", "#3b6d8a", "#6d8a3b", "#8a3b6d", "#3b8a6d", "#6d3b8a", "#a0522d", "#2f4f4f", "#556b2f", "#8b4513", "#4682b4", "#9acd32"];
for (let i = 0; i < colors.length; i++) {
  await page.setContent(
    `<html><body style="margin:0;background:${colors[i]};display:flex;align-items:center;justify-content:center;height:100vh"><div style="font:bold 120px Arial;color:#fff">صورة ${i + 1}</div></body></html>`,
  );
  await page.screenshot({ path: path.join(OUT, `photo-${i + 1}.jpg`), type: "jpeg", quality: 80 });
}
await browser.close();
console.log(fs.readdirSync(OUT).join("\n"));
