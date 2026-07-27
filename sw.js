const CACHE='travl-v7';
const SHELL=['/','/index.html','/manifest.json','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // never cache the API
  if(url.pathname.startsWith('/api/')){e.respondWith(fetch(e.request));return;}
  // map tiles: let the browser handle them natively (SW interception can break opaque images)
  if(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.hostname)) return;
  // app shell: network-first so updates land, cache = offline mode
  if(e.request.mode==='navigate'||url.pathname==='/index.html'){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',cp));return r;}).catch(()=>caches.match('/index.html')));
    return;
  }
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r;})));
    return;
  }
  // cross-origin (fonts, map tiles, weather): cache-on-success, serve stale offline
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request)));
});
