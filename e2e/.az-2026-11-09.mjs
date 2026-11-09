// Session-local A→Z driver for the night of 2026-11-08/09 (not a CI test). One villa through the flow
// as it stands after the 2026-11-08 rulings: coordination (intake → bourse → distribution → follow-up →
// «إرسال المعاملة للدراسة»), the parties, the study («إرسال الدراسة للمراجع والمقيّم»), the appraiser,
// review (approve the study, accept the value, issue the draft), the appraiser's approval, the deposit,
// «تجهيز المعاملة للرفع» and the Enfaz handover. Every field is filled on its own screen's endpoint.
// After each stage, «أعمالي» is read for the three sub-role users (coordination / study / review) so
// the row's owner, action, reason and clock are checked at every step.
//   npx -y tsx e2e/.az-2026-11-09.mjs            (STAGE=<from> resumes, STOP_AFTER=<stage> stops)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { uniqueDeedNumber, syncTaskSlots, listTasksForPo, readPartyTasks } from "./fixtures/transaction.ts";

const API = "http://127.0.0.1:5160";
const BASE = "http://localhost:3000";
const OUT = process.env.OUT || "test-results/az-2026-11-09";
fs.mkdirSync(OUT, { recursive: true });
const STATE_FILE = `${OUT}/state.json`;
const LOG = `${OUT}/mywork.jsonl`;
export const STAGES = [
  "intake", "inspector", "accept", "survey", "send", "study", "appraiser",
  "review", "draft", "approve", "deposit", "prep", "handover", "report",
];
const from = STAGES.indexOf(process.env.STAGE || "intake");
let S = from > 0 && fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 1));
const today = new Date().toISOString().slice(0, 10);
const tag = process.env.TAG || "1109";

// Users by sub-role (identity store, 2026-11-08): coordination 1, study 2, review 4.
export const PHONES = {
  coord: "500000015", // mohammed_nafei — التنسيق
  study: "500000013", // omar_hamrani — دراسة العقار
  review: "500000004", // osama — المراجعة والاعتماد والرفع
  ahmed: "500000008", // field inspector fi-ahmed
  office: "500000011", // jeddah_survey eo-jeddah
  appraiser: "500000007", // abdullah val-abdullah
  cdo: "500000001", // sliman
  supervisor: "500000003", // abdulrahman — section supervisor
};
const raw = {};
export async function loginRaw(u) {
  if (raw[u]) return raw[u];
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: PHONES[u] }),
  });
  if (!r.ok) throw new Error(`login ${u} → ${r.status} ${await r.text()}`);
  raw[u] = await r.text();
  return raw[u];
}
const tok = async (u) => JSON.parse(await loginRaw(u)).token;

export async function call(user, method, path, body, { allow = [], timeoutMs = 180000 } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await tok(user)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok && !allow.includes(r.status)) {
    throw new Error(`${user} ${method} ${path} → ${r.status} ${typeof json === "string" ? json.slice(0, 600) : JSON.stringify(json).slice(0, 900)}`);
  }
  console.log(`  ${user} ${method} ${path.slice(0, 110)} → ${r.status}`);
  return json;
}
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FILES = "test-results/az-2026-11-04-files";
const pdf64 = (name) => fs.readFileSync(`${FILES}/${name}`).toString("base64");
const upload = (user, scope, scopeKey, fileName, pdfName) =>
  call(user, "POST", "/api/attachments", {
    scope, scopeKey, fileName,
    contentType: pdfName ? "application/pdf" : "image/png",
    contentBase64: pdfName ? pdf64(pdfName) : PNG,
  });
const po = () => encodeURIComponent(S.po);
async function download(user, attachmentId) {
  const r = await fetch(`${API}/api/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${await tok(user)}` } });
  return r.ok ? Buffer.from(await r.arrayBuffer()).toString("base64") : null;
}
async function realInspectionPhotos(poNumber) {
  const tasks = await call("cdo", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`);
  const task = tasks.find((t) => t.kind === "field-inspection" && t.status !== "cancelled");
  if (!task) return [];
  const sub = await call("cdo", "GET", `/api/party-task-submissions/${task.id}`);
  return (sub?.payload?.freePhotos ?? [])
    .filter((p) => p.attachmentId && /^image\//.test(p.mimeType || "image/jpeg"))
    .map((p) => ({ category: p.category || "", attachmentId: p.attachmentId, mimeType: p.mimeType }));
}

// ── Values each screen enters (every field) ─────────────────────────────────────────────────────
export const INTAKE = {
  assignmentType: "تنفيذ", requestNumber: `73${tag}`, deedDate: "2015-03-12", ownerName: `مالك التجربة ${tag}`,
  assignmentMandateNumber: `TKF-AZ-${tag}`, assignmentMandateDate: today, court: "محكمة التنفيذ بالرياض", circuit: "3",
  planNumber: "3412", planName: "مخطط النرجس الشمالي", blockNumber: "17", plotNumber: "",
  partitionMinutesNumber: `PM-${tag}`, partitionMinutesDate: "2016-01-20",
  locationMapUrl: "https://maps.google.com/?q=24.774300,46.630100",
  contact: { name: `ممثل المالك ${tag}`, role: "وكيل", phone: "0555000412", nationalId: "1022334455" },
  workOrderDescription: `تجربة A→Z ليلة ${tag} — فيلا كاملة`,
};
export const BOURSE = {
  city: "الرياض", region: "منطقة الرياض",
  regionId: "000000b1-0000-4000-8000-000000000001", cityId: "000000b2-0000-4000-8000-000000000001",
  district: "النرجس", classification: "سكني", propertyType: "فيلا", area: "612.5", deedStatus: "سليم",
  owners: [{ name: `مالك التجربة ${tag}` }, { name: `شريك التجربة ${tag}` }],
  restrictionsPresent: "yes", restrictionType: "mortgaged", restrictionOtherReason: "",
  boundariesAvailability: "bourse",
  northBoundary: "شارع عرض 20م (بورصة)", northBoundaryLengthM: "25", northBoundaryType: "street", northFacadeFinishing: "حجر",
  southBoundary: "قطعة 306 (بورصة)", southBoundaryLengthM: "25", southBoundaryType: "plot", southFacadeFinishing: "دهان",
  eastBoundary: "قطعة 304 (بورصة)", eastBoundaryLengthM: "24.5", eastBoundaryType: "plot", eastFacadeFinishing: "دهان",
  westBoundary: "ممر مشاة 6م (بورصة)", westBoundaryLengthM: "24.5", westBoundaryType: "passage", westFacadeFinishing: "رخام",
  bourseDeedImageFileName: "bourse-deed.png",
};
export const INSPECTOR = {
  streetName: `شارع التجربة ${tag}`, mainStreetName: "طريق الملك سلمان", streetWidthM: "20", siteAttendedBy: "وكيل المالك",
  accessRouteDescription: "من طريق الملك سلمان ثم يمين عند المسجد",
  roomCount: "6", hallCount: "2", unitCount: "1", bathroomCount: "7", showroomCount: "0", wellCount: "0", towerCount: "0",
  builtArea: "640", buildingFloors: "2", basementTotal: "0", annexTotal: "1", annexUpperCount: "1", annexGroundCount: "0",
  buildingsTotal: "1", jacuzziCount: "1", diningCount: "1", majlisCount: "2", maidRoomCount: "1", guardRoomCount: "1",
  parkingCount: "3", playgroundCount: "1", storeCount: "2", hasAnnex: "نعم",
  buildLicenseNumber: `44${tag}`, buildLicenseDate: "2016-06-15", propertyAgeYears: "8",
  electricityMeterCount: "2", electricityMeterNumbers: "55443322, 55443323", waterMeterCount: "1", waterMeterNumbers: "77889900",
  hasViolations: "نعم", violationsCount: "1", violationsDescription: "مظلة سيارات خارج حد الارتداد",
  propertyDescription: `فيلا دورين وملحق علوي — وصف المعاين ${tag}`,
  districtProsCons: `قرب الخدمات / ازدحام وقت الذروة — ${tag}`,
  assetNotes: `ملاحظات المعاين على الأصل ${tag}`,
};
export const FEATURES = {
  assetSubject: "فيلا", facade: "شمالية", propertyUsage: "سكني", zoneStatus: "غير موقوفة", propertyCondition: "مستخدم",
  buildState: "جيد", occupancyState: "مشغول", occupancyDescription: `مؤجرة لعائلة — ${tag}`, districtState: "جديد",
  movables: "نعم", movablesDescription: `أثاث مجالس وغرف نوم — ${tag}`,
  hasFence: "نعم", hasCentralAc: "نعم", hasTanks: "نعم", hasLandscaping: "نعم", carEntrance: "نعم",
  hasBasement: "لا", hasElevator: "نعم", hasPool: "نعم", kitchen: "نعم",
};
const SERVICES = ["كهرباء", "ماء", "صرف صحي", "هاتف / اتصالات", "سفلتة", "إنارة"];
const AMENITIES = ["مساجد", "مستشفيات", "مرفق أمني", "أسواق تجارية", "حدائق", "مدارس", "مقر حكومي", "طرق رئيسية"];
const INSPECTOR_BOUNDARIES = {
  north: { deedDesc: "شارع عرض 20م (معاين)", deedLength: "25", facade: "حجر" },
  south: { deedDesc: "قطعة 306 (معاين)", deedLength: "25", facade: "دهان" },
  east: { deedDesc: "قطعة 304 (معاين)", deedLength: "24.5", facade: "دهان" },
  west: { deedDesc: "ممر مشاة 6م (معاين)", deedLength: "24.5", facade: "رخام" },
};
export const SURVEY = {
  latitude: "24.774350", longitude: "46.630150", onSiteAreaSqm: "611.75",
  northBoundary: "شارع عرض 20م (مكتب)", northBoundaryLengthM: "25.1",
  southBoundary: "قطعة 306 (مكتب)", southBoundaryLengthM: "25.1",
  eastBoundary: "قطعة 304 (مكتب)", eastBoundaryLengthM: "24.4",
  westBoundary: "ممر مشاة 6م (مكتب)", westBoundaryLengthM: "24.4",
  surveyNotes: `ملاحظات الرفع المساحي ${tag}`, transactionNote: `ملاحظة المكتب على المعاملة ${tag}`,
};
const COMPONENTS_TEXT = `فيلا دورين وملحق علوي وسور ومسبح — مكونات الأخصائي ${tag}`;
const INVENTORY = [
  { sortOrder: 0, structureKind: "floor", label: "الدور الأرضي", areaSqm: "300", itemKey: "ground_floor", unit: "sqm", notes: "مجلس وصالة وغرفة طعام ومطبخ" },
  { sortOrder: 1, structureKind: "floor", label: "الدور الأول", areaSqm: "280", itemKey: "first_floor", unit: "sqm", notes: "أربع غرف نوم وصالة عائلية" },
  { sortOrder: 2, structureKind: "annex", label: "الملحق العلوي", areaSqm: "60", itemKey: "upper_annex", unit: "sqm", notes: "غرفة سائق ومخزن" },
];

/** Lets another script reuse the probes on its own transaction, then close the shared browser. */
export function useState(state) { S = state; }
export async function closeBrowser() { await browser?.close(); browser = undefined; }

// ── «أعمالي» probe ─────────────────────────────────────────────────────────────────────────────
let browser;
async function page(user) {
  browser ??= await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "ar" });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const auth = await loginRaw(user);
  await ctx.addInitScript((a) => { sessionStorage.setItem("auth", a); localStorage.setItem("auth", a); }, auth);
  return { ctx, page: await ctx.newPage() };
}
/** The «أعمالي» rows of this deed for one user (desktop table), plus a screenshot. */
export async function myWork(user, label) {
  const { ctx, page: p } = await page(user);
  try {
    await p.goto(`${BASE}/my-work`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("table, [data-testid=my-work-empty]").first().waitFor({ timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const rows = await p.evaluate((deed) => {
      const out = [];
      for (const tr of document.querySelectorAll("table tbody tr")) {
        const t = tr.innerText.replace(/\s+/g, " ").trim();
        if (t.includes(deed)) out.push([...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()));
      }
      return out;
    }, S.deed);
    const chips = await p.locator("[role=group][aria-label='تصفية سريعة'] button").allInnerTexts().catch(() => []);
    await p.screenshot({ path: `${OUT}/mywork-${label}-${user}.png` });
    const entry = { at: new Date().toISOString(), stage: label, user, rows, chips: chips.map((c) => c.replace(/\s+/g, " ")) };
    fs.appendFileSync(LOG, JSON.stringify(entry) + "\n");
    console.log(`  أعمالي[${user}] ${rows.length ? rows.map((r) => r.slice(0, 7).join(" | ")).join(" ;; ") : "— لا صف"}`);
    return rows;
  } finally {
    await ctx.close();
  }
}
async function probeAll(label) {
  for (const u of ["coord", "study", "review"]) {
    try { await myWork(u, label); } catch (e) { console.log(`  أعمالي[${u}] probe failed: ${e.message.slice(0, 200)}`); }
  }
}

// ── Stages ─────────────────────────────────────────────────────────────────────────────────────
async function intake() {
  S.po = `PO-AZ-${tag}-${Date.now().toString().slice(-5)}`;
  S.deed = uniqueDeedNumber();
  await call("coord", "DELETE", "/api/po-intake-draft/mine", undefined, { allow: [404] });
  await call("coord", "POST", "/api/work-orders", {
    poNumber: S.po, assignmentType: INTAKE.assignmentType, promulgationDate: today,
    assignmentSpecialist: "أخصائي إسناد التجربة", assignmentSpecialistEmail: "", expectedPropertyCount: 1,
    clientId: "a1000001-0000-4000-8000-000000000001", workOrderDescription: INTAKE.workOrderDescription,
    properties: [{
      identifierType: "deed", deedNumber: S.deed, deedDate: INTAKE.deedDate, hasRequestNumber: true, requestNumber: INTAKE.requestNumber,
      assignmentMandateNumber: INTAKE.assignmentMandateNumber, assignmentMandateDate: INTAKE.assignmentMandateDate,
      ownerName: INTAKE.ownerName, court: INTAKE.court, circuit: INTAKE.circuit,
      planNumber: INTAKE.planNumber, planName: INTAKE.planName, blockNumber: INTAKE.blockNumber, plotNumber: INTAKE.plotNumber,
      partitionMinutesNumber: INTAKE.partitionMinutesNumber, partitionMinutesDate: INTAKE.partitionMinutesDate,
      locationMapUrl: INTAKE.locationMapUrl,
      delegationLetterFileNames: ["delegation.pdf"], assignmentDocFileNames: ["decree.pdf"],
      contacts: [INTAKE.contact], area: BOURSE.area,
    }],
  });
  const order = await call("coord", "GET", `/api/work-orders/${po()}`);
  S.workOrderId = order.id;
  S.propertyId = order.properties[0].id;
  S.referenceAfterIntake = order.properties[0].referenceNumber ?? order.properties[0].transactionNumber ?? null;
  save();
  const key = `${S.po}:${S.propertyId}`;
  await upload("coord", "property-deed-ownership", key, "deed.pdf", "deed.pdf");
  await upload("coord", "property-delegation", key, "delegation.pdf", "delegation.pdf");
  await upload("coord", "property-decree", key, "decree.pdf", "decree.pdf");
  await syncTaskSlots(await tok("coord"));
  const tasks = await listTasksForPo(await tok("coord"), S.po);
  const parent = tasks.find((t) => t.kind === "case-study-property" && t.propertyId === S.propertyId)
    ?? tasks.filter((t) => t.kind === "case-study-property" && !t.propertyId).sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  S.parent = parent.id;
  save();
  await probeAll("1-intake-primary");
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, {
    propertyId: S.propertyId, identifierType: "deed", bourseDataCompleted: false, deedNumber: S.deed,
  });
  await probeAll("2-intake-bourse");
  await upload("coord", "property-bourse-deed", key, "bourse-deed.png").catch((e) => console.log("  (bourse image)", e.message.slice(0, 200)));
  await call("coord", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/bourse`, BOURSE);
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/advance-after-bourse`, { deedNumber: S.deed });
  await probeAll("3-intake-distribution");
  await call("coord", "POST", `/api/workflow-tasks/${parent.id}/confirm-distribution`, {
    deedNumber: S.deed,
    distribution: {
      governmentAuditor: false, governmentAuditorId: "", valuationDepartment: true, operationsCoordinatorId: "",
      inspectorId: "fi-ahmed", valuatorId: "val-abdullah", engineeringOffice: true, engineeringOfficeId: "eo-jeddah",
      caseSpecialist: false, caseSpecialistId: "",
    },
    assigneeNames: { "field-inspection": "أحمد سعيد", "engineering-survey": "مكتب جدة للمساحة", "property-appraisal": "عبدالله الكثيري" },
  });
  const kids = await listTasksForPo(await tok("coord"), S.po);
  if (!kids.some((t) => t.kind === "engineering-survey")) {
    await call("coord", "POST", `/api/workflow-tasks/${parent.id}/engineering-survey`, { assigneeId: "eo-jeddah", assigneeName: "مكتب جدة للمساحة" });
  }
  const p = await readPartyTasks(await tok("coord"), S.po);
  Object.assign(S, { inspection: p.fieldInspection.id, survey: p.engineeringSurvey.id, appraisal: p.propertyAppraisal.id });
  const after = await call("coord", "GET", `/api/work-orders/${po()}`);
  S.referenceAfterDistribution = after.properties[0].referenceNumber ?? after.properties[0].transactionNumber ?? null;
  await probeAll("4-distributed");
}

async function inspector() {
  const current = await call("ahmed", "GET", `/api/party-task-submissions/${S.inspection}`);
  const kinds = [
    ...Array(12).fill("exterior:facade"), ...Array(14).fill("interior:other"), ...Array(4).fill("interior:other"),
    ...Array(2).fill("exterior:service"), "exterior:service", ...Array(6).fill("interior:other"),
  ];
  const source = await realInspectionPhotos(process.env.PHOTO_SOURCE_PO || "PO-072172");
  const pick = (kind, n) => {
    const pool = source.filter((x) => x.category.startsWith(kind));
    return pool.length ? pool[n % pool.length] : source[n % source.length];
  };
  const freePhotos = [];
  for (const [i, category] of kinds.entries()) {
    const real = pick(category.startsWith("exterior") ? "exterior" : "interior", i);
    const bytes = real ? await download("cdo", real.attachmentId) : null;
    const meta = await call("ahmed", "POST", "/api/attachments", {
      scope: "field-inspection-photo", scopeKey: `${S.inspection}:free:${i + 1}`,
      fileName: bytes ? `photo-${i + 1}.jpg` : `photo-${i + 1}.png`,
      contentType: bytes ? real.mimeType || "image/jpeg" : "image/png", contentBase64: bytes ?? PNG,
    });
    freePhotos.push({ id: i + 1, category, approved: true, fileName: meta.fileName, mimeType: bytes ? real.mimeType || "image/jpeg" : "image/png", attachmentId: meta.id });
  }
  S.photos = freePhotos.map((x) => ({ id: x.attachmentId, category: x.category }));
  save();
  const payload = {
    ...current.payload, ...INSPECTOR, inspectionDate: today, inspectionTime: "09:45",
    mapLatitude: "24.774300", mapLongitude: "46.630100", mapPinned: true,
    accessContactName: `حارس العقار ${tag}`, accessContactPhone: "0500000412", accessContactRole: "حارس", accessContactNationalId: "1098765412",
    featureValues: { ...current.payload.featureValues, ...FEATURES },
    services: SERVICES, amenities: AMENITIES, freePhotos,
    boundaryMatches: Object.fromEntries(Object.entries(INSPECTOR_BOUNDARIES).map(([k, v]) => [k, { ...v, matches: true, mismatchNote: "" }])),
    deedMatchesNature: "yes",
    observations: [{ id: `obs-${tag}`, category: "visible_defect", text: `تشقق بسيط في السور — ${tag}` }],
    clientDeclarationSigned: true, declarationPhoneSatisfied: true, keyAvailable: true, inspectionConfirmed: true,
  };
  await call("ahmed", "PUT", `/api/party-task-submissions/${S.inspection}`, { payload });
  await call("ahmed", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`, { componentsText: "", lines: INVENTORY }, { allow: [403] });
  await call("ahmed", "POST", `/api/party-task-submissions/${S.inspection}/submit`);
  await probeAll("5-inspector-submitted");
}

async function accept() {
  // Coordination accepts the inspection (the follow-up section of the coordinator's page).
  await call("coord", "POST", `/api/party-task-submissions/${S.inspection}/accept`);
  await probeAll("6-inspection-accepted");
}

async function survey() {
  const current = await call("office", "GET", `/api/party-task-submissions/${S.survey}`, undefined, { allow: [404] });
  const report = await upload("office", "engineering-survey-report", S.survey, "survey-report.pdf", "survey-report.pdf");
  const letter = await upload("office", "engineering-site-letter", S.survey, "site-letter.pdf", "deed.pdf");
  const checklist = Array.from({ length: 13 }, () => ({ answer: "yes", note: "" }));
  await call("office", "PUT", `/api/party-task-submissions/${S.survey}`, {
    payload: {
      ...(current?.payload ?? {}), ...SURVEY, taskId: S.survey, propertyId: S.propertyId, poNumber: S.po,
      surveyReportFileName: report.fileName, siteLetterFileName: letter.fileName, siteConfirmed: true,
      surveyReportAttachment: { attachmentId: report.id, fileName: report.fileName },
      siteLetterAttachment: { attachmentId: letter.id, fileName: letter.fileName },
      declarationPhoneSatisfied: true, checklist, deedMatchesNature: "yes",
    },
  });
  await call("office", "POST", `/api/party-task-submissions/${S.survey}/submit`);
  await probeAll("7-survey-submitted");
  await call("coord", "POST", `/api/party-task-submissions/${S.survey}/accept`);
  await probeAll("8-survey-accepted");
}

async function send() {
  // «إرسال المعاملة للدراسة» — the coordinator's formal receipt.
  await call("coord", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {});
  await probeAll("9-sent-to-study");
}

async function study() {
  // «مكونات العقار» (text + table) and the finishing level are the study's; then the photo board.
  await call("study", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`, { componentsText: COMPONENTS_TEXT, lines: INVENTORY });
  // The study's report inputs: finishing level (a condition of the send) and the search-scope note.
  await call("study", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/specialist-report-extras`, {
    specialistReportExtrasJson: JSON.stringify({ finishing: "luxury", searchScopeNotes: `نطاق البحث: حي النرجس وما جاوره — ${tag}` }),
  });
  const at = (a, b) => S.photos.slice(a, b).map((x) => x.id);
  const ext = at(0, 12), int = at(12, 26), kit = at(26, 30), mov = at(33, 39);
  const board = [...ext.slice(0, 10), ...int.slice(0, 10), ...kit.slice(0, 4)];
  await call("study", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/photo-marks`, {
    main: board[0], electricity: [], water: [], movables: mov, report: board, reportSections: {}, reportOrdered: true,
  });
  S.board = board;
  save();
  const keys = [
    ...Array.from({ length: 11 }, (_, i) => `deed_${i}`), ...Array.from({ length: 7 }, (_, i) => `survey_${i}`),
    ...Array.from({ length: 9 }, (_, i) => `comp_${i}`), ...Array.from({ length: 6 }, (_, i) => `occ_${i}`),
    ...Array.from({ length: 4 }, (_, i) => `extra_${i}`),
  ];
  const existing = await call("study", "GET", `/api/case-study-reports/${S.parent}`, undefined, { allow: [404] });
  await call("study", "POST", `/api/case-study-reports/${S.parent}/issue`, {
    report: {
      ...(existing && typeof existing === "object" ? existing : {}),
      taskId: S.parent, propertyId: S.propertyId, poNumber: S.po,
      deedNatureMatchOutcome: "matched", deedNatureMatchNotes: "",
      answers: { ...(existing?.answers ?? {}), ...Object.fromEntries(keys.map((k) => [k, "A"])) },
    },
  });
  await probeAll("10-study-sent");
}

async function appraiser() {
  const vr = await call("appraiser", "POST", "/api/valuation-requests/ensure-open", {
    propId: S.propertyId, area: BOURSE.area, type: "فيلا", appraiser: "عبدالله الكثيري", status: "progress", date: today,
  });
  S.vr = vr.id ?? vr.valuationRequestId ?? vr.data?.id;
  save();
  await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/approach-settings`, {
    marketApproachEnabled: true, costApproachEnabled: true, incomeApproachEnabled: false,
    costScopeKey: "land_and_building", adjustmentsEditUnlocked: true,
    valuationPurposeKey: "judicial_execution", valuationPurposeNote: `تنفيذ حكم قضائي — ${tag}`,
    externalSpecialistUsed: false, valuationDateMode: "issue", ownershipInterestKey: "freehold",
  });
  const villa = [];
  for (const [i, price] of [3150000, 3290000, 3080000].entries()) {
    const c = await call("appraiser", "POST", "/api/comparable-properties", {
      comparablePropertyType: BOURSE.propertyType, transactionKind: "executed", source: "bourse", intakeChannel: "office",
      district: "النرجس", city: "الرياض", transactionDate: today, areaSqm: 600 + i * 10, price,
      latitude: 24.7752 + i * 0.001, longitude: 46.6311 + i * 0.001,
    });
    villa.push(c.id ?? c.data?.id);
  }
  await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/market-approach`, {
    subjectAreaSqm: 640, adjustmentBasis: "whole_property", analysisNotes: `تحليل السوق — ${tag}`,
    subjectSpecs: { attraction: "قرب جامع وحديقة", access: "سهل من طريقين", street_count: "2" },
  });
  await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections`, {
    selectionContext: "market", items: villa.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
  });
  const land = [];
  for (const [i, price] of [2100000, 2210000, 2050000].entries()) {
    const c = await call("appraiser", "POST", "/api/comparable-properties", {
      comparablePropertyType: "أرض", transactionKind: "executed", source: "bourse", intakeChannel: "office",
      district: "النرجس", city: "الرياض", transactionDate: today, areaSqm: 600 + i * 15, price,
      latitude: 24.7738 + i * 0.001, longitude: 46.6290 + i * 0.001,
    });
    land.push(c.id ?? c.data?.id);
  }
  await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections`, {
    selectionContext: "land_within_cost", items: land.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
  });
  const inventory = await call("appraiser", "GET", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`);
  const lines = (inventory.lines ?? []).map((l, i) => ({
    sourceInventoryLineId: l.id, structureKind: l.structureKind, itemKey: l.itemKey, label: l.label, areaSqm: Number(l.areaSqm),
    unit: l.unit, unitCostSar: 1800 + i * 100, rationale: `سعر سوق المقاولات — ${tag}`, isIncluded: true, sortOrder: i,
  }));
  S.costLinesFromInventory = lines.length;
  await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/cost-approach`, {
    lines, analysisNotes: `تحليل التكلفة — ${tag}`, refreshLandFromLandComps: true, buildingPlotAreaSqm: Number(BOURSE.area),
    useRestrictionDiscountPct: 0,
    indirectItems: ["design_supervision", "licensing_fees", "project_management", "utilities_connection", "contingency", "developer_profit"]
      .map((itemKey, i) => ({ itemKey, pct: itemKey === "developer_profit" ? 12 : 1 + i, rationale: `نسبة متعارفة — ${tag}`, sortOrder: i })),
    financingAnnualRatePct: 5, financingMonths: 12,
    actualAgeYears: 8, actualAgeRationale: "عمر المعاين", economicAgeYears: 50, economicAgeRationale: `فلل خرسانية — ${tag}`,
    lifeExtensionYears: 0, functionalObsolescencePct: 2, functionalObsolescenceRationale: `تصميم قديم نسبياً — ${tag}`,
    externalObsolescencePct: 1, externalObsolescenceRationale: `ازدحام — ${tag}`,
  });
  const recon = await call("appraiser", "PUT", `/api/valuation-requests/${S.vr}/reconciliation`, {
    methods: [
      { approachKind: "market", weightPct: 60, isIncluded: true, rationale: `مقارنات مماثلة — ${tag}`, sortOrder: 0 },
      { approachKind: "cost", weightPct: 40, isIncluded: true, rationale: `عقار مبني حديث — ${tag}`, sortOrder: 1 },
    ],
    methodsRationale: `مبرر استخدام الأسلوبين — ${tag}`, finalRoundDecimals: 3,
    basisOfValueKey: "liquidation", valuePremiseKey: "orderly",
    liquidationDiscountPct: 10, liquidationDiscountRationale: `مبرر خصم التصفية — ${tag}`,
  });
  S.finalValue = recon.finalOpinionValue;
  const gates = await call("appraiser", "GET", `/api/valuation-requests/${S.vr}/issuance-gates`);
  S.gates = { allows: gates.allowsIssuance, blocking: gates.blockingReasonsAr };
  const existing = await call("appraiser", "GET", `/api/party-task-submissions/${S.appraisal}`, undefined, { allow: [404] });
  await call("appraiser", "PUT", `/api/party-task-submissions/${S.appraisal}`, {
    payload: {
      ...(existing?.payload ?? {}), taskId: S.appraisal, propertyId: S.propertyId, poNumber: S.po, status: "draft",
      evaluatorPrice: String(S.finalValue ?? ""), forcedSaleDiscountPct: "10",
      independenceDeclared: true, assetDataConfirmed: true, assetDataVarianceNotes: "",
      reportChoices: {
        ...(existing?.payload?.reportChoices ?? {}),
        valueBasisKey: "liquidation", premiseKey: "orderly", marketMethodKey: "market_comparison", finishingLevel: "luxury",
        esgEnv: { none: false, selected: ["موقع خارج نطاق السيول"], notes: `أثر بيئي — ${tag}` },
        esgSoc: { none: false, selected: ["حي عائلي"], notes: `أثر اجتماعي — ${tag}` },
        esgGov: { none: false, selected: ["صك سليم"], notes: `أثر الحوكمة — ${tag}` },
      },
    },
  });
  await call("appraiser", "POST", `/api/party-task-submissions/${S.appraisal}/submit`);
  await probeAll("11-value-submitted");
}

async function review() {
  await call("review", "POST", `/api/case-study-reports/${S.parent}/approve-study`, {});
  await probeAll("12-study-approved");
  await call("review", "POST", `/api/party-task-submissions/${S.appraisal}/accept`);
  await probeAll("13-value-accepted");
}

async function draft() {
  await call("review", "PUT", `/api/valuation-requests/${S.vr}/report-draft/choices`, { printAttachmentKeys: ["deed", "survey"] }, { allow: [400] });
  await call("review", "POST", `/api/valuation-requests/${S.vr}/report-draft/send`, { conformityConfirmed: true, note: `إصدار المسودة — ${tag}` });
  await probeAll("14-draft-sent");
}

async function approve() {
  const { ctx, page: p } = await page("appraiser");
  try {
    await ctx.addInitScript((taskId) => sessionStorage.setItem(`evaluator:tab:${taskId}`, "output"), S.appraisal);
    await p.goto(`${BASE}/property-appraisal/${S.appraisal}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
    await p.waitForTimeout(8000);
    const btn = p.getByRole("button", { name: "اعتماد التقرير", exact: true }).first();
    await btn.waitFor({ state: "visible", timeout: 60000 });
    for (let i = 0; i < 60 && (await btn.isDisabled()); i++) await p.waitForTimeout(1000);
    await btn.click();
    await p.waitForTimeout(1500);
    await p.locator("[role=dialog] button", { hasText: "اعتماد التقرير" }).last().click();
    await p.getByText(/اعتُمد التقرير/).first().waitFor({ timeout: 90000 });
    console.log("  approved on the appraiser's screen");
  } catch (e) {
    await p.screenshot({ path: `${OUT}/approve-fail.png` });
    throw e;
  } finally {
    await ctx.close();
  }
  await probeAll("15-draft-approved");
}

async function deposit() {
  const t0 = Date.now();
  const st = await call("review", "POST", `/api/valuation-requests/${S.vr}/report-issuance/certificate`, {
    depositCode: `QM-${S.po.slice(-8)}`, certificateFileName: "deposit-certificate.pdf",
    certificateContentType: "application/pdf", certificateContentBase64: pdf64("deposit-certificate.pdf"),
  }, { timeoutMs: 300000 });
  console.log(`  deposit ${Math.round((Date.now() - t0) / 1000)}s → ${st?.stage} / ${st?.finalReportStatus}`);
  await probeAll("16-deposited");
}

async function prep() {
  await call("review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/ready-for-upload`);
  await probeAll("17-ready-for-upload");
}

async function handover() {
  await call("review", "POST", `/api/work-orders/${S.workOrderId}/properties/${S.propertyId}/transaction-state/enfaz-handover`);
  const order = await call("review", "GET", `/api/work-orders/${po()}`);
  S.referenceAtEnd = order.properties[0].referenceNumber ?? order.properties[0].transactionNumber ?? null;
  await probeAll("18-handed-over");
}

async function report() {
  const { ctx, page: p } = await page("appraiser");
  try {
    await ctx.addInitScript((taskId) => sessionStorage.setItem(`evaluator:tab:${taskId}`, "output"), S.appraisal);
    await p.goto(`${BASE}/property-appraisal/${S.appraisal}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
    await p.waitForTimeout(6000);
    const out = await p.evaluate(() => {
      const root = document.querySelector(".rpt-ref");
      const rows = [];
      for (const k of root.querySelectorAll("td.k, th.k")) {
        const sec = k.closest("[data-sec]")?.getAttribute("data-sec") ?? "";
        const vals = [];
        let v = k.nextElementSibling;
        while (v && !v.classList.contains("k")) { vals.push((v.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 220)); v = v.nextElementSibling; }
        rows.push({ sec, label: (k.textContent ?? "").trim().replace(/\s+/g, " "), vals });
      }
      const missing = [...root.querySelectorAll("td[data-rpt-missing]")].map((c) => ({
        sec: c.closest("[data-sec]")?.getAttribute("data-sec") ?? "", label: c.getAttribute("data-rpt-missing-label"), source: c.getAttribute("data-rpt-missing-source"),
      }));
      return { rows, missing, text: root.innerText };
    });
    fs.writeFileSync(`${OUT}/report-text.txt`, out.text);
    fs.writeFileSync(`${OUT}/report-cells.json`, JSON.stringify({ rows: out.rows, missing: out.missing }, null, 1));
    console.log(`  ${out.rows.length} labelled rows, ${out.missing.length} red cells`);
  } finally {
    await ctx.close();
  }
}

export const RUN = { intake, inspector, accept, survey, send, study, appraiser, review, draft, approve, deposit, prep, handover, report };
if (process.argv[1]?.endsWith(".az-2026-11-09.mjs")) {
  const stopAfter = STAGES.indexOf(process.env.STOP_AFTER || "report");
  for (const stage of STAGES.slice(Math.max(0, from), stopAfter + 1)) {
    console.log(`── ${stage}`);
    try {
      await RUN[stage]();
      S.done = stage;
      save();
    } catch (e) {
      console.log(`FAILED at ${stage}: ${e.message}`);
      save();
      await browser?.close();
      process.exit(1);
    }
  }
  await browser?.close();
  console.log(JSON.stringify({ po: S.po, deed: S.deed, propertyId: S.propertyId, refs: [S.referenceAfterIntake, S.referenceAfterDistribution, S.referenceAtEnd], finalValue: S.finalValue, gates: S.gates }));
}
