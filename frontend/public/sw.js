/**
 * FunnyPixels Service Worker
 * 支持离线访问、推送通知、后台同步
 */

// 使用时间戳作为版本号，确保每次构建都有新的缓存版本
const CACHE_NAME = `funnypixels-${new Date().getTime()}`;
const RUNTIME_CACHE = 'funnypixels-runtime';

// 需要缓存的核心资源
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 安装事件：缓存核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS).catch((error) => {
          console.log('[SW] Failed to cache core assets:', error);
          // 即使缓存失败，也继续安装
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting()) // 立即激活新的Service Worker
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // 立即控制所有页面
  );
});

// Fetch事件：网络优先，回退到缓存（适合动态内容）
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // API请求：网络优先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 缓存成功的API响应
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败，尝试从缓存获取
          return caches.match(request);
        })
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // 缓存新的静态资源，但排除部分响应 (206) 和不可缓存的响应
          if (response.ok && response.status !== 206 && response.status !== 0) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone).catch((error) => {
                console.log('[SW] Cache put failed:', error, request.url);
              });
            });
          }
          return response;
        });
      })
  );
});

// 推送通知事件
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const options = {
    body: event.data ? event.data.text() : '您有新的消息',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'funnypixels-notification',
    requireInteraction: false,
    actions: [
      { action: 'open', title: '查看', icon: '/icon-checkin.png' },
      { action: 'close', title: '关闭', icon: '/icon-close.png' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('FunnyPixels', options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 后台同步事件（用于离线时的数据同步）
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-pixels') {
    event.waitUntil(syncPixels());
  }
});

// 同步像素数据
async function syncPixels() {
  try {
    // 从IndexedDB获取待同步的数据
    // 发送到服务器
    console.log('[SW] Syncing pixels data...');
    // TODO: 实现具体的同步逻辑
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // 重新抛出错误以便浏览器重试
  }
}

// 消息事件（接收来自主线程的消息）
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }

  if (event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ cacheSize: size });
      })
    );
  }
});

// 获取缓存大小
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

console.log('[SW] Service Worker loaded');
