import { describe, expect, it } from "vitest";
import {
  isPushSupported,
  urlBase64ToUint8Array,
} from "../notifications/web-push";

describe("web-push helpers", () => {
  it("reports unsupported without PushManager", () => {
    expect(isPushSupported()).toBe(false);
  });

  it("decodes VAPID base64url keys", () => {
    const bytes = urlBase64ToUint8Array("AQID");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
