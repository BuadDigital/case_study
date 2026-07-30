/* Ejada shell service worker — network-first app shell, static asset cache,
 * Web Push, and offline navigation fallback.
 * Auth/API traffic is never cached. Compatible with Next Turbopack (no build plugin).
 */
const CACHE_VERSION = "ejada-shell-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const FIELD_ROUTE_PREFIXES = ["/property-inspection", "/government-review"];

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

async function precacheAssets(cache) {
  await Promise.all(
    PRECACHE.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        /* One missing asset must not block SW installation. */
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => precacheAssets(cache)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ejada-shell-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isNextStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".webmanifest")
  );
}

function isFieldRoute(url) {
  return FIELD_ROUTE_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && isFieldRoute(url)) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }),
    );
    return;
  }

  if (isNextStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clientList.some(
        (client) => client.visibilityState === "visible" && client.focused,
      );
      if (focused) {
        for (const client of clientList) {
          client.postMessage({ type: "PUSH_NOTIFICATION", payload });
        }
        return;
      }

      await self.registration.showNotification(payload.title || "إجادة", {
        body: payload.body || "",
        tag: payload.sourceEvent || payload.id || undefined,
        renotify: true,
        dir: "rtl",
        lang: "ar",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: {
          href: payload.href || "/",
          id: payload.id,
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  const target = new URL(href, self.location.origin);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (new URL(client.url).origin !== target.origin) continue;
        await client.focus();
        client.postMessage({
          type: "PUSH_NAVIGATE",
          href: `${target.pathname}${target.search}${target.hash}`,
        });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
