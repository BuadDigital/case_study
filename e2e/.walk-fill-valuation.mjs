// Session-local driver: completes the appraiser's valuation through the API so that
// «اعتماد التقييم وإرسال للأخصائي» passes every issuance gate — WITHOUT submitting.
// PO=<po> PROPERTY=<id> PARENT=<case-study task> APPRAISAL=<appraisal task> node e2e/.walk-fill-valuation.mjs
const API = process.env.API || "http://127.0.0.1:5160";
const PO = process.env.PO;
const PROPERTY = process.env.PROPERTY;
const PARENT = process.env.PARENT;
const APPRAISAL = process.env.APPRAISAL;
if (!PO || !PROPERTY || !PARENT || !APPRAISAL) throw new Error("PO, PROPERTY, PARENT, APPRAISAL are required");

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const today = new Date().toISOString().slice(0, 10);

async function login(username) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!r.ok) throw new Error(`login ${username}: ${r.status}`);
  return (await r.json()).token;
}

async function call(token, method, path, body, { allow = [] } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  const tag = `${method} ${path} -> ${r.status}`;
  if (!r.ok && !allow.includes(r.status)) {
    console.log(tag, typeof json === "string" ? json.slice(0, 500) : JSON.stringify(json).slice(0, 800));
    throw new Error(tag);
  }
  console.log(tag);
  return json;
}

const osama = await login("osama");
const abdullah = await login("abdullah");

// ── A. specialist: deed on file + the case-study report issued (opens the appraiser's submit) ──
await call(osama, "POST", "/api/attachments", {
  scope: "property-deed-ownership",
  scopeKey: `${PO}:${PROPERTY}`,
  fileName: "deed.png",
  contentType: "image/png",
  contentBase64: TINY_PNG,
});

const keys = [
  ...Array.from({ length: 11 }, (_, i) => `deed_${i}`),
  ...Array.from({ length: 7 }, (_, i) => `survey_${i}`),
  ...Array.from({ length: 9 }, (_, i) => `comp_${i}`),
  ...Array.from({ length: 6 }, (_, i) => `occ_${i}`),
  ...Array.from({ length: 4 }, (_, i) => `extra_${i}`),
];
const answers = Object.fromEntries(keys.map((k) => [k, "A"]));
const existingReport = await call(osama, "GET", `/api/case-study-reports/${PARENT}`, undefined, { allow: [404] });
if (existingReport?.status === "issued") {
  console.log("case-study report already issued");
} else {
  await call(osama, "POST", `/api/case-study-reports/${PARENT}/issue`, {
    report: {
      ...(existingReport && typeof existingReport === "object" ? existingReport : {}),
      taskId: PARENT,
      propertyId: PROPERTY,
      poNumber: PO,
      deedNatureMatchOutcome: "matched",
      deedNatureMatchNotes: "",
      answers: { ...(existingReport?.answers ?? {}), ...answers },
    },
  });
}

// ── B. appraiser: the valuation itself ──
const vr = await call(abdullah, "POST", "/api/valuation-requests/ensure-open", {
  propId: PROPERTY, area: "500", type: "فيلا", appraiser: "عبدالله الكثيري", status: "progress", date: today,
});
const VR = vr.id ?? vr.valuationRequestId ?? vr.data?.id;
console.log("VR =", VR, vr.displayId ?? "");

await call(abdullah, "PUT", `/api/valuation-requests/${VR}/approach-settings`, {
  marketApproachEnabled: true,
  costApproachEnabled: false,
  valuationPurposeKey: "judicial_execution",
  valuationDateMode: "issue",
  externalSpecialistUsed: false,
  adjustmentsEditUnlocked: true,
});

await call(abdullah, "PUT", `/api/valuation-requests/${VR}/market-approach`, {
  subjectAreaSqm: 500,
  adjustmentBasis: "price_per_sqm",
});

const comps = [];
for (const [i, price] of [1500000, 1550000, 1480000].entries()) {
  const c = await call(abdullah, "POST", "/api/comparable-properties", {
    comparablePropertyType: "فيلا",
    transactionKind: "executed",
    source: "bourse",
    intakeChannel: "office",
    district: "النرجس",
    city: "الرياض",
    transactionDate: today,
    areaSqm: 500,
    price,
    latitude: 24.71 + i * 0.001,
    longitude: 46.67 + i * 0.001,
  });
  comps.push(c.id ?? c.data?.id);
}
console.log("comparables:", comps.join(", "));

await call(abdullah, "PUT", `/api/valuation-requests/${VR}/comparable-selections`, {
  selectionContext: "market",
  items: comps.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
});
const market = await call(abdullah, "GET", `/api/valuation-requests/${VR}/comparable-selections?selectionContext=market`);
console.log("market:", JSON.stringify({ adopted: market.adoptedCount, w100: market.weightsSumTo100, opinion: market.marketOpinionValue }));

const recon = await call(abdullah, "PUT", `/api/valuation-requests/${VR}/reconciliation`, {
  methods: [{ approachKind: "market", weightPct: 100, isIncluded: true, rationale: "أسلوب السوق", sortOrder: 0 }],
  methodsRationale: "اعتماد أسلوب السوق لتوفر مقارنات كافية ومماثلة للعقار",
  finalRoundDecimals: 0,
  basisOfValueKey: "liquidation",
  valuePremiseKey: "orderly",
  liquidationDiscountPct: 0,
});
const finalValue = recon.finalOpinionValue ?? recon.data?.finalOpinionValue;
console.log("final opinion:", finalValue);

const gates = await call(abdullah, "GET", `/api/valuation-requests/${VR}/issuance-gates`);
console.log("allowsIssuance:", gates.allowsIssuance, "blocking:", JSON.stringify(gates.blockingReasonsAr));
for (const c of gates.checks ?? gates.gates ?? []) if (!c.passed) console.log("  ✗", c.code, c.detailAr ?? "");

// ── C. the appraiser's package draft (saved, NOT submitted) ──
const existing = await call(abdullah, "GET", `/api/party-task-submissions/${APPRAISAL}`, undefined, { allow: [404] });
const payload = {
  ...(existing?.payload ?? {}),
  taskId: APPRAISAL,
  propertyId: PROPERTY,
  poNumber: PO,
  status: "draft",
  evaluatorPrice: String(finalValue ?? ""),
  landValue: existing?.payload?.landValue ?? "0",
  buildingValue: existing?.payload?.buildingValue ?? "0",
  forcedSaleDiscountPct: "0",
  independenceDeclared: true,
  assetDataConfirmed: true,
  assetDataVarianceNotes: "",
  reportChoices: {
    ...(existing?.payload?.reportChoices ?? {}),
    valueBasisKey: "liquidation",
    premiseKey: "orderly",
    marketMethodKey: existing?.payload?.reportChoices?.marketMethodKey || "market_comparison",
    esgEnv: { none: true, selected: [], notes: "" },
    esgSoc: { none: true, selected: [], notes: "" },
    esgGov: { none: true, selected: [], notes: "" },
  },
};
await call(abdullah, "PUT", `/api/party-task-submissions/${APPRAISAL}`, { payload });
console.log("DONE — package saved as draft; nothing submitted.");
