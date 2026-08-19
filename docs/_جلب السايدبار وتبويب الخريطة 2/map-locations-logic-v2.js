// ═══════════════════════════════════════════════════════════════════
// منطق خريطة المواقع المدروسة — الإصدار 2.0 · 2026-08-16
// طبقة منطق نقية: لا DOM، لا ألوان، لا أيقونات — المرجع: system-spec-v1.md §8ج
// ═══════════════════════════════════════════════════════════════════

export const POINT_FAMILIES = { property: "عقارات النظام", comparable: "مقارنات السوق" };

export const LAYERS = {
  active:      { key: "active",      label: "أوامر العمل النشطة", family: "property",   defaultOn: true  },
  archive:     { key: "archive",     label: "الأرشيف (المغلق)",   family: "property",   defaultOn: false },
  comparables: { key: "comparables", label: "مقارنات السوق",      family: "comparable", defaultOn: false },
};

// النشط = لا closedDate. الحالة المهنية معلومة وصفية لا أساس الطبقات.
export function isActive(r) { return !r.closedDate; }
export function emphasisFlag(r) { return isActive(r); }

export const WORKFLOW_STATUS = {
  in_progress:          { key: "in_progress",          label: "قيد العمل" },
  issued:               { key: "issued",               label: "صادر" },
  infeasible_candidate: { key: "infeasible_candidate", label: "مرشح تعذر" },
  infeasible:           { key: "infeasible",           label: "متعذر" },
};

export const REPORT_VALIDITY_DAYS = 90;
export function isReportExpired(r, now = new Date()) {
  if (r.workflowStatus !== "issued" || !r.issueDate) return false;
  const expiry = new Date(r.issueDate);
  expiry.setDate(expiry.getDate() + REPORT_VALIDITY_DAYS);
  return now > expiry;
}

function hasCoords(r) { return r.coords && r.coords.lat != null && r.coords.lng != null; }

export function partitionProperties(records) {
  const active = [], archive = [];
  let activeNoCoords = 0, archiveNoCoords = 0;
  for (const r of records) {
    if (isActive(r)) hasCoords(r) ? active.push(r) : activeNoCoords++;
    else hasCoords(r) ? archive.push(r) : archiveNoCoords++;
  }
  return { active, archive, activeNoCoords, archiveNoCoords };
}

export function resolveDateRange(preset, now = new Date()) {
  switch (preset) {
    case "90d": { const from = new Date(now); from.setDate(from.getDate() - 90); return { from, to: now }; }
    case "1y":  { const from = new Date(now); from.setFullYear(from.getFullYear() - 1); return { from, to: now }; }
    case "2025": return { from: new Date("2025-01-01"), to: new Date("2025-12-31T23:59:59") };
    case "2026": return { from: new Date("2026-01-01"), to: new Date("2026-12-31T23:59:59") };
    default: return { from: null, to: null };
  }
}

function normalize(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
}

function inRange(d, range) {
  if (!range.from && !range.to) return true;
  if (!d) return false;
  const t = new Date(d);
  if (range.from && t < range.from) return false;
  if (range.to && t > range.to) return false;
  return true;
}

export function filterProperties(records, criteria = {}, now = new Date()) {
  const c = criteria;
  let range = { from: c.dateFrom || null, to: c.dateTo || null };
  if (!range.from && !range.to && c.datePreset && c.datePreset !== "all")
    range = resolveDateRange(c.datePreset, now);
  const q = c.query ? normalize(c.query) : null;
  return records.filter(r => {
    if (c.city && r.city !== c.city) return false;
    if (c.propertyType && r.propertyType !== c.propertyType) return false;
    if (c.assignmentType && r.assignmentType !== c.assignmentType) return false;
    if (c.workflowStatuses && c.workflowStatuses.length && !c.workflowStatuses.includes(r.workflowStatus)) return false;
    if (c.expiredOnly && !isReportExpired(r, now)) return false;
    if (!inRange(r.valuationDate || r.openedDate, range)) return false;
    if (q && !normalize([r.deedNo, r.refNo, r.district, r.client, r.city].join(" ")).includes(q)) return false;
    return true;
  });
}

export function filterComparables(comparables, criteria = {}, now = new Date()) {
  const c = criteria;
  let range = { from: c.dateFrom || null, to: c.dateTo || null };
  if (!range.from && !range.to && c.datePreset && c.datePreset !== "all")
    range = resolveDateRange(c.datePreset, now);
  const q = c.query ? normalize(c.query) : null;
  return comparables.filter(x => {
    if (c.city && x.city !== c.city) return false;
    if (c.comparableType && x.comparableType !== c.comparableType) return false;
    if (c.operationType && x.operationType !== c.operationType) return false;
    if (c.approvedOnly && !x.approved) return false;
    if (!inRange(x.operationDate, range)) return false;
    if (q && !normalize([x.refNo, x.district, x.city, x.source, x.description].join(" ")).includes(q)) return false;
    return true;
  });
}

export function countWithoutCoords(list) {
  return list.filter(x => !hasCoords(x)).length;
}

// العقار المجمع: صكوك بـpropertyGroupId مشترك = نقطة واحدة.
export function groupForMap(records) {
  const singles = [], groups = new Map();
  for (const r of records) {
    if (r.propertyGroupId) {
      if (!groups.has(r.propertyGroupId)) groups.set(r.propertyGroupId, []);
      groups.get(r.propertyGroupId).push(r);
    } else singles.push({ kind: "single", record: r, coords: r.coords, active: isActive(r) });
  }
  const grouped = [...groups.values()].map(members => ({
    kind: "group",
    groupId: members[0].propertyGroupId,
    members,
    deedCount: members.length,
    active: members.some(isActive),
    coords: members[0].coords,
  }));
  return [...singles, ...grouped];
}

export function computeStats(properties, comparablesShown = [], now = new Date()) {
  const byStatus = {};
  let issuedValueSum = 0, expiredCount = 0, activeCount = 0;
  const cities = new Set();
  for (const r of properties) {
    byStatus[r.workflowStatus] = (byStatus[r.workflowStatus] || 0) + 1;
    cities.add(r.city);
    if (isActive(r)) activeCount++;
    if (r.workflowStatus === "issued" && typeof r.finalValue === "number") issuedValueSum += r.finalValue;
    if (isReportExpired(r, now)) expiredCount++;
  }
  return {
    total: properties.length, activeCount, archivedCount: properties.length - activeCount,
    byStatus, issuedValueSum, expiredCount, cityCount: cities.size,
    comparablesShown: comparablesShown.length,
  };
}

export function haversineKm(a, b) {
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearbyOf(center, list, radiusKm = 2, excludeId = null) {
  return list
    .filter(x => hasCoords(x) && x.id !== excludeId)
    .map(x => ({ item: x, distanceKm: haversineKm(center, x.coords) }))
    .filter(x => x.distanceKm <= radiusKm)
    .sort((x, y) => x.distanceKm - y.distanceKm);
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}
export function fmtMoney(v) {
  if (v == null) return "-";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ريال";
}

export function propertyCard(r, now = new Date()) {
  return {
    family: "property",
    active: isActive(r),
    workflowStatus: WORKFLOW_STATUS[r.workflowStatus],
    expired: isReportExpired(r, now),
    title: `${r.propertyType} — ${r.district}، ${r.city}`,
    rows: [
      ["الرقم المرجعي", r.refNo],
      ["رقم الصك", r.deedNo],
      ["نوع الصك", r.deedType],
      ["العميل", r.client],
      ["نوع الإسناد", r.assignmentType],
      ["المساحة", r.area != null ? r.area.toLocaleString("en-US") + " م²" : "-"],
      ["تاريخ التقييم", fmtDate(r.valuationDate)],
      ["تاريخ الإصدار", fmtDate(r.issueDate)],
      ["تاريخ الإغلاق", fmtDate(r.closedDate)],
      ["الرأي النهائي للقيمة", r.workflowStatus === "issued" ? fmtMoney(r.finalValue) : "-"],
      ["المقيم", r.valuer || "-"],
      ["مصدر الإحداثيات", r.coordsSource || "-"],
    ],
    actionId: r.id,
  };
}

export function pricePerSqm(c) {
  if (c.price == null || !c.area) return null;
  return c.price / c.area;
}

export function comparableCard(c) {
  const ppsm = pricePerSqm(c);
  return {
    family: "comparable",
    approved: !!c.approved,
    title: `مقارن ${c.comparableType} — ${c.district}، ${c.city}`,
    rows: [
      ["الرقم المرجعي", c.refNo],
      ["نوع العملية", c.operationType],
      ["وصف السعر", c.operationType === "عرض" ? (c.priceDescription || "-") : "-"],
      ["تاريخ العملية", fmtDate(c.operationDate)],
      ["السعر", fmtMoney(c.price)],
      ["سعر المتر (محسوب)", ppsm != null ? fmtMoney(Math.round(ppsm)) : "-"],
      ["المساحة", c.area != null ? c.area.toLocaleString("en-US") + " م²" : "-"],
      ["المصدر", c.source || "-"],
      ["الوصف", c.description || "-"],
    ],
    actionId: c.id,
  };
}

// بيانات تجريبية (معاينة فقط — النظام يبدأ فارغًا)
export const SEED_PROPERTIES = [
  { id: "T-0103", refNo: "EJD-2026-0103", deedNo: "310112009914", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "الرياض", district: "اليرموك", area: 900, client: "شركة أملاك الأولى", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-08-02", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7791, lng: 46.8291 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0104", refNo: "EJD-2026-0104", deedNo: "310112003308", deedType: "تقليدي", propertyType: "أرض تجارية", city: "الرياض", district: "القيروان", area: 1200, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible_candidate", openedDate: "2026-07-20", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. فهد الشمري", coords: { lat: 24.8556, lng: 46.5893 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0108", refNo: "EJD-2026-0108", deedNo: "310112006650", deedType: "سجل عيني", propertyType: "فيلا", city: "الرياض", district: "الشفا", area: 400, client: "البنك الأهلي", assignmentType: "بنك", workflowStatus: "in_progress", openedDate: "2026-08-10", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. سارة الدوسري", coords: { lat: 24.5566, lng: 46.7107 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0112", refNo: "EJD-2026-0112", deedNo: "310112007070", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "الرياض", district: "الرمال", area: 570, client: "نورة القحطاني", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-07-25", valuationDate: "2026-08-01", issueDate: "2026-08-04", closedDate: null, finalValue: 1420000, valuer: "م. سارة الدوسري", coords: { lat: 24.7960, lng: 46.8666 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0109", refNo: "EJD-2026-0109", deedNo: "310112005521", deedType: "تقليدي", propertyType: "عمارة تجارية", city: "الرياض", district: "النسيم الشرقي", area: 800, client: "شركة تطوير الشرق", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-07-01", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7455, lng: 46.8419 }, coordsSource: "ميداني", propertyGroupId: "G-11" },
  { id: "T-0110", refNo: "EJD-2026-0110", deedNo: "310112005522", deedType: "تقليدي", propertyType: "عمارة تجارية", city: "الرياض", district: "النسيم الشرقي", area: 760, client: "شركة تطوير الشرق", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-07-15", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7455, lng: 46.8419 }, coordsSource: "ميداني", propertyGroupId: "G-11" },
  { id: "T-0203", refNo: "EJD-2026-0203", deedNo: "420334009917", deedType: "تقليدي", propertyType: "أرض تجارية", city: "جدة", district: "السلامة", area: 1500, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-05", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. عمر باناجه", coords: { lat: 21.6001, lng: 39.1435 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0205", refNo: "EJD-2026-0205", deedNo: "420334002950", deedType: "تقليدي", propertyType: "أرض سكنية", city: "جدة", district: "النعيم", area: 450, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible_candidate", openedDate: "2026-07-28", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. ماجد الزهراني", coords: { lat: 21.6280, lng: 39.1230 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0302", refNo: "EJD-2026-0302", deedNo: "530221008812", deedType: "تقليدي", propertyType: "مستودع", city: "الدمام", district: "المنطقة الصناعية الثانية", area: 5000, client: "شركة لوجستيات الخليج", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-08-09", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. حسن العلي", coords: { lat: 26.3541, lng: 50.0322 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0402", refNo: "EJD-2026-0402", deedNo: "440556008833", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "مكة المكرمة", district: "الشوقية", area: 800, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-12", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. تركي السبيعي", coords: { lat: 21.3705, lng: 39.7960 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0502", refNo: "EJD-2026-0502", deedNo: "470889002626", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "أبها", district: "المنسك", area: 610, client: "بنك الرياض", assignmentType: "بنك", workflowStatus: "in_progress", openedDate: "2026-08-03", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. ناصر الحربي", coords: { lat: 18.2300, lng: 42.5060 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0601", refNo: "EJD-2026-0601", deedNo: "310112009999", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "طويق", area: 500, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-14", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. فهد الشمري", coords: null, coordsSource: null, propertyGroupId: null },
  { id: "T-0101", refNo: "EJD-2026-0101", deedNo: "310112004512", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "الرياض", district: "النرجس", area: 750, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2026-05-02", valuationDate: "2026-05-10", issueDate: "2026-05-14", closedDate: "2026-05-20", finalValue: 2810000, valuer: "م. خالد العتيبي", coords: { lat: 24.8419, lng: 46.6580 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0102", refNo: "EJD-2026-0102", deedNo: "310112007733", deedType: "تقليدي", propertyType: "فيلا", city: "الرياض", district: "الملقا", area: 480, client: "بنك الرياض", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-06-01", valuationDate: "2026-06-08", issueDate: "2026-06-11", closedDate: "2026-06-18", finalValue: 3650000, valuer: "م. سارة الدوسري", coords: { lat: 24.8034, lng: 46.6002 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0105", refNo: "EJD-2026-0105", deedNo: "310112001177", deedType: "سجل عيني", propertyType: "شقة", city: "الرياض", district: "حطين", area: 172, client: "عبدالله المطيري", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-04-11", valuationDate: "2026-04-16", issueDate: "2026-04-19", closedDate: "2026-04-26", finalValue: 985000, valuer: "م. سارة الدوسري", coords: { lat: 24.7729, lng: 46.5977 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0106", refNo: "EJD-2025-0388", deedNo: "310112008841", deedType: "تقليدي", propertyType: "مستودع", city: "الرياض", district: "السلي", area: 2400, client: "مصرف الراجحي", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2025-11-03", valuationDate: "2025-11-12", issueDate: "2025-11-16", closedDate: "2025-11-25", finalValue: 4120000, valuer: "م. خالد العتيبي", coords: { lat: 24.6428, lng: 46.7987 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0107", refNo: "EJD-2026-0107", deedNo: "310112002216", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "العارض", area: 625, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible", openedDate: "2026-03-05", valuationDate: null, issueDate: null, closedDate: "2026-03-22", finalValue: null, valuer: "أ. فهد الشمري", coords: { lat: 24.9066, lng: 46.6350 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0111", refNo: "EJD-2025-0301", deedNo: "310112000944", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "لبن", area: 900, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2025-09-14", valuationDate: "2025-09-22", issueDate: "2025-09-25", closedDate: "2025-10-02", finalValue: 1980000, valuer: "أ. فهد الشمري", coords: { lat: 24.6180, lng: 46.5620 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0201", refNo: "EJD-2026-0201", deedNo: "420334006611", deedType: "تقليدي", propertyType: "فيلا", city: "جدة", district: "أبحر الشمالية", area: 520, client: "بنك الجزيرة", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-05-20", valuationDate: "2026-05-28", issueDate: "2026-06-01", closedDate: "2026-06-08", finalValue: 2340000, valuer: "م. عمر باناجه", coords: { lat: 21.7743, lng: 39.0987 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0202", refNo: "EJD-2026-0202", deedNo: "420334001208", deedType: "سجل عيني", propertyType: "شقة", city: "جدة", district: "الشاطئ", area: 210, client: "ريم الحربي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-06-14", valuationDate: "2026-06-19", issueDate: "2026-06-22", closedDate: "2026-06-30", finalValue: 1150000, valuer: "م. عمر باناجه", coords: { lat: 21.6152, lng: 39.1044 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0204", refNo: "EJD-2025-0412", deedNo: "420334004433", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "جدة", district: "الروضة", area: 680, client: "شركة إسكان الغرب", assignmentType: "شركة", workflowStatus: "issued", openedDate: "2025-12-01", valuationDate: "2025-12-09", issueDate: "2025-12-12", closedDate: "2025-12-20", finalValue: 5230000, valuer: "م. عمر باناجه", coords: { lat: 21.5731, lng: 39.1521 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0301", refNo: "EJD-2026-0301", deedNo: "530221003377", deedType: "سجل عيني", propertyType: "فيلا", city: "الدمام", district: "الشاطئ الغربي", area: 465, client: "بنك ساب", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-04-02", valuationDate: "2026-04-09", issueDate: "2026-04-12", closedDate: "2026-04-20", finalValue: 1890000, valuer: "م. حسن العلي", coords: { lat: 26.4680, lng: 50.0620 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0303", refNo: "EJD-2026-0303", deedNo: "530445001122", deedType: "تقليدي", propertyType: "شقة", city: "الخبر", district: "العقربية", area: 195, client: "محمد الغامدي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-06-25", valuationDate: "2026-07-01", issueDate: "2026-07-03", closedDate: "2026-07-10", finalValue: 720000, valuer: "م. حسن العلي", coords: { lat: 26.2860, lng: 50.2080 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0304", refNo: "EJD-2025-0355", deedNo: "530445007765", deedType: "تقليدي", propertyType: "أرض تجارية", city: "الخبر", district: "الحزام الذهبي", area: 2000, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible", openedDate: "2025-10-11", valuationDate: null, issueDate: null, closedDate: "2025-11-01", finalValue: null, valuer: "أ. ماجد الزهراني", coords: { lat: 26.2455, lng: 50.1990 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0401", refNo: "EJD-2026-0401", deedNo: "440556002211", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "مكة المكرمة", district: "العوالي", area: 540, client: "بنك البلاد", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-03-15", valuationDate: "2026-03-24", issueDate: "2026-03-28", closedDate: "2026-04-05", finalValue: 3980000, valuer: "م. تركي السبيعي", coords: { lat: 21.3520, lng: 39.8890 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0403", refNo: "EJD-2026-0403", deedNo: "450667003344", deedType: "تقليدي", propertyType: "فيلا", city: "المدينة المنورة", district: "قباء", area: 430, client: "سلطان الأحمدي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-05-05", valuationDate: "2026-05-13", issueDate: "2026-05-17", closedDate: "2026-05-25", finalValue: 1560000, valuer: "م. تركي السبيعي", coords: { lat: 24.4390, lng: 39.6170 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0501", refNo: "EJD-2026-0501", deedNo: "460778001515", deedType: "تقليدي", propertyType: "أرض زراعية", city: "بريدة", district: "الصفراء", area: 12000, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2026-02-10", valuationDate: "2026-02-19", issueDate: "2026-02-23", closedDate: "2026-03-03", finalValue: 3400000, valuer: "أ. ناصر الحربي", coords: { lat: 26.3660, lng: 43.9280 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0503", refNo: "EJD-2025-0290", deedNo: "480990003737", deedType: "تقليدي", propertyType: "أرض سكنية", city: "تبوك", district: "المروج", area: 750, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2025-08-20", valuationDate: "2025-08-28", issueDate: "2025-09-01", closedDate: "2025-09-10", finalValue: 640000, valuer: "أ. ناصر الحربي", coords: { lat: 28.4060, lng: 36.5430 }, coordsSource: "ميداني", propertyGroupId: null },
];

export const SEED_COMPARABLES = [
  { id: "C-9001", refNo: "CMP-2026-9001", comparableType: "أرض سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-07-02", price: 2650000, area: 700, city: "الرياض", district: "النرجس", source: "البورصة العقارية", approved: true,  description: "صفقة موثقة — شارع 20 شمالي", coords: { lat: 24.8460, lng: 46.6510 } },
  { id: "C-9002", refNo: "CMP-2026-9002", comparableType: "أرض سكنية", operationType: "عرض",  priceDescription: "قابل للتفاوض", operationDate: "2026-08-01", price: 2900000, area: 750, city: "الرياض", district: "النرجس", source: "منصة عقار", approved: true,  description: "عرض معلن — زاوية", coords: { lat: 24.8380, lng: 46.6640 } },
  { id: "C-9003", refNo: "CMP-2026-9003", comparableType: "فيلا",      operationType: "عرض",  priceDescription: "حد", operationDate: "2026-07-18", price: 3400000, area: 450, city: "الرياض", district: "الملقا", source: "منصة عقار", approved: false, description: "عرض حديث — تشطيب فاخر", coords: { lat: 24.8090, lng: 46.5950 } },
  { id: "C-9004", refNo: "CMP-2026-9004", comparableType: "عمارة تجارية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-06-10", price: 6800000, area: 820, city: "الرياض", district: "النسيم الشرقي", source: "معاملة سابقة", approved: true, description: "من مقارنات معاملة مغلقة", coords: { lat: 24.7490, lng: 46.8360 } },
  { id: "C-9005", refNo: "CMP-2026-9005", comparableType: "أرض تجارية", operationType: "عرض", priceDescription: "قابل للتفاوض", operationDate: "2026-08-08", price: 5200000, area: 1300, city: "الرياض", district: "القيروان", source: "مسح ميداني", approved: true, description: "رافد ميداني", coords: { lat: 24.8590, lng: 46.5820 } },
  { id: "C-9006", refNo: "CMP-2026-9006", comparableType: "أرض سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-05-25", price: 1800000, area: 600, city: "جدة", district: "النعيم", source: "البورصة العقارية", approved: true, description: "صفقة موثقة", coords: { lat: 21.6310, lng: 39.1190 } },
  { id: "C-9007", refNo: "CMP-2026-9007", comparableType: "فيلا",      operationType: "عرض",  priceDescription: "حد", operationDate: "2026-07-30", price: 2500000, area: 500, city: "جدة", district: "أبحر الشمالية", source: "منصة عقار", approved: false, description: "عرض معلن", coords: { lat: 21.7700, lng: 39.1050 } },
  { id: "C-9008", refNo: "CMP-2026-9008", comparableType: "مستودع",    operationType: "تنفيذ", priceDescription: null, operationDate: "2026-06-20", price: 3900000, area: 4500, city: "الدمام", district: "المنطقة الصناعية الثانية", source: "معاملة سابقة", approved: true, description: "من مقارنات معاملة مغلقة", coords: { lat: 26.3580, lng: 50.0280 } },
  { id: "C-9009", refNo: "CMP-2026-9009", comparableType: "أرض سكنية", operationType: "عرض", priceDescription: "قابل للتفاوض", operationDate: "2026-08-05", price: 950000, area: 780, city: "مكة المكرمة", district: "الشوقية", source: "منصة عقار", approved: true, description: "عرض حديث", coords: { lat: 21.3680, lng: 39.7900 } },
  { id: "C-9010", refNo: "CMP-2026-9010", comparableType: "عمارة سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-07-12", price: 2100000, area: 580, city: "أبها", district: "المنسك", source: "البورصة العقارية", approved: true, description: "صفقة موثقة", coords: { lat: 18.2330, lng: 42.5100 } },
];

export function distinctValues(list, field) {
  return [...new Set(list.map(x => x[field]).filter(Boolean))];
}
