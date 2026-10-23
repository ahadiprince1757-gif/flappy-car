/**
 * Flappy Car 3D — Service Worker (PWA Offline & Asset Cache)
 */

const CACHE_NAME = "flappy-car-v2.2";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./assets/logo.png",
  "./assets/logo.jpg",
  "./assets/icon.svg",
  "./assets/tixar.png",
  "./js/main.js",
  "./js/core/game.js",
  "./js/core/gameState.js",
  "./js/core/gameLoop.js",
  "./js/core/storage.js",
  "./js/core/FBXLoader.js",
  "./js/core/fflate.module.js",
  "./js/player/player.js",
  "./js/player/movement.js",
  "./js/player/controls.js",
  "./js/stages/stages.js",
  "./js/stages/stageRenderer.js",
  "./js/stages/backgrounds.js",
  "./js/cars/cars.js",
  "./js/cars/carRenderer.js",
  "./js/cars/carModelLoader.js",
  "./js/cars/garage.js",
  "./js/obstacles/obstacles.js",
  "./js/obstacles/obstacleRenderer.js",
  "./js/obstacles/obstacleSpawner.js",
  "./js/systems/collision.js",
  "./js/systems/coins.js",
  "./js/systems/powerups.js",
  "./js/systems/effects.js",
  "./js/systems/checkpoints.js",
  "./js/systems/audio.js",
  "./js/systems/orientation.js",
  "./js/racing/racing.js",
  "./js/racing/levelRenderer.js",
  "./js/traffic/trafficCars.js",
  "./js/ui/ui.js",
  "./js/ui/hud.js",
  "./js/ui/menus.js",
  "./js/services/api.js"
];

// Install: Cache core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("[SW] Some assets failed to precache:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. API requests: Network first with graceful offline fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ offline: true, error: "Network unavailable" }), {
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // 2. Code & Styles (HTML, CSS, JS): ALWAYS Network-First!
  // Ensures any visual or gameplay update immediately reflects on mobile phones.
  const isCode =
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname === "/" ||
    url.pathname === "";

  if (isCode) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Heavy 3D Models & Media (FBX, textures, sounds): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
