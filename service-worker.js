/* ==========================================================
   待辦清單 — Service Worker
   策略：預先快取 App 外殼；同源請求採「網路優先、離線時改用快取」，
        確保部署新版本後能立即取得最新檔案，同時支援離線使用。
   ========================================================== */
var CACHE_VERSION = 'todo-app-v2';
var APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

// 安裝：預先快取 App 外殼並立即啟用新版本
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

// 啟用：刪除舊版快取並接管所有頁面
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('todo-app-') === 0 && k !== CACHE_VERSION;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 請求攔截：網路優先，失敗時回退至快取
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        // 離線時開啟任何頁面都回傳首頁
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: '離線中' });
      });
    })
  );
});
