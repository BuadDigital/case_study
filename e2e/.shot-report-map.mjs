// Session-local diagnostic driver: screenshot §18 / §33 maps in the evaluator report
// (screen preview + print tab) and log Google Maps request outcomes. Not a CI test.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TASK_ID = process.env.TASK_ID || "65d43556-06f5-4514-abba-7d6b63e538a3";
const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const auth = JSON.parse(fs.readFileSync("auth-tmp.json", "utf8"));
const out = { consoleErrors: [], pageErrors: [], maps: [], popupMaps: [], notes: [] };
const note = (m) => {
  out.notes.push(m);
  console.log(m);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
// MOCK_STATIC=<png path>: answer Static Maps requests with that PNG to exercise the
// authorized-key path end to end without touching Google Cloud Console.
if (process.env.MOCK_STATIC) {
  const body = fs.readFileSync(process.env.MOCK_STATIC);
  await ctx.route("**/maps/api/staticmap**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body }),
  );
  note("Static Maps mocked with " + process.env.MOCK_STATIC);
}
const redact = (s) => String(s).replace(/key=[A-Za-z0-9_-]+/g, "key=***");
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    out.consoleErrors.push(`${m.type()}: ${redact(m.text()).slice(0, 400)}`);
  }
});
page.on("pageerror", (e) => out.pageErrors.push(String(e).slice(0, 400)));
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("googleapis.com") || u.includes("gstatic.com") || u.includes("google.com/maps")) {
    out.maps.push({ status: r.status(), url: u.replace(/key=[^&]+/, "key=***").slice(0, 200) });
  }
});

try {
  await page.goto(`${BASE}/property-appraisal/${TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByText("أساليب وطرق التقييم المستخدمة").first().waitFor({ timeout: 120000 });
  note("workspace loaded");

  const outputTab = page.getByRole("tab").filter({ hasText: "تقرير التقييم" }).first();
  const outputBtn = (await outputTab.isVisible().catch(() => false))
    ? outputTab
    : page.getByRole("button", { name: "تقرير التقييم", exact: true }).first();
  await outputBtn.click();
  await page.locator(".val-rpt-screen").first().waitFor({ timeout: 90000 });
  note("screen preview rendered");
  await page.waitForTimeout(8000);

  const diag = await page.evaluate(() => {
    const host = document.querySelector("#ejada-comps-map-host");
    const sat = document.querySelector("#ejada-satellite-map-host");
    const close = document.querySelector("#ejada-closeup-map-host");
    const sec18 = document.querySelector('[data-sec="18"]');
    const sec18Img = sec18?.querySelector("img");
    const sec18Slot = sec18?.querySelector("image-slot");
    const tileImgs = host ? [...host.querySelectorAll("img")].map((i) => i.src) : [];
    return {
      hasGoogle: Boolean(window.google && window.google.maps),
      hostFound: Boolean(host),
      hostHtmlHead: host ? host.outerHTML.slice(0, 300) : null,
      satFound: Boolean(sat),
      closeFound: Boolean(close),
      canvasInHost: host ? host.querySelectorAll("canvas").length : 0,
      tileImgCount: tileImgs.length,
      tileSample: tileImgs.slice(0, 3).map((s) => s.replace(/key=[^&]+/, "key=***").slice(0, 160)),
      sec18Text: sec18 ? sec18.textContent.trim().slice(0, 200) : null,
      sec18ImgSrc: sec18Img ? sec18Img.src.slice(0, 80) : null,
      sec18SlotSrc: sec18Slot ? (sec18Slot.getAttribute("src") || "").slice(0, 80) : null,
    };
  });
  note("screen diag: " + JSON.stringify(diag, null, 1));

  // Tile CORS viability probe: can we fetch a tile with CORS and draw it into a canvas?
  if (diag.tileImgCount > 0) {
    const cors = await page.evaluate(async () => {
      const host = document.querySelector("#ejada-comps-map-host");
      const imgs = [...host.querySelectorAll("img")].filter((i) => i.src.startsWith("http"));
      const results = [];
      for (const img of imgs.slice(0, 4)) {
        const r = { src: img.src.replace(/key=[^&]+/, "key=***").slice(0, 120) };
        try {
          const res = await fetch(img.src, { mode: "cors" });
          r.fetchOk = res.ok;
          r.acao = res.headers.get("access-control-allow-origin");
        } catch (e) {
          r.fetchErr = String(e).slice(0, 120);
        }
        try {
          const im = new Image();
          im.crossOrigin = "anonymous";
          await new Promise((res, rej) => {
            im.onload = res;
            im.onerror = () => rej(new Error("img load error"));
            im.src = img.src;
          });
          const c = document.createElement("canvas");
          c.width = im.naturalWidth || 256;
          c.height = im.naturalHeight || 256;
          c.getContext("2d").drawImage(im, 0, 0);
          r.canvasDataUrlOk = c.toDataURL("image/png").startsWith("data:image/png");
        } catch (e) {
          r.canvasErr = String(e).slice(0, 120);
        }
        results.push(r);
      }
      return results;
    });
    note("tile CORS probe: " + JSON.stringify(cors, null, 1));
  }

  const sec18 = page.locator('[data-sec="18"]').first();
  if (await sec18.count()) {
    await sec18.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await sec18.screenshot({ path: `${SHOT_DIR}/screen-sec18.png` });
    note("saved screen-sec18.png");
  }
  const sec33 = page.locator('[data-sec="33"]').first();
  if (await sec33.count()) {
    await sec33.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await sec33.screenshot({ path: `${SHOT_DIR}/screen-sec33.png` });
    note("saved screen-sec33.png");
  }

  // Print tab
  const popupP = ctx.waitForEvent("page", { timeout: 30000 }).catch(() => null);
  await page.getByRole("button", { name: /طباعة/ }).first().click();
  const popup = await popupP;
  if (!popup) {
    note("no print popup opened");
  } else {
    popup.on("response", (r) => {
      const u = r.url();
      if (u.includes("googleapis.com") || u.includes("gstatic.com")) {
        out.popupMaps.push({ status: r.status(), url: u.replace(/key=[^&]+/, "key=***").slice(0, 200) });
      }
    });
    await popup.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
    await popup.waitForTimeout(6000);
    const pdiag = await popup.evaluate(() => {
      const sec18 = document.querySelector('[data-sec="18"]');
      const img = sec18?.querySelector("img");
      const sec33 = document.querySelector('[data-sec="33"]');
      const imgs33 = sec33 ? [...sec33.querySelectorAll("img")].map((i) => i.src.slice(0, 60)) : [];
      return {
        title: document.title,
        sec18Found: Boolean(sec18),
        sec18ImgSrcHead: img ? img.src.slice(0, 60) : null,
        sec18ImgNatural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
        sec18Html: sec18 ? sec18.innerHTML.replace(/data:[^"']{60}[^"']*/g, "data:…").slice(0, 600) : null,
        imgs33,
        hasGoogle: Boolean(window.google && window.google.maps),
      };
    });
    note("print diag: " + JSON.stringify(pdiag, null, 1));
    const p18 = popup.locator('[data-sec="18"]').first();
    if (await p18.count()) {
      await p18.scrollIntoViewIfNeeded();
      await p18.screenshot({ path: `${SHOT_DIR}/print-sec18.png` });
      note("saved print-sec18.png");
    }
    const p33 = popup.locator('[data-sec="33"]').first();
    if (await p33.count()) {
      await p33.scrollIntoViewIfNeeded();
      await p33.screenshot({ path: `${SHOT_DIR}/print-sec33.png` });
      note("saved print-sec33.png");
    }
    await popup.close().catch(() => {});
  }
  const notice = await page
    .locator('[data-testid="report-map-notice"]')
    .first()
    .textContent()
    .catch(() => null);
  note("map notice after print: " + (notice ? notice.slice(0, 300) : "(none)"));
  await page.locator(".rpt-ref").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${SHOT_DIR}/screen-toolbar.png`, fullPage: false });
} catch (e) {
  note("ERROR: " + String(e).slice(0, 600));
  await page.screenshot({ path: `${SHOT_DIR}/error.png`, fullPage: false }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(`${SHOT_DIR}/map-diag.json`, JSON.stringify(out, null, 2));
  console.log("maps requests (screen):", JSON.stringify(out.maps.slice(0, 12), null, 1));
  console.log("maps requests (print):", JSON.stringify(out.popupMaps.slice(0, 12), null, 1));
  console.log("console errors:", JSON.stringify(out.consoleErrors.slice(0, 15), null, 1));
  console.log("page errors:", JSON.stringify(out.pageErrors.slice(0, 5), null, 1));
}
