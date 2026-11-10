// Value regression after the 2026-11-10 valuation changes: for every transaction valued before
// (5 real + the overnight runs), read the server's numbers NOW, recompute them independently,
// read what the appraiser's report prints NOW, and compare with what was recorded before.
// node <this> [OUT=file.json] [ONLY=po,po]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/workspace/property_study";
const API = "http://127.0.0.1:5160";
const BASE = "http://localhost:3000";
const OUT = process.env.OUT || path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), "regress-values.json");
const n = (v) => Number(String(v ?? "").replace(/[,٬\s]/g, "")) || 0;
const near = (a, b, tol = 1.01) => Math.abs(a - b) <= tol;
const roundTo = (v, d) => { const f = 10 ** d; return Math.round(v / f) * f; };

// ── targets + baselines ──
const targets = [];
const realBase = JSON.parse(fs.readFileSync(`${ROOT}/test-results/audit-2026-11-04/valuations.json`, "utf8"));
for (const line of fs.readFileSync(`${ROOT}/test-results/audit-2026-11-04/tasks.txt`, "utf8").split(/\r?\n/).filter(Boolean)) {
  const [taskId, po] = line.split("|");
  const b = realBase.find((r) => r.po === po);
  if (b && !po.startsWith("E2E")) targets.push({ po, taskId, kind: "real", base: { final: b.final, ...b.printed, methods: b.methods, liquidation: b.liquidation } });
}
const az = `${ROOT}/test-results/az30`;
for (const d of fs.readdirSync(az).sort()) {
  const f = `${az}/${d}/state.json`;
  if (!fs.existsSync(f)) continue;
  const s = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!s.appraisal || !s.recompute) continue;
  const r = s.recompute;
  targets.push({ po: s.po, taskId: s.appraisal, vr: s.vr, kind: d, base: { final: r.final, market: r.printed?.market, cost: r.printed?.cost, weighted: r.printed?.weighted, afterLiq: r.printed?.afterLiq, methods: r.methods, liquidation: r.liquidation } });
}
for (const e of (process.env.EXTRA || "").split(",").filter(Boolean)) {
  const [po, taskId, vr] = e.split("|");
  targets.push({ po, taskId, vr, kind: "extra", base: {} });
}
const only = (process.env.ONLY || "").split(",").filter(Boolean);
const run = only.length ? targets.filter((t) => only.includes(t.po)) : targets;

const PHONES = ["500000007", "500000012", "500000006", "500000004"];
const raw = {};
const login = async (phone) => (raw[phone] ??= await (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: phone }) })).text());
const getAs = async (phone, p) => {
  const { token } = JSON.parse(await login(phone));
  const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
};

const browser = await chromium.launch({ headless: true });
const out = [];
for (const t of run) {
  let phone = null;
  for (const p of PHONES.slice(0, 3)) { if (await getAs(p, `/api/party-task-submissions/${t.taskId}`)) { phone = p; break; } }
  phone ??= "500000004";
  const g = (p) => getAs(phone, p);
  const tasksOfPo = await getAs("500000004", `/api/workflow-tasks?poNumber=${encodeURIComponent(t.po)}`);
  const propertyId = (tasksOfPo?.items ?? tasksOfPo ?? []).find((x) => x.id === t.taskId)?.propertyId;
  const vrRef = propertyId ? await g(`/api/valuation-requests/open-by-property/${propertyId}`) : null;
  const vr = vrRef?.id ?? vrRef?.valuationRequestId ?? t.vr;
  const row = { po: t.po, kind: t.kind, phone, base: t.base, now: {}, issues: [], diffs: [] };
  if (!vr) { row.issues.push("no valuation request found"); out.push(row); console.log(`${t.po} NO VR`); continue; }
  const recon = await g(`/api/valuation-requests/${vr}/reconciliation`);
  const market = await g(`/api/valuation-requests/${vr}/comparable-selections?selectionContext=market`);
  const land = await g(`/api/valuation-requests/${vr}/comparable-selections?selectionContext=land_within_cost`);
  const cost = await g(`/api/valuation-requests/${vr}/cost-approach`);
  const issues = row.issues;
  if (!recon) { issues.push("reconciliation not readable"); out.push(row); console.log(`${t.po} NO RECON`); continue; }

  const table = (sel, label) => {
    if (!sel || !sel.adoptedCount) return null;
    let sum = 0, wsum = 0;
    for (const i of sel.items.filter((x) => x.isAdopted && x.market)) {
      const m = i.market;
      const base = sel.adjustmentBasis === "whole_property" ? i.effectivePriceSar : i.effectivePriceSar / (i.effectiveAreaSqm || 1);
      // Sequential factors compound one after another; the rest are summed on the result.
      const SEQ = new Set(["financing", "market", "conditions_of_sale", "sale_conditions", "property_rights", "legal_rights", "expenditures"]);
      const seqLines = (m.adjustmentLines ?? []).filter((l) => l.isIncluded && SEQ.has(l.factorKey));
      const seqSum = seqLines.reduce((a, l) => a + (l.percent ?? 0), 0);
      const seqKnown = near(seqSum, m.sumSequentialPct, 0.001);
      if (!seqKnown) issues.push(`${label}: sequential lines sum ${seqSum} ≠ sumSequentialPct ${m.sumSequentialPct} (formula not checked)`);
      const afterSeq = seqKnown ? seqLines.reduce((v, l) => v * (1 + (l.percent ?? 0) / 100), base) : m.pricePerSqmAfterSequential;
      const afterDiff = afterSeq * (1 + m.sumDifferencePct / 100);
      if (!near(afterDiff, m.pricePerSqmAfterDifference, Math.max(0.02, afterDiff * 1e-5)))
        issues.push(`${label}: comparable after adjustments ${m.pricePerSqmAfterDifference} ≠ recomputed ${afterDiff.toFixed(2)}`);
      sum += m.pricePerSqmAfterDifference * m.effectiveWeightPct / 100;
      wsum += m.effectiveWeightPct;
    }
    if (!near(wsum, 100, 0.01)) issues.push(`${label}: weights sum ${wsum}`);
    const opinion = sel.adjustmentBasis === "whole_property" ? sum : sum * (sel.subjectAreaSqm ?? 0);
    return { opinion, serverRaw: sel.marketOpinionValueRaw, server: sel.marketOpinionValue };
  };
  const mk = table(market, "market");
  if (mk && !near(mk.opinion, mk.serverRaw, Math.max(1, mk.opinion * 1e-5))) issues.push(`market raw opinion server ${mk.serverRaw} ≠ recomputed ${mk.opinion.toFixed(2)}`);
  table(land, "land");

  if (cost?.isSaved && (cost.lines ?? []).length) {
    let direct = 0;
    for (const l of cost.lines.filter((x) => x.isIncluded)) {
      const lt = l.areaSqm * (l.effectiveUnitCostSar ?? l.unitCostSar);
      if (!near(lt, l.lineTotal, 1)) issues.push(`cost line «${l.label}» ${l.lineTotal} ≠ ${lt}`);
      direct += l.lineTotal;
    }
    if (!near(direct, cost.directCostTotal, 1)) issues.push(`direct ${cost.directCostTotal} ≠ ${direct}`);
    const total = cost.directCostTotal * (1 + cost.indirectRatesSumPct / 100);
    if (!near(total, cost.totalCostWithIndirect, 1)) issues.push(`total cost ${cost.totalCostWithIndirect} ≠ ${total}`);
    const dep = cost.totalCostWithIndirect * cost.appliedObsolescencePct / 100;
    if (!near(dep, cost.depreciationValue, 1)) issues.push(`depreciation ${cost.depreciationValue} ≠ ${dep}`);
    const bld = cost.totalCostWithIndirect - cost.depreciationValue;
    if (!near(bld, cost.buildingsValueAfterDepreciation, 1)) issues.push(`buildings ${cost.buildingsValueAfterDepreciation} ≠ ${bld}`);
    const landValue = cost.costScopeKey === "building_only" ? 0 : cost.landValueFromMarket;
    if (!near(bld + landValue, cost.costOpinionWithLand, 1)) issues.push(`cost result ${cost.costOpinionWithLand} ≠ ${bld + landValue}`);
  }

  let weighted = 0;
  for (const m of recon.methods.filter((x) => x.isIncluded)) {
    const expected = m.approachKind === "market" ? market?.marketOpinionValue : m.approachKind === "cost" ? cost?.costOpinionWithLand : m.approachValue;
    if (expected != null && !near(m.approachValue, expected, 1)) issues.push(`recon ${m.approachKind} value ${m.approachValue} ≠ approach ${expected}`);
    weighted += m.approachValue * m.weightPct / 100;
  }
  if (!near(weighted, recon.weightedValue, 1)) issues.push(`weighted ${recon.weightedValue} ≠ ${weighted}`);
  const afterLiq = recon.liquidationDiscountApplied ? recon.weightedValue * (1 - recon.liquidationDiscountPct / 100) : recon.weightedValue;
  if (!near(afterLiq, recon.propertyValueAfterLiquidation, 1)) issues.push(`after liquidation ${recon.propertyValueAfterLiquidation} ≠ ${afterLiq}`);
  const final = roundTo(recon.propertyValueAfterLiquidation + (recon.additionsTotal ?? 0), recon.finalRoundDecimals);
  if (!near(final, recon.finalOpinionValue, 1)) issues.push(`final ${recon.finalOpinionValue} ≠ round(${recon.propertyValueAfterLiquidation}+${recon.additionsTotal}) ${final}`);

  row.now = {
    final: recon.finalOpinionValue, weighted: recon.weightedValue, afterLiq: recon.liquidationDiscountApplied ? recon.propertyValueAfterLiquidation : null,
    market: market?.adoptedCount ? market.marketOpinionValue : null, cost: cost?.isSaved && cost.lines?.length ? cost.costOpinionWithLand : null,
    methods: recon.methods.filter((m) => m.isIncluded).map((m) => `${m.approachKind} ${m.weightPct}%`).join(" + "),
    liquidation: recon.liquidationDiscountApplied ? recon.liquidationDiscountPct : 0,
    basis: recon.basisOfValueKey, premise: recon.valuePremiseKey,
  };

  // What the appraiser's report prints now.
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const session = await login(phone);
  await ctx.addInitScript(({ auth, taskId }) => { sessionStorage.setItem("auth", auth); localStorage.setItem("auth", auth); sessionStorage.setItem(`evaluator:tab:${taskId}`, "output"); }, { auth: session, taskId: t.taskId });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));
  let printed = {};
  try {
    await page.goto(`${BASE}/property-appraisal/${t.taskId}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
    await page.locator('[data-testid="report-refreshing"]').waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const text = await page.locator(".rpt-ref").first().innerText();
    const grab = (re) => { const m = text.match(re); return m ? n(m[1]) : null; };
    printed = {
      market: grab(/القيمة بطريقة المقارنة\t([\d,٬.]+)/),
      cost: grab(/ناتج أسلوب التكلفة \(الأرض \+ المباني\)\t([\d,٬.]+)/) ?? grab(/ناتج أسلوب التكلفة[^\t\n]*\t([\d,٬.]+)/),
      weighted: grab(/القيمة المرجّحة\t([\d,٬.]+)/),
      afterLiq: grab(/القيمة بعد خصم التصفية[^\t\n]*\t([\d,٬.]+)/),
      final: grab(/القيمة النهائية الإجمالية\n([\d,٬.]+) ر\.س\./) ?? grab(/القيمة النهائية للعقار\n([\d,٬.]+) ر\.س\./),
      basis: (text.match(/أساس القيمة\t([^\t\n]{1,40})\n/) || [])[1] ?? null,
      broken: (text.match(/NaN|undefined|Invalid Date|\[object Object\]/g) || []).length,
    };
    fs.writeFileSync(OUT.replace(/\.json$/, `-${t.po}.txt`), text);
  } catch (e) { printed.error = String(e).slice(0, 160); }
  await ctx.close();
  row.printed = printed;
  if (consoleErrors.length) issues.push(`page errors: ${consoleErrors.slice(0, 2).join(" | ")}`);
  if (printed.broken) issues.push(`report has ${printed.broken} broken text (NaN/undefined/…)`);
  const cmp = (label, p, s) => { if (p != null && s != null && !near(p, Math.round(s), 1)) issues.push(`REPORT ${label} prints ${p}, server now ${s}`); };
  cmp("final", printed.final, recon.finalOpinionValue);
  cmp("market", printed.market, row.now.market);
  cmp("cost", printed.cost, row.now.cost);
  cmp("weighted", printed.weighted, recon.weightedValue);
  if (printed.final == null && !printed.error) issues.push("REPORT final value not found");

  // Against before.
  for (const k of ["final", "market", "cost", "weighted", "afterLiq"]) {
    const b = t.base[k], v = row.now[k];
    if (b != null && v != null && !near(Math.round(b), Math.round(v), 1)) row.diffs.push(`${k}: before ${Math.round(b)} → now ${Math.round(v)}`);
    if (b != null && v == null) row.diffs.push(`${k}: before ${Math.round(b)} → now none`);
  }
  if (String(t.base.methods ?? "") !== row.now.methods) row.diffs.push(`methods: «${t.base.methods}» → «${row.now.methods}»`);
  if (Number(t.base.liquidation ?? 0) !== row.now.liquidation) row.diffs.push(`liquidation: ${t.base.liquidation}% → ${row.now.liquidation}%`);
  out.push(row);
  console.log(`${t.po} [${t.kind}] final before=${t.base.final} now=${row.now.final} printed=${printed.final ?? printed.error ?? "?"} basis=${row.now.basis} ${row.diffs.length ? "DIFF: " + row.diffs.join("; ") : "same"} ${issues.length ? "ISSUES: " + issues.join(" | ") : ""}`);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
}
await browser.close();
console.log("DONE", out.length);
