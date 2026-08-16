import type { NavItem, PageId } from "@platform/types";

/** قاموس مرفقات التقرير — أنواع + يُطبع */
export const ATTACHMENT_PRINT_DICTIONARY_NAV_ITEM: NavItem = {
  id: "attachment-print-dictionary",
  label: "قاموس مرفقات التقرير",
  icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6",
  grp: null,
};

export const ATTACHMENT_PRINT_DICTIONARY_PAGE_ID: PageId =
  ATTACHMENT_PRINT_DICTIONARY_NAV_ITEM.id;

export function isAttachmentPrintDictionaryPage(page: PageId): boolean {
  return page === ATTACHMENT_PRINT_DICTIONARY_PAGE_ID;
}
