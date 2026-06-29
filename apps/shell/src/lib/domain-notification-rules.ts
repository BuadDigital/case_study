import { FAILURES_CHANGED_EVENT } from "@failures/mfe";
import { EVALUATOR_RECALL_CHANGED_EVENT } from "@evaluator/mfe";
import {
  SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
} from "@case-study/mfe";
import { FAILURE_TYPES_CHANGED_EVENT } from "@failures/mfe/lib/failure-types-events";
import {
  ENGINEERING_SURVEY_SUBMITTED_EVENT,
  EVALUATOR_SUBMITTED_EVENT,
  FIELD_INSPECTION_SUBMITTED_EVENT,
  GOVERNMENT_REVIEW_SUBMITTED_EVENT,
  VALUATION_COORDINATION_SUBMITTED_EVENT,
} from "@platform/app-shared/prototype/party-workflow-events";
import type { PushNotificationInput } from "@platform/app-shared/notifications/notification-store";

export type DomainNotificationRule = {
  event: string;
  notification: PushNotificationInput;
  auditAction: string;
  auditEntity: string;
};

/** Inbox + toast rules — workflow submits use dedicated *-submitted events only. */
export const DOMAIN_NOTIFICATION_RULES: DomainNotificationRule[] = [
  {
    event: FAILURES_CHANGED_EVENT,
    notification: {
      title: "تحديث في التعذرات",
      body: "راجع قائمة التعذرات.",
      tone: "warn",
      href: "/failures",
      category: "failures",
      entityType: "failure",
      sourceEvent: FAILURES_CHANGED_EVENT,
    },
    auditAction: "تحديث تعذرات",
    auditEntity: "failures",
  },
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
    auditAction: "تحديث أنواع التعذر",
    auditEntity: "failure-types",
  },
  {
    event: FIELD_INSPECTION_SUBMITTED_EVENT,
    notification: {
      title: "إرسال معاينة",
      body: "تم إرسال المعاينة الميدانية.",
      tone: "success",
      href: "/property-inspection",
      category: "workflow",
      entityType: "task",
      sourceEvent: FIELD_INSPECTION_SUBMITTED_EVENT,
    },
    auditAction: "إرسال معاينة ميدانية",
    auditEntity: "field-inspection",
  },
  {
    event: ENGINEERING_SURVEY_SUBMITTED_EVENT,
    notification: {
      title: "إرسال الرفع المساحي",
      body: "تم إرسال الرفع المساحي.",
      tone: "success",
      href: "/active-survey",
      category: "workflow",
      entityType: "task",
      sourceEvent: ENGINEERING_SURVEY_SUBMITTED_EVENT,
    },
    auditAction: "إرسال الرفع المساحي",
    auditEntity: "active-survey",
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
    auditAction: "إرسال تقرير مقيم",
    auditEntity: "property-appraisal",
  },
  {
    event: EVALUATOR_RECALL_CHANGED_EVENT,
    notification: {
      title: "استدعاء تقرير مقيم",
      body: "تم استدعاء تقرير للمراجعة.",
      tone: "warn",
      href: "/property-appraisal",
      category: "workflow",
      entityType: "task",
      sourceEvent: EVALUATOR_RECALL_CHANGED_EVENT,
    },
    auditAction: "استدعاء تقرير مقيم",
    auditEntity: "property-appraisal",
  },
  {
    event: GOVERNMENT_REVIEW_SUBMITTED_EVENT,
    notification: {
      title: "مراجعة حكومية",
      body: "تم إرسال المراجعة الحكومية.",
      tone: "success",
      href: "/government-review",
      category: "workflow",
      entityType: "task",
      sourceEvent: GOVERNMENT_REVIEW_SUBMITTED_EVENT,
    },
    auditAction: "إرسال مراجعة حكومية",
    auditEntity: "government-review",
  },
  {
    event: VALUATION_COORDINATION_SUBMITTED_EVENT,
    notification: {
      title: "استلام تقييم",
      body: "تم إرسال استلام التقييم.",
      tone: "success",
      href: "/valuation-coordination",
      category: "workflow",
      entityType: "task",
      sourceEvent: VALUATION_COORDINATION_SUBMITTED_EVENT,
    },
    auditAction: "إرسال استلام تقييم",
    auditEntity: "valuation-coordination",
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
    auditAction: "تحديث معاملات معلّقة",
    auditEntity: "suspended-transactions",
  },
];
