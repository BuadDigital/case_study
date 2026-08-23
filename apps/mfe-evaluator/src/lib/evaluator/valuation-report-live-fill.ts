import {
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
  VALUATION_PURPOSE_OPTIONS,
  basisOfValueKeyForAssignment,
  basisOfValueLabelArForAssignment,
  valuationPurposeKeyForAssignment,
  valuationPurposeLabelArForAssignment,
  valuePremiseKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import type { PoIntakeRecord, PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  VALUATION_REPORT_USER_OPTION_LABEL,
  showsValuationReportUserField,
  subClientIdFromReportUsers,
} from "@case-study/mfe/lib/prototype/po-intake-data";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { ClientDto, OrganizationValuerRosterEntry } from "@platform/api-client";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "./evaluator-window-data";
import { emptyReportChoices } from "./evaluator-window-data";
import {
  amountToArabicWords,
  formatAmountNumberDisplay,
} from "./arabic-amount-words";
import { parseEvaluatorAmount } from "./value-estimation";

const OWNERSHIP_LABELS: Record<string, string> = {
  absolute: "ملكية مطلقة",
  mortgaged: "مرهون",
  investment: "استثمار",
  shared: "مشاع",
};

const SAMPLE_SECS = new Set(["10", "11", "13", "14", "15", "17", "19", "21", "22", "23", "24"]);

const MARKET_BASIS_DEFINITION =
  "القيمة السوقية هي المبلغ المقدَّر الذي ينبغي أن يُتبادل به أصل أو التزام في تاريخ التقييم بين مشترٍ راغب وبائع راغب في معاملة تجارية بحتة بعد تسويق مناسب، بحيث يتصرف كل طرف عن دراية وبحكمة ودون إجبار.";

const LIQUIDATION_BASIS_DEFINITION =
  "قيمة التصفية هي المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل أو مجموعة أصول بموجب بيع التصفية، وقد حُددت في هذا التقرير بموجب افتراض المعاملة المنظمة ذات فترة التسويق النموذجية (التصفية المنظمة) — انظر المعيار 102 — أسس القيمة، الملحق (أ)60.";

export function slashReportDate(iso: string | null | undefined): string {
  const t = (iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : t;
}

export function assignmentValuationFromPo(
  record?: Pick<
    PoIntakeRecord,
    "assignmentType" | "reportUserClientIds" | "clientId"
  > | null,
): { purposeKey: string; valueBasisKey: string; premiseKey: string } {
  const type = record?.assignmentType?.trim() ?? "";
  if (!type) {
    return { purposeKey: "", valueBasisKey: "", premiseKey: "" };
  }
  const sub = subClientIdFromReportUsers(record?.reportUserClientIds);
  const purposeKey = valuationPurposeKeyForAssignment(type, sub);
  const valueBasisKey = basisOfValueKeyForAssignment(type, sub);
  return {
    purposeKey,
    valueBasisKey,
    premiseKey: valuePremiseKeyForAssignment(type, sub),
  };
}

export function labelForPurposeKey(key: string): string {
  return VALUATION_PURPOSE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function labelForBasisKey(key: string): string {
  return VALUE_BASIS_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function labelForPremiseKey(key: string): string {
  return VALUE_PREMISE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function ownershipTypeDisplay(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (!t) return "";
  return OWNERSHIP_LABELS[t] ?? t;
}

export function reportUserNamesFromRecord(
  record: Pick<PoIntakeRecord, "clientNameAr" | "reportUserClientIds"> | null | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  const ids = record?.reportUserClientIds ?? [];
  const names = ids
    .map((id) => clients.find((c) => c.id === id)?.nameAr.trim() ?? "")
    .filter(Boolean);
  if (names.length) return names.join(" و ");
  return (record?.clientNameAr ?? "").trim();
}

export function formatValuationReportUsers(
  record:
    | Pick<
        PoIntakeRecord,
        "clientNameAr" | "reportUserClientIds" | "assignmentType" | "clientId"
      >
    | null
    | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  if (
    record &&
    showsValuationReportUserField(record.assignmentType, record.clientId)
  ) {
    return VALUATION_REPORT_USER_OPTION_LABEL;
  }
  const names = reportUserNamesFromRecord(record, clients);
  const client = (record?.clientNameAr ?? "").trim();
  if (names && client && names !== client) return `${client} و ${names}`;
  return names || client;
}

function dash(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
}

function joinCoords(inspector?: InspectorWorkspaceDraft | null): string {
  const lat = (inspector?.mapLatitude ?? "").trim();
  const lng = (inspector?.mapLongitude ?? "").trim();
  if (!lat && !lng) return "";
  return [lat, lng].filter(Boolean).join(" ، ");
}

function methodsUsed(choices: EvaluatorReportChoices): string {
  const bits: string[] = [];
  if (choices.marketMethodKey && choices.marketMethodKey !== "__unused__") {
    bits.push("أسلوب السوق");
  }
  if (choices.costMethodKey && choices.costMethodKey !== "__unused__") {
    bits.push("أسلوب التكلفة");
  }
  if (choices.incomeMethodKey && choices.incomeMethodKey !== "__unused__") {
    bits.push("أسلوب الدخل");
  }
  return bits.join(" و ");
}

export type ValuationReportLiveFill = {
  cells: Record<string, string>;
  scopeBasis: string;
  scopeClient: string;
  basisDefinition: string;
  methodRow: [string, string, string];
  boundaries: Array<{
    name: string;
    bound: string;
    len: string;
    face: string;
  }>;
  finalDisplay: string;
  finalWords: string;
  isLiquidation: boolean;
  propertyDescription: string;
};

export function buildValuationReportLiveFill(input: {
  draft: EvaluatorSubmission;
  record?: PoIntakeRecord | null;
  property?: PoPropertyIntake | null;
  inspector?: InspectorWorkspaceDraft | null;
  clients?: Pick<ClientDto, "id" | "nameAr">[];
  purposeLabel?: string | null;
  basisLabel?: string | null;
  premiseLabel?: string | null;
  basisDefinition?: string | null;
  certifiedName?: string | null;
  certifiedLicense?: string | null;
  certifiedIssuedAt?: string | null;
  certifiedExpires?: string | null;
  valuationBranch?: string | null;
  reportType?: string | null;
  currency?: string | null;
}): ValuationReportLiveFill {
  const { draft, record, property, inspector } = input;
  const keys = assignmentValuationFromPo(record);
  const sub = subClientIdFromReportUsers(record?.reportUserClientIds);
  const purpose =
    labelForPurposeKey(keys.purposeKey) ||
    (record
      ? valuationPurposeLabelArForAssignment(record.assignmentType, sub)
      : "");
  const basis =
    labelForBasisKey(keys.valueBasisKey) ||
    (record
      ? basisOfValueLabelArForAssignment(record.assignmentType, sub)
      : "");
  const premise = labelForPremiseKey(keys.premiseKey);
  const client = (record?.clientNameAr ?? "").trim();
  const users = formatValuationReportUsers(record, input.clients ?? []);
  const choices = draft.reportChoices ?? emptyReportChoices();
  const appraisal = slashReportDate(
    draft.appraisalDate || draft.reportIssueDate,
  );
  const inspection = slashReportDate(inspector?.inspectionDate);
  const requestDate = slashReportDate(record?.receivedFromEnfathAt);
  const area = (property?.area ?? "").trim();
  const land = (draft.landValue ?? "").trim();
  const price = (draft.evaluatorPrice ?? "").trim();
  const priceN = parseEvaluatorAmount(price);
  const isLiquidation = keys.valueBasisKey === "liquidation";
  const license = [
    inspector?.buildLicenseNumber?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  const cells: Record<string, string> = {
    "اسم العميل": dash(client),
    "تاريخ التقييم": dash(appraisal),
    "مستخدمو التقرير": dash(users || client),
    "اسم مستخدم تقرير التقييم": dash(users || client),
    "تاريخ المعاينة": dash(inspection),
    "اسم المالك": dash(property?.ownerName),
    "رقم الطلب": dash(property?.requestNumber),
    "الغرض من التقييم": dash(purpose),
    "تاريخ الطلب": dash(requestDate),
    "أساس القيمة": dash(basis),
    "فرضية القيمة": dash(premise),
    "فرضية القيمة (الاستخدام المفترض)": dash(premise),
    "نوع التقرير": dash(input.reportType),
    "عملة التقييم": dash(input.currency),
    "نوع العقار": dash(property?.propertyType || property?.classification),
    "أساليب التقييم المستخدمة": dash(methodsUsed(choices)),
    "حالة العقار": dash(inspector?.featureValues.buildState),
    "حالة الصك": dash(property?.deedStatus),
    "نوع الملكية": dash(ownershipTypeDisplay(property?.ownershipType)),
    "اسم المنطقة": dash(property?.region),
    "اسم المدينة": dash(property?.city),
    "اسم الحي": dash(property?.district),
    "اسم المخطط": dash(property?.planName),
    "رقم المخطط": dash(property?.planNumber),
    "رقم البلك": dash(property?.blockNumber),
    "رقم القطعة": dash(property?.plotNumber),
    "استخدام العقار": dash(property?.classification),
    "إحداثيات الموقع": dash(joinCoords(inspector)),
    "رقم الصك": dash(property?.deedNumber),
    "تاريخ الصك": dash(property?.deedDate),
    "رقم رخصة البناء وتاريخها": dash(license),
    "عمر البناء": dash(
      inspector?.propertyAgeYears
        ? `${inspector.propertyAgeYears.trim()} سنوات`
        : "",
    ),
    "حالة البناء": dash(inspector?.featureValues.buildState),
    "حالة الإشغال": dash(inspector?.featureValues.occupancyState),
    "مساحة الأرض (حسب الصك)": dash(area ? `${area} م²` : ""),
    "مساحة الأرض (م²)": dash(area),
    "قيمة الأرض": dash(
      land && land !== "0" ? formatAmountNumberDisplay(land) : land === "0" ? "0" : "",
    ),
    "القيمة المرجّحة": dash(price ? formatAmountNumberDisplay(price) : ""),
    "قيمة العقار": dash(price ? formatAmountNumberDisplay(price) : ""),
    "نسبة خصم التصفية المنظمة": isLiquidation
      ? dash(
          draft.forcedSaleDiscountPct
            ? `${draft.forcedSaleDiscountPct.replace(/%/g, "")}٪`
            : "",
        )
      : "—",
    "وصف العقار": dash(inspector?.propertyDescription),
  };

  if ((input.certifiedName ?? "").trim()) {
    cells["اسم المقيم المعتمد"] = input.certifiedName!.trim();
  }
  if ((input.certifiedLicense ?? "").trim()) {
    cells["رقم ترخيص مزاولة المهنة"] = input.certifiedLicense!.trim();
  }
  if ((input.certifiedIssuedAt ?? "").trim()) {
    cells["تاريخ الإصدار"] = input.certifiedIssuedAt!.trim();
  }
  if ((input.certifiedExpires ?? "").trim()) {
    cells["تاريخ الانتهاء"] = input.certifiedExpires!.trim();
  }
  if ((input.valuationBranch ?? "").trim()) {
    cells["فرع التقييم"] = input.valuationBranch!.trim();
  }

  return {
    cells,
    scopeBasis: basis,
    scopeClient: client,
    basisDefinition: resolveBasisDefinition(
      keys.valueBasisKey,
      isLiquidation,
      input.basisDefinition,
    ),
    methodRow: [
      choices.marketMethodKey && choices.marketMethodKey !== "__unused__"
        ? "طريقة المقارنة"
        : "غير مستخدم",
      choices.costMethodKey && choices.costMethodKey !== "__unused__"
        ? "طريقة التكلفة (الإحلال)"
        : "غير مستخدم",
      choices.incomeMethodKey && choices.incomeMethodKey !== "__unused__"
        ? "رسملة الدخل"
        : "غير مستخدم",
    ],
    boundaries: [
      {
        name: "الشمالية",
        bound: property?.northBoundary ?? "",
        len: property?.northBoundaryLengthM ?? "",
        face: property?.northFacadeFinishing ?? "",
      },
      {
        name: "الجنوبية",
        bound: property?.southBoundary ?? "",
        len: property?.southBoundaryLengthM ?? "",
        face: property?.southFacadeFinishing ?? "",
      },
      {
        name: "الشرقية",
        bound: property?.eastBoundary ?? "",
        len: property?.eastBoundaryLengthM ?? "",
        face: property?.eastFacadeFinishing ?? "",
      },
      {
        name: "الغربية",
        bound: property?.westBoundary ?? "",
        len: property?.westBoundaryLengthM ?? "",
        face: property?.westFacadeFinishing ?? "",
      },
    ],
    finalDisplay:
      priceN != null && priceN > 0
        ? `${formatAmountNumberDisplay(priceN)} ر.س.`
        : "—",
    finalWords:
      priceN != null && priceN > 0
        ? `فقط ${amountToArabicWords(priceN)} ريال سعودي لا غير`
        : "—",
    isLiquidation,
    propertyDescription: (inspector?.propertyDescription ?? "").trim(),
  };
}

function resolveBasisDefinition(
  valueBasisKey: string,
  isLiquidation: boolean,
  fromLists?: string | null,
): string {
  const listed = (fromLists ?? "").trim();
  if (isLiquidation) {
    return listed || LIQUIDATION_BASIS_DEFINITION;
  }
  if (valueBasisKey === "market") {
    if (listed && !listed.includes("قيمة التصفية")) return listed;
    return MARKET_BASIS_DEFINITION;
  }
  if (listed && !listed.includes("قيمة التصفية")) return listed;
  return listed;
}

function normLabel(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blankValueCells(root: ParentNode) {
  root.querySelectorAll("td.v, td.num").forEach((td) => {
    if (td.classList.contains("k")) return;
    td.textContent = "—";
  });
}

function fillBoundaries(
  sec: Element,
  rows: ValuationReportLiveFill["boundaries"],
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    if (cells[1]) cells[1].textContent = dash(row.bound);
    if (cells[2]) cells[2].textContent = dash(row.len);
    if (cells[3]) cells[3].textContent = dash(row.face);
  });
}

function fillMethodRow(sec: Element, methods: [string, string, string]) {
  const dataRow = [...sec.querySelectorAll("tr")].find((tr) =>
    [...tr.querySelectorAll("td")].length >= 3 &&
    !tr.querySelector("th"),
  );
  if (!dataRow) return;
  const cells = [...dataRow.querySelectorAll("td")];
  cells.forEach((cell, i) => {
    if (methods[i] != null) cell.textContent = methods[i]!;
  });
}

function fillFinalBanner(sec: Element, fill: ValuationReportLiveFill) {
  const banner = [...sec.querySelectorAll("div")].find((d) =>
    (d.getAttribute("style") ?? "").includes("#102b4e"),
  );
  if (!banner) return;
  const kids = [...banner.children];
  const row = kids[0];
  if (row) {
    const parts = [...row.children];
    if (parts[1]) parts[1].textContent = fill.finalDisplay;
  }
  if (kids[1]) kids[1].textContent = fill.finalWords;
}

function fillParticipants(
  sec: Element,
  valuers: OrganizationValuerRosterEntry[] | null | undefined,
  branch: string,
) {
  const active = (valuers ?? []).filter(
    (v) => v.isActive !== false && v.role !== "certified",
  );
  const people = sec.querySelector("table");
  if (!people) return;
  if (!active.length) {
    blankValueCells(people);
    return;
  }
  const table = people;
  const nameRow = [...table.querySelectorAll("tr")].find((r) =>
    normLabel(r.querySelector("td.k")?.textContent ?? "") === "الاسم",
  );
  if (!nameRow) return;
  const nameCells = [...nameRow.querySelectorAll("td.v")];
  nameCells.forEach((cell, i) => {
    cell.textContent = active[i]?.nameAr ?? "—";
  });
  const memRow = [...table.querySelectorAll("tr")].find((r) =>
    normLabel(r.querySelector("td.k")?.textContent ?? "") === "رقم العضوية",
  );
  memRow?.querySelectorAll("td.num, td.v").forEach((cell, i) => {
    cell.textContent = dash(active[i]?.membershipNumber);
  });
  const branchRow = [...table.querySelectorAll("tr")].find((r) =>
    normLabel(r.querySelector("td.k")?.textContent ?? "") === "فرع التقييم",
  );
  branchRow?.querySelectorAll("td.v").forEach((cell) => {
    cell.textContent = dash(branch);
  });
}

export function applyValuationReportLiveFill(
  dom: Document,
  fill: ValuationReportLiveFill,
  extras?: {
    valuers?: OrganizationValuerRosterEntry[] | null;
    valuationBranch?: string;
  },
): void {
  const map = new Map(
    Object.entries(fill.cells).map(([k, v]) => [normLabel(k), v]),
  );
  dom.querySelectorAll("td.k").forEach((labelCell) => {
    const label = normLabel(labelCell.textContent ?? "");
    if (!map.has(label)) return;
    const value = map.get(label)!;
    const next = labelCell.nextElementSibling;
    if (
      next &&
      (next.classList.contains("v") || next.classList.contains("num"))
    ) {
      next.textContent = value;
    }
  });

  const scope = dom.querySelector('[data-sec="2"]');
  if (scope) {
    const p = scope.querySelector("p");
    if (p && fill.scopeBasis && fill.scopeBasis !== "—") {
      p.textContent = `يعتمد أساس التقييم على تحديد ${fill.scopeBasis} لموضوع التقييم في حالته الراهنة.`;
    } else if (p && !fill.isLiquidation) {
      p.textContent = "";
    }
    const items = scope.querySelectorAll("li");
    if (items[0]) {
      items[0].textContent =
        fill.basisDefinition ||
        (!fill.isLiquidation ? "" : items[0].textContent);
    }
    if (items[1] && fill.scopeClient) {
      items[1].textContent =
        `أُعد هذا التقرير لاستخدام العميل (${fill.scopeClient}) فقط، ولا يجوز استخدامه من قبل مستخدم آخر إلا بإذن خطي موقع ومختوم بختم الشركة.`;
    }
  }

  const asset = dom.querySelector('[data-sec="6"]');
  if (asset && fill.propertyDescription) {
    const desc = [...asset.querySelectorAll("td.k")].find(
      (td) => normLabel(td.textContent ?? "") === "وصف العقار",
    )?.nextElementSibling;
    if (desc) desc.textContent = fill.propertyDescription;
  }

  const bounds = dom.querySelector('[data-sec="8"]');
  if (bounds) fillBoundaries(bounds, fill.boundaries);

  const methods = dom.querySelector('[data-sec="16"]');
  if (methods) fillMethodRow(methods, fill.methodRow);

  SAMPLE_SECS.forEach((id) => {
    const sec = dom.querySelector(`[data-sec="${id}"]`);
    if (sec) blankValueCells(sec);
  });

  const landSec = dom.querySelector('[data-sec="20"]');
  if (landSec) {
    landSec.querySelectorAll("td.num").forEach((td) => {
      const row = td.closest("tr");
      const label = normLabel(row?.querySelector("td.k")?.textContent ?? "");
      if (label !== "قيمة الأرض") td.textContent = "—";
    });
  }

  const finalSec = dom.querySelector('[data-sec="25"]');
  if (finalSec) {
    if (!fill.isLiquidation) {
      const disc = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("خصم التصفية"),
      );
      const discVal = disc?.nextElementSibling;
      if (discVal) discVal.textContent = "—";
      const reason = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("مبرر معامل"),
      )?.nextElementSibling;
      if (reason) reason.textContent = "—";
    }
    fillFinalBanner(finalSec, fill);
  }

  const people = dom.querySelector('[data-sec="26"]');
  if (people) {
    fillParticipants(
      people,
      extras?.valuers,
      extras?.valuationBranch || fill.cells["فرع التقييم"] || "",
    );
  }
}
