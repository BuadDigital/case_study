import { describe, expect, it } from "vitest";
import {
  filterNotificationsForRole,
  shouldShowNotificationToast,
} from "../role-notification-policy";
import type { AppNotification } from "../notification-store";

function item(sourceEvent: string): Pick<AppNotification, "sourceEvent"> {
  return { sourceEvent };
}

describe("engineering-office notification allowlist", () => {
  it("lets a reassignment-replaced notice through — the party losing the task must see it", () => {
    expect(
      shouldShowNotificationToast(
        "engineering-office",
        item("distribution-replaced:11111111-1111-1111-1111-111111111111:2026-01-01T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      filterNotificationsForRole("engineering-office", [
        item("distribution-replaced:11111111-1111-1111-1111-111111111111:2026-01-01T00:00:00.000Z"),
      ]),
    ).toHaveLength(1);
  });

  it("still blocks notifications outside the engineering-office allowlist", () => {
    expect(shouldShowNotificationToast("engineering-office", item("failure-raised:1"))).toBe(
      false,
    );
  });

  it("other roles are not filtered at all", () => {
    expect(shouldShowNotificationToast("real-estate-appraiser", item("failure-raised:1"))).toBe(
      true,
    );
  });
});
