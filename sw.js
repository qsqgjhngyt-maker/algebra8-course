/* =====================================================================
   Kitsune Service Worker 3.1.0-rc.5 · LIVING MOTION REPAIR

   - exact-release shell: no old/new HTML-JS mixing;
   - core scripts cached sequentially, never as a phone-killing burst;
   - heavy optional AI/voice modules are cached only when actually requested;
   - installed navigation remains immutable until the next release activates.
   ===================================================================== */
const CACHE="kitsune-math-3.1.0-rc.5-living.1";
const RUNTIME_CACHE="kitsune-math-runtime-3.1.0-rc.5-living.1";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="3.1.0-rc.5";

const CORE_ASSETS=[
  "./index.html?v=3.1.0-rc.5",
  "./security-bootstrap-v1111.js?v=3.1.0-rc.5",
  "./manifest.json",
  "./assets/kitsune-math-favicon-64-v310.png",
  "./assets/kitsune-math-apple-touch-180-v310.png",
  "./assets/kitsune/kitsune-sprite-v1101.png",
  "./styles.css?v=3.1.0-rc.5",
  "./platform-v300.css?v=3.1.0-rc.5",
  "./startup-intro.css?v=3.1.0-rc.5",
  "./startup-intro.js?v=3.1.0-rc.5",
  "./assets/kitsune-startup-motion-v315.webp?v=3.1.0-rc.5",
  "./assets/kitsune-startup-idle-v315.webp?v=3.1.0-rc.5",
  "./assets/kitsune-startup-blink-v315.webp?v=3.1.0-rc.5",
  "./assets/kitsune-startup-magic-v315.webp?v=3.1.0-rc.5",
  "./school-notation-v3045.js?v=3.1.0-rc.5",
  "./app.js?v=3.1.0-rc.5",
  "./pwa-update.js?v=3.1.0-rc.5",
  "./chapter1-v02.js?v=3.1.0-rc.5",
  "./course-v1.js?v=3.1.0-rc.5",
  "./course-theory-v120.js?v=3.1.0-rc.5",
  "./platform-catalog-v300.js?v=3.1.0-rc.5",
  "./curriculum-overlay-v310.js?v=3.1.0-rc.5",
  "./curriculum-sources-v302.js?v=3.1.0-rc.5",
  "./migration-v302.js?v=3.1.0-rc.5",
  "./platform-content-v300.js?v=3.1.0-rc.5",
  "./platform-content-grade8-algebra-v311.js?v=3.1.0-rc.5",
  "./platform-content-grade8-frp-v311.js?v=3.1.0-rc.5",
  "./grade8-progress-bridge-v311.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a6-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-a7-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-g1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-g2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-g3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-g4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-g5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-s1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-s2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade7-s3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-g1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-g2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-g3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-g4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-g5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-s1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-s2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade8-s3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-a6-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-g1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-g2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-g3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-g4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-s1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade9-s2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-a6-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-g1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-g2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-g3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-s1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-s2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade10-s3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a4-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a5-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-a6-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-g1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-g2-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-g3-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-s1-v310.js?v=3.1.0-rc.5",
  "./platform-content-grade11-s2-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-1-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-2-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-3-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-4-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-5-v310.js?v=3.1.0-rc.5",
  "./platform-content-egeb-6-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-1-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-2-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-3-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-4-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-5-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-6-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-7-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-8-v310.js?v=3.1.0-rc.5",
  "./platform-content-egep-9-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-1-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-2-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-3-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-4-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-5-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-6-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-7-v310.js?v=3.1.0-rc.5",
  "./platform-content-oge-8-v310.js?v=3.1.0-rc.5",
  "./coach-v12.js?v=3.1.0-rc.5",
  "./pedagogy-v12.js?v=3.1.0-rc.5",
  "./mastery-data-v13.js?v=3.1.0-rc.5",
  "./mastery-v13.js?v=3.1.0-rc.5",
  "./design-v14.js?v=3.1.0-rc.5",
  "./performance-manager-v150.js?v=3.1.0-rc.5",
  "./runtime-stability-v2395.js?v=3.1.0-rc.5-autovoice.1",
  "./learning-fx-v142.js?v=3.1.0-rc.5",
  "./live-assistant-v15.js?v=3.1.0-rc.5-autovoice.1",
  "./tutor-lite-v16.js?v=3.1.0-rc.5",
  "./tutor-smart-v173.js?v=3.1.0-rc.5",
  "./math-engine-v130.js?v=3.1.0-rc.5",
  "./learning-intelligence-v150.js?v=3.1.0-rc.5",
  "./student-experience-v220.js?v=3.1.0-rc.5",
  "./navigation-stability-v2396.js?v=3.1.0-rc.5",
  "./runtime-loader-v2395.js?v=3.1.0-rc.5",
  "./mobile-voice-entry-v2397.js?v=3.1.0-rc.5",
  "./curriculum-sources-ui-v302.js?v=3.1.0-rc.5",
  "./platform-v300.js?v=3.1.0-rc.5",
  "./app-kernel-v200.js?v=3.1.0-rc.5",
  "./auto-setup-v210.js?v=3.1.0-rc.5",
  "./reveal-manager-v221.js?v=3.1.0-rc.5",
  "./theory-engine-v300.js?v=3.1.0-rc.5",
  "./school-typography-ui-v3045.js?v=3.1.0-rc.5",
  "./math-lab-v130.js?v=3.1.0-rc.5",
  "./camera-import-v210.js?v=3.1.0-rc.5",
  "./course-search-v200.js?v=3.1.0-rc.5",
  "./offline-center-v200.js?v=3.1.0-rc.5",
  "./mastery-score-v220.js?v=3.1.0-rc.5",
  "./reliability-center-v220.js?v=3.1.0-rc.5",
  "./privacy-v1111.js?v=3.1.0-rc.5",
  "./cloud-config-v230.js?v=3.1.0-rc.5",
  "./hybrid-infrastructure-v230.js?v=3.1.0-rc.5",
  "./access-admin-v235.js?v=3.1.0-rc.5",
  "./neural-voice-v17.js?v=3.1.0-rc.5",
  "./kitsune-brain-v18.js?v=3.1.0-rc.5",
  "./kitsune-voice-v19.js?v=3.1.0-rc.5",
  "./kitsune-live-v110.js?v=3.1.0-rc.5",
  "./intelligence-router-v230.js?v=3.1.0-rc.5",
  "./cloud-chat-ux-v231.js?v=3.1.0-rc.5",
  "./local-voice-lab-v231.js?v=3.1.0-rc.5",
  "./voice-conversation-v237.js?v=3.1.0-rc.5",
  "./kitsune-presence-v238.js?v=3.1.0-rc.5",
  "./voice-stability-v2387.js?v=3.1.0-rc.5",
  "./chat-dialog-firewall-v231.js?v=3.1.0-rc.5",
  "./math-worker-v130.js?v=3.1.0-rc.5",
  "./assets/kitsune-math-icon-192-v310.png",
  "./assets/kitsune-math-icon-512-v310.png",
  "./assets/kitsune-math-icon-maskable-192-v310.png",
  "./assets/kitsune-math-icon-maskable-512-v310.png",
  "./assets/kitsune/idle.png",
  "./voice-asr-worker-v2386.js",
  "./whisper-worker-v1116.js"
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
        if(!response?.ok)throw new Error(`Required offline asset unavailable: ${url}`);
        await cache.put(request,response.clone());
      }catch(error){await caches.delete(CACHE);throw error;}
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
      (k.startsWith("algebra8-runtime-v")&&k!==RUNTIME_CACHE) ||
      (k.startsWith("kitsune-math-")&&k!==CACHE&&k!==RUNTIME_CACHE)
    ).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const sameOrigin=url.origin===self.location.origin;
  if(sameOrigin&&url.pathname==="/api/curriculum-status")return;
  if(sameOrigin&&isPrivatePath(url.pathname))return;

  if(sameOrigin){
    const isNavigation=event.request.mode==="navigate"||event.request.destination==="document";
    if(isNavigation){
      event.respondWith((async()=>{
        const shell=await caches.open(CACHE);
        const cached=await shell.match("./index.html?v="+RELEASE) || await shell.match(event.request,{ignoreSearch:true});
        if(cached){
          // Keep the installed HTML immutable until the next worker activates.
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
