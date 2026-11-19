import type { PageId, RoleId } from "@platform/types";
import { activeTransactionNavForRole } from "@platform/app-shared/app-data/active-transactions";
import { PARTY_TASK_PAGES } from "@platform/app-shared/app-data/party-task-pages";
import { Pages } from "@platform/types";

/** The stage queues counted from the task list (the bourse queue is counted from its own list). */
const TASK_STAGE_PAGES: readonly PageId[] = [
  Pages.ActivePrimaryData,
  Pages.ActiveDistribution,
  Pages.ActiveReceipt,
  Pages.ActiveCaseStudy,
  Pages.SystemUpload,
];

export type NavBadgeNeeds = {
  /** The pages whose count the sidebar shows — no other count is worked out. */
  shown: ReadonlySet<PageId>;
  tasks: boolean;
  poRecords: boolean;
  pendingBourse: boolean;
  staff: boolean;
  fees: boolean;
};

/**
 * What the sidebar's counts need for this role (2026-11-19).
 *
 * How it works: the counted pages are the «قوائم العمل» rows the role sees
 * (`activeTransactionNavForRole`); each list is loaded only when one of those pages counts from it —
 * the tasks for the stage and party queues, the work orders for the primary-data, distribution and
 * party queues, the bourse items for «استعلام البورصة», the staff for the party queues, the fees
 * summary for «فوترة الأتعاب».
 * Edge cases: «أعمالي» replaced the stage queues, «تقييم العقار» and «معاينة العقار» in the sidebar of
 * every role that has it, so those roles count none of them — they used to download every task, every
 * work order, the bourse list, the failures and the staff on each page, for counts nobody saw.
 */
export function navBadgeNeeds(rolePages: PageId[], role: RoleId): NavBadgeNeeds {
  const shown = new Set(activeTransactionNavForRole(rolePages, role).map((item) => item.id));
  const partyQueues = Object.values(PARTY_TASK_PAGES).some(
    (def) => def.roleId === role && shown.has(def.pageId),
  );
  return {
    shown,
    tasks: partyQueues || TASK_STAGE_PAGES.some((id) => shown.has(id)),
    poRecords:
      partyQueues || shown.has(Pages.ActivePrimaryData) || shown.has(Pages.ActiveDistribution),
    pendingBourse: shown.has(Pages.BourseInquiry),
    staff: partyQueues,
    fees: shown.has(Pages.PartyFees),
  };
}
