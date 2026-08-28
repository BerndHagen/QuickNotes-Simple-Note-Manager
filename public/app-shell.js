/* global CustomEvent, URL, console, document, navigator, window */

(() => {
  'use strict'

  const script = document.currentScript
  if (!script) return

  const baseUrl = new URL('./', script.src)
  const redirect = window.location.search

  if (redirect.startsWith('?/')) {
    const route = redirect
      .slice(1)
      .split('&')
      .map(segment => segment.replace(/~and~/g, '&'))
      .join('?')
    const destination = `${baseUrl.pathname.slice(0, -1)}${route}${window.location.hash}`
    window.history.replaceState(null, '', destination)
  }

  if (script.dataset.mode !== 'production' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', baseUrl), {
      updateViaCache: 'none',
    }).then(registration => {
      let activatingRequested = false
      const announceWaiting = () => {
        if (!registration.waiting) return
        window.dispatchEvent(new CustomEvent('quicknotes:update-ready'))
      }

      announceWaiting()
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            announceWaiting()
          }
        })
      })

      window.addEventListener('quicknotes:activate-update', () => {
        if (!registration.waiting) return
        activatingRequested = true
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      })
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (activatingRequested) window.location.reload()
      })
    }).catch(error => {
      console.warn('[QuickNotes] Offline support could not be initialized.', error)
    })
  })
})()
