"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal, Button } from "@platform/ui-kit";
import {
  NOTIFICATION_TOAST_EVENT,
  type AppNotification,
} from "@platform/app-shared/notifications/notification-store";
import type { RoleId } from "@platform/types";
import { partyTaskPath } from "../lib/my-task-routes";
import { homePageIdForRole, isTaskReassignedAwayNotice } from "./party-reassignment-notice-state";

/**
 * A party actively working a task screen learns immediately — not only from
 * the inbox — that «تعديل إسناد الأطراف» just moved this exact task to
 * someone else, and is walked back to their own queue instead of continuing
 * to edit a task that is no longer theirs.
 */
export function PartyReassignmentNotice({
  taskId,
  roleId,
}: {
  taskId: string;
  roleId: RoleId;
}) {
  const router = useRouter();
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    function onToast(event: Event) {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (isTaskReassignedAwayNotice(taskId, item)) setTaken(true);
    }
    window.addEventListener(NOTIFICATION_TOAST_EVENT, onToast);
    return () => window.removeEventListener(NOTIFICATION_TOAST_EVENT, onToast);
  }, [taskId]);

  if (!taken) return null;

  const homePageId = homePageIdForRole(roleId);
  const goHome = () => router.replace(homePageId ? partyTaskPath(homePageId) : "/");

  return (
    <AppModal
      open
      title="أُلغي إسنادك"
      onClose={goHome}
      footer={
        <Button
          type="button"
          variant="primary"
          showActionToast={false}
          onClick={goHome}
        >
          حسناً
        </Button>
      }
    >
      <p className="m-0 text-[13px] leading-relaxed text-text-2">
        أُعيد إسناد هذه المعاملة إلى طرف آخر — لم تعد ضمن أعمالك.
      </p>
    </AppModal>
  );
}
