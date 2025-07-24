const CACHE_NAME = 'vocabulario-inteligente-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/static/js/bundle.js', // CRA의 기본 번들 경로, 실제 경로와 다를 수 있습니다.
  '/static/css/main.chunk.css', // 실제 경로 확인이 필요할 수 있습니다.
  '/words.json',
  // 주요 JS/CSS 청크 파일들을 포함시키는 것이 좋습니다.
  // 빌드 후 생성되는 파일명을 확인하고 추가해야 할 수 있습니다.
];

/* eslint-disable-next-line no-restricted-globals */
self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // addAll은 원자적입니다. 하나라도 실패하면 전체가 실패합니다.
        return cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(error => {
        console.error('Failed to cache', error);
      })
  );
});

/* eslint-disable-next-line no-restricted-globals */
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

/* eslint-disable-next-line no-restricted-globals */
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


/* eslint-disable-next-line no-restricted-globals */
self.addEventListener('push', event => {
  const data = event.data.json();
  const title = data.title || 'Vocabulario Inteligente';
  const options = {
    body: data.body,
    icon: '/logo192.png', // 알림에 표시될 아이콘
    badge: '/logo192.png' // 안드로이드에서 사용될 뱃지
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* eslint-disable-next-line no-restricted-globals */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    /* eslint-disable-next-line no-restricted-globals */
    self.skipWaiting();
  }
});
