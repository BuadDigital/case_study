import { PARTY_TASK_RECALL_REQUESTED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";
import {
  SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
} from "@case-study/mfe";
import { FAILURE_TYPES_CHANGED_EVENT } from "@failures/mfe/lib/failure-types-events";
import {
  ENGINEERING_SURVEY_ACCEPTED_EVENT,
  ENGINEERING_SURVEY_RETURNED_EVENT,
  EVALUATOR_SUBMITTED_EVENT,
  FIELD_INSPECTION_SUBMITTED_EVENT,
} from "@platform/app-shared/prototype/party-workflow-events";
import type { PushNotificationInput } from "@platform/app-shared/notifications/notification-store";

type DomainNotificationRule = {
  event: string;
  notification: PushNotificationInput;
};

/** Inbox + toast rules — workflow submits use dedicated *-submitted events only. */
export const DOMAIN_NOTIFICATION_RULES: DomainNotificationRule[] = [
  // FAILURES_CHANGED_EVENT is intentionally omitted: it only fires in the
  // same browser that mutated failures, and raise/resolve UIs already show a
  // specific success toast. The generic "تحديث في التعذرات" toast was a
  // duplicate (same pattern as ENGINEERING_SURVEY_SUBMITTED). Queries still
  // listen for the event directly for invalidate/refresh.
  {
    event: FAILURE_TYPES_CHANGED_EVENT,
    notification: {
      title: "تحديث أنواع التعذر",
      body: "تم تعديل تصنيفات التعذر.",
      tone: "info",
      href: "/failure-types",
      category: "system",
      sourceEvent: FAILURE_TYPES_CHANGED_EVENT,
    },
  },
  {
    event: FIELD_INSPECTION_SUBMITTED_EVENT,
    notification: {
      title: "إرسال معاينة",
      body: "تم إرسال المعاينة الميدانية.",
      tone: "success",
      href: "/active-inspection",
      category: "workflow",
      entityType: "task",
      sourceEvent: FIELD_INSPECTION_SUBMITTED_EVENT,
    },
  },
  // ENGINEERING_SURVEY_SUBMITTED_EVENT is intentionally omitted: it only fires
  // in the submitter's browser, and PartyActiveTaskWork already shows the
  // single success toast ("اكتمل الرفع المساحي لهذا العقار."). Domain toasts
  // here duplicated that message (option A only). Returned/accepted stay —
  // those are still useful inbox signals for the engineering office.
  {
    event: ENGINEERING_SURVEY_RETURNED_EVENT,
    notification: {
      title: "إعادة للتصحيح",
      body: "أُعيدت مخرجات الرفع المساحي للتصحيح.",
      tone: "warn",
      href: "/active-survey",
      category: "workflow",
      entityType: "task",
      sourceEvent: ENGINEERING_SURVEY_RETURNED_EVENT,
    },
  },
  {
    event: ENGINEERING_SURVEY_ACCEPTED_EVENT,
    notification: {
      title: "قبول المخرجات",
      body: "تم قبول مخرجات الرفع المساحي واستحقاق الأتعاب.",
      tone: "success",
      href: "/active-survey",
      category: "workflow",
      entityType: "task",
      sourceEvent: ENGINEERING_SURVEY_ACCEPTED_EVENT,
    },
  },
  {
    event: EVALUATOR_SUBMITTED_EVENT,
    notification: {
      title: "إرسال تقرير مقيم",
      body: "تم إرسال تقرير المقيم.",
      tone: "success",
      href: "/property-appraisal",
      category: "workflow",
      entityType: "task",
      sourceEvent: EVALUATOR_SUBMITTED_EVENT,
    },
  },
  {
    event: PARTY_TASK_RECALL_REQUESTED_EVENT,
    notification: {
      title: "طلب استرجاع معاملة",
      body: "وصل طلب استرجاع من أحد الأطراف للمراجعة.",
      tone: "warn",
      href: "/property-appraisal",
      category: "workflow",
      entityType: "task",
      sourceEvent: PARTY_TASK_RECALL_REQUESTED_EVENT,
    },
  },
  {
    event: SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
    notification: {
      title: "معاملات معلّقة",
      body: "تغيّرت قائمة المعاملات المعلّقة.",
      tone: "warn",
      href: "/suspended-transactions",
      category: "workflow",
      entityType: "property",
      sourceEvent: SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
    },
  },
];
