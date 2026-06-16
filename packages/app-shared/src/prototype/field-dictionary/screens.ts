import type { PageId, RoleId } from "@platform/types";
import { NAV } from "../constants";
import { ACTIVE_TRANSACTIONS_NAV } from "../active-transactions";
import { PROPERTY_FIELDS_CATALOG } from "../property-fields-catalog";
import { roleIdsWithPageAccess } from "./roles";
import type { FieldDictionaryScreen } from "./types";

/** ربط مجموعة القاموس الحالي بصفحات النظام لاشتقاق الأدوار. */
const SCREEN_PAGE_MAP: Record<string, PageId[]> = {
  "po-intake": ["po", "active-primary-data"],
  bourse: ["bourse-inquiry"],
  "bourse-obstruction": ["bourse-inquiry"],
  "property-detail": ["po"],
  "property-detail-basic": ["po"],
  "property-detail-hero": ["po"],
  "inspector-core": ["property-inspection"],
  "inspector-infath": ["property-inspection"],
  "inspector-form-keys": ["property-inspection"],
  "engineering-core": ["active-survey"],
  "engineering-infath": ["active-survey"],
  "engineering-form-keys": ["active-survey"],
  "engineering-checklist": ["active-survey"],
  "engineering-checklist-notes": ["active-survey"],
  "evaluator-core": ["property-appraisal"],
  "evaluator-checklist": ["property-appraisal"],
  "evaluator-infath": ["property-appraisal"],
  "evaluator-form-keys": ["property-appraisal"],
  government: ["government-review"],
  "government-form-keys": ["government-review"],
  "keys-tab": ["keys", "government-review"],
  "case-study-meta": ["active-case-study"],
  "case-study-deed": ["active-case-study"],
  "case-study-survey": ["active-case-study"],
  "case-study-comp": ["active-case-study"],
  "case-study-occ": ["active-case-study"],
  "case-study-extra": ["active-case-study"],
  "specialist-infath": ["active-case-study"],
  "specialist-form-keys": ["active-case-study"],
  "valuation-coordination": ["valuation-coordination"],
  failures: ["failures"],
  "workflow-meta": ["active-primary-data"],
  "party-panel": ["active-primary-data"],
  "property-documents": ["po"],
  "system-auto": ["po"],
  "enfath-upload": ["po"],
  "infath-worker-license": ["po"],
  "backend-api": ["po"],
};

const PLACEHOLDER_PAGES = new Set<PageId>([
  ...NAV.filter((item) => item.placeholder).map((item) => item.id),
  ...ACTIVE_TRANSACTIONS_NAV.filter((item) => item.placeholder).map(
    (item) => item.id,
  ),
]);

/** الدور الأساسي لمجموعة الحقول حسب `sourceRole` في القاموس الحالي. */
export const CATALOG_SOURCE_ROLE_PRIMARY: Record<string, string> = {
  "أخصائي / عميل": "case-specialist",
  أخصائي: "case-specialist",
  معاين: "field-inspector",
  "مكتب هندسي": "engineering-office",
  مقيّم: "real-estate-appraiser",
  "مراجع حكومي": "government-reviewer",
  "منسق تقييم": "valuation-coordinator",
  "بورصة عقارية": "case-specialist",
  "أخصائي / نظام": "case-specialist",
  نظام: "general-manager",
};

export function buildFieldDictionaryScreens(): FieldDictionaryScreen[] {
  return PROPERTY_FIELDS_CATALOG.map((group) => {
    const pages = SCREEN_PAGE_MAP[group.id] ?? [];
    const rolesFromPages = roleIdsWithPageAccess(pages);
    const primary = CATALOG_SOURCE_ROLE_PRIMARY[group.sourceRole] as
      | RoleId
      | undefined;
    const roles: RoleId[] = primary
      ? [...new Set<RoleId>([primary, ...rolesFromPages])]
      : rolesFromPages;
    const status =
      pages.length > 0 && pages.every((p) => PLACEHOLDER_PAGES.has(p))
        ? "مخططة"
        : "موجودة";
    return {
      id: group.id,
      name: group.screen,
      roles,
      status,
    };
  });
}

export const FIELD_DICTIONARY_SCREENS = buildFieldDictionaryScreens();

export function fieldDictionaryScreenName(screenId: string): string {
  return (
    FIELD_DICTIONARY_SCREENS.find((screen) => screen.id === screenId)?.name ??
    screenId
  );
}

export function screensForRole(roleId: string): FieldDictionaryScreen[] {
  return FIELD_DICTIONARY_SCREENS.filter((screen) =>
    screen.roles.includes(roleId as never),
  );
}
