/* =====================================================================
   Kitsune Service Worker v2.3.0-beta.3.9.2 · SMOOTH RUNTIME

   - Small shell only.
   - No previous-release mixing.
   - No bulk idle warmup.
   - Installed PWA navigation is cache-first and refreshed in background.
   - Optional modules are cached naturally when Runtime Loader asks for them.
   ===================================================================== */
const CACHE="algebra8-v2.3.0-beta.3.9.2";
const RUNTIME_CACHE="algebra8-runtime-v2392";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="2.3.0-beta.3.9.2";

const CORE_ASSETS=[
  "./index.html?v=2.3.0-beta.3.9.2",
  "./styles.css?v=2.3.0-alpha",
  "./app.js?v=2.2.3",
  "./chapter1-v02.js?v=2.2.3",
  "./course-v1.js?v=2.2.3",
  "./performance-manager-v150.js?v=2.3.0-beta.3.9.2",
  "./runtime-loader-v2392.js?v=2.3.0-beta.3.9.2",
  "./manifest.json?v=2.3.0-alpha",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon-180.png",
  "./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png",
  "./assets/kitsune/idle.png",
  "./version.json?v=2.3.0-beta.3.9.2"
];

const CHILD_CSP=[
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

const CHILD_PERMISSIONS=[
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

function isPrivatePath(pathname){
  return pathname.startsWith("/v1/auth/") ||
    pathname.startsWith("/v1/enroll") ||
    pathname.startsWith("/v1/temporary-credential") ||
    pathname.startsWith("/v1/qwen/") ||
    pathname.startsWith("/v1/tts/") ||
    pathname.startsWith("/v1/admin/");
}

function secureSameOriginResponse(request,response){
  if(!response)return response;

  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Referrer-Policy","no-referrer");

  const isDocument=request.mode==="navigate"||request.destination==="document";
  if(isDocument){
    headers.set("Content-Security-Policy",CHILD_CSP);
    headers.set("Permissions-Policy",CHILD_PERMISSIONS);
    headers.set("X-Frame-Options","DENY");
  }

  return new Response(response.body,{
    status:response.status,
    statusText:response.statusText,
    headers
  });
}

async function networkAndCache(request,cache){
  try{
    const response=await fetch(request);
    if(response&&response.ok){
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch{
    return null;
  }
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);

    /* Sequential shell install: never create a 40-request burst on phones. */
    for(const url of CORE_ASSETS){
      try{
        const request=new Request(url,{cache:"reload"});
        const response=await fetch(request);
        if(response&&response.ok){
          await cache.put(request,response.clone());
        }
      }catch{}
    }
  })());
});

self.addEventListener("message",event=>{
  const data=event.data||{};

  if(data.type==="SKIP_WAITING"){
    self.skipWaiting();
    return;
  }

  if(data.type==="TRIM_RUNTIME"){
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();

    /* Exact current-release cache only. Never combine old HTML and new JS. */
    await Promise.all(
      keys
        .filter(k=>
          (k.startsWith("algebra8-v")&&k!==CACHE) ||
          (k.startsWith("algebra8-runtime-v")&&k!==RUNTIME_CACHE)
        )
        .map(k=>caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;

  if(sameOrigin&&isPrivatePath(url.pathname))return;

  if(sameOrigin){
    const isNavigation=
      event.request.mode==="navigate" ||
      event.request.destination==="document";

    if(isNavigation){
      event.respondWith((async()=>{
        const shell=await caches.open(CACHE);

        /*
         * Installed app starts from local shell immediately. Refresh the shell
         * in the background, never make the learner wait on GitHub Pages.
         */
        const cached=
          await shell.match("./index.html?v="+RELEASE) ||
          await shell.match(event.request,{ignoreSearch:true});

        if(cached){
          event.waitUntil((async()=>{
            const fresh=await networkAndCache(
              new Request("./index.html?v="+RELEASE,{cache:"no-cache"}),
              shell
            );
            return fresh;
          })());
          return secureSameOriginResponse(event.request,cached);
        }

        const fresh=await networkAndCache(event.request,shell);
        if(fresh)return secureSameOriginResponse(event.request,fresh);

        return new Response("Kitsune offline shell unavailable",{
          status:503,
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      })());
      return;
    }

    event.respondWith((async()=>{
      const shell=await caches.open(CACHE);
      const runtime=await caches.open(RUNTIME_CACHE);

      const shellHit=await shell.match(event.request);
      if(shellHit)return secureSameOriginResponse(event.request,shellHit);

      const runtimeHit=await runtime.match(event.request);
      if(runtimeHit)return secureSameOriginResponse(event.request,runtimeHit);

      const response=await networkAndCache(event.request,runtime);
      if(response)return secureSameOriginResponse(event.request,response);

      return new Response("Kitsune resource unavailable offline",{
        status:503,
        headers:{"Content-Type":"text/plain; charset=utf-8"}
      });
    })());
    return;
  }

  /* Cache only runtime code from jsDelivr. Large HF model files keep their
     dedicated browser/model caches and are not duplicated by this SW. */
  if(url.hostname==="cdn.jsdelivr.net"){
    const path=url.pathname.toLowerCase();
    const cacheable=
      event.request.destination==="script" ||
      event.request.destination==="worker" ||
      /\.(?:js|mjs|wasm)$/.test(path);

    if(cacheable){
      event.respondWith((async()=>{
        const cache=await caches.open(NEURAL_CACHE);
        const cached=await cache.match(event.request);
        if(cached)return cached;

        const response=await fetch(event.request);
        if(response&&(response.ok||response.type==="opaque")){
          cache.put(event.request,response.clone()).catch(()=>{});
        }
        return response;
      })());
    }
  }
});
