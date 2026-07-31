import DOMPurify from 'dompurify'

const NOTE_HTML_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'base'],
}

/**
 * Keep the rich-text markup supported by the editor while removing executable
 * HTML, event handlers, unsafe URLs, and document-level elements.
 */
export const sanitizeNoteHtml = (html) =>
  DOMPurify.sanitize(String(html || ''), NOTE_HTML_CONFIG)

export const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
