import type { RowMoreMenuItem } from "@platform/ui-kit";

export const CASE_STUDY_OPEN_PROGRESS_MESSAGE = "جاري فتح دراسة العقار…";

type PropertyDetailHeroMenuInput = {
  /** The transaction's work page (input and actions); null when the viewer may not open it. */
  workPageHref?: string | null;
  /** The coordinator's page (intake and the parties' follow-up, Omar 2026-11-08); null when not offered. */
  coordinationPageHref?: string | null;
  hideOpenCaseStudy: boolean;
  /** Full case-study workspace, preferred when the viewer can open it. */
  caseStudyWorkspaceHref: string | null;
  /** Property-detail «دراسة العقار» tab — used when the workspace is not available. */
  reportTabHref: string | null;
  caseStudyBusy?: boolean;
  onNavigate: (href: string) => void;
  /**
   * The general actions (reopen, failure, cancellation) from `useTransactionGeneralActions` —
   * the same items every row's ⋮ menu shows (2026-11-05).
   */
  generalItems?: RowMoreMenuItem[];
};

export function buildPropertyDetailHeroMenuItems(
  input: PropertyDetailHeroMenuInput,
): RowMoreMenuItem[] {
  const items: RowMoreMenuItem[] = [];
  const caseStudyHref = input.caseStudyWorkspaceHref ?? input.reportTabHref;
  const workPageHref = input.workPageHref;

  const coordinationPageHref = input.coordinationPageHref;
  if (coordinationPageHref) {
    items.push({
      id: "coordination-page",
      label: "صفحة المنسق",
      disabled: Boolean(input.caseStudyBusy),
      onClick: () => input.onNavigate(coordinationPageHref),
    });
  }

  if (workPageHref) {
    items.push({
      id: "work-page",
      label: "صفحة العمل",
      disabled: Boolean(input.caseStudyBusy),
      onClick: () => input.onNavigate(workPageHref),
    });
  }

  if (!input.hideOpenCaseStudy && caseStudyHref) {
    items.push({
      id: "case-study",
      label: "دراسة العقار",
      busy: Boolean(input.caseStudyBusy),
      disabled: Boolean(input.caseStudyBusy),
      onClick: () => input.onNavigate(caseStudyHref),
    });
  }

  items.push(...(input.generalItems ?? []));

  return items;
}
