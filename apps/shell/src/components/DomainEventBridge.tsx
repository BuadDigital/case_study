"use client";

import { useEffect } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { appendAuditLogEntry } from "@platform/app-shared/audit/audit-log-store";
import { pushNotification } from "@platform/app-shared/notifications/notification-store";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@case-study/mfe/lib/case-study-field-inspection-events";

/** Bridges domain window events to notifications + audit log. */
export function DomainEventBridge() {
  const { displayName } = useAuth();

  useEffect(() => {
    const actor = displayName ?? "مستخدم";

    function onFailureChange() {
      pushNotification({
        title: "تحديث في التعذرات",
        body: "راجع قائمة التعذرات.",
        tone: "warn",
        href: "/failures",
      });
      appendAuditLogEntry({
        actor,
        action: "تحديث تعذرات",
        entity: "failures",
      });
    }

    function onInspectionSubmit() {
      pushNotification({
        title: "إرسال معاينة",
        body: "اكتملت معاينة عقار.",
        tone: "success",
        href: "/property-inspection",
      });
      appendAuditLogEntry({
        actor,
        action: "إرسال معاينة ميدانية",
        entity: "field-inspection",
      });
    }

    window.addEventListener(FAILURES_CHANGED_EVENT, onFailureChange);
    window.addEventListener(
      FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
      onInspectionSubmit,
    );
    return () => {
      window.removeEventListener(FAILURES_CHANGED_EVENT, onFailureChange);
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onInspectionSubmit,
      );
    };
  }, [displayName]);

  return null;
}
