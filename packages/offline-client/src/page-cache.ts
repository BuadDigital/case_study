/**
 * The service worker (`apps/shell/public/sw.js`) keeps the field user's page HTML in
 * `ejada-shell-<build>-pages`. Those copies belong to the signed-in user, so they go
 * with the rest of the offline data on logout / auth rejection.
 */
const PAGE_CACHE_PREFIX = "ejada-shell-";
const PAGE_CACHE_SUFFIX = "-pages";

export async function clearOfflinePageCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(
        (key) =>
          key.startsWith(PAGE_CACHE_PREFIX) && key.endsWith(PAGE_CACHE_SUFFIX),
      )
      .map((key) => caches.delete(key)),
  );
}
