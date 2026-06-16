import type { PageId } from "@platform/types";
import {
  CASE_STUDY_READY_NAV,
  type CaseStudyReadyNavItem,
} from "@platform/types";

/** Routes owned by @case-study/mfe (API-backed, ready for independent deploy). */
export type CaseStudyMfeRoute =
  | "po"
  | "active-primary-data"
  | "bourse-inquiry"
  | "active-distribution";

export type CaseStudyMfeRouteDef = CaseStudyReadyNavItem & {
  path: `/${CaseStudyMfeRoute}` | "/po";
};

/** Sidebar entries for the ready case-study transaction path. */
export const CASE_STUDY_READY_NAV_WITH_PATHS: CaseStudyMfeRouteDef[] =
  CASE_STUDY_READY_NAV.map((item) => ({
    ...item,
    path: `/${item.id}` as CaseStudyMfeRouteDef["path"],
  }));

export { CASE_STUDY_READY_NAV };

export const CASE_STUDY_READY_PAGE_IDS: ReadonlySet<PageId> = new Set([
  "po",
  "active-primary-data",
  "bourse-inquiry",
  "active-distribution",
]);

export function isCaseStudyMfePage(page: string): page is PageId {
  return CASE_STUDY_READY_PAGE_IDS.has(page as PageId);
}

/** PO sub-routes remain under /po/* in the shell host. */
export const CASE_STUDY_PO_PATH_PREFIX = "/po";
