/**
 * Seed the real Medina/Zulfi land pack through API, stop before المقيم.
 *
 * Pack: Downloads/560654006201 & 940115012718/{deed}/
 * Roles: specialist → inspector → engineering office → specialist accept
 * Leaves property-appraisal open for عبدالله.
 */
import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:5160";
const PACK_ROOT =
  process.env.PACK_ROOT ??
  "C:\\Users\\omar bamusa\\Downloads\\560654006201 & 940115012718";

const PHONES = {
  osama: "500000004",
  ahmed: "500000008",
  jeddah_survey: "500000011",
};

const ASSIGNEE_IDS = {
  fieldInspector: "fi-ahmed",
  appraiser: "val-abdullah",
  engineeringOffice: "eo-jeddah",
  caseSpecialist: "cs-osama",
};

const ASSIGNEE_NAMES = {
  fieldInspector: "أحمد سعيد",
  appraiser: "عبدالله الكثيري",
  engineeringOffice: "مكتب جدة للمساحة",
  caseSpecialist: "أسامة الصالحي",
};

const INFATH_CLIENT_ID = "a1000001-0000-4000-8000-000000000001";

const DEEDS = [
  {
    deedNumber: "940115012717",
    folder: "940115012717",
    ownerName: "زكريا عمير جارالله الزارع",
    city: "المدينة المنورة",
    region: "منطقة المدينة المنورة",
    district: "طيبة",
    area: "333.75",
    planNumber: "811/ت/1417",
    plotNumber: "883-1",
    lat: "24.4672",
    lng: "39.6111",
    court: "محكمة التنفيذ بالمدينة المنورة",
    boundaries: {
      north: "قطعة 882 شارع مسلمة بن أمية",
      northLen: "26.70",
      south: "قطعة 883/2 شارع مسلمة بن أمية",
      southLen: "26.70",
      east: "شارع مسلمة بن أمية عرض 14م",
      eastLen: "12.50",
      west: "قطعة 26 شارع بسرة بنت صفوان",
      westLen: "12.50",
    },
  },
  {
    deedNumber: "560654006201",
    folder: "560654006201",
    ownerName: "صالح علي عبدالعزيز العبيد",
    city: "الزلفي",
    region: "منطقة الرياض",
    district: "النهضة",
    area: "625",
    planNumber: "583",
    plotNumber: "884",
    lat: "26.2994",
    lng: "44.8151",
    court: "محكمة التنفيذ بالزلفي",
    boundaries: {
      north: "قطعة 882",
      northLen: "25",
      south: "قطعة 886",
      southLen: "25",
      east: "موقف + شارع عرض 30م",
      eastLen: "25",
      west: "قطعة 883",
      westLen: "25",
    },
  },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mimeFor(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}

function readBase64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => exts.includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(dir, name));
}

async function login(username) {
  const phone = PHONES[username];
  for (const route of ["/api/auth/login", "/api/auth/login-username"]) {
    const res = await fetch(`${API_BASE}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: phone }),
    });
    if (!res.ok) continue;
    const body = await res.json();
    if (body.token) return body.token;
  }
  throw new Error(`login failed for ${username}`);
}

async function api(token, method, route, body) {
  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${route} -> HTTP ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`,
    );
  }
  return json;
}

async function uploadFile(token, { scope, scopeKey, filePath }) {
  const fileName = path.basename(filePath);
  const contentType = mimeFor(fileName);
  const contentBase64 = readBase64(filePath);
  return api(token, "POST", "/api/attachments", {
    scope,
    scopeKey,
    fileName,
    contentType,
    contentBase64,
  });
}

function firstExisting(dir, candidates) {
  for (const name of candidates) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

async function uploadPropertyDocs(token, poNumber, propertyId, deed) {
  const root = path.join(PACK_ROOT, deed.folder);
  const sk = `${poNumber}:${propertyId}`;
  const pairs = [
    {
      scope: "property-deed-ownership",
      file: firstExisting(root, [
        `${deed.deedNumber} صك.png`,
        `${deed.deedNumber} صك.jpg`,
      ]),
    },
    {
      scope: "property-boundaries",
      file: firstExisting(root, [
        `${deed.deedNumber} بلدي.png`,
        `${deed.deedNumber} يو ماب.png`,
        "مخطط.png",
      ]),
    },
    {
      scope: "property-bourse-deed",
      file: firstExisting(path.join(root, "مستندات التكليف"), [
        `البورصة العقارية _ Real Estate Market ${deed.deedNumber}.pdf`,
      ]),
    },
  ];

  const assignmentDir = path.join(root, "مستندات التكليف");
  const assignmentPdfs = listFiles(assignmentDir, [".pdf"]).filter(
    (f) => !path.basename(f).includes("البورصة"),
  );
  if (assignmentPdfs[0]) {
    pairs.push({ scope: "property-decree", file: assignmentPdfs[0] });
  }
  if (assignmentPdfs[1]) {
    pairs.push({ scope: "property-delegation", file: assignmentPdfs[1] });
  }

  for (const { scope, file } of pairs) {
    if (!file) continue;
    process.stdout.write(`    upload ${scope}: ${path.basename(file)}\n`);
    await uploadFile(token, { scope, scopeKey: sk, filePath: file });
  }
}

async function submitLandInspection(token, taskId, deed) {
  const exteriorDir = path.join(PACK_ROOT, deed.folder, "صور خارجية");
  const exteriors = listFiles(exteriorDir, [".jpg", ".jpeg", ".png"]).slice(
    0,
    6,
  );
  const freePhotos = [];
  for (const [i, filePath] of exteriors.entries()) {
    const photoId = i + 1;
    const meta = await uploadFile(token, {
      scope: "field-inspection-photo",
      scopeKey: `${taskId}:free:${photoId}`,
      filePath,
    });
    freePhotos.push({
      id: photoId,
      fileName: path.basename(filePath),
      mimeType: mimeFor(filePath),
      attachmentId: meta.id,
      category: "خارجية",
      approved: true,
    });
    process.stdout.write(`    inspection photo ${photoId}/${exteriors.length}\n`);
  }

  await api(token, "PUT", `/api/party-task-submissions/${taskId}`, {
    payload: {
      inspectionDate: today(),
      inspectionTime: "10:30",
      mapLatitude: deed.lat,
      mapLongitude: deed.lng,
      accessContactName: deed.ownerName,
      accessContactPhone: "0501234567",
      accessContactRole: "المالك",
      accessRouteDescription: `مدخل من الشارع — ${deed.district}`,
      inspectionConfirmed: true,
      vacantLand: true,
      keyAvailable: true,
      hasAnnex: "لا",
      showroomCount: "",
      wellCount: "",
      featureValues: {
        assetSubject: "أرض",
        propertyUsage: "سكني",
        districtState: "متوسط",
        movables: "لا",
      },
      featurePhotoAttachments: {},
      componentPhotoAttachments: { showroom: null, well: null },
      observations: [],
      services: [],
      amenities: [],
      definedPhotos: {},
      freePhotos,
    },
  });
  await api(token, "POST", `/api/party-task-submissions/${taskId}/submit`);
}

function yesChecklist() {
  return Array.from({ length: 13 }, (_, i) => ({
    answer: "yes",
    note: i === 7 ? "أرض فضاء" : "",
  }));
}

async function submitSurvey(token, taskId, deed) {
  const surveyDir = path.join(PACK_ROOT, deed.folder, "التقرير المساحي");
  const report =
    firstExisting(surveyDir, [
      `المعدل ${deed.deedNumber}.pdf`,
      `${deed.deedNumber}.pdf`,
    ]) ?? listFiles(surveyDir, [".pdf"])[0];
  if (!report) throw new Error(`No survey PDF for ${deed.deedNumber}`);

  const meta = await uploadFile(token, {
    scope: "engineering-survey-report",
    scopeKey: `${taskId}:survey-report`,
    filePath: report,
  });
  process.stdout.write(`    survey report: ${path.basename(report)}\n`);

  await api(token, "PUT", `/api/party-task-submissions/${taskId}`, {
    payload: {
      latitude: deed.lat,
      longitude: deed.lng,
      surveyReportFileName: path.basename(report),
      surveyReportAttachment: {
        attachmentId: meta.id,
        fileName: path.basename(report),
        mimeType: "application/pdf",
      },
      siteLetterFileName: "",
      siteConfirmed: true,
      declarationPhoneSatisfied: true,
      deedMatchesNature: "yes",
      onSiteAreaSqm: deed.area,
      northBoundary: deed.boundaries.north,
      northBoundaryLengthM: deed.boundaries.northLen,
      southBoundary: deed.boundaries.south,
      southBoundaryLengthM: deed.boundaries.southLen,
      eastBoundary: deed.boundaries.east,
      eastBoundaryLengthM: deed.boundaries.eastLen,
      westBoundary: deed.boundaries.west,
      westBoundaryLengthM: deed.boundaries.westLen,
      natureOnSiteAreaSqm: "",
      natureNorthBoundary: "",
      natureNorthBoundaryLengthM: "",
      natureSouthBoundary: "",
      natureSouthBoundaryLengthM: "",
      natureEastBoundary: "",
      natureEastBoundaryLengthM: "",
      natureWestBoundary: "",
      natureWestBoundaryLengthM: "",
      surveyNotes: "رفع مساحي من حزمة المستندات الحقيقية",
      transactionNote: "",
      checklist: yesChecklist(),
    },
  });
  await api(token, "POST", `/api/party-task-submissions/${taskId}/submit`);
}

async function distributeOne(token, poNumber, propertyId, deedNumber) {
  await api(token, "POST", "/api/workflow-tasks/sync");
  const tasks = await api(
    token,
    "GET",
    `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`,
  );
  const parent =
    tasks.find(
      (t) => t.kind === "case-study-property" && t.propertyId === propertyId,
    ) ??
    tasks
      .filter((t) => t.kind === "case-study-property" && !t.propertyId)
      .sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  if (!parent) throw new Error(`No case-study slot for ${deedNumber}`);

  await api(token, "POST", `/api/workflow-tasks/${parent.id}/advance-after-enfath`, {
    propertyId,
    identifierType: "deed",
    bourseDataCompleted: false,
    deedNumber,
  });

  await api(
    token,
    "PUT",
    `/api/work-orders/${encodeURIComponent(poNumber)}/properties/${propertyId}/bourse`,
    {
      city: DEEDS.find((d) => d.deedNumber === deedNumber).city,
      region: DEEDS.find((d) => d.deedNumber === deedNumber).region,
      district: DEEDS.find((d) => d.deedNumber === deedNumber).district,
      classification: "أرض",
      propertyType: "أرض",
      area: DEEDS.find((d) => d.deedNumber === deedNumber).area,
      deedStatus: "سليم",
      bourseDeedImageFileName: `${deedNumber}-bourse.pdf`,
      planNumber: DEEDS.find((d) => d.deedNumber === deedNumber).planNumber,
      plotNumber: DEEDS.find((d) => d.deedNumber === deedNumber).plotNumber,
    },
  );

  await api(token, "POST", `/api/workflow-tasks/${parent.id}/advance-after-bourse`, {
    deedNumber,
  });

  await api(token, "POST", `/api/workflow-tasks/${parent.id}/confirm-distribution`, {
    deedNumber,
    distribution: {
      governmentAuditor: false,
      governmentAuditorId: "",
      valuationDepartment: true,
      operationsCoordinatorId: "",
      inspectorId: ASSIGNEE_IDS.fieldInspector,
      valuatorId: ASSIGNEE_IDS.appraiser,
      engineeringOffice: true,
      engineeringOfficeId: ASSIGNEE_IDS.engineeringOffice,
      caseSpecialist: true,
      caseSpecialistId: ASSIGNEE_IDS.caseSpecialist,
    },
    assigneeNames: {
      "field-inspection": ASSIGNEE_NAMES.fieldInspector,
      "engineering-survey": ASSIGNEE_NAMES.engineeringOffice,
      "property-appraisal": ASSIGNEE_NAMES.appraiser,
    },
  });

  const after = await api(
    token,
    "GET",
    `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`,
  );
  const forProperty = after.filter((t) => t.propertyId === propertyId);
  const pick = (kind) => {
    const found = forProperty.find((t) => t.kind === kind);
    if (!found) throw new Error(`Missing ${kind} for ${deedNumber}`);
    return found;
  };
  return {
    parent: pick("case-study-property"),
    fieldInspection: pick("field-inspection"),
    engineeringSurvey: pick("engineering-survey"),
    propertyAppraisal: pick("property-appraisal"),
  };
}

async function main() {
  console.log(`API ${API_BASE}`);
  console.log(`Pack ${PACK_ROOT}`);

  const osama = await login("osama");
  const ahmed = await login("ahmed");
  const survey = await login("jeddah_survey");

  const poNumber = `LAND-${Date.now().toString().slice(-8)}`;
  console.log(`\n▶ Creating PO ${poNumber} (2 properties)\n`);

  await api(osama, "DELETE", "/api/po-intake-draft/mine").catch(() => null);
  await api(osama, "POST", "/api/work-orders", {
    poNumber,
    assignmentType: "تنفيذ",
    promulgationDate: today(),
    assignmentSpecialist: ASSIGNEE_NAMES.caseSpecialist,
    assignmentSpecialistEmail: "osama@ejadah.dev",
    expectedPropertyCount: 2,
    clientId: INFATH_CLIENT_ID,
    properties: [],
  });

  const results = [];
  for (const deed of DEEDS) {
    console.log(`\n══ ${deed.deedNumber} (${deed.city} / ${deed.district}) ══`);
    const created = await api(
      osama,
      "POST",
      `/api/work-orders/${encodeURIComponent(poNumber)}/properties`,
      {
        identifierType: "deed",
        deedNumber: deed.deedNumber,
        hasRequestNumber: false,
        assignmentMandateNumber: `TKF-${deed.deedNumber.slice(-5)}`,
        assignmentMandateDate: today(),
        ownerName: deed.ownerName,
        court: deed.court,
        circuit: "1",
        delegationLetterFileNames: ["delegation.pdf"],
        assignmentDocFileNames: ["assignment.pdf"],
        contacts: [
          { name: deed.ownerName, role: "مالك", phone: "0501234567" },
        ],
        planNumber: deed.planNumber,
        plotNumber: deed.plotNumber,
        area: deed.area,
      },
    );
    const propertyId = created.id;
    console.log(`  property ${propertyId}`);

    console.log("  docs…");
    await uploadPropertyDocs(osama, poNumber, propertyId, deed);

    console.log("  distribute…");
    const parties = await distributeOne(
      osama,
      poNumber,
      propertyId,
      deed.deedNumber,
    );

    console.log("  inspector (أحمد)…");
    await submitLandInspection(ahmed, parties.fieldInspection.id, deed);
    await api(
      osama,
      "POST",
      `/api/party-task-submissions/${parties.fieldInspection.id}/accept`,
    );

    console.log("  survey (مكتب جدة)…");
    await submitSurvey(survey, parties.engineeringSurvey.id, deed);
    try {
      await api(
        osama,
        "POST",
        `/api/party-task-submissions/${parties.engineeringSurvey.id}/accept`,
      );
      console.log("  survey accepted");
    } catch (err) {
      console.warn(
        `  survey accept skipped (likely pricing): ${String(err.message).slice(0, 160)}`,
      );
    }

    results.push({
      deedNumber: deed.deedNumber,
      propertyId,
      appraisalTaskId: parties.propertyAppraisal.id,
      inspectionTaskId: parties.fieldInspection.id,
      surveyTaskId: parties.engineeringSurvey.id,
    });
  }

  console.log("\n════════════════════════════════════════");
  console.log("DONE — stopped before المقيم");
  console.log(`PO: ${poNumber}`);
  for (const row of results) {
    console.log(
      `  صك ${row.deedNumber} → /po/${encodeURIComponent(poNumber)}/property/${row.propertyId}`,
    );
    console.log(
      `    تقييم: /active-appraisal/${row.appraisalTaskId}  (عبدالله الكثيري)`,
    );
  }
  console.log("Login as عبدالله (500000007) to continue appraisal.");
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message || err);
  process.exit(1);
});
