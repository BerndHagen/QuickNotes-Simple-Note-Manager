import { createKnowledgeSearchEngine } from './searchEngine'

const engine = createKnowledgeSearchEngine()

self.onmessage = (event) => {
  const message = event.data || {}
  try {
    if (message.type === 'replaceAll') {
      engine.replaceAll(message.documents || [])
      self.postMessage({ type: 'ready', ownerId: message.ownerId, count: engine.size() })
    } else if (message.type === 'upsert') {
      engine.upsert(message.document)
    } else if (message.type === 'remove') {
      engine.remove(message.noteId)
    } else if (message.type === 'search') {
      self.postMessage({
        type: 'results',
        requestId: message.requestId,
        results: engine.search(message.query, message.options),
      })
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error?.message || 'The search worker failed.',
    })
  }
}

