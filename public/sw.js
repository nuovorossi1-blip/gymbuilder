const CACHE = 'gymbuilder-shell-v3'
const SHELL = ['/', '/manifest.webmanifest', '/gymbuilder-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) return response
      return caches.match('/')
    }).catch(() => caches.match('/')))
    return
  }
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)))
    }
    return response
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))))
})

self.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data.type === 'SHOW_BACKGROUND_TIMER') {
    const { label, remainingSec, endTime } = event.data
    const targetTime = endTime || (Date.now() + (remainingSec || 0) * 1000)
    self.registration.showNotification(`⏱️ GymBuilder · ${label}`, {
      body: 'Timer attivo in background. Tocca per aprire l’allenamento.',
      icon: '/gymbuilder-icon.svg',
      badge: '/gymbuilder-icon.svg',
      tag: 'gymbuilder-active-timer',
      renotify: false,
      silent: true,
      showChronometer: true,
      chronometerDirection: 'down',
      timestamp: targetTime,
      data: { href: '/?resume=workout' }
    })
  } else if (event.data.type === 'CLEAR_BACKGROUND_TIMER') {
    self.registration.getNotifications({ tag: 'gymbuilder-active-timer' }).then((notifications) => {
      notifications.forEach((n) => n.close())
    })
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/?resume=workout'
  const target = new URL(href, self.location.origin)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const sameOrigin = clients.filter((client) => {
      try {
        return new URL(client.url).origin === self.location.origin
      } catch {
        return false
      }
    })
    const existing = sameOrigin.find((client) => new URL(client.url).pathname === '/avvia')
      || sameOrigin.find((client) => client.focused)
      || sameOrigin.find((client) => client.visibilityState === 'visible')
      || sameOrigin[0]
    if (existing) {
      // Non navigare e non aprire una seconda superficie browser: React riceve
      // il comando e riporta la finestra esistente al Runner persistito.
      existing.postMessage({ type: 'RESUME_ACTIVE_SESSION', href: '/avvia', source: 'notification' })
      return existing.focus()
    }
    return self.clients.openWindow(target.href)
  }))
})
