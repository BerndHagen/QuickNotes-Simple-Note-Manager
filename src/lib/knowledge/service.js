import { createKnowledgeSearchEngine } from './searchEngine'
import { getKnowledgeDocuments, reconcileKnowledgeIndex, rebuildKnowledgeIndex } from './repository'

let activeOwnerId = null
let worker = null
let fallbackEngine = null
let activeDocuments = new Map()
let requestSequence = 0
let reconciliationSequence = 0
const pendingRequests = new Map()
const listeners = new Set()
let snapshot = { status: 'idle', ownerId: null, documentCount: 0, error: null }

const publish = (updates) => {
  snapshot = { ...snapshot, ...updates }
  listeners.forEach((listener) => listener())
}

const terminateWorker = () => {
  worker?.terminate()
  worker = null
  for (const { reject } of pendingRequests.values()) reject(new Error('Search workspace changed.'))
  pendingRequests.clear()
}

const ensureWorker = () => {
  if (worker || typeof Worker === 'undefined') return worker
  worker = new Worker(new URL('./search.worker.js', import.meta.url), { type: 'module', name: 'quicknotes-search' })
  worker.onmessage = (event) => {
    const message = event.data || {}
    if (message.type === 'ready') {
      publish({ status: 'ready', documentCount: message.count, error: null })
    } else if (message.type === 'results') {
      pendingRequests.get(message.requestId)?.resolve(message.results || [])
      pendingRequests.delete(message.requestId)
    } else if (message.type === 'error') {
      const error = new Error(message.message || 'Search failed.')
      pendingRequests.get(message.requestId)?.reject(error)
      pendingRequests.delete(message.requestId)
      publish({ status: 'error', error })
    }
  }
  worker.onerror = (event) => {
    publish({ status: 'error', error: new Error(event.message || 'Search worker failed.') })
    terminateWorker()
  }
  return worker
}

const loadEngine = async (ownerId, documents) => {
  if (ownerId !== activeOwnerId) return
  activeDocuments = new Map(documents.map((document) => [document.noteId, document]))
  const searchWorker = ensureWorker()
  if (searchWorker) {
    fallbackEngine = null
    searchWorker.postMessage({ type: 'replaceAll', ownerId, documents })
  } else {
    fallbackEngine = createKnowledgeSearchEngine(documents)
    publish({ status: 'ready', documentCount: documents.length, error: null })
  }
}

const updateEngine = (ownerId, result) => {
  if (ownerId !== activeOwnerId) return
  const documentById = new Map(result.documents.map((document) => [document.noteId, document]))
  for (const noteId of result.removedNoteIds) {
    activeDocuments.delete(noteId)
    if (worker) worker.postMessage({ type: 'remove', noteId })
    else fallbackEngine?.remove(noteId)
  }
  for (const noteId of result.changedNoteIds) {
    const document = documentById.get(noteId)
    if (!document) continue
    activeDocuments.set(noteId, document)
    if (worker) worker.postMessage({ type: 'upsert', document })
    else fallbackEngine?.upsert(document)
  }
  publish({ status: 'ready', documentCount: activeDocuments.size, error: null })
}

export const activateKnowledgeIndex = async ({ ownerId, notes, folders = [], force = false }) => {
  if (!ownerId) {
    activeOwnerId = null
    fallbackEngine = null
    activeDocuments = new Map()
    terminateWorker()
    publish({ status: 'idle', ownerId: null, documentCount: 0, error: null })
    return []
  }
  const sequence = ++reconciliationSequence
  const ownerChanged = activeOwnerId !== ownerId
  const canUpdateIncrementally = !force && !ownerChanged && snapshot.status === 'ready'
  if (ownerChanged) {
    activeOwnerId = ownerId
    fallbackEngine = null
    activeDocuments = new Map()
    terminateWorker()
  }
  publish({ status: 'building', ownerId, error: null })
  try {
    const result = force
      ? await rebuildKnowledgeIndex({ ownerId, notes, folders })
      : await reconcileKnowledgeIndex({ ownerId, notes, folders })
    if (sequence !== reconciliationSequence || ownerId !== activeOwnerId) return []
    if (canUpdateIncrementally) updateEngine(ownerId, result)
    else await loadEngine(ownerId, result.documents)
    return result.documents
  } catch (error) {
    if (sequence === reconciliationSequence) publish({ status: 'error', ownerId, error })
    throw error
  }
}

export const searchKnowledge = async (query, options = {}) => {
  if (!activeOwnerId) return []
  const searchWorker = ensureWorker()
  if (searchWorker && snapshot.status !== 'error') {
    const requestId = ++requestSequence
    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { resolve, reject })
      searchWorker.postMessage({ type: 'search', requestId, query, options })
    })
  }
  if (!fallbackEngine) fallbackEngine = createKnowledgeSearchEngine(await getKnowledgeDocuments(activeOwnerId))
  return fallbackEngine.search(query, options)
}

export const rebuildActiveKnowledgeIndex = ({ notes, folders = [] }) => {
  if (!activeOwnerId) return Promise.resolve([])
  return activateKnowledgeIndex({ ownerId: activeOwnerId, notes, folders, force: true })
}

export const getKnowledgeServiceSnapshot = () => snapshot
export const getIndexedKnowledgeDocument = (noteId) => activeDocuments.get(noteId) || null
export const getIndexedKnowledgeDocuments = () => [...activeDocuments.values()]
export const getActiveKnowledgeOwnerId = () => activeOwnerId
export const getIndexedKnowledgeText = (noteId) => activeDocuments.get(noteId)?.searchableText || ''
export const subscribeKnowledgeService = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
