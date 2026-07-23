import {
  ENGINEERING_SURVEY_ACCEPTED_EVENT,
  ENGINEERING_SURVEY_RETURNED_EVENT,
  ENGINEERING_SURVEY_SUBMITTED_EVENT,
} from "../prototype/party-workflow-events";
import type { AppNotification } from "./notification-store";

export const ENGINEERING_OFFICE_ROLE = "engineering-office";

export function isEngineeringOfficeRole(
  role: string | null | undefined,
): boolean {
  return role === ENGINEERING_OFFICE_ROLE;
}

function isEngineeringSurveyLifecycleEvent(
  sourceEvent: string | undefined,
): boolean {
  if (!sourceEvent) return false;
  return (
    sourceEvent === ENGINEERING_SURVEY_SUBMITTED_EVENT ||
    sourceEvent === ENGINEERING_SURVEY_RETURNED_EVENT ||
    sourceEvent === ENGINEERING_SURVEY_ACCEPTED_EVENT ||
    sourceEvent.startsWith("engineering-survey-returned:") ||
    sourceEvent.startsWith("engineering-survey-accepted:")
  );
}

/** مكتب الهندسي — يسمح فقط بإشعارات الرفع المساحي وإسناد المهام الخاصة به. */
export function isAllowedEngineeringOfficeNotification(
  sourceEvent: string | undefined,
): boolean {
  return (
    isEngineeringSurveyLifecycleEvent(sourceEvent) ||
    sourceEvent?.startsWith("distribution-assigned:") === true ||
    sourceEvent?.startsWith("distribution-assigned-batch:") === true
  );
}

export function shouldDeliverDomainNotification(
  role: string | null | undefined,
  eventName: string,
): boolean {
  if (!isEngineeringOfficeRole(role)) return true;
  return (
    isEngineeringSurveyLifecycleEvent(eventName) ||
    eventName.startsWith("distribution-assigned:") ||
    eventName.startsWith("distribution-assigned-batch:")
  );
}

export function shouldShowNotificationToast(
  role: string | null | undefined,
  item: Pick<AppNotification, "sourceEvent">,
): boolean {
  if (!isEngineeringOfficeRole(role)) return true;
  return isAllowedEngineeringOfficeNotification(item.sourceEvent);
}

export function filterNotificationsForRole<T extends Pick<AppNotification, "sourceEvent">>(
  role: string | null | undefined,
  items: T[],
): T[] {
  if (!isEngineeringOfficeRole(role)) return items;
  return items.filter((item) =>
    isAllowedEngineeringOfficeNotification(item.sourceEvent),
  );
}
