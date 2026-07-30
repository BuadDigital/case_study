import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  clearApiWriteInterceptor,
  installApiWriteInterceptor,
  repositoryFetch,
} from "./write-repository";

describe("API write repository", () => {
  afterEach(() => {
    clearApiWriteInterceptor();
    vi.unstubAllGlobals();
  });

  it("routes every mutating HTTP verb through one interceptor", async () => {
    const nativeFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", nativeFetch);
    const seen: string[] = [];
    installApiWriteInterceptor(async (request, next) => {
      seen.push(request.method);
      return next();
    });

    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      await repositoryFetch("/api/resource", { method });
    }

    expect(seen).toEqual(["POST", "PUT", "PATCH", "DELETE"]);
    expect(nativeFetch).toHaveBeenCalledTimes(4);
  });

  it("does not treat reads as writes", async () => {
    const nativeFetch = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", nativeFetch);
    const interceptor = vi.fn();
    installApiWriteInterceptor(interceptor);

    await repositoryFetch("/api/resource");

    expect(interceptor).not.toHaveBeenCalled();
    expect(nativeFetch).toHaveBeenCalledOnce();
  });

  it("lets the offline layer defer a write without reaching the network", async () => {
    const nativeFetch = vi.fn();
    vi.stubGlobal("fetch", nativeFetch);
    installApiWriteInterceptor(
      async (request) =>
        new Response(JSON.stringify({ queued: request.method }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const response = await repositoryFetch("/api/resource", {
      method: "PATCH",
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ queued: "PATCH" });
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it("keeps application HTTP writes behind the repository", () => {
    const offenders: string[] = [];
    for (const root of ["packages/api-client/src", "apps"]) {
      for (const file of sourceFiles(resolve(process.cwd(), root))) {
        const source = readFileSync(file, "utf8");
        if (!/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/.test(source))
          continue;
        if (
          source.includes("repositoryFetch as fetch") ||
          file.endsWith("write-repository.ts")
        ) {
          continue;
        }
        offenders.push(file.replaceAll("\\", "/"));
      }
    }

    expect(offenders, "Direct HTTP writes bypass the repository").toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (name.includes(".test.") || name.includes(".spec.")) return [];
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
