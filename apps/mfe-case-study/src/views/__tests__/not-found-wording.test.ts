import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * «لم يُعثَر على …» is impersonal passive — the verb does not agree with «المهمة» / «معاملة»
 * («لم تُعثر» was shown on the party task page and the case-study chips).
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) && !full.includes("__tests__") ? [full] : [];
  });
}

describe("not-found wording", () => {
  it("never says «لم تُعثر»", () => {
    const root = join(__dirname, "..", "..");
    const offenders = sources(root).filter((file) => readFileSync(file, "utf8").includes("لم تُعثر"));
    expect(offenders).toEqual([]);
  });
});
