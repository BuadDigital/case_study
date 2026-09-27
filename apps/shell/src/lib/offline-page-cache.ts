import type { PageId } from "@platform/types";
import {
  offlineFormPages,
  offlineLandingPath,
} from "@platform/app-shared/offline/offline-routes";

/** Re-warm at most this often when nothing changed (tasks refetch on a short interval). */
const REWARM_AFTER_MS = 30 * 60_000;

let lastWarm: { signature: string; at: number } | null = null;
let lastPlan: OfflinePagePlan | null = null;

export type OfflinePagePlan = { urls: string[]; landing: string | null };

/** Delete previous SW caches only after the new worker has a warmed profile. */
export function shouldDeletePreviousServiceWorkerCaches(
  newPagesCacheHasProfile: boolean,
): boolean {
  return newPagesCacheHasProfile;
}

export function lastWarmedOfflinePlan(): OfflinePagePlan | null {
  return lastPlan;
}

/** The field user's pages plus one detail route per assigned inspection task. */
export function offlinePagePlan(
  rolePages: readonly PageId[],
  tasks: ReadonlyArray<Record<string, unknown>>,
): OfflinePagePlan {
  // Only the input-form screens open offline (spec §3.1) — `OFFLINE_PAGE_PREFIXES` in sw.js.
  const pages = offlineFormPages(rolePages);
  const urls = pages.map((id) => `/${id}`);

  if (pages.includes("active-inspection")) {
    for (const task of tasks) {
      if (String(task.kind ?? task.Kind ?? "") !== "field-inspection") continue;
      const id = String(task.id ?? task.Id ?? "").trim();
      if (id) urls.push(`/active-inspection/${encodeURIComponent(id)}`);
    }
  }

  return { urls, landing: offlineLandingPath(rolePages) };
}

/**
 * Asks the service worker to keep offline copies of these pages and every chunk they
 * load. Skipped when the same plan was sent recently.
 */
export async function warmOfflinePages(
  userId: string,
  plan: OfflinePagePlan,
): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (plan.urls.length === 0) return;

  const signature = JSON.stringify([userId, plan.landing, [...plan.urls].sort()]);
  const now = Date.now();
  if (
    lastWarm?.signature === signature &&
    now - lastWarm.at < REWARM_AFTER_MS
  ) {
    return;
  }

  // First visit: the worker may still be installing — wait for it rather than skip,
  // or the pages would only be kept after the next task refresh.
  lastPlan = plan;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 30_000)),
  ]);
  const workers = [registration?.waiting, registration?.active].filter(
    (worker): worker is ServiceWorker => Boolean(worker),
  );
  if (workers.length === 0) return;
  lastWarm = { signature, at: now };
  const message = {
    type: "WARM_OFFLINE_PAGES",
    urls: plan.urls,
    landing: plan.landing,
  };
  for (const worker of workers) {
    worker.postMessage(message);
  }
}
