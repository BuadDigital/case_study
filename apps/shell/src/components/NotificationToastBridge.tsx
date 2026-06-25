"use client";

import { useEffect } from "react";
import { useOptionalToast, type ToastTone } from "@platform/design-system";
import {
  NOTIFICATION_PUSHED_EVENT,
  NOTIFICATION_TOAST_EVENT,
  type AppNotification,
} from "@platform/app-shared/notifications/notification-store";

function toastToneForNotification(
  tone: AppNotification["tone"],
): ToastTone {
  if (tone === "success") return "success";
  if (tone === "warn") return "error";
  return "info";
}

function toastMessageForNotification(item: AppNotification): string {
  if (item.body) return `${item.title} — ${item.body}`;
  return item.title;
}

/** Shows a short toast when a notification is pushed to the inbox. */
export function NotificationToastBridge() {
  const toast = useOptionalToast();

  useEffect(() => {
    if (!toast) return;
    const { showToast } = toast;

    function onPushed(event: Event) {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (!item) return;
      showToast(
        toastMessageForNotification(item),
        toastToneForNotification(item.tone),
      );
    }

    window.addEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
    window.addEventListener(NOTIFICATION_TOAST_EVENT, onPushed);
    return () => {
      window.removeEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
      window.removeEventListener(NOTIFICATION_TOAST_EVENT, onPushed);
    };
  }, [toast]);

  return null;
}
