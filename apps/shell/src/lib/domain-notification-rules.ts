import { FAILURES_CHANGED_EVENT } from "@failures/mfe";
import {
  EVALUATOR_RECALL_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
} from "@evaluator/mfe";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "@engineering-office/mfe";
import {
  SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
  TASKS_CHANGED_EVENT,
  WORK_ORDERS_CHANGED_EVENT,
} from "@case-study/mfe";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@case-study/mfe/lib/case-study-field-inspection-events";
import { GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT } from "@case-study/mfe/lib/prototype/government-review-work-storage";
import { VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT } from "@case-study/mfe/lib/prototype/valuation-coordination-work-storage";
import { FAILURE_TYPES_CHANGED_EVENT } from "@failures/mfe/lib/failure-types-events";
import type { PushNotificationInput } from "@platform/app-shared/notifications/notification-store";

export type DomainNotificationRule = {
  event: string;
  notification: PushNotificationInput;
  auditAction: string;
  auditEntity: string;
};

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
    event: FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
    notification: {
      title: "إرسال معاينة",
      body: "اكتملت معاينة عقار.",
      tone: "success",
      href: "/property-inspection",
      category: "workflow",
      entityType: "task",
      sourceEvent: FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
    },
    auditAction: "إرسال معاينة ميدانية",
    auditEntity: "field-inspection",
  },
  {
    event: ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
    notification: {
      title: "إرسال مسح هندسي",
      body: "اكتمل مسح عقار.",
      tone: "success",
      href: "/active-survey",
      category: "workflow",
      entityType: "task",
      sourceEvent: ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
    },
    auditAction: "إرسال مسح هندسي",
    auditEntity: "active-survey",
  },
  {
    event: EVALUATOR_SUBMISSION_CHANGED_EVENT,
    notification: {
      title: "إرسال تقرير مقيم",
      body: "اكتمل رفع تقرير المقيم.",
      tone: "success",
      href: "/property-appraisal",
      category: "workflow",
      entityType: "task",
      sourceEvent: EVALUATOR_SUBMISSION_CHANGED_EVENT,
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
    event: GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
    notification: {
      title: "مراجعة حكومية",
      body: "تم تحديث مراجعة حكومية.",
      tone: "success",
      href: "/government-review",
      category: "workflow",
      entityType: "task",
      sourceEvent: GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
    },
    auditAction: "تحديث مراجعة حكومية",
    auditEntity: "government-review",
  },
  {
    event: VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT,
    notification: {
      title: "استلام تقييم",
      body: "تم تحديث استلام التقييم.",
      tone: "success",
      href: "/valuation-coordination",
      category: "workflow",
      entityType: "task",
      sourceEvent: VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT,
    },
    auditAction: "تحديث استلام تقييم",
    auditEntity: "valuation-coordination",
  },
  {
    event: TASKS_CHANGED_EVENT,
    notification: {
      title: "تحديث المهام",
      body: "تغيّرت حالة مهام سير العمل.",
      tone: "info",
      href: "/active-case-study",
      category: "workflow",
      entityType: "task",
      sourceEvent: TASKS_CHANGED_EVENT,
    },
    auditAction: "تحديث مهام سير العمل",
    auditEntity: "workflow-tasks",
  },
  {
    event: WORK_ORDERS_CHANGED_EVENT,
    notification: {
      title: "تحديث أوامر العمل",
      body: "راجع أوامر العمل المرتبطة بالمعاملات.",
      tone: "info",
      href: "/active-case-study",
      category: "workflow",
      entityType: "work-order",
      sourceEvent: WORK_ORDERS_CHANGED_EVENT,
    },
    auditAction: "تحديث أوامر العمل",
    auditEntity: "work-orders",
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
