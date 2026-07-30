import { beforeEach, describe, expect, it } from "vitest";
import { notificationFromDto } from "../src/notifications/notification-mappers";
import {
  listNotifications,
  markNotificationRead,
  notificationStorageKey,
  pushNotification,
  setNotificationStorageUser,
} from "../src/notifications/notification-store";

describe("notification contract and browser persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    setNotificationStorageUser(null);
  });

  it("maps legacy warning and keeps operations-task entities", () => {
    const item = notificationFromDto({
      id: "notification-1",
      title: "Reminder",
      tone: "warning",
      entityType: "operations-task",
      createdAtUtc: "2026-07-29T10:00:00.000Z",
      read: false,
    });

    expect(item.tone).toBe("warn");
    expect(item.entityType).toBe("operations-task");
  });

  it("migrates the legacy inbox once and isolates subsequent users", () => {
    localStorage.setItem(
      "ree-notifications",
      JSON.stringify([
        {
          id: "legacy-1",
          title: "Legacy",
          createdAt: "2026-07-29T10:00:00.000Z",
          read: false,
        },
      ]),
    );

    setNotificationStorageUser("user-1");
    expect(listNotifications().map((item) => item.id)).toEqual(["legacy-1"]);
    expect(localStorage.getItem("ree-notifications")).toBeNull();

    setNotificationStorageUser("user-2");
    expect(listNotifications()).toEqual([]);
    pushNotification({ title: "User two" });

    setNotificationStorageUser("user-1");
    expect(listNotifications().map((item) => item.id)).toEqual(["legacy-1"]);
    expect(localStorage.getItem(notificationStorageKey("user-2"))).toContain(
      "User two",
    );
  });

  it("deduplicates within a user namespace and persists read state", () => {
    setNotificationStorageUser("user-1");
    const first = pushNotification({
      title: "First",
      sourceEvent: "same-event",
    });
    const updated = pushNotification({
      title: "Updated",
      sourceEvent: "same-event",
    });

    expect(updated.id).toBe(first.id);
    expect(listNotifications()).toHaveLength(1);

    markNotificationRead(updated.id);
    expect(listNotifications()[0]?.read).toBe(true);
  });
});
