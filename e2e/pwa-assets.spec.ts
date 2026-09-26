import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

test.describe("PWA assets", () => {
  test("offline.html is tracked and present", () => {
    const file = path.resolve("apps/shell/public/offline.html");
    expect(fs.existsSync(file)).toBeTruthy();
    const html = fs.readFileSync(file, "utf8");
    expect(html).toContain("أنت دون اتصال حالياً");
  });

  test("service worker includes push handlers and resilient precache", () => {
    const file = path.resolve("apps/shell/public/sw.js");
    const sw = fs.readFileSync(file, "utf8");
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain('const CACHE_PREFIX = "ejada-shell-"');
    expect(sw).toContain("One missing asset must not block SW installation");
  });

  test("service worker keeps the field inspector's working pages", () => {
    const sw = fs.readFileSync(path.resolve("apps/shell/public/sw.js"), "utf8");
    expect(sw).toContain('"/active-inspection"');
    expect(sw).toContain('"/operations-tasks"');
    expect(sw).toContain('data.type === "WARM_OFFLINE_PAGES"');
  });
});
