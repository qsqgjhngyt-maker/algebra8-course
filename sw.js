const CACHE="algebra8-v1.9.0";
const NEURAL_CACHE="algebra8-ai-runtime-v1.9.0";
const ASSETS=[
  "./","./index.html","./styles.css","./app.js","./chapter1-v02.js","./course-v1.js",
  "./manifest.json","./assets/icon.svg","./assets/icon-192.png","./assets/icon-512.png",
  "./coach-v12.js","./pedagogy-v12.js","./mastery-data-v13.js","./mastery-v13.js",
  "./design-v14.js","./learning-fx-v142.js","./live-assistant-v15.js",
  "./tutor-lite-v16.js","./tutor-smart-v173.js","./neural-voice-v17.js","./kitsune-brain-v18.js","./kitsune-voice-v19.js"
];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys
        .filter(k=>k!==CACHE&&k!==NEURAL_CACHE)
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
      caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
        if(resp&&resp.ok){
          const copy=resp.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
        }
        return resp;
      }).catch(()=>caches.match("./index.html")))
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
