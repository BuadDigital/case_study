// Session-local edge cases for the night of 2026-11-08/09. Each scenario starts from a state.json the
// main driver (.az-2026-11-09.mjs) left at some stage (OUT=<dir> STOP_AFTER=<stage>), performs the
// edge action as the role that owns it, prints the server's answer, and reads «أعمالي» for the three
// sub-role users after each step.
//   STATE=<dir>/state.json SCENARIO=<name> npx -y tsx e2e/.az-2026-11-09-edges.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { call, loginRaw } from "./.az-2026-11-09.mjs";

const BASE = "http://localhost:3000";
const STATE = process.env.STATE;
const S = JSON.parse(fs.readFileSync(STATE, "utf8"));
const OUT = STATE.replace(/state\.json$/, "");
const save = () => fs.writeFileSync(STATE, JSON.stringify(S, null, 1));
const po = () => encodeURIComponent(S.po);
const results = [];
/** Runs one call that is expected to be refused (or allowed); records the answer either way. */
async function expect(label, user, method, path, body, { refused }) {
  try {
    const json = await call(user, method, path, body);
    const ok = !refused;
    results.push({ label, ok, got: "accepted", detail: JSON.stringify(json)?.slice(0, 160) });
    console.log(`  ${ok ? "✓" : "✗"} ${label}: accepted`);
    return json;
  } catch (e) {
    const msg = String(e.message);
    const status = msg.match(/→ (\d{3})/)?.[1];
    const ar = msg.match(/"(?:detail|error|_)":"([^"]+)"/)?.[1] ?? msg.slice(0, 200);
    const ok = !!refused;
    results.push({ label, ok, got: `refused ${status}`, detail: ar });
    console.log(`  ${ok ? "✓" : "✗"} ${label}: refused ${status} — ${ar}`);
    return null;
  }
}

let browser;
async function myWork(user, label) {
  browser ??= await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "ar" });
  try {
    await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
    const auth = await loginRaw(user);
    await ctx.addInitScript((a) => { sessionStorage.setItem("auth", a); localStorage.setItem("auth", a); }, auth);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/my-work`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("table").first().waitFor({ timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const rows = await p.evaluate((deed) => [...document.querySelectorAll("table tbody tr")]
      .filter((tr) => tr.innerText.includes(deed))
      .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim())), S.deed);
    await p.screenshot({ path: `${OUT}mywork-${label}-${user}.png` });
    console.log(`  أعمالي[${user}] ${rows.length ? rows.map((r) => `${r[4]} | ${r[6]}`).join(" ;; ") : "— لا صف"}`);
    return rows;
  } finally {
    await ctx.close();
  }
}
async function probe(label) {
  for (const u of ["coord", "study", "review"]) await myWork(u, label).catch((e) => console.log(`  probe ${u}: ${e.message.slice(0, 120)}`));
}

// ── Scenarios ───────────────────────────────────────────────────────────────────────────────────
const SCENARIOS = {
  /** From STOP_AFTER=inspector: the follow-up's own edges. */
  async coordination() {
    await probe("e1-inspection-submitted");
    await expect("receive before accepting anything", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { refused: true });
    // By design (PoRoleMatrixRules.CanAcceptPartyWork, Omar 2026-11-08): every sub-role may accept — checked, not refused.
    await expect("study sub-role may also accept the inspection (ruling 2026-11-08)", "study", "POST", `/api/party-task-submissions/${S.inspection}/accept`, undefined, { refused: false });
    await expect("return the inspection without a note", "coord", "POST", `/api/party-task-submissions/${S.inspection}/return-inspection`,
      { returnNote: "", sections: ["photos"], affectedTaskIds: [] }, { refused: true });
    await expect("return the inspection with a note", "coord", "POST", `/api/party-task-submissions/${S.inspection}/return-inspection`,
      { returnNote: "صور الواجهة غير واضحة — أعد تصويرها", sections: ["photos"], affectedTaskIds: [] }, { refused: false });
    await probe("e2-inspection-returned");
    const sub = await call("ahmed", "GET", `/api/party-task-submissions/${S.inspection}`);
    console.log(`  inspection status after return: ${sub.status} · note: ${sub.returnNote ?? "—"}`);
    await expect("inspector re-submits without re-ticking the declaration", "ahmed", "POST", `/api/party-task-submissions/${S.inspection}/submit`, undefined, { refused: true });
    await call("ahmed", "PUT", `/api/party-task-submissions/${S.inspection}`, {
      payload: { ...sub.payload, clientDeclarationSigned: true, declarationPhoneSatisfied: true, inspectionConfirmed: true },
    });
    await expect("inspector re-submits", "ahmed", "POST", `/api/party-task-submissions/${S.inspection}/submit`, undefined, { refused: false });
    await probe("e2b-inspection-resubmitted");
    await expect("coordinator accepts", "coord", "POST", `/api/party-task-submissions/${S.inspection}/accept`, undefined, { refused: false });
    await expect("accept twice", "coord", "POST", `/api/party-task-submissions/${S.inspection}/accept`, undefined, { refused: true });
    const ext = await expect("add an external delivery", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/external-receipts`,
      { partyName: "أمانة منطقة الرياض", awaited: "إفادة المخطط" }, { refused: false });
    S.externalReceiptId = ext?.id;
    save();
    await expect("add an external delivery with no party", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/external-receipts`,
      { partyName: "", awaited: "" }, { refused: true });
    await probe("e3-awaiting-external");
  },
  /** After the survey is submitted + accepted (main driver STAGE=survey STOP_AFTER=survey on the same OUT). */
  async external() {
    await expect("receive while an external delivery is pending", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { refused: true });
    await expect("study sub-role cannot send to the study", "study", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { refused: true });
    await expect("mark the external delivery received", "coord", "POST", `/api/transactions/external-receipts/${S.externalReceiptId}/received`, { note: "وصلت الإفادة" }, { refused: false });
    await expect("receive", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { refused: false });
    await expect("receive twice", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { refused: true });
    await probe("e4-sent");
  },
  /** From STOP_AFTER=send: the study's edges. */
  async studyEdges() {
    await expect("study sends with no «مكونات العقار» text", "study", "POST", `/api/case-study-reports/${S.parent}/issue`,
      { report: { taskId: S.parent, propertyId: S.propertyId, poNumber: S.po, deedNatureMatchOutcome: "matched", answers: {} } }, { refused: true });
    await expect("coordination cannot send the study", "coord", "POST", `/api/case-study-reports/${S.parent}/issue`,
      { report: { taskId: S.parent, propertyId: S.propertyId, poNumber: S.po, deedNatureMatchOutcome: "matched", answers: {} } }, { refused: true });
    await expect("review cannot approve an unsent study", "review", "POST", `/api/case-study-reports/${S.parent}/approve-study`, {}, { refused: true });
  },
  /** From STOP_AFTER=appraiser (study sent, value submitted): review's returns. */
  async reviewReturns() {
    await expect("study cannot approve its own study", "study", "POST", `/api/case-study-reports/${S.parent}/approve-study`, {}, { refused: true });
    await expect("review returns the study without a reason", "review", "POST", `/api/case-study-reports/${S.parent}/reopen`, { reason: "" }, { refused: true });
    await expect("review returns the study («إرجاع للدراسة»)", "review", "POST", `/api/case-study-reports/${S.parent}/reopen`,
      { reason: "وصف المكونات لا يذكر الملحق الأرضي — أكمله" }, { refused: false });
    await probe("e5-study-returned");
    const r = await call("study", "GET", `/api/case-study-reports/${S.parent}`);
    await expect("study re-sends", "study", "POST", `/api/case-study-reports/${S.parent}/issue`, { report: r }, { refused: false });
    await probe("e6-study-resent");
    await expect("review returns the value to the appraiser", "review", "POST", `/api/party-task-submissions/${S.appraisal}/reopen`,
      { returnNote: "راجع أوزان الأسلوبين — الوزن 60/40 يحتاج مبرراً" }, { refused: false });
    await probe("e7-value-returned");
    const sub = await call("appraiser", "GET", `/api/party-task-submissions/${S.appraisal}`);
    console.log(`  appraisal status after return: ${sub.status}`);
    await expect("appraiser re-submits", "appraiser", "POST", `/api/party-task-submissions/${S.appraisal}/submit`, undefined, { refused: false });
    await expect("issue the draft before approving the study", "review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true }, { refused: true });
    await expect("review approves the study", "review", "POST", `/api/case-study-reports/${S.parent}/approve-study`, {}, { refused: false });
    await expect("study edits the property after approval (lock)", "study", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/specialist-report-extras`,
      { specialistReportExtrasJson: JSON.stringify({ finishing: "medium" }) }, { refused: true });
    await expect("study reopens an approved study", "study", "POST", `/api/case-study-reports/${S.parent}/reopen`, { reason: "أريد تعديل التشطيب بعد الاعتماد" }, { refused: true });
    await expect("issue the draft before accepting the value", "review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true }, { refused: true });
    await expect("review accepts the value", "review", "POST", `/api/party-task-submissions/${S.appraisal}/accept`, undefined, { refused: false });
    await expect("issue the draft without the conformity tick", "review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: false }, { refused: true });
    await expect("study cannot issue the draft", "study", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true }, { refused: true });
    await expect("review issues the draft", "review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true, note: "مسودة" }, { refused: false });
    await expect("appraiser returns the draft without a reason", "appraiser", "POST", `/api/valuation-requests/${S.vr}/report-draft/return-to-review`, { reason: "" }, { refused: true });
    await expect("appraiser returns the draft to review", "appraiser", "POST", `/api/valuation-requests/${S.vr}/report-draft/return-to-review`,
      { reason: "رقم رخصة البناء في المسودة يحتاج تأكيداً" }, { refused: false });
    await probe("e8-draft-returned");
    await expect("ready-for-upload before the deposit", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/ready-for-upload`, undefined, { refused: true });
    await expect("handover before the deposit", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/enfaz-handover`, undefined, { refused: true });
    await expect("review re-issues the draft", "review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true, note: "بعد التأكيد" }, { refused: false });
    await probe("e9-draft-reissued");
  },
  /** After handover (main driver to the end on the same OUT): the reopening and its badge. */
  async reopen() {
    await expect("study cannot reopen a handed-over transaction", "study", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/reopen`,
      { reason: "تجربة", reopenStudy: true, source: "internal" }, { refused: true });
    await expect("reopen without a reason", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/reopen`,
      { reason: "", reopenStudy: true, source: "internal" }, { refused: true });
    await expect("review reopens (internal, study)", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/reopen`,
      { reason: "اكتُشف خطأ في مساحة الدور الأول بعد الرفع", reopenStudy: true, reopenValuation: false, source: "internal" }, { refused: false });
    await probe("e10-reopened");
    const st = await call("review", "GET", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state`);
    console.log(`  state after reopen: ${JSON.stringify(st).slice(0, 400)}`);
  },
  /** Any stage: cancel the transaction, see the rows go, reactivate, see them return. */
  async cancellation() {
    await probe("c1-before");
    await expect("the study sub-role cannot request it (coordination's)", "study", "POST", `/api/transaction-cancellations`,
      { propertyId: S.propertyId, reasonCode: "duplicate", note: "مكرر مع أمر عمل آخر" }, { refused: true });
    await expect("cancel with no reason", "coord", "POST", `/api/transaction-cancellations`, { propertyId: S.propertyId, reasonCode: "" }, { refused: true });
    const req = await expect("coordination requests the cancellation", "coord", "POST", `/api/transaction-cancellations`,
      { propertyId: S.propertyId, reasonCode: "duplicate", note: "مكرر مع أمر عمل آخر" }, { refused: false });
    const id = req?.id;
    await probe("c2-requested");
    await expect("a case specialist cannot approve it", "review", "POST", `/api/transaction-cancellations/${id}/approve`, { note: "" }, { refused: true });
    await expect("the supervisor approves it", "supervisor", "POST", `/api/transaction-cancellations/${id}/approve`, { note: "موافق" }, { refused: false });
    await probe("c3-cancelled");
    // Writes on a cancelled transaction (approve-study is idempotent once approved, so not a probe).
    await expect("review edits the data of a cancelled transaction", "review", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/specialist-report-extras`,
      { specialistReportExtrasJson: JSON.stringify({ finishing: "medium" }) }, { refused: true });
    await expect("coordination adds an external delivery to a cancelled transaction", "coord", "POST", `/api/transactions/by-property/${S.propertyId}/external-receipts`,
      { partyName: "جهة", awaited: "خطاب" }, { refused: true });
    await expect("the appraiser saves his package on a cancelled transaction", "appraiser", "PUT", `/api/party-task-submissions/${S.appraisal}`,
      { payload: { taskId: S.appraisal, propertyId: S.propertyId, poNumber: S.po, evaluatorPrice: "1" } }, { refused: true });
    await expect("the appraiser approves the draft of a cancelled transaction", "appraiser", "POST", `/api/valuation-requests/${S.vr}/report-draft/approve`, {}, { refused: true });
    await expect("reactivate without a reason", "supervisor", "POST", `/api/transaction-cancellations/${id}/reactivate`, { note: "" }, { refused: true });
    await expect("the supervisor reactivates", "supervisor", "POST", `/api/transaction-cancellations/${id}/reactivate`, { note: "أُلغي بالخطأ — ليس مكرراً" }, { refused: false });
    await probe("c4-reactivated");
  },
};

try {
  await SCENARIOS[process.env.SCENARIO]();
} finally {
  await browser?.close();
  fs.appendFileSync(`${OUT}edges.jsonl`, results.map((r) => JSON.stringify({ scenario: process.env.SCENARIO, ...r })).join("\n") + "\n");
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks, ${bad.length} unexpected${bad.length ? ":\n" + bad.map((b) => `  ✗ ${b.label} → ${b.got} ${b.detail}`).join("\n") : ""}`);
}
