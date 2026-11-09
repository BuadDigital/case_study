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
  {
    // Coordination's formal receipt of the parties' work (ruling 2026-11-02).
    id: "active-receipt",
    label: "الاستلام من الأطراف",
    icon: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  },
];
