/* Vault service worker: app works offline; scanner files cached after first use. */
var V='vault-v1';
var SHELL=['./','index.html','app.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png','logo-dark.png','logo-light.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.origin!==location.origin){ // fonts: cache as we go
    e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request).then(function(res){var cp=res.clone();caches.open(V).then(function(c){c.put(e.request,cp);});return res;}).catch(function(){return r;});}));return;
  }
  if(u.pathname.indexOf('/ocr/')>=0){ // big scanner files: cache-first
    e.respondWith(caches.match(e.request).then(function(r){return r||fetch(e.request).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(e.request,cp);});}return res;});}));return;
  }
  // app files: network first so updates show, fall back to cache offline
  e.respondWith(fetch(e.request).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(e.request,cp);});}return res;}).catch(function(){return caches.match(e.request).then(function(r){return r||caches.match('index.html');});}));
});
