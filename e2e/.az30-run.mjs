// Session-local A→Z campaign runner: one scenario from e2e/.az30-scenarios.mjs, intake → Enfaz handover.
//   MSYS_NO_PATHCONV=1 SCN=04 npx -y tsx e2e/.az30-run.mjs           (fresh run)
//   SCN=04 STAGE=deposit npx -y tsx e2e/.az30-run.mjs                 (resume from a stage, ids kept in state.json)
import fs from "node:fs";
import * as L from "./.az30-lib.mjs";
import { SCENARIOS } from "./.az30-scenarios.mjs";

const X = SCENARIOS[process.env.SCN];
if (!X) throw new Error(`unknown scenario ${process.env.SCN}`);
const OUT = process.env.ROUND ? `test-results/az30/${process.env.ROUND}/${X.tag}-${X.name}` : `test-results/az30/${X.tag}-${X.name}`;
if (!process.env.STAGE && fs.existsSync(`${OUT}/state.json`)) fs.renameSync(`${OUT}/state.json`, `${OUT}/state.prev-${Date.now()}.json`);
const R = L.makeRun(OUT);
const { S } = R;
S.scenario = { tag: X.tag, name: X.name, type: X.typeAr, title: X.title };
const H = X.hooks ?? {};
const hook = (name) => async () => { if (H[name]) await H[name](R, X, L); };

const fmt = (v) => Number(v).toLocaleString("en-US");
async function finalChecks(label = "final") {
  const pdf = await L.finalPdf(R, X, label);
  const draft = await R.call("osama", "GET", `/api/valuation-report-drafts/by-property/${S.propertyId}`, undefined, { quiet: true });
  S.reportNumber = draft.reportNumber; S.draftVersion = draft.version;
  const flat = pdf.replace(/\s+/g, " ");
  const has = (s) => !!s && (flat.includes(s) || flat.includes([...s].reverse().join("")));
  // pypdf gives Arabic in presentation forms with the words of a line reversed: compare word by word after NFKC.
  const nf = pdf.normalize("NFKC");
  const surveyPkg = S.survey ? await R.call("osama", "GET", `/api/party-task-submissions/${S.survey}`, undefined, { quiet: true, allow: [404] }) : null;
  const wo = await R.call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`, undefined, { quiet: true });
  const north = surveyPkg?.payload?.northBoundary || wo.properties.find((p) => p.id === S.propertyId)?.northBoundary || "";
  const words = north.normalize("NFKC").split(/[\s()]+/).filter((w) => w.length > 1 && /^([؀-ۿ]+|\d+)$/.test(w));
  const checks = {
    northBoundaryWords: words.length > 0 && words.every((w) => nf.includes(w)),
    depositCode: has(S.depositCode), reportNumber: has(draft.reportNumber),
    finalValue: has(fmt(S.finalValue)) || has(String(S.finalValue)),
  };
  S[`${label}Pdf`] = { pages: Number(pdf.split("\n")[0]), checks };
  R.log(`  final PDF checks ${JSON.stringify(checks)} (report ${draft.reportNumber}, v${draft.version}, code ${S.depositCode})`);
  for (const [k, ok] of Object.entries(checks)) if (!ok) R.finding({ kind: "defect?", step: label, title: `final PDF text lacks ${k}`, evidence: `${OUT}/${label}-pdf.txt; expected ${k === "finalValue" ? fmt(S.finalValue) : k === "depositCode" ? S.depositCode : draft.reportNumber}` });
  R.save();
}

async function enfazChecks(label = "enfaz-tab") {
  const t = await L.enfazTab(R, label);
  const flat = t.replace(/\s+/g, " ");
  const props = await R.call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`, undefined, { quiet: true });
  const prop = props.properties.find((p) => p.id === S.propertyId);
  // The tab shows the accepted survey's boundaries first, then the property's own.
  const surveyPkg = S.survey ? await R.call("osama", "GET", `/api/party-task-submissions/${S.survey}`, undefined, { quiet: true, allow: [404] }) : null;
  const north = surveyPkg?.payload?.northBoundary || prop?.northBoundary;
  const checks = {
    finalValue: flat.includes(fmt(S.finalValue)) || flat.includes(String(S.finalValue)),
    depositCode: flat.includes(S.depositCode),
    reportNumber: !!S.reportNumber && flat.includes(S.reportNumber),
    northBoundary: !!north && flat.includes(north),
  };
  // «أساس القيمة» and «تاريخ إصدار التقرير» against the report and the approved draft.
  const after = (lab) => { const lines = t.split(/\n/); const i = lines.findIndex((l) => l.trim() === lab); return i >= 0 ? (lines[i + 1] ?? "").trim() : null; };
  const reportText = fs.existsSync(`${OUT}/report-text.txt`) ? fs.readFileSync(`${OUT}/report-text.txt`, "utf8") : "";
  const reportBasis = (reportText.match(/أساس القيمة\t([^\t\n]+)/) ?? [])[1] ?? null;
  const enfazBasis = after("أساس القيمة");
  const draft = await R.call("osama", "GET", `/api/valuation-report-drafts/by-property/${S.propertyId}`, undefined, { quiet: true });
  const enfazDate = after("تاريخ إصدار التقرير");
  S[`${label}Extra`] = { reportBasis, enfazBasis, enfazDate, draftReportDate: draft.reportDate };
  R.log(`  Enfaz basis «${enfazBasis}» vs report «${reportBasis}»; Enfaz issue date «${enfazDate}» vs approved report date ${draft.reportDate}`);
  if (reportBasis && enfazBasis && !enfazBasis.includes(reportBasis.trim())) R.finding({ kind: "defect?", step: label, title: `Enfaz «أساس القيمة» = «${enfazBasis}» but the report prints «${reportBasis}»`, evidence: `${OUT}/${label}.txt` });
  S[label] = { checks, northBoundary: north };
  R.log(`  Enfaz tab checks ${JSON.stringify(checks)}`);
  for (const [k, ok] of Object.entries(checks)) if (!ok) R.finding({ kind: "defect?", step: label, title: `Enfaz tab lacks ${k}`, evidence: `${OUT}/${label}.txt` });
  R.save();
}

const PIPELINE = [
  ["intake", () => L.intake(R, X)], ["afterBourse", hook("afterBourse")],
  ["distribute", () => L.distribute(R, X)], ["afterDistribute", hook("afterDistribute")],
  ["inspector", () => (H.inspector ? H.inspector(R, X, L) : L.inspector(R, X))], ["afterInspector", hook("afterInspector")],
  ["accept", () => L.accept(R, X)], ["afterAccept", hook("afterAccept")],
  ["survey", () => (H.survey ? H.survey(R, X, L) : L.survey(R, X))], ["afterSurvey", hook("afterSurvey")],
  ["receive", () => L.receiveAndBoard(R, X)],
  ["study", () => (H.study ? H.study(R, X, L) : L.issueStudy(R, X))], ["afterStudy", hook("afterStudy")],
  ["valuate", () => L.valuate(R, X)],
  ["submit", () => L.appraisalPackage(R, X)], ["afterSubmit", hook("afterSubmit")],
  ["report", async () => {
    const o = await L.dumpReport(R, X);
    await L.recompute(R, o.text);
    for (const want of X.expectInReport ?? []) {
      const ok = o.text.includes(want);
      R.log(`  report contains «${want}»: ${ok}`);
      if (!ok) R.finding({ kind: "defect?", step: "report", title: `corrected value «${want}» does not reach the appraiser's report`, evidence: `${OUT}/report-text.txt` });
    }
    for (const issue of S.recompute.issues) R.finding({ kind: "defect?", step: "recompute", title: issue, evidence: `${OUT}/report-text.txt` });
    if (o.broken.length) R.finding({ kind: "defect?", step: "report", title: `broken text in report: ${o.broken.join(" | ")}`, evidence: `${OUT}/report-text.txt` });
  }],
  ["send", () => L.sendDraft(R, X)], ["afterSend", hook("afterSend")],
  ["approve", () => L.approveInUi(R)], ["afterApprove", hook("afterApprove")],
  ["deposit", () => L.deposit(R, X)], ["afterDeposit", hook("afterDeposit")],
  ["final", () => finalChecks()], ["afterFinal", hook("afterFinal")],
  ["handover", async () => { await L.handover(R); S.handedOver = true; }], ["afterHandover", hook("afterHandover")],
  ["enfaz", async () => { await enfazChecks(); const tl = await L.timeline(R); R.log(`  timeline: ${tl.length} entries`);
    const blob = JSON.stringify(tl);
    for (const re of X.expectTimeline ?? []) {
      const ok = new RegExp(re).test(blob);
      R.log(`  timeline has /${re}/: ${ok}`);
      if (!ok) R.finding({ kind: "defect?", step: "timeline", title: `timeline lacks an entry matching /${re}/`, evidence: `${OUT}/timeline.json` });
    }
    await L.readTasks(R);
  }],
];
R.finalChecks = finalChecks;
X.prepare?.(PIPELINE, R, L);
const names = PIPELINE.map(([n]) => n);
const from = process.env.STAGE ? names.indexOf(process.env.STAGE) : 0;
if (from < 0) throw new Error(`unknown stage ${process.env.STAGE}; stages: ${names.join(", ")}`);
R.log(`════ ${X.tag} ${X.name} — ${X.title} (from ${names[from]}) ${new Date().toISOString()}`);
let failed = null;
for (const [name, fn] of PIPELINE.slice(from)) {
  if (name.startsWith("after") && !H[name]) continue;
  R.log(`── ${name}`);
  try {
    await fn();
    S.done = name;
    R.save();
  } catch (e) {
    failed = { stage: name, message: String(e.message).slice(0, 1500) };
    S.failed = failed;
    R.log(`FAILED at ${name}: ${e.message}`);
    R.save();
    break;
  }
}
if (!failed) delete S.failed;
S.finishedAt = new Date().toISOString();
R.save();
await L.closeBrowser();
console.log(JSON.stringify({ tag: X.tag, po: S.po, final: S.finalValue, handedOver: !!S.handedOver, failed, findings: S.findings.length }));
process.exit(failed ? 1 : 0);
