// Session-local driver: fills the adjustment tables the A→Z driver left at zero — every factor %,
// every comparable's description, the per-factor rationales, a manual weight — on the market and the
// land table, through the endpoints the matrix saves to, then reads the appraiser's report back.
// STATE=<state.json of .az-full-report-trace.mjs> npx -y tsx e2e/.az-fill-adjustments.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { apiLogin } from "./fixtures/transaction.ts";

const API = "http://127.0.0.1:5160";
const STATE = process.env.STATE || "test-results/az-full-run1/state.json";
const S = JSON.parse(fs.readFileSync(STATE, "utf8"));
const OUT = STATE.replace(/state\.json$/, "");
const token = await apiLogin("abdullah");
async function call(method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 500)}`);
  console.log(`  ${method} ${path.replace(S.vr, "VR")} → ${r.status}`);
  return text ? JSON.parse(text) : null;
}

// What the appraiser types, per comparable (index) and factor.
const PLAN = {
  market: {
    financing: { pct: [-2, 0, -1], desc: null, why: "دفعات مقسطة في المقارن 1 و3" },
    market: { pct: [3, 2, 4], desc: null, why: "ارتفاع الأسعار منذ تاريخ الصفقة" },
    location: { pct: [0, -2, 1], desc: ["النرجس — نفس الشارع", "النرجس — طرف الحي", "النرجس — قرب الطريق"], why: "موقع المقارن داخل الحي" },
    attraction: { pct: [2, 0, -1], desc: ["بعيد عن الجامع", "قرب الجامع", "قرب الحديقة والجامع"], why: "القرب من الجامع والحديقة" },
    access: { pct: [0, 1, -2], desc: ["مدخل واحد", "مدخل من طريق فرعي", "مدخلان"], why: "سهولة بلوغ المقارن" },
    street_count: { pct: [5, 0, 0], desc: ["1", "2", "2"], why: "عدد الشوارع المطلة" },
  },
  land_within_cost: {
    financing: { pct: [0, -1, 0], desc: null, why: "دفعة مؤجلة في الأرض 2" },
    market: { pct: [2, 2, 3], desc: null, why: "ارتفاع أسعار الأراضي" },
    location: { pct: [1, 0, -1], desc: ["أرض داخلية", "أرض على شارع 20", "أرض طرفية"], why: "موقع الأرض داخل الحي" },
    attraction: { pct: [0, 1, 0], desc: ["بعيدة عن الجامع", "بعيدة عن الحديقة", "قرب الجامع"], why: "القرب من المرافق" },
    access: { pct: [-1, 0, 0], desc: ["ممر ضيق", "شارع 15", "شارع 20"], why: "سهولة الوصول للأرض" },
    street_count: { pct: [3, 0, 0], desc: ["1", "2", "2"], why: "عدد الواجهات" },
  },
};

for (const [context, factors] of Object.entries(PLAN)) {
  console.log(`── ${context}`);
  const list = await call("GET", `/api/valuation-requests/${S.vr}/comparable-selections?selectionContext=${context}`);
  const adopted = list.items.filter((i) => i.isAdopted).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const [i, item] of adopted.entries()) {
    const lines = item.market.adjustmentLines.map((l) => {
      const plan = factors[l.factorKey];
      if (!plan) return { ...l };
      return {
        ...l,
        isIncluded: true,
        percent: plan.pct[i] ?? 0,
        descriptionAr: plan.desc ? plan.desc[i] : l.descriptionAr,
      };
    });
    // The third comparable carries a manual weight on the market table.
    const manual = context === "market";
    await call("PUT", `/api/valuation-requests/${S.vr}/comparable-selections/${item.id}/market`, {
      adjustmentLines: lines,
      weightPct: manual ? [40, 35, 25][i] : null,
      weightIsManual: manual,
      weightOverrideRationale: manual ? "المقارن الأول الأقرب مساحة وموقعاً" : null,
      areaAdjustmentMethod: item.market.areaAdjustmentMethod,
    });
  }
  for (const [factorKey, plan] of Object.entries(factors)) {
    await call("PUT", `/api/valuation-requests/${S.vr}/adjustment-factor-rationale`, {
      selectionContext: context, factorKey, rationaleAr: plan.why,
    });
  }
}

// The reconciliation follows the new market and cost figures.
const recon = await call("GET", `/api/valuation-requests/${S.vr}/reconciliation`);
console.log("final opinion:", recon.finalOpinionValue, "market", recon.marketOpinionValue, "cost", recon.costOpinionWithLand);

// The appraiser's report.
const raw = await (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "500000007" }) })).text();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript(({ auth, taskId }) => { sessionStorage.setItem("auth", auth); localStorage.setItem("auth", auth); sessionStorage.setItem(`evaluator:tab:${taskId}`, "output"); }, { auth: raw, taskId: S.appraisal });
const page = await ctx.newPage();
await page.goto(`http://localhost:3000/property-appraisal/${S.appraisal}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
await page.locator('[data-testid="report-refreshing"]').waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
await page.waitForTimeout(6000);
const text = await page.locator(".rpt-ref").innerText();
fs.writeFileSync(`${OUT}report-text-adjusted.txt`, text);
await browser.close();
console.log("report saved");
