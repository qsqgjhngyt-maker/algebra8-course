
const CACHE="algebra8-v1.2.0";
const ASSETS=["./","./index.html","./styles.css","./app.js","./chapter1-v02.js","./course-v1.js","./manifest.json","./assets/icon.svg","./assets/icon-192.png","./assets/icon-512.png","./coach-v12.js","./pedagogy-v12.js"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(
  caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const copy=resp.clone();
    caches.open(CACHE).then(c=>c.put(e.request,copy));
    return resp;
  }).catch(()=>caches.match("./index.html")))
));
