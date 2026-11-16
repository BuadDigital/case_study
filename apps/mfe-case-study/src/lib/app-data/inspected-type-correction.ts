/**
 * Case staff's change of a submitted inspection's property type (Omar 2026-11-12: the study
 * specialist changes the type too; 2026-11-16: in its own field of «خصائص العقار», like any other
 * answer, no reason asked). The server (`PartyTaskSubmissionService.CorrectInspectedTypeAsync`) is
 * the judge.
 */
import { textLooksLikeVacantLand } from "@platform/app-shared/app-data/inspector-workspace-data";

/** The type changed (trimmed, exact); an empty choice is no change. */
export function inspectedTypeChanged(currentType: string, nextType: string): boolean {
  return nextType.trim() !== "" && nextType.trim() !== currentType.trim();
}

/**
 * What a change between land and a built type does to the inspector's answers, said once it is saved.
 *
 * How it works: to land — the building answers are hidden, not deleted, and come back with the type;
 * from land — they show again, and whatever the inspector never entered is missing.
 * Edge cases: no crossing (villa → building, residential land → commercial land) says nothing. The
 * screen cannot tell whether hidden answers are stored (a land's draft never carries them), so the
 * second note covers both an inspection done as land and a type changed to land and back.
 */
export function inspectedTypeCrossingNote(currentType: string, nextType: string): string | null {
  if (!inspectedTypeChanged(currentType, nextType)) return null;
  const wasLand = textLooksLikeVacantLand(currentType);
  const isLand = textLooksLikeVacantLand(nextType);
  if (wasLand === isLand) return null;
  return isLand
    ? "حقول المبنى التي أدخلها المعاين (الواجهة، حالة البناء، الإشغال…) تُخفى ولا تُحذف، وتعود إن رجع النوع."
    : "حقول المبنى (الواجهة، حالة البناء، الإشغال…) تظهر من جديد. ما لم يُدخله المعاين منها يُطلب عند تأكيد مدخلاته، وبعد التأكيد يُستكمل بإعادة المعاينة للمعاين.";
}
