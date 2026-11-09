// Session-local edge case: two deeds of one PO merged into ONE transaction after their inspections
// (one building). Checks «أعمالي» per stage: rows per deed vs per transaction, the single receipt,
// the single study row, and that the folded deed follows the holder.
//   npx -y tsx e2e/.az-2026-11-09-linked.mjs
import fs from "node:fs";
import { call, myWork, useState, closeBrowser, RUN, BOURSE } from "./.az-2026-11-09.mjs";
import { uniqueDeedNumber } from "./fixtures/transaction.ts";

const OUT = "test-results/az-2026-11-09-linked/";
fs.mkdirSync(OUT, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const po = `PO-AZ-1194-${Date.now().toString().slice(-5)}`;
const deeds = [uniqueDeedNumber(), uniqueDeedNumber()];
const prop = (deed, i) => ({
  identifierType: "deed", deedNumber: deed, deedDate: "2015-03-12", hasRequestNumber: true, requestNumber: `74119${i}`,
  assignmentMandateNumber: `TKF-1194-${i}`, assignmentMandateDate: today, ownerName: "مالك المرتبطين", court: "محكمة التنفيذ بالرياض", circuit: "3",
  planNumber: "3412", planName: "مخطط النرجس الشمالي", blockNumber: "17", plotNumber: "", partitionMinutesNumber: "", partitionMinutesDate: "",
  locationMapUrl: "https://maps.google.com/?q=24.774300,46.630100", delegationLetterFileNames: ["delegation.pdf"], assignmentDocFileNames: ["decree.pdf"],
  contacts: [{ name: "ممثل", role: "وكيل", phone: "0555000419", nationalId: "1022334419" }], area: "300",
});
await call("coord", "DELETE", "/api/po-intake-draft/mine", undefined, { allow: [404] });
await call("coord", "POST", "/api/work-orders", {
  poNumber: po, assignmentType: "تنفيذ", promulgationDate: today, assignmentSpecialist: "أخصائي إسناد", assignmentSpecialistEmail: "",
  expectedPropertyCount: 2, clientId: "a1000001-0000-4000-8000-000000000001", workOrderDescription: "صكان لعمارة واحدة — تجربة الربط",
  properties: deeds.map(prop),
});
const order = await call("coord", "GET", `/api/work-orders/${encodeURIComponent(po)}`);
await call("coord", "POST", "/api/workflow-tasks/sync");
const states = [];
for (const [i, p] of order.properties.entries()) {
  const tasks = await call("coord", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(po)}`);
  const parent = tasks.find((t) => t.kind === "case-study-property" && t.propertyId === p.id)
    ?? tasks.filter((t) => t.kind === "case-study-property" && !t.propertyId).sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  for (const [scope, f] of [["property-deed-ownership", "deed.pdf"], ["property-delegation", "delegation.pdf"], ["property-decree", "decree.pdf"]]) {
    await call("coord", "POST", "/api/attachments", { scope, scopeKey: `${po}:${p.id}`, fileName: f, contentType: "application/pdf",
      contentBase64: fs.readFileSync(`test-results/az-2026-11-04-files/${f}`).toString("base64") });
  }
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, { propertyId: p.id, identifierType: "deed", bourseDataCompleted: false, deedNumber: p.deedNumber });
  await call("coord", "PUT", `/api/work-orders/${encodeURIComponent(po)}/properties/${p.id}/bourse`, { ...BOURSE, propertyType: "عمارة", area: "300" });
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/advance-after-bourse`, { deedNumber: p.deedNumber });
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/confirm-distribution`, {
    deedNumber: p.deedNumber,
    distribution: { governmentAuditor: false, governmentAuditorId: "", valuationDepartment: true, operationsCoordinatorId: "", inspectorId: "fi-ahmed",
      valuatorId: "val-abdullah", engineeringOffice: false, engineeringOfficeId: "", caseSpecialist: false, caseSpecialistId: "" },
    assigneeNames: { "field-inspection": "أحمد سعيد", "property-appraisal": "عبدالله الكثيري" },
  });
  const kids = (await call("coord", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(po)}`)).filter((t) => t.propertyId === p.id);
  states.push({
    po, deed: p.deedNumber, propertyId: p.id, workOrderId: order.id, parent: parent.id,
    inspection: kids.find((t) => t.kind === "field-inspection")?.id, appraisal: kids.find((t) => t.kind === "property-appraisal")?.id,
    survey: kids.find((t) => t.kind === "engineering-survey")?.id,
  });
}
fs.writeFileSync(`${OUT}states.json`, JSON.stringify(states, null, 1));
console.log("deeds:", states.map((s) => `${s.deed} survey=${s.survey ? "yes" : "no"}`).join(" ; "));
const probe = async (label) => {
  for (const s of states) {
    useState(s);
    for (const u of ["coord", "study", "review"]) await myWork(u, `${label}-${s.deed.slice(-4)}`).catch((e) => console.log("probe", e.message.slice(0, 100)));
  }
};
await probe("L1-distributed");
for (const s of states) { useState(s); await RUN.inspector(); await RUN.accept(); }
// Merge B's transaction into A's (one building) — coordination's call before the receipt.
const tx = await call("coord", "GET", `/api/transactions/by-property/${states[0].propertyId}`);
const merged = await call("coord", "POST", `/api/transactions/${tx.id}/merge`, { propertyIds: [states[1].propertyId], linkKind: "one_building" }).catch((e) => console.log("MERGE:", e.message.slice(0, 400)));
console.log("merged:", JSON.stringify(merged)?.slice(0, 300));
await probe("L2-merged");
const r = await call("coord", "POST", `/api/transactions/by-property/${states[0].propertyId}/receive`, {}).catch((e) => console.log("RECEIVE:", e.message.slice(0, 400)));
console.log("received:", JSON.stringify(r)?.slice(0, 200));
await probe("L3-received");
await closeBrowser();
