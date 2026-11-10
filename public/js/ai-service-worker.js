// AI Model and Application Caching Service Worker
const CACHE_NAME = 'codeshield-ai-v3';
const ASSETS_TO_CACHE = [
  // Core application files
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/ai-secret-detector.js',
  '/js/real-time-detector.js',
  '/js/settings-manager.js',
  
  // AI and ML dependencies
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder',
  
  // UI assets
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap'
];

// AI Models to cache
const AI_MODELS = [
  '/models/secret-detection/model.json',
  '/models/secret-detection/group1-shard1of1.bin',
  '/models/universal-sentence-encoder/group1-shard1of1.json',
  '/models/universal-sentence-encoder/group1-shard1of1.bin'
];

// Install event - cache all required assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching application shell and AI models');
        return Promise.all([
          cache.addAll(ASSETS_TO_CACHE),
          cacheAIResources(cache)
        ]);
      })
      .catch(error => {
        console.error('Failed to cache resources:', error);
      })
  );
  
  // Activate the service worker immediately
  self.skipWaiting();
});

// Cache AI resources with proper error handling
async function cacheAIResources(cache) {
  try {
    // Cache AI models with proper content-type headers
    for (const modelUrl of AI_MODELS) {
      try {
        const response = await fetch(modelUrl);
        if (response.ok) {
          const cacheResponse = response.clone();
          await cache.put(modelUrl, cacheResponse);
        }
      } catch (error) {
        console.warn(`Failed to cache ${modelUrl}:`, error);
      }
    }
  } catch (error) {
    console.error('Error caching AI resources:', error);
  }
}

// Activate event - clean up old caches and set up background sync
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all([
        // Clean up old caches
        ...cacheNames
          .filter(cacheName => cacheName.startsWith('codeshield-') && cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }),
        
        // Claim clients to ensure the service worker takes effect immediately
        self.clients.claim(),
        
        // Register for background sync
        self.registration.sync.register('update-models')
      ]);
    })
  );
});

// Fetch event - serve from cache first, then network with cache update
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests and cross-origin requests that we don't control
  if (event.request.method !== 'GET') return;
  
  // Handle requests for AI models and application assets
  if (isAssetRequest(requestUrl) || isModelRequest(requestUrl)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Return cached response if available
          if (cachedResponse) {
            // Update cache in the background
            updateCacheInBackground(event.request);
            return cachedResponse;
          }
          
          // If not in cache, fetch from network
          return fetchWithCacheFallback(event.request);
        })
    );
  }
});

// Check if the request is for an application asset
function isAssetRequest(url) {
  return ASSETS_TO_CACHE.some(asset => {
    return url.href === asset || 
           (url.origin === self.location.origin && 
            ASSETS_TO_CACHE.some(asset => url.pathname.endsWith(asset.split('/').pop())));
  });
}

// Check if the request is for an AI model
function isModelRequest(url) {
  return AI_MODELS.some(model => url.href.endsWith(model.split('/').pop()));
}

// Update cache in the background
function updateCacheInBackground(request) {
  fetch(request).then(response => {
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
    }
  }).catch(error => {
    console.warn('Background cache update failed:', error);
  });
}

// Fetch with cache fallback
async function fetchWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response && response.status === 200) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
    }
    
    return response;
  } catch (error) {
    // If network fails, try to return from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If nothing in cache, return an error response
    return new Response(JSON.stringify({
      error: 'Failed to load resource. You might be offline.'
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle background sync for model updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-models') {
    event.waitUntil(updateModels());
  }
});

// Update AI models in the background
async function updateModels() {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    await Promise.all(
      AI_MODELS.map(async (modelUrl) => {
        try {
          const response = await fetch(modelUrl);
          if (response.ok) {
            await cache.put(modelUrl, response);
          }
        } catch (error) {
          console.warn(`Failed to update model ${modelUrl}:`, error);
        }
      })
    );
    
    // Notify all clients that models have been updated
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'modelsUpdated',
        message: 'AI models have been updated',
        timestamp: new Date().toISOString()
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error updating models:', error);
    return false;
  }
}
// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        console.log('AI model cache cleared');
        event.ports[0].postMessage({ success: true });
      })
      .catch(error => {
        console.error('Failed to clear cache:', error);
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
});
