/* =====================================================================
   Kitsune Service Worker v2.3.0-beta.3.9.0 · ADAPTIVE STABILITY

   Key change: installation no longer warms the whole application at once.
   Only the resilient shell is pre-cached. Everything else is cached naturally
   as the user opens it, or gradually during a stable idle period.
   ===================================================================== */
const CACHE="algebra8-v2.3.0-beta.3.9.0";
const RUNTIME_CACHE="algebra8-runtime-v2390";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="2.3.0-beta.3.9.0";

const CORE_ASSETS=[
  "./index.html?v=2.3.0-beta.3.9.0",
  "./styles.css?v=2.3.0-alpha",
  "./app.js?v=2.2.3",
  "./chapter1-v02.js?v=2.2.3",
  "./course-v1.js?v=2.2.3",
  "./performance-manager-v150.js?v=2.3.0-beta.3.9.0",
  "./manifest.json?v=2.3.0-alpha",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon-180.png",
  "./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png",
  "./assets/kitsune/idle.png",
  "./version.json?v=2.3.0-beta.3.9.0"
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

function withTimeout(request,ms=4500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return fetch(request,{cache:"no-store",signal:controller.signal})
    .finally(()=>clearTimeout(timer));
}

async function putIfOk(cache,request,response){
  if(response&&response.ok){
    try{await cache.put(request,response.clone())}catch{}
  }
  return response;
}

async function matchPreviousApp(request,{ignoreSearch=false}={}){
  const keys=(await caches.keys())
    .filter(k=>k.startsWith("algebra8-v")&&k!==CACHE)
    .sort()
    .reverse();

  for(const key of keys.slice(0,2)){
    try{
      const cache=await caches.open(key);
      const hit=await cache.match(request,{ignoreSearch});
      if(hit)return hit;
    }catch{}
  }
  return null;
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const failures=[];

    /* Deliberately sequential and deliberately small: no 60-file update storm. */
    for(const url of CORE_ASSETS){
      try{
        const request=new Request(url,{cache:"reload"});
        const response=await fetch(request);
        if(response&&response.ok)await cache.put(request,response.clone());
        else failures.push(url);
      }catch{
        failures.push(url);
      }
    }

    if(failures.length){
      console.warn("[Kitsune SW 3.9] optional core cache failures",failures);
    }
  })());
});

self.addEventListener("message",event=>{
  const data=event.data||{};

  if(data.type==="SKIP_WAITING"){
    self.skipWaiting();
    return;
  }

  if(data.type==="CACHE_URLS"){
    const urls=Array.isArray(data.urls)?data.urls.slice(0,80):[];
    event.waitUntil((async()=>{
      const cache=await caches.open(RUNTIME_CACHE);

      for(const raw of urls){
        try{
          const url=new URL(raw,self.location.origin);
          if(url.origin!==self.location.origin||isPrivatePath(url.pathname))continue;

          const request=new Request(url.href,{method:"GET",cache:"reload"});
          const existing=await cache.match(request);
          if(existing)continue;

          const response=await fetch(request);
          if(response&&response.ok)await cache.put(request,response.clone());

          /* Yield between files so weak phones never get an idle-cache burst. */
          await new Promise(resolve=>setTimeout(resolve,35));
        }catch{}
      }
    })());
    return;
  }

  if(data.type==="TRIM_RUNTIME"){
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    const appCaches=keys
      .filter(k=>k.startsWith("algebra8-v"))
      .sort()
      .reverse();

    /* Keep the current shell plus one previous release as a crash/offline
       fallback. Never delete model-loader/browser caches here. */
    const previous=appCaches.find(k=>k!==CACHE)||null;
    const keep=new Set([CACHE,RUNTIME_CACHE,NEURAL_CACHE,previous].filter(Boolean));

    await Promise.all(
      keys
        .filter(k=>k.startsWith("algebra8-v")&&!keep.has(k))
        .map(k=>caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;

  /* Auth, broker, Qwen and TTS are always network-only. */
  if(sameOrigin&&isPrivatePath(url.pathname))return;

  if(sameOrigin){
    const isNavigation=event.request.mode==="navigate"||event.request.destination==="document";

    if(isNavigation){
      event.respondWith((async()=>{
        const releaseCache=await caches.open(CACHE);
        const runtimeCache=await caches.open(RUNTIME_CACHE);

        try{
          const response=await withTimeout(event.request,4500);
          if(response&&response.ok){
            const copy=response.clone();
            releaseCache.put("./index.html?v="+RELEASE,copy.clone()).catch(()=>{});
            runtimeCache.put(event.request,copy).catch(()=>{});
          }
          return secureSameOriginResponse(event.request,response);
        }catch{
          const fallback=
            await releaseCache.match("./index.html?v="+RELEASE) ||
            await runtimeCache.match(event.request,{ignoreSearch:true}) ||
            await matchPreviousApp(event.request,{ignoreSearch:true}) ||
            await caches.match("./index.html",{ignoreSearch:true});

          if(fallback)return secureSameOriginResponse(event.request,fallback);
          return new Response("Kitsune offline shell unavailable",{
            status:503,
            headers:{"Content-Type":"text/plain; charset=utf-8"}
          });
        }
      })());
      return;
    }

    event.respondWith((async()=>{
      const releaseCache=await caches.open(CACHE);
      const runtimeCache=await caches.open(RUNTIME_CACHE);

      const coreHit=await releaseCache.match(event.request);
      if(coreHit)return secureSameOriginResponse(event.request,coreHit);

      const runtimeHit=await runtimeCache.match(event.request);
      if(runtimeHit)return secureSameOriginResponse(event.request,runtimeHit);

      try{
        const response=await fetch(event.request,{cache:"no-store"});
        if(response&&response.ok){
          runtimeCache.put(event.request,response.clone()).catch(()=>{});
        }
        return secureSameOriginResponse(event.request,response);
      }catch{
        const fallback=await matchPreviousApp(event.request,{ignoreSearch:true}) ||
          await caches.match(event.request,{ignoreSearch:true});
        if(fallback)return secureSameOriginResponse(event.request,fallback);
        return new Response("Kitsune resource unavailable offline",{
          status:503,
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      }
    })());
    return;
  }

  /* Cache only the small jsDelivr runtime code needed by local AI. Huge model
     files use their own browser/HF caches and are intentionally not duplicated. */
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
