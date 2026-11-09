// Session-local A→Z driver (not a CI test): one villa transaction where every party fills every
// field on the endpoint its own screen saves to, then the appraiser's valuation report is read
// cell by cell. Each stage logs in as the role that owns the screen.
// Run from the repo root with the stack up:   npx -y tsx e2e/.az-full-report-trace.mjs
//   STAGE=<from> resumes at a stage with the ids kept in OUT/state.json.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { apiLogin, uniqueDeedNumber, uniquePoNumber, readPartyTasks, syncTaskSlots, listTasksForPo } from "./fixtures/transaction.ts";

const API = "http://127.0.0.1:5160";
const BASE = "http://localhost:3000";
const OUT = process.env.OUT || "test-results/az-full";
fs.mkdirSync(OUT, { recursive: true });
const STATE_FILE = `${OUT}/state.json`;
const STAGES = ["intake", "inspector", "accept", "survey", "specialist", "appraiser", "report"];
const from = STAGES.indexOf(process.env.STAGE || "intake");
let S = from > 0 && fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 1));
const today = new Date().toISOString().slice(0, 10);
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).toString("base64");

const tokens = {};
const tok = async (u) => (tokens[u] ??= await apiLogin(u));
async function call(user, method, path, body, { allow = [] } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await tok(user)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok && !allow.includes(r.status)) {
    throw new Error(`${user} ${method} ${path} → ${r.status} ${typeof json === "string" ? json.slice(0, 600) : JSON.stringify(json).slice(0, 900)}`);
  }
  console.log(`  ${user} ${method} ${path} → ${r.status}`);
  return json;
}
const upload = (user, scope, scopeKey, fileName, pdf = false) =>
  call(user, "POST", "/api/attachments", {
    scope, scopeKey, fileName, contentType: pdf ? "application/pdf" : "image/png", contentBase64: pdf ? PDF : PNG,
  });
const po = () => encodeURIComponent(S.po);
/** Base64 of an attachment's bytes, read as `user`; null when it cannot be read. */
async function download(user, attachmentId) {
  const r = await fetch(`${API}/api/attachments/${attachmentId}`, { headers: { Authorization: `Bearer ${await tok(user)}` } });
  return r.ok ? Buffer.from(await r.arrayBuffer()).toString("base64") : null;
}
/** The inspector photos of a real transaction's inspection (category, attachment id, type), read by the specialist. */
async function realInspectionPhotos(poNumber) {
  const tasks = await call("osama", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`);
  const task = tasks.find((t) => t.kind === "field-inspection" && t.status !== "cancelled");
  if (!task) return [];
  const sub = await call("osama", "GET", `/api/party-task-submissions/${task.id}`);
  return (sub?.payload?.freePhotos ?? [])
    .filter((p) => p.attachmentId && /^image\//.test(p.mimeType || "image/jpeg"))
    .map((p) => ({ category: p.category || "", attachmentId: p.attachmentId, mimeType: p.mimeType }));
}

// ── The values each screen enters ────────────────────────────────────────────────────────────
export const INTAKE = {
  assignmentType: "تنفيذ",
  requestNumber: "7310412",
  deedDate: "2015-03-12",
  ownerName: "مالك التجربة الكاملة",
  assignmentMandateNumber: "TKF-AZ-1104",
  assignmentMandateDate: today,
  court: "محكمة التنفيذ بالرياض",
  circuit: "3",
  planNumber: "3412",
  planName: "مخطط النرجس الشمالي",
  blockNumber: "17",
  plotNumber: "", // unplatted: a plot number would skip the office (survey not needed)
  partitionMinutesNumber: "PM-1104",
  partitionMinutesDate: "2016-01-20",
  locationMapUrl: "https://maps.google.com/?q=24.774300,46.630100",
  contact: { name: "ممثل المالك للتجربة", role: "وكيل", phone: "0555000412", nationalId: "1022334455" },
};
export const BOURSE = {
  city: "الرياض", region: "منطقة الرياض",
  regionId: "000000b1-0000-4000-8000-000000000001", cityId: "000000b2-0000-4000-8000-000000000001",
  district: "النرجس", classification: "سكني", propertyType: "فيلا", area: "612.5", deedStatus: "سليم",
  owners: [{ name: "مالك التجربة الكاملة" }, { name: "شريك التجربة الثاني" }],
  restrictionsPresent: "yes", restrictionType: "mortgaged", restrictionOtherReason: "",
  boundariesAvailability: "bourse",
  northBoundary: "شارع عرض 20م (بورصة)", northBoundaryLengthM: "25", northBoundaryType: "street", northFacadeFinishing: "حجر",
  southBoundary: "قطعة 306 (بورصة)", southBoundaryLengthM: "25", southBoundaryType: "plot", southFacadeFinishing: "دهان",
  eastBoundary: "قطعة 304 (بورصة)", eastBoundaryLengthM: "24.5", eastBoundaryType: "plot", eastFacadeFinishing: "دهان",
  westBoundary: "ممر مشاة 6م (بورصة)", westBoundaryLengthM: "24.5", westBoundaryType: "passage", westFacadeFinishing: "رخام",
  bourseDeedImageFileName: "bourse-deed.png",
};
export const INSPECTOR = {
  streetName: "شارع التجربة 412", mainStreetName: "طريق الملك سلمان", streetWidthM: "20", siteAttendedBy: "وكيل المالك",
  accessRouteDescription: "من طريق الملك سلمان ثم يمين عند المسجد",
  roomCount: "6", hallCount: "2", unitCount: "1", bathroomCount: "7", showroomCount: "0", wellCount: "0", towerCount: "0",
  builtArea: "640", buildingFloors: "2", basementTotal: "0", annexTotal: "1", annexUpperCount: "1", annexGroundCount: "0",
  buildingsTotal: "1", jacuzziCount: "1", diningCount: "1", majlisCount: "2", maidRoomCount: "1", guardRoomCount: "1",
  parkingCount: "3", playgroundCount: "1", storeCount: "2", hasAnnex: "نعم",
  buildLicenseNumber: "4410412", buildLicenseDate: "2016-06-15", propertyAgeYears: "8",
  electricityMeterCount: "2", electricityMeterNumbers: "55443322, 55443323", waterMeterCount: "1", waterMeterNumbers: "77889900",
  hasViolations: "نعم", violationsCount: "1", violationsDescription: "مظلة سيارات خارج حد الارتداد",
  propertyDescription: "فيلا دورين وملحق علوي — وصف المعاين 412",
  districtProsCons: "قرب الخدمات / ازدحام وقت الذروة — 412",
  assetNotes: "ملاحظات المعاين على الأصل 412",
};
export const FEATURES = {
  assetSubject: "فيلا", facade: "شمالية", propertyUsage: "سكني", zoneStatus: "غير موقوفة", propertyCondition: "مستخدم",
  buildState: "جيد", occupancyState: "مشغول", occupancyDescription: "مؤجرة لعائلة — 412", districtState: "جديد",
  movables: "نعم", movablesDescription: "أثاث مجالس وغرف نوم — 412",
  hasFence: "نعم", hasCentralAc: "نعم", hasTanks: "نعم", hasLandscaping: "نعم", carEntrance: "نعم",
  hasBasement: "لا", hasElevator: "نعم", hasPool: "نعم", kitchen: "نعم",
};
export const SERVICES = ["كهرباء", "ماء", "صرف صحي", "هاتف / اتصالات", "سفلتة", "إنارة"];
export const AMENITIES = ["مساجد", "مستشفيات", "مرفق أمني", "أسواق تجارية", "حدائق", "مدارس", "مقر حكومي", "طرق رئيسية"];
export const INSPECTOR_BOUNDARIES = {
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
  surveyNotes: "ملاحظات الرفع المساحي 412", transactionNote: "ملاحظة المكتب على المعاملة 412",
};
export const COMPONENTS_TEXT = "فيلا دورين وملحق علوي وسور ومسبح — مكونات الأخصائي 412";
export const INVENTORY = [
  { sortOrder: 0, structureKind: "floor", label: "الدور الأرضي", areaSqm: "300", itemKey: "ground_floor", unit: "sqm", notes: "مجلس وصالة وغرفة طعام ومطبخ" },
  { sortOrder: 1, structureKind: "floor", label: "الدور الأول", areaSqm: "280", itemKey: "first_floor", unit: "sqm", notes: "أربع غرف نوم وصالة عائلية" },
  { sortOrder: 2, structureKind: "annex", label: "الملحق العلوي", areaSqm: "60", itemKey: "upper_annex", unit: "sqm", notes: "غرفة سائق ومخزن" },
];

// ── Stages ───────────────────────────────────────────────────────────────────────────────────
async function intake() {
  S.po = uniquePoNumber();
  S.deed = uniqueDeedNumber();
  await call("osama", "DELETE", "/api/po-intake-draft/mine", undefined, { allow: [404] });
  await call("osama", "POST", "/api/work-orders", {
    poNumber: S.po, assignmentType: INTAKE.assignmentType, promulgationDate: today,
    assignmentSpecialist: "أسامة الصالحي", assignmentSpecialistEmail: "", expectedPropertyCount: 1,
    clientId: "a1000001-0000-4000-8000-000000000001",
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
  const order = await call("osama", "GET", `/api/work-orders/${po()}`);
  S.propertyId = order.properties[0].id;
  save();
  const key = `${S.po}:${S.propertyId}`;
  await upload("osama", "property-deed-ownership", key, "deed.pdf", true);
  await upload("osama", "property-delegation", key, "delegation.pdf", true);
  await upload("osama", "property-decree", key, "decree.pdf", true);

  await syncTaskSlots(await tok("osama"));
  const tasks = await listTasksForPo(await tok("osama"), S.po);
  const parent = tasks.find((t) => t.kind === "case-study-property" && t.propertyId === S.propertyId)
    ?? tasks.filter((t) => t.kind === "case-study-property" && !t.propertyId).sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  await call("osama", "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, {
    propertyId: S.propertyId, identifierType: "deed", bourseDataCompleted: false, deedNumber: S.deed,
  });
  await upload("osama", "property-bourse-deed", key, "bourse-deed.png").catch((e) => console.log("  (bourse image)", e.message.slice(0, 200)));
  await call("osama", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/bourse`, BOURSE);
  await call("osama", "POST", `/api/workflow-tasks/${parent.id}/advance-after-bourse`, { deedNumber: S.deed });
  await call("osama", "POST", `/api/workflow-tasks/${parent.id}/confirm-distribution`, {
    deedNumber: S.deed,
    distribution: {
      governmentAuditor: false, governmentAuditorId: "", valuationDepartment: true, operationsCoordinatorId: "",
      inspectorId: "fi-ahmed", valuatorId: "val-abdullah", engineeringOffice: true, engineeringOfficeId: "eo-jeddah",
      caseSpecialist: true, caseSpecialistId: "cs-osama",
    },
    assigneeNames: { "field-inspection": "أحمد سعيد", "engineering-survey": "مكتب جدة للمساحة", "property-appraisal": "عبدالله الكثيري" },
  });
  // A platted deed (plan + plot) gets no office at distribution; the specialist adds one («إضافة رفع مساحي»).
  const kids = await listTasksForPo(await tok("osama"), S.po);
  if (!kids.some((t) => t.kind === "engineering-survey")) {
    await call("osama", "POST", `/api/workflow-tasks/${parent.id}/engineering-survey`, { assigneeId: "eo-jeddah", assigneeName: "مكتب جدة للمساحة" });
  }
  const p = await readPartyTasks(await tok("osama"), S.po);
  Object.assign(S, { parent: p.parent.id, inspection: p.fieldInspection.id, survey: p.engineeringSurvey.id, appraisal: p.propertyAppraisal.id });
}

async function inspector() {
  const current = await call("ahmed", "GET", `/api/party-task-submissions/${S.inspection}`);
  // 12 exterior, 14 interior, 4 other (kitchen/bath), 2 electricity meters, 1 water meter, 6 movables.
  const kinds = [
    // Only the screen's categories (parent exterior|interior × kind facade|service|amenity|other) —
    // invented ones are not counted by the screen's 10/20 minimum (the server accepts anything).
    ...Array(12).fill("exterior:facade"), ...Array(14).fill("interior:other"), ...Array(4).fill("interior:other"),
    ...Array(2).fill("exterior:service"), "exterior:service", ...Array(6).fill("interior:other"),
  ];
  // Real photos (Omar 2026-11-04: «بدل الصور الخضراء… صور من معاملة حقيقية»): copied from a real inspection
  // on this local production copy (PHOTO_SOURCE_PO, default PO-072172) — exterior ones for the exterior
  // slots, interior ones for the rest. Local test data only; nothing leaves the machine.
  const source = await realInspectionPhotos(process.env.PHOTO_SOURCE_PO || "PO-072172");
  const pick = (kind, n) => {
    const pool = source.filter((p) => p.category.startsWith(kind));
    return pool.length ? pool[n % pool.length] : source[n % source.length];
  };
  const freePhotos = [];
  for (const [i, category] of kinds.entries()) {
    const real = pick(category.startsWith("exterior") ? "exterior" : "interior", i);
    const bytes = real ? await download("osama", real.attachmentId) : null;
    const meta = await call("ahmed", "POST", "/api/attachments", {
      scope: "field-inspection-photo", scopeKey: `${S.inspection}:free:${i + 1}`,
      fileName: bytes ? `photo-${i + 1}.jpg` : `photo-${i + 1}.png`,
      contentType: bytes ? real.mimeType || "image/jpeg" : "image/png",
      contentBase64: bytes ?? PNG,
    });
    freePhotos.push({
      id: i + 1, category, approved: true, fileName: meta.fileName,
      mimeType: bytes ? real.mimeType || "image/jpeg" : "image/png", attachmentId: meta.id,
    });
  }
  S.photos = freePhotos.map((p) => ({ id: p.attachmentId, category: p.category }));
  save();
  const payload = {
    ...current.payload, ...INSPECTOR,
    inspectionDate: today, inspectionTime: "09:45",
    mapLatitude: "24.774300", mapLongitude: "46.630100", mapPinned: true,
    accessContactName: "حارس العقار 412", accessContactPhone: "0500000412", accessContactRole: "حارس", accessContactNationalId: "1098765412",
    featureValues: { ...current.payload.featureValues, ...FEATURES },
    services: SERVICES, amenities: AMENITIES, freePhotos,
    boundaryMatches: Object.fromEntries(Object.entries(INSPECTOR_BOUNDARIES).map(([k, v]) => [k, { ...v, matches: true, mismatchNote: "" }])),
    deedMatchesNature: "yes",
    observations: [{ id: "obs-412", category: "visible_defect", text: "تشقق بسيط في السور — 412" }],
    clientDeclarationSigned: true, declarationPhoneSatisfied: true, keyAvailable: true, inspectionConfirmed: true,
    // Land: the inspector answers whether it holds buildings worth valuing (required on land).
    ...(/أرض/.test(BOURSE.propertyType) ? { vacantLand: true, landHasValuableStructures: "no" } : {}),
  };
  await call("ahmed", "PUT", `/api/party-task-submissions/${S.inspection}`, { payload });
  // «مكونات العقار» table — filled on site by the inspector's inventory card.
  await call("ahmed", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`, {
    componentsText: "", lines: INVENTORY,
  }, { allow: [403] });
  await call("ahmed", "POST", `/api/party-task-submissions/${S.inspection}/submit`);
}

async function accept() {
  await call("osama", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`, {
    componentsText: COMPONENTS_TEXT, lines: INVENTORY,
  });
  await call("osama", "POST", `/api/party-task-submissions/${S.inspection}/accept`);
}

async function survey() {
  const current = await call("jeddah_survey", "GET", `/api/party-task-submissions/${S.survey}`, undefined, { allow: [404] });
  const report = await upload("jeddah_survey", "engineering-survey-report", S.survey, "survey-report.pdf", true);
  const letter = await upload("jeddah_survey", "engineering-site-letter", S.survey, "site-letter.pdf", true);
  S.surveyReportId = report.id;
  const checklist = Array.from({ length: 13 }, () => ({ answer: "yes", note: "" }));
  await call("jeddah_survey", "PUT", `/api/party-task-submissions/${S.survey}`, {
    payload: {
      ...(current?.payload ?? {}), ...SURVEY, taskId: S.survey, propertyId: S.propertyId, poNumber: S.po,
      surveyReportFileName: report.fileName, siteLetterFileName: letter.fileName, siteConfirmed: true,
      surveyReportAttachment: { attachmentId: report.id, fileName: report.fileName },
      siteLetterAttachment: { attachmentId: letter.id, fileName: letter.fileName },
      declarationPhoneSatisfied: true, checklist, deedMatchesNature: "yes",
    },
  });
  await call("jeddah_survey", "POST", `/api/party-task-submissions/${S.survey}/submit`);
  await call("osama", "POST", `/api/party-task-submissions/${S.survey}/accept`);
}

async function specialist() {
  const ids = (cat) => S.photos.filter((p) => p.category.startsWith(cat)).map((p) => p.id);
  // Photos are uploaded in a fixed order: 12 exterior, 14 interior, 4 kitchen/bath, 3 meters, 6 movables.
  const at = (from, to) => S.photos.slice(from, to).map((p) => p.id);
  const ext = at(0, 12), int = at(12, 26), kit = at(26, 30), mov = at(33, 39);
  // The 24-slot board: slot 1 the main photo, then 9 exterior, 10 interior, 4 kitchen/bath.
  const board = [...ext.slice(0, 10), ...int.slice(0, 10), ...kit.slice(0, 4)];
  await call("osama", "PUT", `/api/work-orders/${po()}/properties/${S.propertyId}/photo-marks`, {
    main: board[0], electricity: [], water: [], movables: mov, report: board, reportSections: {}, reportOrdered: true,
  });
  S.board = board;
  S.movables = mov;
  save();
  const keys = [
    ...Array.from({ length: 11 }, (_, i) => `deed_${i}`), ...Array.from({ length: 7 }, (_, i) => `survey_${i}`),
    ...Array.from({ length: 9 }, (_, i) => `comp_${i}`), ...Array.from({ length: 6 }, (_, i) => `occ_${i}`),
    ...Array.from({ length: 4 }, (_, i) => `extra_${i}`),
  ];
  // «الاستلام من الأطراف» — the coordination specialist's formal receipt before the study ends.
  await call("osama", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {});
  const existing = await call("osama", "GET", `/api/case-study-reports/${S.parent}`, undefined, { allow: [404] });
  await call("osama", "POST", `/api/case-study-reports/${S.parent}/issue`, {
    report: {
      ...(existing && typeof existing === "object" ? existing : {}),
      taskId: S.parent, propertyId: S.propertyId, poNumber: S.po,
      deedNatureMatchOutcome: "matched", deedNatureMatchNotes: "",
      answers: { ...(existing?.answers ?? {}), ...Object.fromEntries(keys.map((k) => [k, "A"])) },
    },
  });
}

async function appraiser() {
  const vr = await call("abdullah", "POST", "/api/valuation-requests/ensure-open", {
    propId: S.propertyId, area: BOURSE.area, type: "فيلا", appraiser: "عبدالله الكثيري", status: "progress", date: today,
  });
  S.vr = vr.id ?? vr.valuationRequestId ?? vr.data?.id;
  save();
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/approach-settings`, {
    marketApproachEnabled: true, costApproachEnabled: true, incomeApproachEnabled: false,
    costScopeKey: "land_and_building", adjustmentsEditUnlocked: true,
    valuationPurposeKey: "judicial_execution", valuationPurposeNote: "تنفيذ حكم قضائي — 412",
    externalSpecialistUsed: false, valuationDateMode: "issue", ownershipInterestKey: "freehold",
  });
  // Market: three villa sales.
  const villa = [];
  for (const [i, price] of [3150000, 3290000, 3080000].entries()) {
    const c = await call("abdullah", "POST", "/api/comparable-properties", {
      comparablePropertyType: BOURSE.propertyType, transactionKind: "executed", source: "bourse", intakeChannel: "office",
      district: "النرجس", city: "الرياض", transactionDate: today, areaSqm: 600 + i * 10, price,
      latitude: 24.7752 + i * 0.001, longitude: 46.6311 + i * 0.001,
    });
    villa.push(c.id ?? c.data?.id);
  }
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/market-approach`, {
    subjectAreaSqm: 640, adjustmentBasis: "whole_property", analysisNotes: "تحليل السوق — 412",
    subjectSpecs: { attraction: "قرب جامع وحديقة", access: "سهل من طريقين", street_count: "2" },
  });
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections`, {
    selectionContext: "market", items: villa.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
  });
  // Cost: land comparables, then the lines pulled from the inventory priced.
  const land = [];
  for (const [i, price] of [2100000, 2210000, 2050000].entries()) {
    const c = await call("abdullah", "POST", "/api/comparable-properties", {
      comparablePropertyType: "أرض", transactionKind: "executed", source: "bourse", intakeChannel: "office",
      district: "النرجس", city: "الرياض", transactionDate: today, areaSqm: 600 + i * 15, price,
      latitude: 24.7738 + i * 0.001, longitude: 46.6290 + i * 0.001,
    });
    land.push(c.id ?? c.data?.id);
  }
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections`, {
    selectionContext: "land_within_cost", items: land.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
  });
  const cost = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/cost-approach`);
  // The cost screen pulls its lines from «مكونات العقار» (the inventory) — the same here.
  const inventory = await call("abdullah", "GET", `/api/work-orders/${po()}/properties/${S.propertyId}/building-inventory`);
  const lines = (inventory.lines ?? []).map((l, i) => ({
    sourceInventoryLineId: l.id, structureKind: l.structureKind, itemKey: l.itemKey,
    label: l.label, areaSqm: Number(l.areaSqm), unit: l.unit, unitCostSar: 1800 + i * 100, rationale: "سعر سوق المقاولات — 412",
    isIncluded: true, sortOrder: i,
  }));
  S.costLinesFromInventory = lines.length;
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/cost-approach`, {
    lines, analysisNotes: "تحليل التكلفة — 412", refreshLandFromLandComps: true, buildingPlotAreaSqm: Number(BOURSE.area),
    useRestrictionDiscountPct: 0, indirectItems: ["design_supervision", "licensing_fees", "project_management", "utilities_connection", "contingency", "developer_profit"].map((itemKey, i) => ({ itemKey, pct: itemKey === "developer_profit" ? 12 : 1 + i, rationale: "نسبة متعارفة — 412", sortOrder: i })),
    financingAnnualRatePct: 5, financingMonths: 12,
    actualAgeYears: 8, actualAgeRationale: "عمر المعاين", economicAgeYears: 50, economicAgeRationale: "فلل خرسانية — 412",
    lifeExtensionYears: 0, functionalObsolescencePct: 2, functionalObsolescenceRationale: "تصميم قديم نسبياً — 412",
    externalObsolescencePct: 1, externalObsolescenceRationale: "ازدحام — 412",
  });
  const recon = await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/reconciliation`, {
    methods: [
      { approachKind: "market", weightPct: 60, isIncluded: true, rationale: "مقارنات مماثلة — 412", sortOrder: 0 },
      { approachKind: "cost", weightPct: 40, isIncluded: true, rationale: "عقار مبني حديث — 412", sortOrder: 1 },
    ],
    methodsRationale: "مبرر استخدام الأسلوبين — 412", finalRoundDecimals: 3,
    basisOfValueKey: "liquidation", valuePremiseKey: "orderly",
    liquidationDiscountPct: 10, liquidationDiscountRationale: "مبرر خصم التصفية — 412",
  });
  S.finalValue = recon.finalOpinionValue;
  const gates = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/issuance-gates`);
  S.gates = { allows: gates.allowsIssuance, blocking: gates.blockingReasonsAr };
  const existing = await call("abdullah", "GET", `/api/party-task-submissions/${S.appraisal}`, undefined, { allow: [404] });
  await call("abdullah", "PUT", `/api/party-task-submissions/${S.appraisal}`, {
    payload: {
      ...(existing?.payload ?? {}), taskId: S.appraisal, propertyId: S.propertyId, poNumber: S.po, status: "draft",
      evaluatorPrice: String(S.finalValue ?? ""), forcedSaleDiscountPct: "10",
      independenceDeclared: true, assetDataConfirmed: true, assetDataVarianceNotes: "",
      reportChoices: {
        ...(existing?.payload?.reportChoices ?? {}),
        valueBasisKey: "liquidation", premiseKey: "orderly", marketMethodKey: "market_comparison", finishingLevel: "luxury",
        esgEnv: { none: false, selected: ["موقع خارج نطاق السيول"], notes: "أثر بيئي — 412" },
        esgSoc: { none: false, selected: ["حي عائلي"], notes: "أثر اجتماعي — 412" },
        esgGov: { none: false, selected: ["صك سليم"], notes: "أثر الحوكمة — 412" },
      },
    },
  });
}

async function report() {
  const session = JSON.stringify({ token: await tok("abdullah") });
  const raw = await (await fetch(`${API}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "500000007" }),
  })).text().catch(() => session);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const auth = raw.includes("token") ? raw : session;
  await ctx.addInitScript(({ auth, taskId }) => {
    sessionStorage.setItem("auth", auth);
    localStorage.setItem("auth", auth);
    sessionStorage.setItem(`evaluator:tab:${taskId}`, "output");
  }, { auth, taskId: S.appraisal });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/property-appraisal/${S.appraisal}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 150000 });
  await page.locator('[data-testid="report-refreshing"]').waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const out = await page.evaluate(() => {
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
      sec: c.closest("[data-sec]")?.getAttribute("data-sec") ?? "", label: c.getAttribute("data-rpt-missing-label"),
      source: c.getAttribute("data-rpt-missing-source"),
    }));
    const photos = [...root.querySelectorAll("img")].map((i) => i.getAttribute("src")?.slice(0, 120)).filter(Boolean);
    return { rows, missing, photos, text: root.innerText };
  });
  fs.writeFileSync(`${OUT}/report-text.txt`, out.text);
  fs.writeFileSync(`${OUT}/report-cells.json`, JSON.stringify({ rows: out.rows, missing: out.missing, photos: out.photos }, null, 1));
  await page.screenshot({ path: `${OUT}/report-top.png` });
  await browser.close();
  console.log(`  ${out.rows.length} labelled rows, ${out.missing.length} red cells, ${out.photos.length} images`);
}

const RUN = { intake, inspector, accept, survey, specialist, appraiser, report };
// TYPE=<bourse type> overrides the villa (also the inspector's «الأصل محل التقييم»); STOP_AFTER=<stage> stops there.
if (process.env.TYPE) { BOURSE.propertyType = process.env.TYPE; FEATURES.assetSubject = process.env.TYPE; }
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
    process.exit(1);
  }
}
console.log(JSON.stringify({ po: S.po, propertyId: S.propertyId, appraisal: S.appraisal, finalValue: S.finalValue, gates: S.gates }));
