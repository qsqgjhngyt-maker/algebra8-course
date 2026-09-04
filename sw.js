const CACHE="algebra8-v2.1.0";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="2.1.0";
const ASSETS=[
  "./","./index.html?v=2.1.0","./styles.css?v=2.1.0","./app.js?v=2.1.0","./chapter1-v02.js?v=2.1.0","./course-v1.js?v=2.1.0",
  "./manifest.json?v=2.1.0","./assets/icon-192.png","./assets/icon-512.png","./assets/icon-maskable-192.png","./assets/icon-maskable-512.png","./assets/apple-touch-icon-180.png","./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png","./assets/kitsune/idle.png","./assets/kitsune/blink.png","./assets/kitsune/talk-small.png","./assets/kitsune/talk-wide.png","./assets/kitsune/talk-o.png","./assets/kitsune/happy.png","./assets/kitsune/explain.png","./assets/kitsune/idle-alt.png",
  "./coach-v12.js?v=2.1.0","./pedagogy-v12.js?v=2.1.0","./mastery-data-v13.js?v=2.1.0","./mastery-v13.js?v=2.1.0",
  "./design-v14.js?v=2.1.0","./learning-fx-v142.js?v=2.1.0","./live-assistant-v15.js?v=2.1.0",
  "./tutor-lite-v16.js?v=2.1.0","./tutor-smart-v173.js?v=2.1.0","./neural-voice-v17.js?v=2.1.0","./kitsune-brain-v18.js?v=2.1.0","./kitsune-voice-v19.js?v=2.1.0","./whisper-worker-v1114.js?v=2.1.0","./whisper-worker-v1116.js?v=2.1.0","./kitsune-live-v110.js?v=2.1.0","./privacy-v1111.js?v=2.1.0","./security-bootstrap-v1111.js?v=2.1.0","./pwa-update.js?v=2.1.0","./math-engine-v130.js?v=2.1.0","./math-lab-v130.js?v=2.1.0","./math-worker-v130.js?v=2.1.0","./performance-manager-v150.js?v=2.1.0","./learning-intelligence-v150.js?v=2.1.0","./course-search-v200.js?v=2.1.0","./offline-center-v200.js?v=2.1.0","./app-kernel-v200.js?v=2.1.0","./camera-import-v210.js?v=2.1.0","./auto-setup-v210.js?v=2.1.0","./version.json?v=2.1.0"
];

const CHILD_CSP=[
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'none'",
  "manifest-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' blob: 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "child-src 'self' blob: https://cdn.jsdelivr.net",
  "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://raw.githubusercontent.com https://github.com https://objects.githubusercontent.com",
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

self.addEventListener("install",e=>{
  /* v2.1.0 FINAL: cache every same-origin release asset independently.
     One optional asset must not make the whole Service Worker install fail. */
  e.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const failures=[];
    for(const url of ASSETS){
      try{
        const req=new Request(url,{cache:"reload"});
        const resp=await fetch(req);
        if(resp&&resp.ok)await cache.put(req,resp.clone());
        else failures.push(url);
      }catch(err){failures.push(url)}
    }
    if(failures.length)console.warn("[Kitsune SW] optional cache failures",failures);
  })());
});

self.addEventListener("message",e=>{
  const data=e.data||{};
  if(data.type==="SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys
        /* Delete only obsolete caches owned by this course. Never wipe
           unknown CacheStorage entries created by AI runtimes/model loaders. */
        .filter(k=>
          (k.startsWith("algebra8-v")&&k!==CACHE) ||
          (k.startsWith("algebra8-ai-runtime-")&&k!==NEURAL_CACHE)
        )
        .map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;

  const url=new URL(e.request.url);
  const sameOrigin=url.origin===self.location.origin;
  const neuralRuntime=url.hostname==="cdn.jsdelivr.net";

  if(sameOrigin){
    const isNavigation=e.request.mode==="navigate"||e.request.destination==="document";

    if(isNavigation){
      /* Always ask the network for the app shell first. This prevents an old
         installed iPhone PWA from booting an obsolete index.html forever. */
      e.respondWith((async()=>{
        try{
          const resp=await fetch(e.request,{cache:"no-store"});
          if(resp&&resp.ok){
            const copy=resp.clone();
            caches.open(CACHE).then(c=>c.put("./index.html?v="+RELEASE,copy)).catch(()=>{});
          }
          return secureSameOriginResponse(e.request,resp);
        }catch(err){
          const fallback=
            await caches.match("./index.html?v="+RELEASE) ||
            await caches.match("./index.html",{ignoreSearch:true});
          return secureSameOriginResponse(e.request,fallback);
        }
      })());
      return;
    }

    e.respondWith((async()=>{
      const releaseCache=await caches.open(CACHE);
      const cached=await releaseCache.match(e.request);
      if(cached)return secureSameOriginResponse(e.request,cached);

      try{
        const resp=await fetch(e.request,{cache:"no-store"});
        if(resp&&resp.ok)releaseCache.put(e.request,resp.clone()).catch(()=>{});
        return secureSameOriginResponse(e.request,resp);
      }catch(err){
        const fallback=await caches.match(e.request,{ignoreSearch:true});
        return secureSameOriginResponse(e.request,fallback);
      }
    })());
    return;
  }

  /* jsDelivr-модули Piper, WebLLM и Transformers.js кэшируем после первого запуска.
     Большие модели Piper/WebLLM/Whisper используют собственные browser caches/OPFS.
     Поэтому большие ответы Hugging Face здесь намеренно не дублируем. */
  if(neuralRuntime){
    e.respondWith(
      caches.open(NEURAL_CACHE).then(cache=>
        cache.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
          if(resp&&(resp.ok||resp.type==="opaque"))cache.put(e.request,resp.clone()).catch(()=>{});
          return resp;
        }))
      )
    );
  }
});
