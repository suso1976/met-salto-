
const CACHE="met-salto-v1";
const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    event.respondWith(caches.match(req).then(cached=>cached || fetch(req).then(resp=>{
      const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); return resp;
    })));
  }
});
