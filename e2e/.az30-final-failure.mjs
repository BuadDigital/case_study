// Session-local extra of the A→Z campaign: a transaction that ends in a FINAL failure («تعذّر نهائي»)
// declared by the supervisor — what it blocks afterwards. No Enfaz handover by design.
//   MSYS_NO_PATHCONV=1 npx -y tsx e2e/.az30-final-failure.mjs
import * as L from "./.az30-lib.mjs";
import { SCENARIOS } from "./.az30-scenarios.mjs";

const X = { ...SCENARIOS["01"], tag: "31", name: "final-failure", title: "أرض سكنية — تعذّر نهائي يعتمده المشرف", lat: 24.917, lng: 46.786 };
const R = L.makeRun("test-results/az30/r2/31-final-failure");
const { S } = R;
S.scenario = { tag: "31", name: "final-failure", type: X.typeAr, title: X.title };
const refused = async (label, user, method, path, body) => {
  const r = await R.call(user, method, path, body, { allow: [400, 403, 409] });
  if (r?.__status) {
    const msg = r.errors ? Object.values(r.errors).flat().join(" | ") : r.detail ?? r.message;
    S.refusals = [...(S.refusals ?? []), { label, status: r.__status, msg }];
    R.log(`  ✓ refused (${label}) ${r.__status}: ${msg}`);
  } else R.finding({ kind: "defect?", step: label, title: `expected a refusal: ${label}` });
};
try {
  await L.intake(R, X);
  await L.distribute(R, X);
  await L.inspector(R, X);
  const p = S.props[0];
  const f = await R.call("ahmed", "POST", "/api/failures", { poNumber: S.po, propertyId: p.id, deedNumber: p.deed, problemTypeId: "unknown-location", severity: "internal", raisedByRole: "المعاين", title: "عدم معرفة موقع العقار", internalNote: "لم يُعثر على العقار في الموقع المحدد — 31", specialist: "أسامة الصالحي" });
  await R.call("osama", "POST", `/api/failures/${f.id}/submit`, { note: "تعذّر الوصول للموقع بعد ثلاث زيارات" });
  await refused("specialist declares a final failure", "osama", "POST", "/api/failures/final", { poNumber: S.po, propertyId: p.id, problemTypeId: "unknown-location", title: "عدم معرفة موقع العقار", reason: "x", notifyParties: true });
  await refused("final failure without a reason", "sliman", "POST", "/api/failures/final", { poNumber: S.po, propertyId: p.id, problemTypeId: "unknown-location", title: "عدم معرفة موقع العقار", reason: "", notifyParties: true });
  const fin = await R.call("sliman", "POST", "/api/failures/final", { poNumber: S.po, propertyId: p.id, problemTypeId: "unknown-location", title: "عدم معرفة موقع العقار", reason: "تعذّر نهائي: الموقع غير معروف بعد ثلاث زيارات وإفادة المالك — 31", notifyParties: true });
  R.log(`  final failure → ${JSON.stringify(fin).slice(0, 200)}`);
  const wo = await R.call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`, undefined, { quiet: true });
  S.deedStatusAfterFinal = wo.properties[0].deedStatus;
  const tasks = await L.readTasks(R);
  R.log(`  deed status ${S.deedStatusAfterFinal}; tasks ${tasks.map((t) => `${t.kind}:${t.status}`).join(", ")}`);
  await refused("a second final failure", "sliman", "POST", "/api/failures/final", { poNumber: S.po, propertyId: p.id, problemTypeId: "unknown-location", title: "x", reason: "مرة ثانية للتجربة فقط", notifyParties: false });
  await refused("resolve a final (approved) failure", "osama", "POST", `/api/failures/${f.id}/resolve`, { resolutionReason: "محاولة حل بعد النهائي", continueInstructions: "" });
  await refused("cancel a finally-failed transaction", "osama", "POST", "/api/transaction-cancellations", { propertyId: p.id, reasonCode: "other", note: "إلغاء بعد التعذّر النهائي — 31" });
  await refused("inspector accept after the final failure", "osama", "POST", `/api/party-task-submissions/${p.inspection}/accept`);
  await refused("Enfaz handover after the final failure", "osama", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/enfaz-handover`);
  const tl = await L.timeline(R);
  R.log(`  timeline: ${tl.map((i) => i.title).join(" | ")}`);
  S.done = "final-failure";
} catch (e) {
  S.failed = { stage: "final-failure", message: String(e.message).slice(0, 800) };
  R.log(`FAILED: ${e.message}`);
}
R.save();
await L.closeBrowser();
console.log(JSON.stringify({ tag: "31", po: S.po, failed: S.failed ?? null, refusals: S.refusals?.length, findings: S.findings.length }));
