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
import type {
  BuildingInventoryLineDto,
  ClientDto,
  OrganizationValuerRosterEntry,
  ValuationComparableSelectionListDto,
  ValuationCostApproachDto,
  ValuationReconciliationDto,
} from "@platform/api-client";
import {
  areasFromInventory,
  adoptedComparables,
  costRowCells,
  countOrFlag,
  dashSheet,
  esgCell,
  finishingLevelLabel,
  formatMoneyCell,
  joinObservations,
  mapSurroundings,
  membershipCategoryLabel,
  presentChip,
  reconWeight,
  valuerRoleLabel,
  yesNoFromFlag,
} from "./valuation-report-sheet-facts";
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

/** Template sample numbers wiped before live data is written. */
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
  areaRows: Array<{ key: string; values: string[] }>;
  buildDescRows: Array<{ key: string; values: string[] }>;
  serviceRows: Array<{ key: string; values: string[] }>;
  comparableRows: Array<{ key: string; values: string[] }>;
  costRows: Array<{ key: string; values: string[] }>;
  reconRows: Array<{ key: string; values: string[] }>;
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
  inventoryLines?: BuildingInventoryLineDto[] | null;
  market?: ValuationComparableSelectionListDto | null;
  cost?: ValuationCostApproachDto | null;
  recon?: ValuationReconciliationDto | null;
  clients?: Pick<ClientDto, "id" | "nameAr">[];
  purposeLabel?: string | null;
  basisLabel?: string | null;
  premiseLabel?: string | null;
  basisDefinition?: string | null;
  certifiedName?: string | null;
  certifiedLicense?: string | null;
  certifiedIssuedAt?: string | null;
  certifiedExpires?: string | null;
  certifiedMembershipCategory?: string | null;
  certifiedTitle?: string | null;
  certifiedMembershipExpires?: string | null;
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
    "هل يوجد منقولات": dash(inspector?.featureValues.movables),
    "وصف المنقولات":
      inspector?.featureValues.movables === "نعم"
        ? dash(inspector?.featureValues.movablesDescription)
        : inspector?.featureValues.movables === "لا"
          ? "لا يوجد منقولات بالعقار"
          : dash(""),
    "المنقولات":
      inspector?.featureValues.movables === "نعم"
        ? dash(inspector?.featureValues.movablesDescription)
        : inspector?.featureValues.movables === "لا"
          ? "لا يوجد منقولات بالعقار"
          : dash(""),
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

  const areas = areasFromInventory(input.inventoryLines, inspector);
  const surroundings = mapSurroundings(inspector?.amenities);
  const defects = [
    joinObservations(inspector),
    inspector?.hasViolations === "نعم"
      ? [
          "مخالفات ظاهرة",
          inspector.violationsCount.trim()
            ? `(${inspector.violationsCount.trim()})`
            : "",
          inspector.violationsDescription.trim(),
        ]
          .filter(Boolean)
          .join(" ")
      : inspector?.hasViolations === "لا"
        ? "لا توجد مخالفات ظاهرة"
        : "",
  ]
    .filter(Boolean)
    .join("؛ ");
  const kitchenCount =
    inspector?.featureValues.kitchen === "نعم"
      ? "نعم"
      : inspector?.featureValues.kitchen === "لا"
        ? "لا"
        : "";
  const reconFinal = input.recon?.finalOpinionValue;
  const reconLand = input.cost?.landValueFromMarket;
  const reconWeighted = input.recon?.weightedValue ?? reconFinal;
  const landDisplay =
    reconLand != null && reconLand > 0
      ? formatMoneyCell(reconLand)
      : land && land !== "0"
        ? formatAmountNumberDisplay(land)
        : land === "0"
          ? "0"
          : "";
  const priceDisplay =
    reconFinal != null && reconFinal > 0
      ? formatMoneyCell(reconFinal)
      : price
        ? formatAmountNumberDisplay(price)
        : "";
  const weightedDisplay =
    reconWeighted != null && reconWeighted > 0
      ? formatMoneyCell(reconWeighted)
      : priceDisplay;
  cells["قيمة الأرض"] = dash(landDisplay);
  cells["القيمة المرجّحة"] = dash(weightedDisplay);
  cells["قيمة العقار"] = dash(priceDisplay);
  if (input.recon?.liquidationDiscountApplied) {
    cells["نسبة خصم التصفية المنظمة"] = dash(
      `${String(input.recon.liquidationDiscountPct ?? "").replace(/%/g, "")}٪`,
    );
  }

  const marketW = reconWeight(input.recon, ["market", "comparison"]);
  const costW = reconWeight(input.recon, ["cost", "replacement"]);
  const incomeW = reconWeight(input.recon, ["income"]);
  cells["أسلوب السوق"] = dash(marketW.weight);
  cells["أسلوب التكلفة"] = dash(costW.weight);
  cells["أسلوب الدخل"] = dash(incomeW.weight);

  cells["غرف النوم"] = dash(inspector?.roomCount);
  cells["الصالات"] = dash(inspector?.hallCount);
  cells["دورات المياه"] = dash(inspector?.bathroomCount);
  cells["مطابخ"] = dash(kitchenCount);
  cells["مصعد"] = dash(yesNoFromFlag(inspector?.featureValues.hasElevator));
  cells["مسبح"] = dash(yesNoFromFlag(inspector?.featureValues.hasPool));
  cells["ملاحق"] = dash(countOrFlag(inspector?.annexTotal, inspector?.hasAnnex));
  cells["جاكوزي"] = dash(inspector?.jacuzziCount);
  cells["غرف الطعام"] = dash(inspector?.diningCount);
  cells["المجالس"] = dash(inspector?.majlisCount);
  cells["غرف الخدم"] = dash(inspector?.maidRoomCount);
  cells["غرفة حارس"] = dash(inspector?.guardRoomCount);
  cells["مواقف"] = dash(inspector?.parkingCount);
  cells["مستودع"] = dash(inspector?.storeCount);
  const extraComp = [
    inspector?.playgroundCount?.trim()
      ? `ملاعب أطفال: ${inspector.playgroundCount.trim()}`
      : "",
    inspector?.wellCount?.trim() ? `آبار: ${inspector.wellCount.trim()}` : "",
    inspector?.showroomCount?.trim()
      ? `معارض: ${inspector.showroomCount.trim()}`
      : "",
    surroundings["أخرى"],
  ]
    .filter(Boolean)
    .join("، ");
  cells["أخرى"] = dash(extraComp);
  cells["وصف العيوب الإنشائية"] = dash(defects);
  cells["جامع"] = dash(surroundings["جامع"]);
  cells["مرفق طبي"] = dash(surroundings["مرفق طبي"]);
  cells["مرفق أمني"] = dash(surroundings["مرفق أمني"]);
  cells["سوق تجاري"] = dash(surroundings["سوق تجاري"]);
  cells["حديقة"] = dash(surroundings["حديقة"]);
  cells["مرفق تعليمي"] = dash(surroundings["مرفق تعليمي"]);
  cells["مقر حكومي"] = dash(surroundings["مقر حكومي"]);
  cells["طريق سريع"] = dash(surroundings["طريق سريع"]);

  cells["محضر التجزئة"] = dash(
    [property?.partitionMinutesNumber, property?.partitionMinutesDate]
      .map((x) => (x ?? "").trim())
      .filter(Boolean)
      .join(" · "),
  );
  cells["تشطيب الواجهة الشمالية"] = dash(property?.northFacadeFinishing);
  cells["تشطيب الواجهة الشرقية"] = dash(property?.eastFacadeFinishing);
  cells["تشطيب الواجهة الجنوبية"] = dash(property?.southFacadeFinishing);
  cells["تشطيب الواجهة الغربية"] = dash(property?.westFacadeFinishing);
  const finLevel = finishingLevelLabel(choices.finishingLevel);
  if (finLevel) cells["مستوى التشطيب"] = finLevel;

  cells["كفاءة الطاقة"] = dash(esgCell(choices.esgEnv));
  cells["أخطار الموقع والمناخ"] = dash(esgCell(choices.esgEnv));
  cells["المباني الخضراء"] = dash(esgCell(choices.esgEnv));
  cells["جودة التصاميم ورفاهية المسكن"] = dash(esgCell(choices.esgSoc));
  cells["الإسهام المجتمعي للعقار"] = dash(esgCell(choices.esgSoc));
  cells["الخدمات المتوفرة في الموقع"] = dash(esgCell(choices.esgSoc));
  cells["الامتثال التنظيمي"] = dash(esgCell(choices.esgGov));
  cells["الإدارة الفعالة لبيانات العقار"] = dash(esgCell(choices.esgGov));
  cells["مقومات تشغيل العقار"] = dash(esgCell(choices.esgGov));

  const rationale =
    (input.recon?.methodsRationale ?? "").trim() ||
    choices.methodsRationale.trim();
  cells["مبرر استخدام طرق التقييم"] = dash(rationale);
  cells["دخل سنوي"] = dash(choices.incomeAnnual);
  cells["نسبة الشغور"] = dash(choices.incomeVacancyPct);
  cells["نسبة التشغيل"] = dash(choices.incomeOpexPct);
  cells["معدل الرسملة"] = dash(choices.incomeCapRatePct);

  const profit = input.cost?.indirectItems?.find((i) =>
    (i.itemKey || i.labelAr || "").toLowerCase().includes("profit"),
  );
  cells["قيمة هامش الربح"] = dash(
    profit ? formatMoneyCell(profit.amount) : "",
  );
  cells["تكلفة المبنى والأرض"] = dash(
    input.cost ? formatMoneyCell(input.cost.costOpinionWithLand) : "",
  );
  cells["العمر الفعلي"] = dash(
    inspector?.propertyAgeYears
      ? `${inspector.propertyAgeYears.trim()} سنوات`
      : input.cost?.actualAgeYears != null
        ? String(input.cost.actualAgeYears)
        : "",
  );
  cells["العمر الاقتصادي"] = dash(
    input.cost?.economicAgeYears != null
      ? String(input.cost.economicAgeYears)
      : "",
  );
  cells["نسبة الإهلاك / مجموع التقادم"] = dash(
    input.cost?.totalObsolescencePct != null
      ? `${input.cost.totalObsolescencePct}٪`
      : "",
  );
  cells["قيمة الإهلاك"] = dash(
    input.cost ? formatMoneyCell(input.cost.depreciationValue) : "",
  );
  cells["قيمة المباني بعد الإهلاك"] = dash(
    input.cost ? formatMoneyCell(input.cost.buildingsValueAfterDepreciation) : "",
  );
  cells["ناتج أسلوب التكلفة (الأرض + المباني)"] = dash(
    input.cost ? formatMoneyCell(input.cost.costOpinionWithLand) : "",
  );
  cells["سعر المتر المستورد من طريقة المقارنة"] = dash(
    input.cost?.landUnitRateFromMarket
      ? formatMoneyCell(input.cost.landUnitRateFromMarket)
      : "",
  );

  const comps = adoptedComparables(input.market);
  comps.forEach((item, i) => {
    const n = i + 1;
    const c = item.comparable;
    cells[`المقارن (${n})`] = dash(c.comparablePropertyType);
  });

  if ((input.certifiedName ?? "").trim()) {
    cells["اسم المقيم المعتمد"] = input.certifiedName!.trim();
    cells["الاسم"] = input.certifiedName!.trim();
  }
  if ((input.certifiedLicense ?? "").trim()) {
    cells["رقم ترخيص مزاولة المهنة"] = input.certifiedLicense!.trim();
    cells["رقم العضوية"] = dash(input.certifiedLicense);
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
  const memCat = membershipCategoryLabel(input.certifiedMembershipCategory);
  if (memCat) cells["فئة العضوية"] = memCat;
  const role =
    (input.certifiedTitle ?? "").trim() || valuerRoleLabel("certified");
  if (role) cells["صفته"] = role;
  if ((input.certifiedMembershipExpires ?? "").trim()) {
    cells["تاريخ انتهاء العضوية"] = input.certifiedMembershipExpires!.trim();
  }

  const groundCost = costRowCells(
    input.cost,
    ["ground_floor"],
    ["أرضي"],
    areas.ground,
  );
  const firstCost = costRowCells(
    input.cost,
    ["first_floor"],
    ["الأول"],
    areas.first,
  );
  const annexCost = costRowCells(
    input.cost,
    ["upper_annex"],
    ["ملحق"],
    areas.annex,
  );
  const basementCost = costRowCells(
    input.cost,
    ["basement"],
    ["قبو"],
    areas.basement,
  );
  const fenceCost = costRowCells(input.cost, ["fence"], ["سور"], "");
  const poolCost = costRowCells(input.cost, ["pool"], ["مسبح"], "");
  const parkCost = costRowCells(input.cost, ["parking"], ["مواقف"], "");
  const otherCost = costRowCells(input.cost, ["custom"], ["أخرى"], "");

  cells["سور"] = dash(fenceCost[0] || fenceCost[2]);

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
    areaRows: [
      { key: "الدور الأرضي", values: [dashSheet(areas.ground)] },
      { key: "الدور الأول", values: [dashSheet(areas.first)] },
      { key: "الملحق العلوي", values: [dashSheet(areas.annex)] },
      { key: "القبو", values: [dashSheet(areas.basement)] },
      { key: "إجمالي الملاحق", values: [dashSheet(areas.annexTotal)] },
    ],
    buildDescRows: areas.descriptions.map((r) => ({
      key: r.key,
      values: r.values.map((v) => dashSheet(v)),
    })),
    serviceRows: [
      {
        key: "كهرباء",
        values: [
          presentChip(inspector?.services, "كهرباء"),
          dashSheet(inspector?.electricityMeterCount),
          dashSheet(inspector?.electricityMeterNumbers),
        ],
      },
      {
        key: "ماء",
        values: [
          presentChip(inspector?.services, "ماء"),
          dashSheet(inspector?.waterMeterCount),
          dashSheet(inspector?.waterMeterNumbers),
        ],
      },
      {
        key: "صرف صحي",
        values: [
          presentChip(inspector?.services, "صرف صحي"),
          "—",
          "—",
        ],
      },
      {
        key: "هاتف / ألياف بصرية",
        values: [
          presentChip(inspector?.services, "هاتف / اتصالات"),
          "—",
          "—",
        ],
      },
    ],
    comparableRows: comps.map((item, i) => {
      const c = item.comparable;
      return {
        key: String(i + 1),
        values: [
          dashSheet(c.comparablePropertyType),
          dashSheet(c.areaSqm ? String(c.areaSqm) : ""),
          dashSheet(c.transactionDate),
          dashSheet(formatMoneyCell(c.price)),
          dashSheet(formatMoneyCell(c.pricePerSqm)),
        ],
      };
    }),
    costRows: [
      { key: "مسطح الدور الأرضي", values: groundCost.map((v) => dashSheet(v)) },
      { key: "مسطح الدور الأول", values: firstCost.map((v) => dashSheet(v)) },
      { key: "مسطح الملحق العلوي", values: annexCost.map((v) => dashSheet(v)) },
      { key: "القبو", values: basementCost.map((v) => dashSheet(v)) },
      { key: "الأسوار", values: fenceCost.map((v) => dashSheet(v)) },
      { key: "المسبح", values: poolCost.map((v) => dashSheet(v)) },
      { key: "مواقف سيارات", values: parkCost.map((v) => dashSheet(v)) },
      { key: "أخرى", values: otherCost.map((v) => dashSheet(v)) },
      {
        key: "مجموع التكلفة المباشرة",
        values: [
          "—",
          "—",
          dashSheet(
            input.cost ? formatMoneyCell(input.cost.directCostTotal) : "",
          ),
        ],
      },
    ],
    reconRows: [
      {
        key: "أسلوب السوق — طريقة المقارنة",
        values: [dashSheet(marketW.weight), dashSheet(marketW.contrib)],
      },
      {
        key: "أسلوب التكلفة — طريقة التكلفة (الإحلال)",
        values: [dashSheet(costW.weight), dashSheet(costW.contrib)],
      },
      {
        key: "أسلوب الدخل",
        values: [dashSheet(incomeW.weight), dashSheet(incomeW.contrib)],
      },
    ],
    finalDisplay:
      (reconFinal != null && reconFinal > 0
        ? `${formatAmountNumberDisplay(reconFinal)} ر.س.`
        : priceN != null && priceN > 0
          ? `${formatAmountNumberDisplay(priceN)} ر.س.`
          : "—"),
    finalWords:
      reconFinal != null && reconFinal > 0
        ? `فقط ${amountToArabicWords(reconFinal)} ريال سعودي لا غير`
        : priceN != null && priceN > 0
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

function fillKeyedRows(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => r.key === name);
    if (!row) return;
    row.values.forEach((value, i) => {
      const cell = cells[i + 1];
      if (cell) cell.textContent = value;
    });
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
  SAMPLE_SECS.forEach((id) => {
    const sec = dom.querySelector(`[data-sec="${id}"]`);
    if (sec) blankValueCells(sec);
  });

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

  const areas = dom.querySelector('[data-sec="9"]');
  if (areas) fillKeyedRows(areas, fill.areaRows);

  const build = dom.querySelector('[data-sec="10"]');
  if (build) fillKeyedRows(build, fill.buildDescRows);

  const services = dom.querySelector('[data-sec="14"]');
  if (services) fillKeyedRows(services, fill.serviceRows);

  const methods = dom.querySelector('[data-sec="16"]');
  if (methods) fillMethodRow(methods, fill.methodRow);

  const comps = dom.querySelector('[data-sec="17"]');
  if (comps) fillKeyedRows(comps, fill.comparableRows);

  const costSec = dom.querySelector('[data-sec="21"]');
  if (costSec) fillKeyedRows(costSec, fill.costRows);

  const reconSec = dom.querySelector('[data-sec="24"]');
  if (reconSec) fillKeyedRows(reconSec, fill.reconRows);

  const landSec = dom.querySelector('[data-sec="20"]');
  if (landSec) {
    landSec.querySelectorAll("td.num").forEach((td) => {
      const row = td.closest("tr");
      const label = normLabel(row?.querySelector("td.k")?.textContent ?? "");
      if (label !== "قيمة الأرض" && label !== "سعر المتر المستورد من طريقة المقارنة") {
        td.textContent = "—";
      }
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
