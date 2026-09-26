/* Ejada shell service worker — network-first app shell, static asset cache,
 * offline copies of the field-role pages, Web Push, and offline navigation fallback.
 * Auth/API traffic is never cached. Compatible with Next Turbopack (no build plugin).
 *
 * The cache version comes from the registration URL (`/sw.js?v=<build>`), so every
 * deploy installs a fresh worker and drops the previous build's caches.
 */
const SW_VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "ejada-shell-";
const STATIC_CACHE = `${CACHE_PREFIX}${SW_VERSION}-static`;
/** User-specific page copies — the page wipes every `ejada-shell-*-pages` cache on logout. */
const PAGES_CACHE = `${CACHE_PREFIX}${SW_VERSION}-pages`;
const OFFLINE_URL = "/offline.html";
/**
 * Written by the page when a field role warms its pages. Holds the offline landing
 * route; its absence means "this device has no offline user", so nothing is kept.
 */
const OFFLINE_PROFILE_KEY = "/__ejada/offline-profile";

/**
 * Field-role input-form screens kept for offline reload / cold start (plus their task
 * detail routes) — spec §3.1 allows only these offline. Mirrors `OFFLINE_FORM_PAGE_IDS`
 * in packages/app-shared/src/offline/offline-routes.ts.
 */
const OFFLINE_PAGE_PREFIXES = ["/active-inspection", "/operations-tasks", "/keys"];
const MAX_WARM_PAGES = 80;
/** Upper bound on chunks/fonts followed from the warmed pages (the whole build is ~200). */
const MAX_WARM_ASSETS = 600;

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
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== STATIC_CACHE &&
                key !== PAGES_CACHE,
            )
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

function isOfflinePage(url) {
  return OFFLINE_PAGE_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
}

/** Pages are keyed without the query so `?task=` / `?source=pwa` variants still hit. */
function pageCacheKey(url) {
  return `${url.origin}${url.pathname}`;
}

async function readOfflineProfile() {
  const cache = await caches.open(PAGES_CACHE);
  const entry = await cache.match(OFFLINE_PROFILE_KEY);
  if (!entry) return null;
  try {
    return await entry.json();
  } catch {
    return null;
  }
}

/** Only a real page for a signed-in user: no redirects (login bounce), no errors. */
function isCacheablePage(response) {
  return response.ok && response.type === "basic" && !response.redirected;
}

async function rememberPage(url, response) {
  if (!isOfflinePage(url) || !isCacheablePage(response)) return;
  if (!(await readOfflineProfile())) return;
  const cache = await caches.open(PAGES_CACHE);
  await cache.put(pageCacheKey(url), response);
}

async function offlinePageFor(url) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(pageCacheKey(url));
  if (cached) return cached;

  // Offline a field user gets their input forms only (spec §3.1): the start URL
  // (`/?source=pwa`) and any other screen send them to their queue. The login screen
  // cannot work offline, so it keeps the offline page.
  if (url.pathname !== "/login" && !url.pathname.startsWith("/login/")) {
    const profile = await readOfflineProfile();
    if (profile?.landing && (await cache.match(`${url.origin}${profile.landing}`))) {
      return Response.redirect(profile.landing, 302);
    }
  }
  return null;
}

async function handleNavigation(request, url) {
  // Reaching the login screen means nobody is signed in on this device any more —
  // backs up the page-side wipe, which logout does not wait for.
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) {
    await caches.delete(PAGES_CACHE).catch(() => {});
  }
  try {
    const response = await fetch(request);
    rememberPage(url, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await offlinePageFor(url);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  // Client-side navigations fetch RSC payloads straight from the network; when that
  // fails offline, Next falls back to a full navigation, which lands here.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
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

/** Every `/_next/static/…` asset a page names — scripts, CSS, fonts and the RSC chunk list. */
function staticAssetsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/\/_next\/static\/[^"'\s<>\\)]+/g)) {
    found.add(match[0]);
  }
  return [...found];
}

/**
 * Chunks a JS/CSS asset pulls in later: Turbopack names lazy chunks as
 * `"static/chunks/…"` inside the runtime, CSS names fonts as `url(../media/…)`.
 */
function assetsReferencedBy(path, body) {
  const found = new Set(staticAssetsIn(body));
  if (path.endsWith(".js")) {
    for (const match of body.matchAll(/"(static\/(?:chunks|media)\/[^"\\]+)"/g)) {
      found.add(`/_next/${match[1]}`);
    }
  } else if (path.endsWith(".css")) {
    for (const match of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (match[1].startsWith("data:")) continue;
      const url = new URL(match[1], new URL(path, self.location.origin));
      if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
        found.add(url.pathname);
      }
    }
  }
  return found;
}

/**
 * Caches the page's assets and, transitively, every lazy chunk and font they load on
 * demand — otherwise a dynamic import on a screen not opened online yet fails offline
 * with ChunkLoadError. Hashed file names never change, so cached ones are not refetched.
 */
async function cacheStaticAssets(paths) {
  const cache = await caches.open(STATIC_CACHE);
  const seen = new Set(paths);
  const queue = [...paths];
  while (queue.length > 0 && seen.size <= MAX_WARM_ASSETS) {
    const path = queue.shift();
    try {
      let response = await cache.match(path);
      if (!response) {
        const fresh = await fetch(path);
        if (!fresh.ok) continue;
        await cache.put(path, fresh.clone());
        response = fresh;
      }
      if (!path.endsWith(".js") && !path.endsWith(".css")) continue;
      for (const next of assetsReferencedBy(path, await response.text())) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    } catch {
      /* Keep warming the rest. */
    }
  }
}

/**
 * Fetches the field user's pages while online so they open offline: the HTML goes to
 * the pages cache, and every chunk it names goes to the static cache (so screens the
 * user has not visited yet still hydrate).
 */
async function warmOfflinePages(data) {
  const origin = self.location.origin;
  const landing = typeof data.landing === "string" ? data.landing : null;
  const pages = await caches.open(PAGES_CACHE);
  await pages.put(
    OFFLINE_PROFILE_KEY,
    new Response(JSON.stringify({ landing }), {
      headers: { "Content-Type": "application/json" },
    }),
  );

  const urls = (Array.isArray(data.urls) ? data.urls : [])
    .filter((path) => typeof path === "string" && path.startsWith("/"))
    .slice(0, MAX_WARM_PAGES);
  const assets = new Set();
  for (const path of urls) {
    const url = new URL(path, origin);
    if (!isOfflinePage(url)) continue;
    try {
      const response = await fetch(url.href, { credentials: "same-origin" });
      if (!isCacheablePage(response)) continue;
      const html = await response.clone().text();
      await pages.put(pageCacheKey(url), response);
      for (const asset of staticAssetsIn(html)) assets.add(asset);
    } catch {
      /* Offline mid-warm — the next warm picks it up. */
    }
  }
  await cacheStaticAssets([...assets]);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "WARM_OFFLINE_PAGES") {
    event.waitUntil(warmOfflinePages(data).catch(() => {}));
  }
});

/** Background Sync tag — page registers this when outbox has pending writes. */
const OFFLINE_SYNC_TAG = "ejada-offline-sync";

self.addEventListener("sync", (event) => {
  if (event.tag !== OFFLINE_SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "RUN_OFFLINE_SYNC", source: "background-sync" });
      }
    })(),
  );
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
