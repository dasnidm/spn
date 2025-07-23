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
