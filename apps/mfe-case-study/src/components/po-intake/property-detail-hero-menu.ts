import type { RowMoreMenuItem } from "@platform/ui-kit";

export const CASE_STUDY_OPEN_PROGRESS_MESSAGE = "جاري فتح دراسة العقار…";

export type PropertyDetailHeroMenuInput = {
  hideOpenCaseStudy: boolean;
  /** Full case-study workspace, preferred when the viewer can open it. */
  caseStudyWorkspaceHref: string | null;
  /** Property-detail «دراسة العقار» tab — used when the workspace is not available. */
  reportTabHref: string | null;
  caseStudyBusy?: boolean;
  onNavigate: (href: string) => void;
  onOpenFailure?: () => void;
};

export function buildPropertyDetailHeroMenuItems(
  input: PropertyDetailHeroMenuInput,
): RowMoreMenuItem[] {
  const items: RowMoreMenuItem[] = [];
  const caseStudyHref =
    input.caseStudyWorkspaceHref ?? input.reportTabHref;

  if (!input.hideOpenCaseStudy && caseStudyHref) {
    items.push({
      id: "case-study",
      label: "دراسة العقار",
      busy: Boolean(input.caseStudyBusy),
      disabled: Boolean(input.caseStudyBusy),
      onClick: () => input.onNavigate(caseStudyHref),
    });
  }

  if (input.onOpenFailure) {
    items.push({
      id: "failure",
      label: "تسجيل تعذر",
      danger: true,
      disabled: Boolean(input.caseStudyBusy),
      onClick: input.onOpenFailure,
    });
  }

  return items;
}
