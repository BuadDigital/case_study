// Session-local helper: takes a transaction whose valuation is saved (state.json of
// .az-full-report-trace.mjs) to the end — appraiser submits, specialist sends the draft (deed + survey
// attached), the appraiser approves by clicking «اعتماد التقرير» on his real report screen (headless
// browser, so the frozen copy is the screen's own HTML), the specialist deposits (code + PDF
// certificate → final PDF), and records the Enfaz handover. Each step logs the server's answer.
// STATE=<state.json> [STEPS=submit,draft,approve,deposit,handover] [CODE=QM-…] npx -y tsx e2e/.finish-transaction.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const API = "http://127.0.0.1:5160";
const S = JSON.parse(fs.readFileSync(process.env.STATE, "utf8"));
const STEPS = (process.env.STEPS || "submit,draft,approve,deposit,handover").split(",");
const PHONES = { osama: "500000004", abdullah: "500000007" };
const raw = {};
const login = async (u) => (raw[u] ??= await (await fetch(`${API}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: PHONES[u] }),
})).text());
async function call(user, method, path, body, timeoutMs = 120000) {
  const { token } = JSON.parse(await login(user));
  const r = await fetch(`${API}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  console.log(`  ${user} ${method} ${path.slice(0, 90)} → ${r.status}${r.ok ? "" : " " + text.slice(0, 300)}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return text ? JSON.parse(text) : null;
}

const order = await call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`);
if (STEPS.includes("submit")) {
  // The screen keeps the package price equal to the final opinion; do the same before submitting.
  const recon = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/reconciliation`);
  const sub = await call("abdullah", "GET", `/api/party-task-submissions/${S.appraisal}`);
  if (String(sub.payload?.evaluatorPrice ?? "") !== String(recon.finalOpinionValue)) {
    await call("abdullah", "PUT", `/api/party-task-submissions/${S.appraisal}`, {
      payload: { ...sub.payload, evaluatorPrice: String(recon.finalOpinionValue) },
    });
  }
  await call("abdullah", "POST", `/api/party-task-submissions/${S.appraisal}/submit`);
}
if (STEPS.includes("draft")) {
  const draft = await call("osama", "GET", `/api/valuation-report-drafts/by-property/${S.propertyId}`);
  await call("osama", "PUT", `/api/valuation-requests/${S.vr}/report-draft`, {
    ...(draft.specialistChoices ?? {}), printAttachmentKeys: ["deed", "survey"],
  }).catch(() => console.log("  (choices save skipped)"));
  await call("osama", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true, note: "إرسال آلي للاعتماد" });
}
if (STEPS.includes("approve")) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const auth = await login("abdullah");
  await ctx.addInitScript(({ auth, taskId }) => {
    sessionStorage.setItem("auth", auth); localStorage.setItem("auth", auth);
    sessionStorage.setItem(`evaluator:tab:${taskId}`, "output");
  }, { auth, taskId: S.appraisal });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3000/property-appraisal/${S.appraisal}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
  await page.waitForTimeout(8000);
  const approveBtn = page.getByRole("button", { name: "اعتماد التقرير", exact: true }).first();
  await approveBtn.waitFor({ state: "visible", timeout: 60000 });
  for (let i = 0; i < 60 && (await approveBtn.isDisabled()); i++) await page.waitForTimeout(1000);
  await approveBtn.click();
  await page.waitForTimeout(1500); // the sheet animates in; an early click is lost
  await page.locator("[role=dialog] button", { hasText: "اعتماد التقرير" }).last().click();
  try {
    await page.getByText(/اعتُمد التقرير/).first().waitFor({ timeout: 90000 });
  } catch (e) {
    await page.screenshot({ path: `${process.env.STATE.replace(/state\.json$/, "")}approve-fail.png` });
    console.log("  approve not confirmed:", (await page.locator("[role=alert],[role=status],[data-sonner-toast]").allInnerTexts()).join(" | ").slice(0, 300));
    throw e;
  }
  console.log("  approved on the appraiser's screen");
  await browser.close();
}
if (STEPS.includes("deposit")) {
  const pdf = fs.readFileSync("test-results/az-2026-11-04-files/deposit-certificate.pdf").toString("base64");
  const t0 = Date.now();
  const st = await call("osama", "POST", `/api/valuation-requests/${S.vr}/report-issuance/certificate`, {
    depositCode: process.env.CODE || `QM-${S.po.slice(-8)}`, certificateFileName: "deposit-certificate.pdf",
    certificateContentType: "application/pdf", certificateContentBase64: pdf,
  }, 300000);
  console.log(`  deposit ${Math.round((Date.now() - t0) / 1000)}s → ${st.stage} / ${st.finalReportStatus}`);
}
if (STEPS.includes("handover")) {
  await call("osama", "POST", `/api/work-orders/${order.id}/properties/${S.propertyId}/transaction-state/enfaz-handover`);
}
console.log("done");
