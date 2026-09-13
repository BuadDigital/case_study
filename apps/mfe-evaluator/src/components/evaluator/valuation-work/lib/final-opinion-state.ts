/**
 * Pure rules behind `FinalOpinionSection` — the live value-opinion calculation
 * (weights, liquidation discount, rounding and the auto-generated opinion text)
 * and the reconciliation save payload. No React, no I/O.
 */
import type {
  ValuationCostApproachDto,
  ValuationReconciliationMethodDto,
} from "@platform/api-client";
import { valuePremiseKeyForAssignment } from "@platform/app-shared/app-data/assignment-valuation-defaults";

import { fmt } from "./shell-utils";

export type FinalOpinionInputs = {
  reconMethods: ValuationReconciliationMethodDto[];
  basisOfValueKey: string;
  basisOptions: { value: string; label: string }[];
  liquidationDiscountPct: string;
  finalRoundDecimals: string;
  cost: ValuationCostApproachDto | null;
  buildingOnly: boolean;
  hasAdoptedMarket: boolean;
};

/** Live value-opinion calc (interactive-form spec) plus `buildOpinion` text. */
export function finalOpinionComputed({
  reconMethods,
  basisOfValueKey,
  basisOptions,
  liquidationDiscountPct,
  finalRoundDecimals,
  cost,
  buildingOnly,
  hasAdoptedMarket,
}: FinalOpinionInputs) {
    const weightSumLocal = reconMethods.reduce((s, m) => s + (m.weightPct || 0), 0);
    const reconWeightsBad =
      reconMethods.length >= 2 && Math.round(weightSumLocal) !== 100;
    // Interactive-form spec: values as-is (may be partial or negative) — adoption is the gate.
    const weightedLocal =
      reconMethods.length === 0
        ? 0
        : reconMethods.length === 1
          ? reconMethods[0].approachValue
          : reconMethods.reduce(
              (s, m) => s + m.approachValue * ((m.weightPct || 0) / 100),
              0,
            );

    // Indicator completeness as in the form: market = adopted comparable; cost = lines + extended life (+ land unless building-only).
    const costBuildReady =
      (cost?.lines?.length ?? 0) > 0 &&
      (cost?.directCostTotal ?? 0) > 0 &&
      (cost?.extendedLifeYears ?? 0) > 0;
    const costComplete = buildingOnly
      ? costBuildReady
      : costBuildReady && !!cost?.landEstimateComplete;
    const methodComplete = (kind: string) =>
      kind === "cost" ? costComplete : hasAdoptedMarket;
    const isLiquidation = basisOfValueKey === "liquidation";
    const discountPctNum = isLiquidation
      ? Number(liquidationDiscountPct.replace(",", ".")) || 0
      : 0;
    const forcedCut = (weightedLocal * discountPctNum) / 100;
    const decNum = Math.min(
      Math.max(Number.parseInt(finalRoundDecimals, 10) || 0, 0),
      6,
    );
    const roundPow = 10 ** decNum;
    const finalLocal =
      Math.round((weightedLocal - forcedCut) / roundPow) * roundPow;
    const roundNote =
      decNum === 0
        ? "بلا تقريب — أقرب ريال"
        : `مقرَّبة لأقرب ${fmt(roundPow)} ريال`;
    const soleCost =
      reconMethods.length === 1 && reconMethods[0]?.approachKind === "cost";

    // buildOpinion — auto-generated final-opinion text.
    const basisLabel =
      basisOptions.find((o) => o.value === basisOfValueKey)?.label ??
      basisOfValueKey;
    const linesOut: string[] = [];
    if (!reconMethods.length) {
      linesOut.push("لم يُختَر أي أسلوب تقييم بعد.");
    } else if (reconMethods.length === 1) {
      if (soleCost && !buildingOnly) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة. قُدّرت قيمة الأرض بطريقة المقارنات باعتبارها فضاء، وقُدّرت قيمة التحسينات بطريقة المقاول على أساس تكلفة الإحلال ناقصاً الإهلاك، والقيمة النهائية هي حاصل جمعهما. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else if (soleCost) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة بنطاق «مبنى فقط»؛ القيمة = تكلفة الإحلال ناقصاً الإهلاك. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else {
        linesOut.push(
          "اعتُمد أسلوب السوق وحده، وقُدّرت القيمة بطريقة المقارنات. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      }
      linesOut.push(
        `مؤشر ${reconMethods[0].labelAr}: ${fmt(reconMethods[0].approachValue)} ر.س بوزن ١٠٠٪.`,
      );
    } else {
      for (const m of reconMethods) {
        linesOut.push(
          `مؤشر ${m.labelAr}: ${fmt(m.approachValue)} ر.س بوزن ${m.weightPct}٪.`,
        );
        if ((m.rationale ?? "").trim())
          linesOut.push(`مبرر وزن ${m.labelAr}: ${m.rationale.trim()}.`);
      }
    }
    if (discountPctNum > 0)
      linesOut.push(forcedSaleDiscountOpinionLine(discountPctNum));
    linesOut.push(`أساس القيمة المستخدم: ${basisLabel}.`);
    linesOut.push(`الرأي النهائي في قيمة العقار: ${fmt(finalLocal)} ر.س.`);

    return {
      weightSumLocal,
      reconWeightsBad,
      weightedLocal,
      isLiquidation,
      discountPctNum,
      forcedCut,
      finalLocal,
      roundNote,
      soleCost,
      methodComplete,
      opinionAuto: linesOut.join("\n"),
    };
}

export type FinalOpinionComputed = ReturnType<typeof finalOpinionComputed>;

/** Auto-generated forced-sale discount sentence in the final-opinion narrative. */
export const FORCED_SALE_DISCOUNT_OPINION_LINE_RE =
  /^طُبِّق خصم بيع قسري .+٪\.$/m;

export function forcedSaleDiscountOpinionLine(pct: number): string {
  return `طُبِّق خصم بيع قسري ${pct}٪.`;
}

/**
 * Keep a manually edited opinion in sync with the discount % without wiping
 * custom wording — only the discount line is inserted/replaced/removed.
 */
export function syncDiscountLineInOpinion(
  text: string,
  nextPct: number,
): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nextLine =
    nextPct > 0 ? forcedSaleDiscountOpinionLine(nextPct) : null;
  const withoutDiscount = lines.filter(
    (line) => !FORCED_SALE_DISCOUNT_OPINION_LINE_RE.test(line.trim()),
  );
  if (!nextLine) return withoutDiscount.join("\n");

  const basisIdx = withoutDiscount.findIndex((line) =>
    line.trim().startsWith("أساس القيمة المستخدم:"),
  );
  if (basisIdx >= 0) {
    withoutDiscount.splice(basisIdx, 0, nextLine);
    return withoutDiscount.join("\n");
  }
  const finalIdx = withoutDiscount.findIndex((line) =>
    line.trim().startsWith("الرأي النهائي في قيمة العقار:"),
  );
  if (finalIdx >= 0) {
    withoutDiscount.splice(finalIdx, 0, nextLine);
    return withoutDiscount.join("\n");
  }
  withoutDiscount.push(nextLine);
  return withoutDiscount.join("\n");
}

/** PO selection wins; saved recon is fallback; assignment type is last resort. */
export function workOrderPremiseKey({
  poPremise,
  reconPremise,
  assignmentType,
}: {
  poPremise?: string | null;
  reconPremise?: string | null;
  assignmentType?: string;
}): string {
  const fromPo = poPremise?.trim();
  if (fromPo) return fromPo;
  const fromRecon = reconPremise?.trim();
  if (fromRecon) return fromRecon;
  if (!assignmentType?.trim()) return "";
  return valuePremiseKeyForAssignment(assignmentType);
}

export type AlertOverrideRecord = Record<
  string,
  { overrideRationale: string; acknowledged: boolean }
>;

export type ReconciliationDraft = {
  reconMethods: ValuationReconciliationMethodDto[];
  methodsRationale: string;
  finalRoundDecimals: string;
  basisOfValueKey: string;
  valuePremiseKey: string;
  liquidationDiscountPct: string;
  liquidationDiscountRationale: string;
  alertOverrides: AlertOverrideRecord;
};

/** Saved methodology-alert dispositions keyed by code. */
export function alertOverridesFromRecon(
  recon: {
    methodologyAlertOverrides?: {
      code: string;
      overrideRationale?: string | null;
      acknowledged?: boolean;
    }[];
  } | null,
): AlertOverrideRecord {
  const ovMap: AlertOverrideRecord = {};
  for (const o of recon?.methodologyAlertOverrides ?? []) {
    ovMap[o.code] = {
      overrideRationale: o.overrideRationale ?? "",
      acknowledged: o.acknowledged ?? false,
    };
  }
  return ovMap;
}

/** Draft state to the save request body. */
export function reconciliationSaveRequest(
  draft: ReconciliationDraft,
  opinionAuto: string,
) {
  return {
    // Auto text is pinned on save unless the appraiser edited it (“auto until edited” model).
    methodsRationale: draft.methodsRationale.trim() || opinionAuto,
    finalRoundDecimals: Number.parseInt(draft.finalRoundDecimals, 10) || 0,
    basisOfValueKey: draft.basisOfValueKey,
    valuePremiseKey: draft.valuePremiseKey || null,
    liquidationDiscountPct:
      Number(draft.liquidationDiscountPct.replace(",", ".")) || 0,
    liquidationDiscountRationale: draft.liquidationDiscountRationale || null,
    methodologyAlertOverrides: Object.entries(draft.alertOverrides).map(
      ([code, v]) => ({
        code,
        overrideRationale: v.overrideRationale || null,
        acknowledged: v.acknowledged,
      }),
    ),
    methods: draft.reconMethods.map((m, i) => ({
      id: m.id,
      approachKind: m.approachKind,
      weightPct: m.weightPct,
      rationale: m.rationale,
      isIncluded: m.isIncluded,
      sortOrder: i,
    })),
  };
}

/**
 * Silent reload merge — server-computed approach values win, the appraiser's
 * weights, rationales and inclusion flags stay.
 */
export function mergeReconMethods(
  serverMethods: ValuationReconciliationMethodDto[],
  mine: ValuationReconciliationMethodDto[],
): ValuationReconciliationMethodDto[] {
  return serverMethods.map((m) => {
    const own = mine.find((p) => p.approachKind === m.approachKind);
    return own
      ? {
          ...m,
          weightPct: own.weightPct,
          rationale: own.rationale,
          isIncluded: own.isIncluded,
        }
      : m;
  });
}
