// Session-local: walk a transaction reopened for the study (edges SCENARIO=reopen) back to Enfaz.
import fs from "node:fs";
import { call, myWork } from "./.az-2026-11-09.mjs";
const S = JSON.parse(fs.readFileSync(process.env.STATE, "utf8"));
const step = async (label, user, method, path, body) => {
  try { await call(user, method, path, body); console.log(`  ✓ ${label}`); }
  catch (e) { console.log(`  ✗ ${label}: ${e.message.slice(0, 400)}`); }
};
const r = await call("study", "GET", `/api/case-study-reports/${S.parent}`);
await step("study re-sends after the reopening", "study", "POST", `/api/case-study-reports/${S.parent}/issue`, { report: r });
await step("review approves the study again", "review", "POST", `/api/case-study-reports/${S.parent}/approve-study`, {});
const st = await call("review", "GET", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state`);
console.log("  stages:", st.stages.map((s) => `${s.key}=${s.status}`).join(" "));
await step("prepare for upload", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/ready-for-upload`);
await step("re-upload to Enfaz", "review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/enfaz-handover`);
const re = await call("review", "GET", `/api/transaction-reopenings/active`).catch((e) => e.message.slice(0, 200));
console.log("  active reopening for this deed:", JSON.stringify(Array.isArray(re) ? re.filter((x) => x.propertyId === S.propertyId) : re).slice(0, 300));
for (const u of ["coord", "study", "review"]) await myWork(u, "after-reupload").catch(() => {});
