const CACHE_NAME = 'nostr-notify-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/icon-192.png',
    '/icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('Cache addAll failed:', err);
            })
    );
});

// Fetch from cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(
                    (response) => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }
                );
            })
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: 'icon-192.png',
        badge: 'icon-192.png'
    };
    
    event.waitUntil(
        self.registration.showNotification('Nostr Notify', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});
