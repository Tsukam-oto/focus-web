const CACHE='focus-shell-v5-8-work2';
const FILES=['./','./index.html','./app.js','./studio.js','./creative.js','./creative-archive.js','./install.js','./privacy-v5.js','./focus-v5.css','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('focus-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Cache only this app's static files, never user photos, backups, or ChatGPT content.
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope),path=url.pathname.slice(scope.pathname.length);
 if(!['','index.html','app.js','studio.js','creative.js','creative-archive.js','install.js','privacy-v5.js','focus-v5.css','manifest.webmanifest','icon-192.png','icon-512.png'].includes(path))return;
 event.respondWith(fetch(request).then(response=>{
   if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,clone)))}
   return response;
 }).catch(async()=>await caches.match(request)||(request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
