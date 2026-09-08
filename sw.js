/* =====================================================================
   Kitsune Service Worker 2.3.0-beta.3.9.7 · STABLE CURRENT RELEASE

   - exact-release shell: no old/new HTML-JS mixing;
   - core scripts cached sequentially, never as a phone-killing burst;
   - heavy optional AI/voice modules are cached only when actually requested;
   - navigation is cache-first and refreshed in the background.
   ===================================================================== */
const CACHE="algebra8-v2.3.0-beta.3.9.7";
const RUNTIME_CACHE="algebra8-runtime-v2397";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="2.3.0-beta.3.9.7";

const CORE_ASSETS=[
  "./index.html?v=2.3.0-beta.3.9.7",
  "./styles.css?v=2.3.0-alpha",
  "./security-bootstrap-v1111.js?v=2.3.0-alpha",
  "./app.js?v=2.2.3",
  "./pwa-update.js?v=2.3.0-alpha",
  "./chapter1-v02.js?v=2.2.3",
  "./course-v1.js?v=2.2.3",
  "./coach-v12.js?v=2.2.3",
  "./pedagogy-v12.js?v=2.2.3",
  "./mastery-data-v13.js?v=2.2.3",
  "./mastery-v13.js?v=2.2.3",
  "./design-v14.js?v=2.3.0-alpha",
  "./performance-manager-v150.js?v=2.3.0-beta.3.9.5",
  "./runtime-stability-v2395.js?v=2.3.0-beta.3.9.5",
  "./learning-fx-v142.js?v=2.2.3",
  "./live-assistant-v15.js?v=2.2.3",
  "./tutor-lite-v16.js?v=2.2.3",
  "./tutor-smart-v173.js?v=2.2.3",
  "./math-engine-v130.js?v=2.2.3",
  "./learning-intelligence-v150.js?v=2.2.3",
  "./student-experience-v220.js?v=2.3.0-alpha",
  "./navigation-stability-v2396.js?v=2.3.0-beta.3.9.6",
  "./runtime-loader-v2395.js?v=2.3.0-beta.3.9.5",
  "./mobile-voice-entry-v2397.js?v=2.3.0-beta.3.9.7",
  "./app-kernel-v200.js?v=2.2.3",
  "./auto-setup-v210.js?v=2.2.3",
  "./reveal-manager-v221.js?v=2.2.3",
  "./math-worker-v130.js?v=2.2.3",
  "./manifest.json?v=2.3.0-alpha",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon-180.png",
  "./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png",
  "./assets/kitsune/idle.png",
  "./version.json?v=2.3.0-beta.3.9.7"
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
  "camera=(self)","geolocation=()","payment=()","usb=()",
  "accelerometer=()","gyroscope=()","magnetometer=()",
  "encrypted-media=()","picture-in-picture=()","microphone=(self)",
  "fullscreen=(self)","autoplay=(self)"
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
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

async function networkAndCache(request,cache){
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch{return null}
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of CORE_ASSETS){
      try{
        const request=new Request(url,{cache:"reload"});
        const response=await fetch(request);
        if(response&&response.ok)await cache.put(request,response.clone());
      }catch{}
    }
  })());
});

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="SKIP_WAITING"){self.skipWaiting();return}
  if(data.type==="TRIM_RUNTIME")event.waitUntil(caches.delete(RUNTIME_CACHE));
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>
      (k.startsWith("algebra8-v")&&k!==CACHE) ||
      (k.startsWith("algebra8-runtime-v")&&k!==RUNTIME_CACHE)
    ).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  if(sameOrigin&&isPrivatePath(url.pathname))return;

  if(sameOrigin){
    const isNavigation=event.request.mode==="navigate"||event.request.destination==="document";
    if(isNavigation){
      event.respondWith((async()=>{
        const shell=await caches.open(CACHE);
        const cached=await shell.match("./index.html?v="+RELEASE) || await shell.match(event.request,{ignoreSearch:true});
        if(cached){
          event.waitUntil(networkAndCache(new Request("./index.html?v="+RELEASE,{cache:"no-cache"}),shell));
          return secureSameOriginResponse(event.request,cached);
        }
        const fresh=await networkAndCache(event.request,shell);
        if(fresh)return secureSameOriginResponse(event.request,fresh);
        return new Response("Kitsune offline shell unavailable",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
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
      return new Response("Kitsune resource unavailable offline",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
    })());
    return;
  }

  if(url.hostname==="cdn.jsdelivr.net"){
    const path=url.pathname.toLowerCase();
    const cacheable=event.request.destination==="script"||event.request.destination==="worker"||/\.(?:js|mjs|wasm)$/.test(path);
    if(cacheable){
      event.respondWith((async()=>{
        const cache=await caches.open(NEURAL_CACHE);
        const cached=await cache.match(event.request);
        if(cached)return cached;
        const response=await fetch(event.request);
        if(response&&(response.ok||response.type==="opaque"))cache.put(event.request,response.clone()).catch(()=>{});
        return response;
      })());
    }
  }
});
