// Session-local A→Z campaign library (not a CI test): the stages of one transaction, from PO intake to the
// Enfaz handover, each driven through the endpoint its own screen saves to, as the role that owns it.
// Used by e2e/.az30-run.mjs with a scenario from e2e/.az30-scenarios.mjs. Writes only E2E- POs.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { uniqueDeedNumber, uniquePoNumber } from "./fixtures/transaction.ts";

export const API = "http://127.0.0.1:5160";
export const BASE = "http://localhost:3000";
export const PHONES = {
  sliman: "500000001", osama: "500000004", ahmed: "500000008", abdullah: "500000007",
  eman: "500000010", jeddah_survey: "500000011", assaf: "500000012",
  // Case-specialist sub-roles (2026-11): osama = review, hamrani = study, nafei = coordination.
  hamrani: "500000013", nafei: "500000015",
};
/** A step osama (review only) is refused is retried as the study, then the coordination specialist. */
const SPECIALIST_FALLBACK = ["hamrani", "nafei"];
export const today = new Date().toLocaleDateString("en-CA");
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
/** A real one-page certificate PDF (the tiny hand-made PDF is accepted at deposit but never merges into the final report). */
export const CERT_PDF = fs.readFileSync("test-results/az-2026-11-04-files/deposit-certificate.pdf").toString("base64");
export const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).toString("base64");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── session + HTTP ────────────────────────────────────────────────────────────────────────────
const raw = {};
async function waitHealthy() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${API}/health`); if (r.ok) return; } catch { /* down */ }
    await sleep(10000);
  }
  throw new Error("STACK DOWN: /health did not answer for 6+ minutes");
}
export async function loginRaw(user) {
  if (raw[user]) return raw[user];
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: PHONES[user] }) });
      if (!r.ok) throw new Error(`login ${user} → ${r.status}`);
      raw[user] = await r.text();
      return raw[user];
    } catch (e) {
      if (attempt > 2) throw e;
      await waitHealthy();
    }
  }
}
export const tok = async (u) => JSON.parse(await loginRaw(u)).token;

export function makeRun(OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  const STATE_FILE = `${OUT}/state.json`;
  const S = fs.existsSync(STATE_FILE) && process.env.FRESH !== "1" ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
  S.steps ??= [];
  S.findings ??= [];
  const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(S, null, 1));
  const logFile = `${OUT}/steps.log`;
  const log = (line) => { console.log(line); fs.appendFileSync(logFile, line + "\n"); };

  /** One API call as `user`. allow = statuses that are expected (a refusal case); returns {status, json}. */
  async function call(user, method, path, body, { allow = [], quiet = false, raw: wantRaw = false, headers = {} } = {}) {
    for (let attempt = 0; ; attempt++) {
      let r;
      try {
        r = await fetch(`${API}${path}`, {
          method,
          headers: { Authorization: `Bearer ${await tok(user)}`, "Content-Type": "application/json", ...headers },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (e) {
        if (attempt > 2) throw e;
        log(`  (network error ${e.message} — waiting for the stack)`);
        await waitHealthy();
        continue;
      }
      if ((r.status === 502 || r.status === 503 || r.status === 504) && attempt < 3) {
        log(`  (${r.status} on ${method} ${path} — waiting for the stack)`);
        await sleep(5000);
        await waitHealthy();
        continue;
      }
      if (wantRaw && r.ok) return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") };
      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = text; }
      const short = (typeof json === "string" ? json : JSON.stringify(json) ?? "").slice(0, 700);
      S.steps.push({ at: new Date().toISOString(), user, method, path, status: r.status, ...(r.ok ? {} : { body: short }) });
      const subRoleRefusal = r.status === 403 || (r.status === 400 && /لأخصائي (ال)?(تنسيق|دراسة|مراجعة)|متاح لأخصائي|للمراجع|لدارس/.test(short));
      if (subRoleRefusal && user === "osama" && !allow.includes(r.status)) {
        for (const other of SPECIALIST_FALLBACK) {
          const res = await call(other, method, path, body, { allow: [...allow, 400, 403], quiet: true, raw: wantRaw, headers });
          if (!(res && (res.__status === 403 || res.__status === 400))) { log(`  ↳ ${other} did it (${method} ${path})`); return res; }
        }
      }
      if (!r.ok && !allow.includes(r.status)) {
        log(`  ✗ ${user} ${method} ${path} → ${r.status} ${short}`);
        const err = new Error(`${user} ${method} ${path} → ${r.status} ${short}`);
        err.status = r.status; err.json = json; err.request = body;
        throw err;
      }
      if (!quiet) log(`  ${user} ${method} ${path} → ${r.status}${r.ok ? "" : " " + short}`);
      return r.ok ? json : { __status: r.status, ...((json && typeof json === "object") ? json : { text: json }) };
    }
  }
  const finding = (f) => { S.findings.push({ ...f, at: new Date().toISOString() }); log(`  ⚑ FINDING [${f.kind}] ${f.title}`); save(); };
  return { S, save, log, call, finding, OUT };
}

// ── real photos (copied once from a real inspection on this local production copy) ────────────
const PHOTO_DIR = "test-results/az30/_photos";
export async function photoPool(R) {
  const idx = `${PHOTO_DIR}/index.json`;
  if (fs.existsSync(idx)) return JSON.parse(fs.readFileSync(idx, "utf8"));
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const out = [];
  for (const po of ["PO-072172"]) {
    const tasks = await R.call("osama", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(po)}`, undefined, { quiet: true });
    const task = tasks.find((t) => t.kind === "field-inspection" && t.status !== "cancelled");
    const sub = await R.call("osama", "GET", `/api/party-task-submissions/${task.id}`, undefined, { quiet: true });
    for (const [i, p] of (sub?.payload?.freePhotos ?? []).entries()) {
      if (!p.attachmentId || !/^image\//.test(p.mimeType || "image/jpeg")) continue;
      const r = await fetch(`${API}/api/attachments/${p.attachmentId}`, { headers: { Authorization: `Bearer ${await tok("osama")}` } });
      if (!r.ok) continue;
      const file = `${PHOTO_DIR}/${i}.jpg`;
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      out.push({ file, category: p.category || "", mimeType: p.mimeType || "image/jpeg" });
    }
  }
  fs.writeFileSync(idx, JSON.stringify(out, null, 1));
  return out;
}

// ── stages ────────────────────────────────────────────────────────────────────────────────────
const RIYADH = { regionId: "000000b1-0000-4000-8000-000000000001", cityId: "000000b2-0000-4000-8000-000000000001" };

export function deedProperty(X, d, i) {
  const n = X.tag;
  return {
    identifierType: "deed", deedNumber: d, deedDate: X.deedDate ?? "2014-05-10", hasRequestNumber: true, requestNumber: `73${n}${i}`.slice(0, 9),
    assignmentMandateNumber: `TKF-${n}-${i}`, assignmentMandateDate: today,
    ownerName: X.owner ?? `مالك ${X.typeAr} ${n}`, court: "محكمة التنفيذ بالرياض", circuit: String(1 + (Number(n) % 9)),
    planNumber: `34${n}`, planName: `مخطط ${X.district} ${n}`, blockNumber: `${10 + i}`, plotNumber: X.platted ? `${200 + Number(n)}` : "",
    partitionMinutesNumber: `PM-${n}${i}`, partitionMinutesDate: "2016-01-20",
    locationMapUrl: `https://maps.google.com/?q=${X.lat.toFixed(6)},${X.lng.toFixed(6)}`,
    delegationLetterFileNames: ["delegation.pdf"], assignmentDocFileNames: ["decree.pdf"],
    contacts: [{ name: `ممثل المالك ${n}`, role: "وكيل", phone: `05550${String(n).padStart(2, "0")}${i}12`.slice(0, 10), nationalId: `10223344${String(n).padStart(2, "0")}` }],
    area: String(X.area),
  };
}

export function bourseBody(X, i = 0) {
  const n = X.tag;
  const b = {
    city: "الرياض", region: "منطقة الرياض", ...RIYADH, district: X.district, classification: X.classification, propertyType: X.typeAr,
    area: String(X.area), deedStatus: "فعال",
    owners: [{ name: X.owner ?? `مالك ${X.typeAr} ${n}` }, { name: `شريك ${n}` }],
    restrictionsPresent: X.restrictions ? "yes" : "no", restrictionType: X.restrictions ? "mortgaged" : "", restrictionOtherReason: "",
    boundariesAvailability: X.boundaries ?? "bourse",
    bourseDeedImageFileName: "bourse-deed.png",
  };
  if ((X.boundaries ?? "bourse") !== "no") {
    const L = X.sides;
    Object.assign(b, {
      northBoundary: `شارع عرض 20م (بورصة ${n})`, northBoundaryLengthM: String(L[0]), northBoundaryType: "street", northFacadeFinishing: X.kind === "land" ? "" : "حجر",
      southBoundary: `قطعة ${300 + i} (بورصة ${n})`, southBoundaryLengthM: String(L[0]), southBoundaryType: "plot", southFacadeFinishing: X.kind === "land" ? "" : "دهان",
      eastBoundary: `قطعة ${310 + i} (بورصة ${n})`, eastBoundaryLengthM: String(L[1]), eastBoundaryType: "plot", eastFacadeFinishing: X.kind === "land" ? "" : "دهان",
      westBoundary: `ممر مشاة 6م (بورصة ${n})`, westBoundaryLengthM: String(L[1]), westBoundaryType: "passage", westFacadeFinishing: X.kind === "land" ? "" : "رخام",
    });
  }
  return b;
}

/** Intake (one or more deeds) + bourse for each; leaves distribution to `distribute`. */
export async function intake(R, X) {
  const { S, call } = R;
  S.po = uniquePoNumber();
  const n = X.deeds ?? 1;
  S.deeds = Array.from({ length: n }, () => uniqueDeedNumber());
  // (The intake draft is not cleared: the main session works as osama in the browser at the same time.)
  await call("osama", "POST", "/api/work-orders", {
    poNumber: S.po, assignmentType: "تنفيذ", promulgationDate: today,
    assignmentSpecialist: "أسامة الصالحي", assignmentSpecialistEmail: "", expectedPropertyCount: n,
    clientId: "a1000001-0000-4000-8000-000000000001",
    properties: S.deeds.map((d, i) => deedProperty(X, d, i)),
  });
  const order = await call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`);
  S.workOrderId = order.id;
  S.props = order.properties.map((p) => ({ id: p.id, deed: p.deedNumber }));
  S.propertyId = S.props[0].id;
  R.save();
  await call("osama", "POST", "/api/workflow-tasks/sync");
  for (const [i, p] of S.props.entries()) {
    const key = `${S.po}:${p.id}`;
    for (const [scope, f] of [["property-deed-ownership", "deed.pdf"], ["property-delegation", "delegation.pdf"], ["property-decree", "decree.pdf"]]) {
      await call("osama", "POST", "/api/attachments", { scope, scopeKey: key, fileName: f, contentType: "application/pdf", contentBase64: PDF });
    }
    const tasks = await call("osama", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(S.po)}`, undefined, { quiet: true });
    const parent = tasks.find((t) => t.kind === "case-study-property" && t.propertyId === p.id)
      ?? tasks.filter((t) => t.kind === "case-study-property" && !t.propertyId).sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
    p.parent = parent.id;
    await call("osama", "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, { propertyId: p.id, identifierType: "deed", bourseDataCompleted: false, deedNumber: p.deed });
    await call("osama", "POST", "/api/attachments", { scope: "property-bourse-deed", scopeKey: key, fileName: "bourse-deed.png", contentType: "image/png", contentBase64: PNG }, { allow: [400] });
    await call("osama", "PUT", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${p.id}/bourse`, bourseBody(X, i));
  }
  S.parent = S.props[0].parent;
  R.save();
}

export async function distribute(R, X) {
  const { S, call } = R;
  for (const p of S.props) {
    await call("osama", "POST", `/api/workflow-tasks/${p.parent}/advance-after-bourse`, { deedNumber: p.deed });
    await call("osama", "POST", `/api/workflow-tasks/${p.parent}/confirm-distribution`, {
      deedNumber: p.deed,
      distribution: {
        governmentAuditor: false, governmentAuditorId: "", valuationDepartment: true, operationsCoordinatorId: "",
        inspectorId: "fi-ahmed", valuatorId: "val-abdullah", engineeringOffice: true, engineeringOfficeId: "eo-jeddah",
        caseSpecialist: true, caseSpecialistId: "cs-osama",
      },
      assigneeNames: { "field-inspection": "أحمد سعيد", "engineering-survey": "مكتب جدة للمساحة", "property-appraisal": "عبدالله الكثيري" },
    });
  }
  await readTasks(R);
}

export async function readTasks(R) {
  const { S, call } = R;
  const tasks = await call("osama", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(S.po)}`, undefined, { quiet: true });
  for (const p of S.props) {
    const kids = tasks.filter((t) => t.propertyId === p.id && t.status !== "cancelled");
    p.inspection = kids.find((t) => t.kind === "field-inspection")?.id ?? null;
    p.survey = kids.find((t) => t.kind === "engineering-survey")?.id ?? null;
    p.appraisal = kids.find((t) => t.kind === "property-appraisal")?.id ?? null;
  }
  Object.assign(S, { inspection: S.props[0].inspection, survey: S.props[0].survey, appraisal: S.props[0].appraisal ?? tasks.find((t) => t.kind === "property-appraisal" && t.status !== "cancelled")?.id });
  S.taskStatuses = tasks.map((t) => ({ kind: t.kind, prop: t.propertyId?.slice(0, 8), status: t.status, phase: t.phase }));
  R.save();
  return tasks;
}

// Feature keys hidden on land (FieldInspection land rules) and on an apartment (facade only).
const LAND_HIDDEN = ["facade", "propertyCondition", "buildState", "occupancyState", "carEntrance", "hasBasement", "hasElevator", "hasPool", "hasCentralAc", "hasTanks", "hasLandscaping", "kitchen"];

export function inspectorPayload(X, current, i, freePhotos) {
  const n = X.tag;
  const features = {
    assetSubject: X.assetSubject ?? X.typeAr, facade: "شمالية", propertyUsage: X.usage ?? "سكني", zoneStatus: "غير موقوفة", propertyCondition: "مستخدم",
    buildState: X.buildState ?? "جيد", occupancyState: "مشغول", occupancyDescription: `مؤجر — ${n}`, districtState: "جديد",
    movables: X.movables ? "نعم" : "لا", movablesDescription: X.movables ? `أثاث ومعدات — ${n}` : "",
    hasFence: "نعم", hasCentralAc: "نعم", hasTanks: "نعم", hasLandscaping: "نعم", carEntrance: "نعم",
    hasBasement: "لا", hasElevator: X.kind === "building" ? "نعم" : "لا", hasPool: "لا", kitchen: "نعم",
  };
  if (X.kind === "land") for (const k of LAND_HIDDEN) delete features[k];
  if (X.kind === "apartment") delete features.facade;
  const sides = X.sides;
  const mismatch = X.inspectorDeedMatch === "no";
  const bnd = (side, desc, len, facade) => ({
    deedDesc: desc, deedLength: String(len), facade: X.kind === "land" || X.kind === "apartment" ? "" : facade,
    matches: mismatch && side === "east" ? false : true,
    mismatchNote: mismatch && side === "east" ? `الطبيعة: قطعة ملاصقة غير مذكورة في الصك — ${n}` : "",
  });
  const builtLike = X.kind !== "land";
  return {
    ...(current?.payload ?? {}),
    streetName: `شارع التجربة ${n}`, mainStreetName: "طريق الملك سلمان", streetWidthM: "20", siteAttendedBy: "وكيل المالك",
    accessRouteDescription: `من طريق الملك سلمان ثم يمين عند المسجد — ${n}`,
    ...(builtLike ? {
      roomCount: String(X.rooms ?? 5), hallCount: "2", unitCount: String(X.units ?? 1), bathroomCount: String((X.rooms ?? 5) + 1), showroomCount: X.typeAr.includes("محل") ? "1" : "0",
      wellCount: X.typeAr.includes("مزرعة") ? "1" : "0", towerCount: "0", builtArea: String(X.builtArea ?? X.area), buildingFloors: String(X.floors ?? 2),
      basementTotal: "0", annexTotal: "1", annexUpperCount: "1", annexGroundCount: "0", buildingsTotal: String(X.buildings ?? 1),
      jacuzziCount: "0", diningCount: "1", majlisCount: "1", maidRoomCount: "1", guardRoomCount: "1", parkingCount: "2", playgroundCount: "0", storeCount: "1",
      hasAnnex: "نعم", buildLicenseNumber: `44${n}12`, buildLicenseDate: "2016-06-15", propertyAgeYears: String(X.age ?? 8),
      electricityMeterCount: "1", electricityMeterNumbers: `5544${n}22`, waterMeterCount: "1", waterMeterNumbers: `7788${n}00`,
    } : { landHasValuableStructures: X.landStructures ? "yes" : "no" }),
    hasViolations: "نعم", violationsCount: "1", violationsDescription: `مخالفة ارتداد بسيطة — ${n}`,
    propertyDescription: X.inspectorDescription ?? `${X.typeAr} — وصف المعاين ${n}`,
    districtProsCons: `قرب الخدمات / ازدحام وقت الذروة — ${n}`, assetNotes: `ملاحظات المعاين على الأصل ${n}`,
    inspectionDate: today, inspectionTime: "09:45",
    mapLatitude: X.lat.toFixed(6), mapLongitude: X.lng.toFixed(6), mapPinned: true,
    accessContactName: `حارس العقار ${n}`, accessContactPhone: `05000${String(n).padStart(3, "0")}12`.slice(0, 10), accessContactRole: "حارس", accessContactNationalId: `10987654${String(n).padStart(2, "0")}`,
    featureValues: { ...(current?.payload?.featureValues ?? {}), ...features },
    services: ["كهرباء", "ماء", "صرف صحي", "هاتف / اتصالات", "سفلتة", "إنارة"],
    amenities: ["مساجد", "مستشفيات", "مرفق أمني", "أسواق تجارية", "حدائق", "مدارس", "مقر حكومي", "طرق رئيسية"],
    freePhotos,
    boundaryMatches: {
      north: bnd("north", `شارع عرض 20م (معاين ${n})`, sides[0], "حجر"),
      south: bnd("south", `قطعة ${300 + i} (معاين ${n})`, sides[0], "دهان"),
      east: bnd("east", `قطعة ${310 + i} (معاين ${n})`, sides[1], "دهان"),
      west: bnd("west", `ممر مشاة 6م (معاين ${n})`, sides[1], "رخام"),
    },
    deedMatchesNature: (X.boundaries ?? "bourse") === "no" ? "" : (mismatch ? "no" : "yes"),
    observations: [{ id: `obs-${n}`, category: "visible_defect", text: `تشقق بسيط في السور — ${n}` }],
    clientDeclarationSigned: true, declarationPhoneSatisfied: true, keyAvailable: true, inspectionConfirmed: true,
  };
}

export async function inspector(R, X, { submit = true } = {}) {
  const { S, call } = R;
  const pool = await photoPool(R);
  for (const [i, p] of S.props.entries()) {
    const current = await call("ahmed", "GET", `/api/party-task-submissions/${p.inspection}`, undefined, { allow: [404] });
    // Screen categories only (parent exterior|interior × kind facade|service|amenity|other); `role` is the
    // driver's own label for the specialist's board (kitchen, meters, movables), never sent as a category.
    const plan = X.kind === "land"
      ? [...Array(10).fill(["exterior:facade", "ext"]), ...Array(2).fill(["exterior:other", "ext"])]
      : [...Array(12).fill(["exterior:facade", "ext"]), ...Array(16).fill(["interior:other", "int"]), ...Array(4).fill(["interior:other", "kit"]),
        ["exterior:service", "elec"], ["exterior:service", "water"], ...(X.movables ? Array(4).fill(["interior:other", "mov"]) : [])];
    const freePhotos = [];
    const roles = [];
    for (const [k, [category, role]] of plan.entries()) {
      const want = category.startsWith("exterior") ? "exterior" : "interior";
      const cands = pool.filter((x) => x.category.startsWith(want));
      const src = (cands.length ? cands : pool)[(k + Number(X.tag)) % (cands.length || pool.length)];
      const bytes = src ? fs.readFileSync(src.file).toString("base64") : PNG;
      const meta = await call("ahmed", "POST", "/api/attachments", {
        scope: "field-inspection-photo", scopeKey: `${p.inspection}:free:${k + 1}`, fileName: `photo-${k + 1}.jpg`,
        contentType: src?.mimeType ?? "image/png", contentBase64: bytes,
      }, { quiet: true });
      freePhotos.push({ id: k + 1, category, approved: true, fileName: meta.fileName, mimeType: src?.mimeType ?? "image/png", attachmentId: meta.id });
      roles.push(role);
    }
    R.log(`  ahmed uploaded ${freePhotos.length} real photos for deed ${p.deed}`);
    p.photos = freePhotos.map((f, k) => ({ id: f.attachmentId, category: f.category, role: roles[k] }));
    R.save();
    // Component photos (showroom / well, required when counted) and the optional feature proof photos.
    const payload = inspectorPayload(X, current, i, freePhotos);
    const photoOf = async (slot, k) => {
      const src = pool[(k + Number(X.tag)) % pool.length];
      const meta = await call("ahmed", "POST", "/api/attachments", {
        scope: "field-inspection-photo", scopeKey: `${p.inspection}:${slot}`, fileName: `${slot.replace(/:/g, "-")}.jpg`,
        contentType: src.mimeType, contentBase64: fs.readFileSync(src.file).toString("base64"),
      }, { quiet: true });
      return { attachmentId: meta.id, fileName: meta.fileName };
    };
    const component = {};
    if (Number(payload.showroomCount) > 0) component.showroom = await photoOf("component:showroom", 1);
    if (Number(payload.wellCount) > 0) component.well = await photoOf("component:well", 2);
    payload.componentPhotoAttachments = { ...(payload.componentPhotoAttachments ?? {}), ...component };
    if (X.kind !== "land") {
      const keys = ["buildState", "carEntrance", "kitchen", ...(X.kind === "apartment" ? [] : ["facade"]), ...(payload.featureValues.hasElevator === "نعم" ? ["hasElevator"] : []), ...(X.movables ? ["movables"] : [])];
      const feat = {};
      for (const [k, key] of keys.entries()) feat[key] = await photoOf(`feature:${key}`, 3 + k);
      payload.featurePhotoAttachments = { ...(payload.featurePhotoAttachments ?? {}), ...feat };
    }
    await call("ahmed", "PUT", `/api/party-task-submissions/${p.inspection}`, { payload });
    if (X.inventory?.length) {
      await call("ahmed", "PUT", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${p.id}/building-inventory`, { componentsText: "", lines: X.inventory }, { allow: [403] });
    }
    if (submit) await call("ahmed", "POST", `/api/party-task-submissions/${p.inspection}/submit`);
  }
}

export async function accept(R, X) {
  const { S, call } = R;
  for (const p of S.props) {
    await call("osama", "PUT", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${p.id}/building-inventory`, {
      componentsText: X.componentsText ?? `${X.typeAr} — مكونات الأخصائي ${X.tag}`, lines: X.inventory ?? [],
    });
    await call("osama", "POST", `/api/party-task-submissions/${p.inspection}/accept`);
    if (X.kind !== "land") {
      // «مستوى تشطيبات البناء» — the specialist's field on the inspector-review screen (specialist report extras).
      const wo = await call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}`, undefined, { quiet: true });
      const prop = wo.properties.find((x) => x.id === p.id);
      let bag = {};
      try { bag = JSON.parse(prop?.specialistReportExtrasJson || "{}"); } catch { bag = {}; }
      await call("osama", "PUT", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${p.id}/specialist-report-extras`, { specialistReportExtrasJson: JSON.stringify({ ...bag, finishing: X.finishing ?? "luxury" }) });
    }
  }
}

export function surveyPayload(X, current, p, report, letter, { lat, lng } = {}, po = "") {
  const n = X.tag;
  const L = X.sides;
  return {
    ...(current?.payload ?? {}),
    latitude: (lat ?? X.lat + 0.00004).toFixed(6), longitude: (lng ?? X.lng + 0.00004).toFixed(6), onSiteAreaSqm: String(X.area - 0.75),
    northBoundary: `شارع عرض 20م (مكتب ${n})`, northBoundaryLengthM: String(L[0] + 0.1),
    southBoundary: `قطعة 300 (مكتب ${n})`, southBoundaryLengthM: String(L[0] + 0.1),
    eastBoundary: `قطعة 310 (مكتب ${n})`, eastBoundaryLengthM: String(L[1] - 0.1),
    westBoundary: `ممر مشاة 6م (مكتب ${n})`, westBoundaryLengthM: String(L[1] - 0.1),
    surveyNotes: `ملاحظات الرفع المساحي ${n}`, transactionNote: `ملاحظة المكتب على المعاملة ${n}`,
    taskId: p.survey, propertyId: p.id, poNumber: po,
    surveyReportFileName: report.fileName, siteLetterFileName: letter.fileName, siteConfirmed: true,
    surveyReportAttachment: { attachmentId: report.id, fileName: report.fileName },
    siteLetterAttachment: { attachmentId: letter.id, fileName: letter.fileName },
    declarationPhoneSatisfied: true, checklist: Array.from({ length: 13 }, () => ({ answer: "yes", note: "" })), deedMatchesNature: "yes",
  };
}

export async function survey(R, X, { acceptIt = true, coords } = {}) {
  const { S, call } = R;
  for (const p of S.props) {
    if (!p.survey) { R.log(`  (deed ${p.deed}: no survey task)`); continue; }
    const current = await call("jeddah_survey", "GET", `/api/party-task-submissions/${p.survey}`, undefined, { allow: [404] });
    const report = await call("jeddah_survey", "POST", "/api/attachments", { scope: "engineering-survey-report", scopeKey: p.survey, fileName: "survey-report.pdf", contentType: "application/pdf", contentBase64: PDF });
    const letter = await call("jeddah_survey", "POST", "/api/attachments", { scope: "engineering-site-letter", scopeKey: p.survey, fileName: "site-letter.pdf", contentType: "application/pdf", contentBase64: PDF });
    await call("jeddah_survey", "PUT", `/api/party-task-submissions/${p.survey}`, { payload: surveyPayload(X, current, p, report, letter, coords, S.po) });
    await call("jeddah_survey", "POST", `/api/party-task-submissions/${p.survey}/submit`);
    if (acceptIt) await call("osama", "POST", `/api/party-task-submissions/${p.survey}/accept`, X.surveyDiscount ? { proposedDiscountSar: X.surveyDiscount, discountReason: `تأخر المكتب في التسليم — ${X.tag}` } : undefined);
  }
}

export async function receiveAndBoard(R, X) {
  const { S, call } = R;
  await call("osama", "POST", `/api/transactions/by-property/${S.propertyId}/receive`, {}, { allow: X.allowReceiveRefusal ? [400] : [] });
  for (const p of S.props) {
    const ids = (role) => p.photos.filter((x) => x.role === role).map((x) => x.id);
    const ext = ids("ext"), int = ids("int"), kit = ids("kit"), mov = ids("mov");
    const board = [...ext.slice(0, 10), ...int.slice(0, 10), ...kit.slice(0, 4)].slice(0, 24);
    await call("osama", "PUT", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${p.id}/photo-marks`, {
      main: board[0], electricity: ids("elec"), water: ids("water"), movables: mov, report: board, reportSections: {}, reportOrdered: true,
    });
    p.board = board.length;
  }
  R.save();
}

export async function issueStudy(R, X, { allow = [] } = {}) {
  const { S, call } = R;
  const keys = [
    ...Array.from({ length: 11 }, (_, i) => `deed_${i}`), ...Array.from({ length: 7 }, (_, i) => `survey_${i}`),
    ...Array.from({ length: 9 }, (_, i) => `comp_${i}`), ...Array.from({ length: 6 }, (_, i) => `occ_${i}`),
    ...Array.from({ length: 4 }, (_, i) => `extra_${i}`),
  ];
  const existing = await call("osama", "GET", `/api/case-study-reports/${S.parent}`, undefined, { allow: [404] });
  const base = existing && typeof existing === "object" && !existing.__status ? existing : {};
  return call("osama", "POST", `/api/case-study-reports/${S.parent}/issue`, {
    report: {
      ...base, taskId: S.parent, propertyId: S.propertyId, poNumber: S.po,
      deedNatureMatchOutcome: X.studyOutcome ?? "matched", deedNatureMatchNotes: X.studyOutcomeNotes ?? "",
      requestNumber: base.requestNumber || `73${X.tag}0`, requestDate: base.requestDate || today,
      deedRemarks: `ملاحظات الصك — ${X.tag}`, surveyRemarks: `ملاحظات الرفع المساحي في الدراسة — ${X.tag}`,
      componentsRemarks: `ملاحظات المكونات — ${X.tag}`, occupancyRemarks: `ملاحظات الإشغال — ${X.tag}`,
      meterType: "كهرباء", meterNumber: `5544${X.tag}22`, hoaFee: X.kind === "apartment" ? "1200" : "0",
      sigDeed: `أسامة الصالحي — ${X.tag}`, sigApprover: "سليمان المشرف", sigDate: today,
      infathLinkedAssets: (X.deeds ?? 1) > 1 ? "yes" : "no", infathLinkedDeedNumbers: (X.deeds ?? 1) > 1 ? S.props.map((p) => p.deed).join("، ") : "",
      infathLinkedAssetsNotes: (X.deeds ?? 1) > 1 ? `مبنى واحد على صكين — ${X.tag}` : "",
      infathOtherNotes: `ملاحظات أخرى للأخصائي — ${X.tag}`, infathClosingNotes: `ملاحظات ختامية للأخصائي — ${X.tag}`,
      answers: { ...(base.answers ?? {}), ...Object.fromEntries(keys.map((k) => [k, "A"])) },
    },
  }, { allow });
}

// ── valuation ─────────────────────────────────────────────────────────────────────────────────
export async function ensureVr(R, X) {
  const { S, call } = R;
  const vr = await call("abdullah", "POST", "/api/valuation-requests/ensure-open", {
    propId: S.propertyId, area: String(X.area), type: X.typeAr, appraiser: "عبدالله الكثيري", status: "progress", date: today,
  });
  S.vr = vr.id ?? vr.valuationRequestId ?? vr.data?.id;
  R.save();
  return S.vr;
}

async function addComps(R, X, list, ctx) {
  const { S, call } = R;
  const ids = [];
  for (const [i, c] of list.entries()) {
    const body = {
      comparablePropertyType: c.type, transactionKind: c.kind ?? "executed", source: c.source ?? ["bourse", "listing_platform", "field"][i % 3], intakeChannel: "office",
      district: X.district, city: "الرياض", transactionDate: c.date ?? today, areaSqm: c.area, price: c.price,
      latitude: X.lat + 0.0012 * (i + 1) * (ctx === "market" ? 1 : -1), longitude: X.lng + 0.001 * (i + 1),
      usage: c.usage ?? X.usage ?? "سكني", planNumber: `34${X.tag}`, plotNumber: `${400 + i}`, transactionReference: `TR-${X.tag}-${ctx}-${i}`,
      description: `مقارن ${i + 1} (${c.type}) — ${X.tag}`,
      ...(c.kind === "offer" ? { priceDescription: "asking", listingNumber: `L-${X.tag}${i}`, advertiserPhone: "0550000999" } : {}),
    };
    const r = await call("abdullah", "POST", "/api/comparable-properties", body, { quiet: true });
    ids.push(r.id ?? r.data?.id);
  }
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections`, {
    selectionContext: ctx, items: ids.map((comparablePropertyId, sortOrder) => ({ comparablePropertyId, sortOrder, isAdopted: true })),
  });
  return ids;
}

const ADJ = {
  financing: { pct: [-2, 0, -1], desc: null, why: "دفعات مقسطة في المقارن 1 و3" },
  market: { pct: [3, 2, 4], desc: null, why: "ارتفاع الأسعار منذ تاريخ الصفقة" },
  location: { pct: [0, -2, 1], desc: ["نفس الشارع", "طرف الحي", "قرب الطريق"], why: "موقع المقارن داخل الحي" },
  attraction: { pct: [2, 0, -1], desc: ["بعيد عن الجامع", "قرب الجامع", "قرب الحديقة والجامع"], why: "القرب من الجامع والحديقة" },
  access: { pct: [0, 1, -2], desc: ["مدخل واحد", "مدخل من طريق فرعي", "مدخلان"], why: "سهولة بلوغ المقارن" },
  street_count: { pct: [5, 0, 0], desc: ["1", "2", "2"], why: "عدد الشوارع المطلة" },
  area: { pct: null, desc: null, why: "فرق المساحة وفق معامل المساحة" },
};

export async function fillAdjustments(R, X, context, manualWeights) {
  const { S, call } = R;
  const list = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/comparable-selections?selectionContext=${context}`, undefined, { quiet: true });
  const adopted = list.items.filter((i) => i.isAdopted).sort((a, b) => a.sortOrder - b.sortOrder);
  const shift = Number(X.tag) % 3;
  for (const [i, item] of adopted.entries()) {
    const lines = item.market.adjustmentLines.map((l) => {
      const plan = ADJ[l.factorKey];
      if (!plan || !plan.pct) return { ...l, isIncluded: l.isIncluded ?? true };
      return { ...l, isIncluded: true, percent: plan.pct[(i + shift) % 3] ?? 0, descriptionAr: plan.desc ? `${plan.desc[i % 3]} — ${X.tag}` : l.descriptionAr };
    });
    const manual = !!manualWeights;
    await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/comparable-selections/${item.id}/market`, {
      adjustmentLines: lines,
      weightPct: manual ? manualWeights[i] : null, weightIsManual: manual,
      weightOverrideRationale: manual ? "المقارن الأول الأقرب مساحة وموقعاً" : null,
      areaAdjustmentMethod: item.market.areaAdjustmentMethod,
    }, { quiet: true });
  }
  for (const [factorKey, plan] of Object.entries(ADJ)) {
    if (!adopted[0]?.market.adjustmentLines.some((l) => l.factorKey === factorKey)) continue;
    await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/adjustment-factor-rationale`, { selectionContext: context, factorKey, rationaleAr: `${plan.why} — ${X.tag}` }, { quiet: true });
  }
  R.log(`  adjustments filled on ${context} (${adopted.length} comps)`);
}

export async function valuate(R, X) {
  const { S, call } = R;
  const V = X.valuation;
  await ensureVr(R, X);
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/approach-settings`, {
    marketApproachEnabled: !!V.market, costApproachEnabled: !!V.cost, incomeApproachEnabled: false,
    costScopeKey: V.scope, costBasisKey: "replacement", costMeasurementUnitKey: "comparison_unit", adjustmentsEditUnlocked: true,
    valuationPurposeKey: V.purpose ?? "judicial_execution", valuationPurposeNote: `تنفيذ حكم قضائي — ${X.tag}`,
    externalSpecialistUsed: false, valuationDateMode: V.retro ? "retrospective" : "issue",
    ...(V.retro ? { retrospectiveDate: V.retro.date, retrospectiveRationale: V.retro.why } : {}),
    ownershipInterestKey: V.ownership ?? "freehold", ...(V.leaseYears ? { remainingLeaseYears: V.leaseYears } : {}),
    selectedAssumptions: V.assumptions ?? [],
  });
  if (V.market) {
    await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/market-approach`, {
      subjectAreaSqm: V.market.subjectArea, adjustmentBasis: V.market.basis, analysisNotes: `تحليل السوق — ${X.tag}`,
      subjectSpecs: { attraction: "قرب جامع وحديقة", access: "سهل من طريقين", street_count: "2", location: `${X.district} — وسط الحي` },
    });
    await addComps(R, X, V.market.comps, "market");
    await fillAdjustments(R, X, "market", V.market.manualWeights ?? null);
  }
  if (V.cost) {
    if (V.cost.landComps) {
      await addComps(R, X, V.cost.landComps, "land_within_cost");
      await fillAdjustments(R, X, "land_within_cost", null);
    }
    const inventory = await call("abdullah", "GET", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${S.propertyId}/building-inventory`, undefined, { quiet: true });
    const lines = (inventory.lines ?? []).map((l, i) => ({
      sourceInventoryLineId: l.id, structureKind: l.structureKind, itemKey: l.itemKey, label: l.label, areaSqm: Number(l.areaSqm), unit: l.unit,
      unitCostSar: (V.cost.unitCost ?? 1800) + i * 100, rationale: `سعر سوق المقاولات — ${X.tag}`, isIncluded: true, sortOrder: i,
    }));
    S.costLines = lines.length;
    await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/cost-approach`, {
      lines, analysisNotes: `تحليل التكلفة — ${X.tag}`, refreshLandFromLandComps: !!V.cost.landComps,
      buildingPlotAreaSqm: V.cost.plotArea ?? X.area, ...(V.cost.landShare ? { apartmentLandShareSqm: V.cost.landShare } : {}),
      useRestrictionDiscountPct: V.cost.useRestriction ?? 0, ...(V.cost.useRestriction ? { useRestrictionDiscountRationale: `قيود استخدام الأرض — ${X.tag}` } : {}),
      indirectItems: ["design_supervision", "licensing_fees", "project_management", "utilities_connection", "contingency", "developer_profit"].map((itemKey, i) => ({
        itemKey, pct: itemKey === "developer_profit" ? (V.cost.profit ?? 12) : 1 + i, rationale: `نسبة متعارفة — ${X.tag}`, sortOrder: i,
      })),
      financingAnnualRatePct: 5, financingMonths: 12,
      actualAgeYears: X.age ?? 8, actualAgeRationale: "عمر المعاين", economicAgeYears: V.cost.life ?? 50, economicAgeRationale: `مبانٍ خرسانية — ${X.tag}`,
      lifeExtensionYears: 0, functionalObsolescencePct: 2, functionalObsolescenceRationale: `تصميم قديم نسبياً — ${X.tag}`,
      externalObsolescencePct: 1, externalObsolescenceRationale: `ازدحام المنطقة — ${X.tag}`,
    });
  }
  if (X.valuedDocument) await valuedDocument(R, X);
  await reconcile(R, X);
}

export async function reconcile(R, X) {
  const { S, call } = R;
  const V = X.valuation;
  const methods = [];
  if (V.market) methods.push({ approachKind: "market", weightPct: V.weights?.[0] ?? (V.cost ? 60 : 100), isIncluded: true, rationale: `مقارنات مماثلة — ${X.tag}`, sortOrder: 0 });
  if (V.cost) methods.push({ approachKind: "cost", weightPct: V.weights?.[1] ?? (V.market ? 40 : 100), isIncluded: true, rationale: `عقار مبني — ${X.tag}`, sortOrder: 1 });
  const liq = V.basis === "liquidation";
  const recon = await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/reconciliation`, {
    methods, methodsRationale: `مبرر استخدام الأسلوب — ${X.tag}`, finalRoundDecimals: V.round ?? 3,
    basisOfValueKey: V.basis ?? "market", valuePremiseKey: V.premise ?? (liq ? "orderly" : "hau"),
    liquidationDiscountPct: liq ? (V.liq ?? 10) : 0, liquidationDiscountRationale: liq ? `مبرر خصم التصفية — ${X.tag}` : null,
  });
  // The appraiser acknowledges / justifies every triggered soft alert (the screen asks the same).
  const gates = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/issuance-gates`, undefined, { quiet: true });
  const soft = (gates.methodologyAlerts ?? []).filter((a) => a.triggered && !a.isHard);
  if (soft.length) {
    await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/reconciliation/alert-overrides`, {
      methodologyAlertOverrides: soft.map((a) => ({ code: a.code, acknowledged: true, overrideRationale: `مبرر المقيّم للتنبيه ${a.number} — ${X.tag}` })),
    }, { allow: [400] });
  }
  const after = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/issuance-gates`, undefined, { quiet: true });
  S.alerts = (after.methodologyAlerts ?? []).filter((a) => a.triggered).map((a) => `${a.code}${a.isHard ? "(hard)" : ""}${a.blocksIssuance ? "!" : ""}`);
  S.gates = { allows: after.allowsIssuance, blocking: after.blockingReasonsAr };
  const rec = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/reconciliation`, undefined, { quiet: true });
  S.finalValue = rec.finalOpinionValue;
  R.log(`  final=${S.finalValue} market=${rec.marketOpinionValue} cost=${rec.costOpinionWithLand} alerts=${S.alerts.join(",")} gates=${JSON.stringify(S.gates.blocking)}`);
  R.save();
  return rec;
}

export async function valuedDocument(R, X) {
  const { S, call } = R;
  const up = await call("osama", "POST", "/api/attachments", {
    scope: "property-valued-document", scopeKey: `${S.po}:${S.propertyId}`, fileName: "valued-movables.pdf", contentType: "application/pdf", contentBase64: PDF,
    documentTypeKey: "valued-document", customDocumentLabel: `تقييم المنقولات — ${X.tag}`,
  });
  S.valuedDoc = up.id;
  await call("osama", "POST", `/api/attachments/${up.id}/value-document-review`, { decision: "approved" });
  await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/value-documents`);
  await call("abdullah", "PUT", `/api/valuation-requests/${S.vr}/value-documents`, { uses: [{ attachmentId: up.id, effect: "addition", value: X.valuedDocument }] });
  R.save();
}

export async function appraisalPackage(R, X, { submit = true, allow = [] } = {}) {
  const { S, call } = R;
  const V = X.valuation;
  const existing = await call("abdullah", "GET", `/api/party-task-submissions/${S.appraisal}`, undefined, { allow: [404] });
  const prev = existing && !existing.__status ? existing.payload ?? {} : {};
  // The plan image («صورة الأصل من المخطط») and the cost split the Enfaz form shows.
  const plan = prev.planImageMetadata?.attachmentId ? { id: prev.planImageMetadata.attachmentId, fileName: prev.planImageFileName }
    : await call("abdullah", "POST", "/api/attachments", { scope: "evaluator-plan-image", scopeKey: S.appraisal, fileName: "plan-image.pdf", contentType: "application/pdf", contentBase64: CERT_PDF }, { allow: [400, 403] }).then((r) => (r?.__status ? null : r));
  if (V.cost) {
    const cost = await call("abdullah", "GET", `/api/valuation-requests/${S.vr}/cost-approach`, undefined, { quiet: true });
    S.costSplit = { land: Math.round(cost.costScopeKey === "building_only" ? 0 : cost.landValueFromMarket ?? 0), building: Math.round(cost.buildingsValueAfterDepreciation ?? 0) };
  }
  await call("abdullah", "PUT", `/api/party-task-submissions/${S.appraisal}`, {
    payload: {
      ...prev, taskId: S.appraisal, propertyId: S.propertyId, poNumber: S.po, status: "draft",
      evaluatorPrice: String(S.finalValue ?? ""), forcedSaleDiscountPct: V.basis === "liquidation" ? String(V.liq ?? 10) : "0",
      independenceDeclared: true, assetDataConfirmed: true, assetDataVarianceNotes: `لا فروق جوهرية — ${X.tag}`,
      // What the appraiser's own screen writes besides (Enfaz fields, checklist, report staff, dates).
      appraisalDate: today, reportIssueDate: today,
      valuationMethod: V.market && V.cost ? "أسلوب السوق — طريقة المقارنة + أسلوب التكلفة — طريقة المقاول" : V.market ? "أسلوب السوق — طريقة المقارنة" : "أسلوب التكلفة — طريقة المقاول",
      valueBasis: "قيمة التصفية", // the screen derives it from the assignment type «تنفيذ» (evaluator-submission-model)
      demandLevel: "متوسط", searchScopeNotes: `البورصة العقارية ومنصات الإعلانات والمعاينة الميدانية — ${X.tag}`,
      landValue: S.costSplit ? String(S.costSplit.land) : "", buildingValue: S.costSplit ? String(S.costSplit.building) : "",
      appraiserAddress: "الرياض — حي العليا، طريق الملك فهد، مبنى 12", appraiserPhone: "0112345678",
      evaluatorNotes: `ملاحظات المقيّم على العقار — ${X.tag}`,
      planImageFileName: plan?.fileName ?? null, ...(plan ? { planImageMetadata: { fileName: plan.fileName, mimeType: "application/pdf", sizeBytes: 30469, attachmentId: plan.id } } : {}),
      checklist: {
        q_plan_match: true, q_excess_zoning: false, q_land_waqf: false, q_property_waqf: false, q_expropriation: false,
        q_property_use_verified: true, q_agriculture_inquiry: X.usage === "زراعي", q_overlap: false, q_shared_building: X.kind === "apartment",
        q_environmental_factors: false, q_unregistered_additions: false, q_shared_deed: true, shared_deed_scope: "part", shared_deed_percentage: "50",
        q_lease_exists: V.ownership === "leased_land", q_lease_active: V.ownership === "leased_land", q_technical_notes_exists: true,
        technical_notes_text: `ملاحظات فنية للمقيّم — ${X.tag}`,
      },
      reportWorkers: [
        { id: "w1", role: "معد", name: "عبدالله الكثيري", licenseNumber: "1210001234", licenseDate: "2022-03-10", licenseFileName: null },
        { id: "w2", role: "مراجع", name: "عساف المقيم", licenseNumber: "1210005678", licenseDate: "2021-07-01", licenseFileName: null },
        { id: "w3", role: "معتمد", name: "عماد الرشيد", licenseNumber: "1210009999", licenseDate: "2020-01-15", licenseFileName: null },
      ],
      reportChoices: {
        ...(prev.reportChoices ?? {}),
        purposeKey: V.purpose ?? "judicial_execution",
        valueBasisKey: V.basis ?? "market", premiseKey: V.premise ?? (V.basis === "liquidation" ? "orderly" : "hau"),
        marketMethodKey: V.market ? "market_comparison" : "", costMethodKey: V.cost ? "contractor" : "", finishingLevel: X.finishing ?? "luxury",
        methodsRationale: `مبرر استخدام الأسلوب — ${X.tag}`,
        esgEnv: { none: false, selected: ["موقع خارج نطاق السيول"], notes: `أثر بيئي — ${X.tag}` },
        esgSoc: { none: false, selected: ["حي عائلي"], notes: `أثر اجتماعي — ${X.tag}` },
        esgGov: { none: false, selected: ["صك سليم"], notes: `أثر الحوكمة — ${X.tag}` },
      },
    },
  });
  if (submit) return call("abdullah", "POST", `/api/party-task-submissions/${S.appraisal}/submit`, undefined, { allow });
}

// ── browser: the appraiser's report, the approval, the Enfaz tab ──────────────────────────────
let browser;
async function br() { return (browser ??= await chromium.launch({ headless: true })); }
export async function closeBrowser() { if (browser) await browser.close(); browser = undefined; }
async function pageAs(user, extraInit) {
  const b = await br();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  await ctx.addInitScript(({ auth, extra }) => {
    sessionStorage.setItem("auth", auth); localStorage.setItem("auth", auth);
    for (const [k, v] of Object.entries(extra ?? {})) sessionStorage.setItem(k, v);
  }, { auth: await loginRaw(user), extra: extraInit });
  return { ctx, page: await ctx.newPage() };
}

async function openReport(user, taskId) {
  const { ctx, page } = await pageAs(user, { [`evaluator:tab:${taskId}`]: "output" });
  await page.goto(`${BASE}/property-appraisal/${taskId}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".rpt-ref [data-sec]").first().waitFor({ timeout: 240000 });
  await page.locator('[data-testid="report-refreshing"]').waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(6000);
  return { ctx, page };
}

/** Reads the appraiser's report: labelled rows, red cells, images, broken text. */
export async function dumpReport(R, X, label = "report") {
  const { S } = R;
  const { ctx, page } = await openReport("abdullah", S.appraisal);
  const out = await page.evaluate(() => {
    const root = document.querySelector(".rpt-ref");
    const rows = [];
    for (const k of root.querySelectorAll("td.k, th.k")) {
      const sec = k.closest("[data-sec]")?.getAttribute("data-sec") ?? "";
      const vals = []; let v = k.nextElementSibling;
      while (v && !v.classList.contains("k")) { vals.push((v.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 220)); v = v.nextElementSibling; }
      rows.push({ sec, label: (k.textContent ?? "").trim().replace(/\s+/g, " "), vals });
    }
    const missing = [...root.querySelectorAll("td[data-rpt-missing]")].map((c) => ({
      sec: c.closest("[data-sec]")?.getAttribute("data-sec") ?? "", label: c.getAttribute("data-rpt-missing-label"), source: c.getAttribute("data-rpt-missing-source"),
      row: (c.closest("tr")?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 160),
    }));
    const imgs = [...root.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "");
    const slotEls = [...root.querySelectorAll("image-slot")];
    const slots = slotEls.map((s) => !!(s.getAttribute("src") ?? "").trim());
    window.__slotSecs = slotEls.map((s) => `${s.closest("[data-sec]")?.getAttribute("data-name") ?? "?"}:${(s.getAttribute("src") ?? "").trim() ? 1 : 0}`);
    const text = root.innerText;
    const broken = [...new Set((text.match(/[^\n]{0,40}(NaN|undefined|null|Invalid Date)[^\n]{0,40}/g) ?? []))];
    return { rows, missing, imgCount: imgs.filter(Boolean).length, slotCount: slots.length, slotFilled: slots.filter(Boolean).length, broken, text };
  });
  fs.writeFileSync(`${R.OUT}/${label}-text.txt`, out.text);
  fs.writeFileSync(`${R.OUT}/${label}-cells.json`, JSON.stringify({ rows: out.rows, missing: out.missing, broken: out.broken, imgCount: out.imgCount, slots: [out.slotCount, out.slotFilled] }, null, 1));
  await page.screenshot({ path: `${R.OUT}/${label}-top.png` });
  await ctx.close();
  S[label] = { rows: out.rows.length, red: out.missing.length, redCells: out.missing.map((m) => `${m.sec}|${m.label}|${m.source}`), imgs: out.imgCount, slots: [out.slotCount, out.slotFilled], broken: out.broken };
  R.log(`  ${label}: ${out.rows.length} rows, ${out.missing.length} red, ${out.imgCount} images, slots ${out.slotFilled}/${out.slotCount}, broken=${JSON.stringify(out.broken)}`);
  R.save();
  return out;
}

/** The appraiser clicks «اعتماد التقرير» on his report tab (the browser builds the approved copy). */
export async function approveInUi(R) {
  const { S } = R;
  const { ctx, page } = await openReport("abdullah", S.appraisal);
  const bar = page.locator('[data-testid="report-draft-approval-bar"]');
  await bar.waitFor({ timeout: 60000 });
  await bar.getByRole("button", { name: "اعتماد التقرير" }).click();
  const dlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
  await dlg.waitFor({ timeout: 20000 });
  // confirmIgnoringDoubleClick ignores clicks for 500 ms after the dialog opens.
  await page.waitForTimeout(1500);
  await dlg.getByRole("button", { name: "اعتماد التقرير" }).click();
  const done = page.locator('[data-testid="report-awaiting-deposit"]');
  try {
    await done.waitFor({ timeout: 240000 });
  } catch (e) {
    const t = await bar.innerText().catch(() => "");
    await page.screenshot({ path: `${R.OUT}/approve-failed.png` });
    await ctx.close();
    throw new Error(`approve did not finish: ${t.slice(0, 600)}`);
  }
  await ctx.close();
  R.log("  abdullah approved the report in the UI");
}

/** Text of the property page's «الرفع على إنفاذ» tab as the specialist sees it. */
export async function enfazTab(R, label = "enfaz-tab") {
  const { S } = R;
  const { ctx, page } = await pageAs("osama");
  await page.goto(`${BASE}/po/${encodeURIComponent(S.po)}/property/${S.propertyId}?tab=enfath-upload`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(25000);
  const text = await page.locator("main").innerText().catch(async () => page.locator("body").innerText());
  fs.writeFileSync(`${R.OUT}/${label}.txt`, text);
  await page.screenshot({ path: `${R.OUT}/${label}.png`, fullPage: true });
  await ctx.close();
  return text;
}

// ── report cycle ──────────────────────────────────────────────────────────────────────────────
export async function sendDraft(R, X, note) {
  // The specialist's print choices (attachments printed with the report) — saved while preparing.
  await R.call("osama", "PUT", `/api/valuation-requests/${R.S.vr}/report-draft/choices`, { choices: { printAttachmentKeys: R.S.survey ? ["deed", "survey"] : ["deed"] } }, { allow: [400, 409] });
  // Review flow (2026-11-08): review approves the study and accepts the value before issuing the draft.
  await R.call("osama", "POST", `/api/case-study-reports/${R.S.parent}/approve-study`, {}, { allow: [400, 409] });
  await R.call("osama", "POST", `/api/party-task-submissions/${R.S.appraisal}/accept`, {}, { allow: [400, 409] });
  return R.call("osama", "POST", `/api/valuation-requests/${R.S.vr}/report-draft/send`, { conformityConfirmed: true, note: note ?? `راجعت التقييم مع دراسة العقار — ${X.tag}` });
}

export async function deposit(R, X, code) {
  const { S, call } = R;
  S.depositCode = code ?? `QM${X.tag}${Date.now().toString().slice(-7)}`;
  const t0 = Date.now();
  const res = await fetch(`${API}/api/valuation-requests/${S.vr}/report-issuance/certificate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await tok("osama")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ depositCode: S.depositCode, certificateFileName: `certificate-${X.tag}.pdf`, certificateContentType: "application/pdf", certificateContentBase64: CERT_PDF }),
    signal: AbortSignal.timeout(300000),
  });
  const text = await res.text();
  S.steps.push({ at: new Date().toISOString(), user: "osama", method: "POST", path: `/api/valuation-requests/${S.vr}/report-issuance/certificate`, status: res.status, ...(res.ok ? {} : { body: text.slice(0, 700) }) });
  R.log(`  osama POST deposit certificate → ${res.status} in ${Math.round((Date.now() - t0) / 1000)}s ${res.ok ? "" : text.slice(0, 500)}`);
  if (!res.ok) throw new Error(`deposit → ${res.status} ${text.slice(0, 500)}`);
  R.save();
  return JSON.parse(text);
}

export async function finalPdf(R, X, label = "final") {
  const { S, call } = R;
  let buf = null;
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${API}/api/valuation-requests/${S.vr}/report-draft/final-report`, { headers: { Authorization: `Bearer ${await tok("osama")}` } });
    if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); break; }
    if (i % 6 === 3) await call("osama", "POST", `/api/valuation-requests/${S.vr}/report-draft/final-report/generate`, undefined, { allow: [400, 409] });
    await sleep(10000);
  }
  if (!buf) throw new Error("final report PDF never became ready (5 min)");
  fs.writeFileSync(`${R.OUT}/${label}.pdf`, buf);
  fs.mkdirSync("test-results/az30/_py", { recursive: true });
  const txt = execFileSync("python", ["-c", "import sys,pypdf;r=pypdf.PdfReader(sys.argv[1]);print(len(r.pages));print('\\n'.join((p.extract_text() or '') for p in r.pages))", fs.realpathSync(`${R.OUT}/${label}.pdf`)], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: "test-results/az30/_py", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  fs.writeFileSync(`${R.OUT}/${label}-pdf.txt`, txt);
  R.log(`  final PDF ${buf.length} bytes, ${txt.split("\n")[0]} pages`);
  return txt;
}

export async function handover(R, { allow = [] } = {}) {
  // Review flow (2026-11-08): «تجهيز المعاملة للرفع» stamps the deed before the handover.
  await R.call("osama", "POST", `/api/work-orders/${R.S.workOrderId}/properties/${R.S.propertyId}/transaction-state/ready-for-upload`, undefined, { allow: [400, 409] });
  return R.call("osama", "POST", `/api/work-orders/${R.S.workOrderId}/properties/${R.S.propertyId}/transaction-state/enfaz-handover`, undefined, { allow });
}

export async function timeline(R, label = "timeline") {
  const { S, call } = R;
  const t = await call("osama", "GET", `/api/work-orders/${encodeURIComponent(S.po)}/properties/${S.propertyId}/timeline`, undefined, { quiet: true });
  fs.writeFileSync(`${R.OUT}/${label}.json`, JSON.stringify(t, null, 1));
  const items = Array.isArray(t) ? t : (t?.items ?? t?.events ?? []);
  S.timelineCount = items.length;
  R.save();
  return items;
}

// ── independent recompute (from test-results/audit-2026-11-04/check-valuations.mjs) ─────────────
const num = (v) => Number(String(v ?? "").replace(/[,٬\s]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) || 0;
const near = (a, b, tol = 1.01) => Math.abs(a - b) <= tol;
const roundTo = (v, d) => { const f = 10 ** d; return Math.round(v / f) * f; };

export async function recompute(R, reportText) {
  const { S, call } = R;
  const g = (p) => call("abdullah", "GET", p, undefined, { quiet: true, allow: [404] });
  const recon = await g(`/api/valuation-requests/${S.vr}/reconciliation`);
  const market = await g(`/api/valuation-requests/${S.vr}/comparable-selections?selectionContext=market`);
  const land = await g(`/api/valuation-requests/${S.vr}/comparable-selections?selectionContext=land_within_cost`);
  const cost = await g(`/api/valuation-requests/${S.vr}/cost-approach`);
  const issues = [];
  const table = (sel, label) => {
    if (!sel || !sel.adoptedCount) return null;
    const adopted = sel.items.filter((i) => i.isAdopted && i.market);
    let sum = 0, wsum = 0;
    for (const i of adopted) {
      const m = i.market;
      const base = sel.adjustmentBasis === "whole_property" ? i.effectivePriceSar : i.effectivePriceSar / (i.effectiveAreaSqm || 1);
      // Sequential factors compound one after another (financing → market → transaction type); the differences add up.
      const seq = (m.adjustmentLines ?? []).filter((l) => l.isIncluded && ["financing", "market", "transaction_type"].includes(l.factorKey));
      const afterSeq = seq.length ? seq.reduce((v, l) => v * (1 + (l.percent ?? 0) / 100), base) : base * (1 + m.sumSequentialPct / 100);
      const afterDiff = afterSeq * (1 + m.sumDifferencePct / 100);
      if (!near(afterDiff, m.pricePerSqmAfterDifference, Math.max(0.02, afterDiff * 1e-5))) issues.push(`${label}: comparable after adjustments ${m.pricePerSqmAfterDifference} ≠ recomputed ${afterDiff.toFixed(2)}`);
      sum += m.pricePerSqmAfterDifference * m.effectiveWeightPct / 100; wsum += m.effectiveWeightPct;
    }
    if (!near(wsum, 100, 0.01)) issues.push(`${label}: weights sum ${wsum}`);
    const opinion = sel.adjustmentBasis === "whole_property" ? sum : sum * (sel.subjectAreaSqm ?? 0);
    return { opinion, server: sel.marketOpinionValueRaw };
  };
  const mk = table(market, "market");
  if (mk && !near(mk.opinion, mk.server, Math.max(1, mk.opinion * 1e-5))) issues.push(`market opinion server ${mk.server} ≠ recomputed ${mk.opinion.toFixed(2)}`);
  const ld = table(land, "land");
  if (cost?.isSaved && (cost.lines ?? []).length) {
    let direct = 0;
    for (const l of cost.lines.filter((x) => x.isIncluded)) {
      const lt = l.areaSqm * (l.effectiveUnitCostSar ?? l.unitCostSar);
      if (!near(lt, l.lineTotal, 1)) issues.push(`cost line «${l.label}» ${l.lineTotal} ≠ ${lt}`);
      direct += l.lineTotal;
    }
    if (!near(direct, cost.directCostTotal, 1)) issues.push(`direct ${cost.directCostTotal} ≠ ${direct}`);
    const indirectPct = (cost.indirectItems ?? []).reduce((a, i) => a + i.pct, 0) + cost.financingPct;
    if (!near(indirectPct, cost.indirectRatesSumPct, 0.01)) issues.push(`indirect % ${cost.indirectRatesSumPct} ≠ ${indirectPct}`);
    const total = cost.directCostTotal * (1 + cost.indirectRatesSumPct / 100);
    if (!near(total, cost.totalCostWithIndirect, 1)) issues.push(`total cost ${cost.totalCostWithIndirect} ≠ ${total}`);
    const life = cost.effectiveLifeYears || 0;
    const phys = life > 0 ? (cost.actualAgeYears ?? 0) / life * 100 : 0;
    if (cost.physicalObsolescencePct != null && !near(phys, cost.physicalObsolescencePct, 0.01)) issues.push(`physical % ${cost.physicalObsolescencePct} ≠ ${phys} (age ${cost.actualAgeYears} / life ${life})`);
    const applied = Math.min(100, (cost.physicalObsolescencePct ?? 0) + cost.functionalObsolescencePct + cost.externalObsolescencePct);
    if (!near(applied, cost.appliedObsolescencePct, 0.01)) issues.push(`applied obsolescence ${cost.appliedObsolescencePct} ≠ ${applied}`);
    const dep = cost.totalCostWithIndirect * cost.appliedObsolescencePct / 100;
    if (!near(dep, cost.depreciationValue, 1)) issues.push(`depreciation ${cost.depreciationValue} ≠ ${dep}`);
    const bld = cost.totalCostWithIndirect - cost.depreciationValue;
    if (!near(bld, cost.buildingsValueAfterDepreciation, 1)) issues.push(`buildings ${cost.buildingsValueAfterDepreciation} ≠ ${bld}`);
    const landValue = cost.costScopeKey === "building_only" ? 0 : cost.landValueFromMarket;
    if (ld && cost.costScopeKey !== "building_only") {
      const area = cost.apartmentLandShareSqm > 0 ? cost.apartmentLandShareSqm : cost.landAreaSqm;
      const lv = cost.landUnitRateAfterDiscount * area;
      if (!near(lv, cost.landValueFromMarket, 1)) issues.push(`land value ${cost.landValueFromMarket} ≠ rate×area ${lv}`);
    }
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
  let printed = {};
  if (reportText) {
    const grab = (re) => { const m = reportText.match(re); return m ? num(m[1]) : null; };
    printed = {
      market: grab(/القيمة بطريقة المقارنة\t([\d,٬.٠-٩]+)/),
      cost: grab(/ناتج أسلوب التكلفة \(الأرض \+ المباني\)\t([\d,٬.٠-٩]+)/) ?? grab(/ناتج أسلوب التكلفة[^\t\n]*\t([\d,٬.٠-٩]+)/),
      weighted: grab(/القيمة المرجّحة\t([\d,٬.٠-٩]+)/),
      afterLiq: grab(/القيمة بعد خصم التصفية[^\t\n]*\t([\d,٬.٠-٩]+)/),
      final: grab(/القيمة النهائية للعقار\n([\d,٬.٠-٩]+) ر\.س\./) ?? grab(/القيمة النهائية الإجمالية\n([\d,٬.٠-٩]+) ر\.س\./),
    };
    const cmp = (label, p, s) => { if (p != null && s != null && !near(p, Math.round(s), 1)) issues.push(`REPORT ${label} prints ${p}, server ${s}`); };
    cmp("market", printed.market, market?.adoptedCount ? market.marketOpinionValue : null);
    cmp("cost", printed.cost, cost?.isSaved && cost.lines?.length ? cost.costOpinionWithLand : null);
    cmp("weighted", printed.weighted, recon.weightedValue);
    if (recon.liquidationDiscountApplied) cmp("after liquidation", printed.afterLiq, recon.propertyValueAfterLiquidation);
    cmp("final", printed.final, recon.finalOpinionValue);
    if (printed.final == null) issues.push("REPORT final value not found");
  }
  const row = { final: recon.finalOpinionValue, weighted: recon.weightedValue, additions: recon.additionsTotal, methods: recon.methods.filter((m) => m.isIncluded).map((m) => `${m.approachKind} ${m.weightPct}%`).join(" + "), liquidation: recon.liquidationDiscountApplied ? recon.liquidationDiscountPct : 0, market: market?.marketOpinionValue, cost: cost?.costOpinionWithLand, printed, issues };
  S.recompute = row;
  R.save();
  R.log(`  recompute: final=${row.final} [${row.methods}] printed=${JSON.stringify(printed)} ${issues.length ? "ISSUES " + JSON.stringify(issues) : "OK"}`);
  return row;
}
