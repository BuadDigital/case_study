import type { RowMoreMenuItem } from "@platform/ui-kit";

export const CASE_STUDY_OPEN_PROGRESS_MESSAGE = "جاري فتح دراسة العقار…";

// Omar 2026-11-16: «صفحة المنسق» and «صفحة العمل» left this menu — the header is on those pages
// already, and «أعمالي» and the lists open them.
type PropertyDetailHeroMenuInput = {
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
