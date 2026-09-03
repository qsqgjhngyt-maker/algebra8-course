const CACHE="algebra8-v1.12.0";
const NEURAL_CACHE="algebra8-ai-runtime-v1";
const ASSETS=[
  "./","./index.html","./styles.css","./app.js","./chapter1-v02.js","./course-v1.js",
  "./manifest.json","./assets/icon-192.png","./assets/icon-512.png","./assets/icon-maskable-192.png","./assets/icon-maskable-512.png","./assets/apple-touch-icon-180.png","./assets/favicon-64.png",
  "./assets/kitsune/kitsune-sprite-v1101.png","./assets/kitsune/idle.png","./assets/kitsune/blink.png","./assets/kitsune/talk-small.png","./assets/kitsune/talk-wide.png","./assets/kitsune/talk-o.png","./assets/kitsune/happy.png","./assets/kitsune/explain.png","./assets/kitsune/idle-alt.png",
  "./coach-v12.js","./pedagogy-v12.js","./mastery-data-v13.js","./mastery-v13.js",
  "./design-v14.js","./learning-fx-v142.js","./live-assistant-v15.js",
  "./tutor-lite-v16.js","./tutor-smart-v173.js","./neural-voice-v17.js","./kitsune-brain-v18.js","./kitsune-voice-v19.js","./whisper-worker-v1114.js","./whisper-worker-v1116.js","./kitsune-live-v110.js","./privacy-v1111.js","./security-bootstrap-v1111.js","./pwa-update.js"
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
    e.respondWith(
      caches.match(e.request).then(async cached=>{
        if(cached)return secureSameOriginResponse(e.request,cached);

        try{
          const resp=await fetch(e.request);
          if(resp&&resp.ok){
            const copy=resp.clone();
            caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
          }
          return secureSameOriginResponse(e.request,resp);
        }catch(err){
          const fallback=await caches.match("./index.html");
          return secureSameOriginResponse(e.request,fallback);
        }
      })
    );
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
