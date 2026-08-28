import type { ValuationComparableSelectionDto } from "@platform/api-client";

/**
 * أمر جدول التسويات — واجهة واحدة بدل ١٥ مقبض رد نداء (Command/ISP):
 * الجدول يرسل الأمر، والصدفة تنفّذه في سياقها (سوق / أرض ضمن التكلفة).
 */
export type MatrixAction =
  | {
      type: "save-cell";
      item: ValuationComparableSelectionDto;
      factorKey: string;
      raw: string;
    }
  | {
      type: "save-weight";
      item: ValuationComparableSelectionDto;
      rawPct: string;
      weightRationale: string;
    }
  | { type: "save-rationale"; factorKey: string; text: string }
  | {
      type: "save-line-rationale";
      selectionId: string;
      factorKey: string;
      text: string;
    }
  | {
      type: "toggle-included";
      item: ValuationComparableSelectionDto;
      factorKey: string;
    }
  | { type: "change-basis"; basis: "price_per_sqm" | "whole_property" }
  | { type: "reset-weights" }
  | { type: "area-factor-change"; value: string }
  | { type: "add-factor"; factorKey: string; labelAr: string }
  | { type: "remove-factor"; factorKey: string }
  | { type: "remove-sequential"; factorKey: string }
  | { type: "restore-sequential"; factorKey: string }
  | {
      type: "save-description";
      item: ValuationComparableSelectionDto;
      factorKey: string;
      text: string;
    }
  | { type: "save-subject-spec"; factorKey: string; text: string };

/** ينفّذ الأمر ويعيد نجاحه — الأوامر التي لا تُنتظر نتيجتها تعيد true. */
export type MatrixDispatch = (action: MatrixAction) => Promise<boolean>;

/** عمليات الصدفة التي يوصّلها المنفّذ — التواقيع كما هي معرّفة هناك. */
export type MatrixOps<TContext> = {
  saveMatrixCell(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ): Promise<boolean>;
  saveWeight(
    item: ValuationComparableSelectionDto,
    rawPct: string,
    weightRationale: string,
  ): Promise<boolean>;
  saveFactorRationale(
    factorKey: string,
    text: string,
    context: TContext,
  ): Promise<unknown> | void;
  saveLineRationaleOverride(
    selectionId: string,
    factorKey: string,
    text: string,
    context: TContext,
  ): Promise<unknown> | void;
  toggleFactorIncluded(
    item: ValuationComparableSelectionDto,
    factorKey: string,
  ): Promise<unknown> | void;
  changeAdjustmentBasis(
    basis: "price_per_sqm" | "whole_property",
  ): Promise<unknown> | void;
  resetWeights(context: TContext): Promise<boolean>;
  saveAreaFactorPct(value: string): Promise<unknown> | void;
  addDifferenceFactor(
    factorKey: string,
    labelAr: string,
    context?: TContext,
  ): Promise<unknown> | void;
  removeDifferenceFactor(
    factorKey: string,
    context?: TContext,
  ): Promise<unknown> | void;
  removeSequentialFactor(
    factorKey: string,
    context?: TContext,
  ): Promise<unknown> | void;
  restoreSequentialFactor(
    factorKey: string,
    context?: TContext,
  ): Promise<unknown> | void;
  saveCellDescription(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ): Promise<unknown> | void;
  saveSubjectSpec(factorKey: string, text: string): Promise<unknown> | void;
};

/**
 * منفّذ الأوامر — استراتيجية السياق تُمرَّر مرة واحدة فيتوحّد زوجا المقابض
 * (سوق/أرض) في مرسل واحد لكل سياق.
 */
export async function runMatrixAction<TContext>(
  ops: MatrixOps<TContext>,
  context: TContext,
  action: MatrixAction,
): Promise<boolean> {
  switch (action.type) {
    case "save-cell":
      return ops.saveMatrixCell(action.item, action.factorKey, action.raw);
    case "save-weight":
      return ops.saveWeight(action.item, action.rawPct, action.weightRationale);
    case "reset-weights":
      return ops.resetWeights(context);
    case "save-rationale":
      await ops.saveFactorRationale(action.factorKey, action.text, context);
      return true;
    case "save-line-rationale":
      await ops.saveLineRationaleOverride(
        action.selectionId,
        action.factorKey,
        action.text,
        context,
      );
      return true;
    case "toggle-included":
      await ops.toggleFactorIncluded(action.item, action.factorKey);
      return true;
    case "change-basis":
      await ops.changeAdjustmentBasis(action.basis);
      return true;
    case "area-factor-change":
      await ops.saveAreaFactorPct(action.value);
      return true;
    case "add-factor":
      await ops.addDifferenceFactor(action.factorKey, action.labelAr, context);
      return true;
    case "remove-factor":
      await ops.removeDifferenceFactor(action.factorKey, context);
      return true;
    case "remove-sequential":
      await ops.removeSequentialFactor(action.factorKey, context);
      return true;
    case "restore-sequential":
      await ops.restoreSequentialFactor(action.factorKey, context);
      return true;
    case "save-description":
      await ops.saveCellDescription(action.item, action.factorKey, action.text);
      return true;
    case "save-subject-spec":
      await ops.saveSubjectSpec(action.factorKey, action.text);
      return true;
  }
}
