/* global URL, console, document, navigator, window */

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
    }).catch(error => {
      console.warn('[QuickNotes] Offline support could not be initialized.', error)
    })
  })
})()
