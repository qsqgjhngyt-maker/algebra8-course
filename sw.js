const CACHE = "algebra8-v2.3.0-beta.3.8.4";
const NEURAL_CACHE = "algebra8-ai-runtime-v1";
const RELEASE = "2.3.0-beta.3.8.4";

const ASSETS = [
  "./index.html?v=2.3.0-beta.3.8.4",
  "./styles.css?v=2.3.0-alpha",
  "./app.js?v=2.2.3",
  "./chapter1-v02.js?v=2.2.3",
  "./course-v1.js?v=2.2.3",
  "./manifest.json?v=2.3.0-alpha",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-192.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon-180.png",
  "./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png",
  "./assets/kitsune/idle.png",
  "./assets/kitsune/blink.png",
  "./assets/kitsune/talk-small.png",
  "./assets/kitsune/talk-wide.png",
  "./assets/kitsune/talk-o.png",
  "./assets/kitsune/happy.png",
  "./assets/kitsune/explain.png",
  "./assets/kitsune/idle-alt.png",
  "./coach-v12.js?v=2.2.3",
  "./pedagogy-v12.js?v=2.2.3",
  "./mastery-data-v13.js?v=2.2.3",
  "./mastery-v13.js?v=2.2.3",
  "./design-v14.js?v=2.3.0-alpha",
  "./learning-fx-v142.js?v=2.2.3",
  "./live-assistant-v15.js?v=2.2.3",
  "./tutor-lite-v16.js?v=2.2.3",
  "./tutor-smart-v173.js?v=2.2.3",
  "./neural-voice-v17.js?v=2.2.3",
  "./kitsune-brain-v18.js?v=2.3.0-beta",
  "./kitsune-voice-v19.js?v=2.3.0-beta",
  "./whisper-worker-v1114.js?v=2.2.3",
  "./whisper-worker-v1116.js?v=2.2.3",
  "./kitsune-live-v110.js?v=2.2.3",
  "./privacy-v1111.js?v=2.3.0-beta",
  "./security-bootstrap-v1111.js?v=2.3.0-alpha",
  "./pwa-update.js?v=2.3.0-alpha",
  "./math-engine-v130.js?v=2.2.3",
  "./math-lab-v130.js?v=2.2.3",
  "./math-worker-v130.js?v=2.2.3",
  "./performance-manager-v150.js?v=2.2.3",
  "./learning-intelligence-v150.js?v=2.2.3",
  "./course-search-v200.js?v=2.2.3",
  "./offline-center-v200.js?v=2.3.0-alpha",
  "./app-kernel-v200.js?v=2.2.3",
  "./camera-import-v210.js?v=2.2.3",
  "./auto-setup-v210.js?v=2.2.3",
  "./mastery-score-v220.js?v=2.3.0-alpha",
  "./reliability-center-v220.js?v=2.3.0-alpha",
  "./student-experience-v220.js?v=2.3.0-alpha",
  "./reveal-manager-v221.js?v=2.2.3",
  "./cloud-config-v230.js?v=2.3.0-alpha.2",
  "./hybrid-infrastructure-v230.js?v=2.3.0-beta.3.7.2",
  "./access-admin-v235.js?v=2.3.0-beta.3.6.2",
  "./intelligence-router-v230.js?v=2.3.0-beta.3.3",
  "./cloud-chat-ux-v231.js?v=2.3.0-beta.3.3",
  "./local-voice-lab-v231.js?v=2.3.0-beta.3.3",
  "./voice-conversation-v237.js?v=2.3.0-beta.3.7.2",
  "./kitsune-presence-v238.js?v=2.3.0-beta.3.8.1",
  "./voice-stability-v2384.js?v=2.3.0-beta.3.8.4",
  "./voice-asr-worker-v2384.js?v=2.3.0-beta.3.8.4",
  "./chat-dialog-firewall-v231.js?v=2.3.0-beta.3.6.2",
  "./version.json?v=2.3.0-beta.3.8.4"
];

const CHILD_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src https://accounts.google.com",
  "form-action 'none'",
  "manifest-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "script-src 'self' blob: 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "child-src 'self' blob: https://cdn.jsdelivr.net",
  "connect-src 'self' https://accounts.google.com https://kitsune-hybrid-broker.akronikl.workers.dev https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://raw.githubusercontent.com https://github.com https://objects.githubusercontent.com http://127.0.0.1:17865",
  "upgrade-insecure-requests"
].join("; ");

const CHILD_PERMISSIONS = [
  "camera=(self)",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
  "encrypted-media=()",
  "picture-in-picture=()",
  "microphone=(self)",
  "fullscreen=(self)",
  "autoplay=(self)"
].join(", ");

function secureSameOriginResponse(request, response) {
  if (!response) {
    return new Response("Kitsune временно недоступна офлайн.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");

  const isDocument =
    request.mode === "navigate" ||
    request.destination === "document";

  if (isDocument) {
    headers.set("Content-Security-Policy", CHILD_CSP);
    headers.set("Permissions-Policy", CHILD_PERMISSIONS);
    headers.set("X-Frame-Options", "DENY");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const failures = [];

    for (const url of ASSETS) {
      try {
        const request = new Request(url, { cache: "reload" });
        const response = await fetch(request);

        if (response && response.ok) {
          await cache.put(request, response.clone());
        } else {
          failures.push(url);
        }
      } catch {
        failures.push(url);
      }
    }

    if (failures.length) {
      console.warn("[Kitsune SW] optional cache failures", failures);
    }
  })());
});

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            (key.startsWith("algebra8-v") && key !== CACHE) ||
            (key.startsWith("algebra8-ai-runtime-") && key !== NEURAL_CACHE)
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const neuralRuntime = url.hostname === "cdn.jsdelivr.net";

  if (
    url.pathname.startsWith("/v1/auth/") ||
    url.pathname.startsWith("/v1/enroll") ||
    url.pathname.startsWith("/v1/access/") ||
    url.pathname.startsWith("/v1/admin/") ||
    url.pathname.startsWith("/v1/temporary-credential") ||
    url.pathname.startsWith("/v1/qwen/") ||
    url.pathname.startsWith("/v1/tts/")
  ) {
    return;
  }

  if (sameOrigin) {
    const isNavigation =
      event.request.mode === "navigate" ||
      event.request.destination === "document";

    if (isNavigation) {
      event.respondWith((async () => {
        try {
          const response = await fetch(event.request, { cache: "no-store" });

          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE)
              .then(cache => cache.put("./index.html?v=" + RELEASE, copy))
              .catch(() => {});
          }

          return secureSameOriginResponse(event.request, response);
        } catch {
          const fallback =
            await caches.match("./index.html?v=" + RELEASE) ||
            await caches.match("./index.html", { ignoreSearch: true });

          return secureSameOriginResponse(event.request, fallback);
        }
      })());
      return;
    }

    event.respondWith((async () => {
      const releaseCache = await caches.open(CACHE);
      const cached = await releaseCache.match(event.request);

      if (cached) {
        return secureSameOriginResponse(event.request, cached);
      }

      try {
        const response = await fetch(event.request, { cache: "no-store" });

        if (response && response.ok) {
          releaseCache.put(event.request, response.clone()).catch(() => {});
        }

        return secureSameOriginResponse(event.request, response);
      } catch {
        const fallback = await caches.match(event.request, { ignoreSearch: true });
        return secureSameOriginResponse(event.request, fallback);
      }
    })());
    return;
  }

  if (neuralRuntime) {
    event.respondWith(
      caches.open(NEURAL_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;

          return fetch(event.request).then(response => {
            if (response && (response.ok || response.type === "opaque")) {
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          });
        })
      )
    );
  }
});
