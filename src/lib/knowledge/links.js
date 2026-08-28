const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, div'

const decode = (value) => {
  if (typeof value !== 'string' || !value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

const cleanId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const id = String(value || '').trim()
  const containsControlCharacter = [...id].some((character) => character.charCodeAt(0) < 32)
  return id && id.length <= 2_000 && !containsControlCharacter ? id : ''
}

const hash = (value) => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

export const parseInternalNoteHref = (href) => {
  const value = String(href || '').trim()
  const hashMatch = /^#note\/([^?#]+)(?:\?([^#]+))?$/u.exec(value)
  if (hashMatch) {
    const parameters = new URLSearchParams(hashMatch[2] || '')
    return {
      noteId: cleanId(decode(hashMatch[1])),
      anchorId: cleanId(parameters.get('anchor')) || null,
      objectId: cleanId(parameters.get('object')) || null,
    }
  }
  const legacyMatch = /^note:\/\/([^/?#]+)(?:\/([^?#]+))?/u.exec(value)
  if (legacyMatch) {
    return {
      noteId: cleanId(decode(legacyMatch[1])),
      anchorId: cleanId(decode(legacyMatch[2])) || null,
      objectId: null,
    }
  }
  return null
}

export const createInternalNoteHref = ({ noteId, anchorId = null, objectId = null }) => {
  const stableNoteId = cleanId(noteId)
  if (!stableNoteId) throw new Error('A valid note identity is required.')
  const query = []
  if (anchorId) query.push(`anchor=${encodeURIComponent(cleanId(anchorId))}`)
  if (objectId) query.push(`object=${encodeURIComponent(cleanId(objectId))}`)
  return `#note/${encodeURIComponent(stableNoteId)}${query.length ? `?${query.join('&')}` : ''}`
}

const linkIdentity = (ownerId, sourceNoteId, sourceType, sourceIdentity, target, ordinal) =>
  `${ownerId}:${sourceNoteId}:${hash(`${sourceType}|${sourceIdentity}|${target.noteId}|${target.anchorId || ''}|${target.objectId || ''}|${ordinal}`)}`

const compactContext = (value, maximum = 240) => {
  const text = String(value || '').replace(/\s+/gu, ' ').trim()
  return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text
}

export const extractDocumentLinks = ({ ownerId, noteId, html }) => {
  if (!ownerId || !noteId || !html || typeof DOMParser === 'undefined') return []
  const documentNode = new DOMParser().parseFromString(String(html), 'text/html')
  const links = []
  let currentHeadingId = null
  let ordinal = 0

  for (const element of documentNode.body.querySelectorAll('h1, h2, h3, h4, h5, h6, a')) {
    if (/^H[1-6]$/u.test(element.tagName)) {
      currentHeadingId = element.getAttribute('data-anchor-id') || null
      continue
    }
    const parsed = parseInternalNoteHref(element.getAttribute('href'))
    const target = {
      noteId: cleanId(element.getAttribute('data-note-id')) || parsed?.noteId || '',
      anchorId: cleanId(element.getAttribute('data-note-anchor-id')) || parsed?.anchorId || null,
      objectId: cleanId(element.getAttribute('data-note-object-id')) || parsed?.objectId || null,
    }
    if (!target.noteId) continue
    const sourceIdentity = currentHeadingId || `document-${ordinal}`
    links.push({
      id: linkIdentity(ownerId, noteId, 'document', sourceIdentity, target, ordinal),
      ownerId,
      sourceNoteId: noteId,
      sourceKind: 'document',
      sourceAnchorId: currentHeadingId,
      sourceObjectId: null,
      targetNoteId: target.noteId,
      targetAnchorId: target.anchorId,
      targetObjectId: target.objectId,
      relationship: element.getAttribute('data-relationship') || 'reference',
      label: compactContext(element.textContent) || 'Linked note',
      context: compactContext(element.closest(BLOCK_SELECTOR)?.textContent || element.textContent),
      createdAt: null,
      updatedAt: new Date().toISOString(),
    })
    ordinal += 1
  }
  return links
}

export const extractSpatialLinks = ({ ownerId, noteId, contentKind, objects = [], notesById = new Map() }) =>
  objects
    .filter((object) => object?.kind === 'noteLink' && cleanId(object.data?.targetNoteId))
    .map((object, ordinal) => {
      const target = {
        noteId: cleanId(object.data.targetNoteId),
        anchorId: cleanId(object.data.targetAnchorId) || null,
        objectId: cleanId(object.data.targetObjectId) || null,
      }
      const targetTitle = notesById.get(target.noteId)?.title
      return {
        id: linkIdentity(ownerId, noteId, contentKind, object.id, target, ordinal),
        ownerId,
        sourceNoteId: noteId,
        sourceKind: contentKind,
        sourceAnchorId: null,
        sourceObjectId: object.id,
        targetNoteId: target.noteId,
        targetAnchorId: target.anchorId,
        targetObjectId: target.objectId,
        relationship: object.data.relationship || 'reference',
        label: compactContext(object.data.label || targetTitle) || 'Linked note',
        context: compactContext(object.data.context || `Link to ${targetTitle || 'note'}`),
        createdAt: object.createdAt || null,
        updatedAt: object.updatedAt || new Date().toISOString(),
      }
    })

export const extractKnowledgeLinks = ({ ownerId, note, spatialObjects = [], notesById = new Map() }) => {
  if (!note?.id) return []
  if (note.contentKind === 'paper' || note.contentKind === 'canvas' || ['paper', 'canvas'].includes(note.noteType)) {
    return extractSpatialLinks({
      ownerId,
      noteId: note.id,
      contentKind: note.contentKind || note.noteType,
      objects: spatialObjects,
      notesById,
    })
  }
  return extractDocumentLinks({ ownerId, noteId: note.id, html: note.content })
}
