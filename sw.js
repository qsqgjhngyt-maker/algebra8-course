const CACHE="algebra8-v1.13.1";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const RELEASE="1.13.1";
const ASSETS=[
  "./","./index.html?v=1.13.1","./styles.css?v=1.13.1","./app.js?v=1.13.1","./chapter1-v02.js?v=1.13.1","./course-v1.js?v=1.13.1",
  "./manifest.json?v=1.13.1","./assets/icon-192.png","./assets/icon-512.png","./assets/icon-maskable-192.png","./assets/icon-maskable-512.png","./assets/apple-touch-icon-180.png","./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png","./assets/kitsune/idle.png","./assets/kitsune/blink.png","./assets/kitsune/talk-small.png","./assets/kitsune/talk-wide.png","./assets/kitsune/talk-o.png","./assets/kitsune/happy.png","./assets/kitsune/explain.png","./assets/kitsune/idle-alt.png",
  "./coach-v12.js?v=1.13.1","./pedagogy-v12.js?v=1.13.1","./mastery-data-v13.js?v=1.13.1","./mastery-v13.js?v=1.13.1",
  "./design-v14.js?v=1.13.1","./learning-fx-v142.js?v=1.13.1","./live-assistant-v15.js?v=1.13.1",
  "./tutor-lite-v16.js?v=1.13.1","./tutor-smart-v173.js?v=1.13.1","./neural-voice-v17.js?v=1.13.1","./kitsune-brain-v18.js?v=1.13.1","./kitsune-voice-v19.js?v=1.13.1","./whisper-worker-v1114.js?v=1.13.1","./whisper-worker-v1116.js?v=1.13.1","./kitsune-live-v110.js?v=1.13.1","./privacy-v1111.js?v=1.13.1","./security-bootstrap-v1111.js?v=1.13.1","./pwa-update.js?v=1.13.1","./math-engine-v130.js?v=1.13.1","./math-lab-v130.js?v=1.13.1","./math-worker-v130.js?v=1.13.1"
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
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://raw.githubusercontent.com https://github.com https://objects.githubusercontent.com",
  "upgrade-insecure-requests"
].join("; ");

const CHILD_PERMISSIONS=[
  "camera=()",
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
  /* v1.11.9: download the whole release in background, but do NOT replace
     the currently running app until the user presses "Обновить". This avoids
     interrupting a lesson or losing text that has not yet been submitted. */
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
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
