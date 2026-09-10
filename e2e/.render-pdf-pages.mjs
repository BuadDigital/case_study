// Session-local helper: rasterize a PDF's pages to PNG with pdf.js inside headless Chromium
// (the machine has no poppler). Usage: node e2e/.render-pdf-pages.mjs <file.pdf> <outDir> [pages]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const [pdfPath, outDir, pagesArg] = process.argv.slice(2);
if (!pdfPath || !outDir) {
  console.error("usage: node e2e/.render-pdf-pages.mjs <file.pdf> <outDir> [1,4,10]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const wanted = pagesArg ? pagesArg.split(",").map((n) => Number(n)) : null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let file;
  if (url.pathname === "/doc.pdf") file = pdfPath;
  else if (url.pathname.startsWith("/pdfjs/")) file = path.join(pdfjsDir, url.pathname.slice("/pdfjs/".length));
  else if (url.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html><body style="margin:0;background:#888"><script type="module">
      import * as pdfjs from "/pdfjs/build/pdf.mjs";
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/build/pdf.worker.mjs";
      const doc = await pdfjs.getDocument({ url: "/doc.pdf" }).promise;
      window.__pages = doc.numPages;
      window.__render = async (n, scale) => {
        const page = await doc.getPage(n);
        const vp = page.getViewport({ scale });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height; c.id = "pg";
        document.body.replaceChildren(c);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        return { w: vp.width, h: vp.height };
      };
      window.__ready = true;
    </script></body></html>`);
    return;
  }
  if (!file || !fs.existsSync(file)) {
    res.statusCode = 404;
    res.end("nope");
    return;
  }
  const ext = path.extname(file);
  res.setHeader(
    "content-type",
    ext === ".pdf" ? "application/pdf" : ext === ".mjs" || ext === ".js" ? "text/javascript" : "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } });
page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const total = await page.evaluate(() => window.__pages);
console.log("pages:", total);
const list = wanted ?? Array.from({ length: total }, (_, i) => i + 1);
for (const n of list) {
  if (n < 1 || n > total) continue;
  await page.evaluate(([num, scale]) => window.__render(num, scale), [n, 1.4]);
  const canvas = page.locator("#pg");
  const out = path.join(outDir, `page-${String(n).padStart(2, "0")}.png`);
  await canvas.screenshot({ path: out });
  console.log("saved", out);
}
await browser.close();
server.close();
