import type { PageId } from "./navigation";

/** API-ready case-study transaction sidebar entries (shared by shell + MFE). */
type CaseStudyReadyNavItem = {
  id: PageId;
  label: string;
  icon: string;
};

export const CASE_STUDY_READY_NAV: CaseStudyReadyNavItem[] = [
  {
    id: "active-primary-data",
    label: "البيانات الأولية",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
  },
  {
    id: "bourse-inquiry",
    label: "استعلام بورصة",
    icon: "M3 3h18v18H3zM7 7h10v4H7zM7 13h6v4H7z",
  },
  {
    id: "active-distribution",
    label: "توزيع المعاملات",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
  },
];
