import { db } from '../db'

export const SEMANTIC_SCHEMA_VERSION = 1
export const MAX_SEMANTIC_NOTES_PER_JOB = 1_000
export const MAX_SEMANTIC_CHUNKS_PER_NOTE = 8
export const MAX_SEMANTIC_CHUNK_CHARACTERS = 2_400
export const MAX_EMBEDDING_DIMENSIONS = 3_072

const compact = (value) => String(value || '').replace(/\s+/gu, ' ').trim()

const splitBounded = (text, maximum = MAX_SEMANTIC_CHUNK_CHARACTERS) => {
  const source = compact(text)
  if (!source) return []
  const chunks = []
  let rest = source
  while (rest.length > maximum && chunks.length < MAX_SEMANTIC_CHUNKS_PER_NOTE - 1) {
    const floor = Math.floor(maximum * 0.62)
    const candidates = [rest.lastIndexOf('. ', maximum), rest.lastIndexOf('; ', maximum), rest.lastIndexOf(' ', maximum)]
    const boundary = candidates.find((value) => value >= floor) || maximum
    chunks.push(rest.slice(0, boundary + (rest[boundary] === '.' || rest[boundary] === ';' ? 1 : 0)).trim())
    rest = rest.slice(boundary + 1).trim()
  }
  if (rest) chunks.push(rest.slice(0, maximum))
  return chunks
}

const sourceSections = (document) => {
  const sections = []
  const body = compact([
    document.title,
    document.headingsText,
    document.bodyText,
    document.objectText,
    document.metadataText,
  ].filter(Boolean).join('\n'))
  if (body) sections.push({ kind: 'note', text: body, target: { noteId: document.noteId } })
  for (const location of document.locations || []) {
    const text = compact(location.text)
    if (!text || !['recognition', 'object'].includes(location.kind)) continue
    sections.push({
      kind: location.kind,
      text,
      target: {
        noteId: document.noteId,
        anchorId: location.anchorId || null,
        objectId: location.objectId || null,
        recognitionId: location.recognitionId || null,
        resourceId: location.resourceId || null,
        pageId: location.pageId || null,
        pageNumber: location.pageNumber || null,
        timeMs: location.timeMs ?? null,
      },
    })
  }
  return sections
}

export function chunkKnowledgeDocument(document) {
  if (!document?.noteId || !document.sourceFingerprint || document.deleted || document.archived || document.shared) return []
  const chunks = []
  for (const section of sourceSections(document)) {
    for (const text of splitBounded(section.text)) {
      if (chunks.length >= MAX_SEMANTIC_CHUNKS_PER_NOTE) break
      const index = chunks.length
      chunks.push({
        id: `${document.noteId}:semantic:${index}`,
        noteId: document.noteId,
        chunkIndex: index,
        sourceFingerprint: document.sourceFingerprint,
        text,
        title: String(document.title || 'Untitled note').slice(0, 500),
        target: section.target,
      })
    }
    if (chunks.length >= MAX_SEMANTIC_CHUNKS_PER_NOTE) break
  }
  return chunks
}

const finiteVector = (value) => {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_EMBEDDING_DIMENSIONS) return null
  const vector = value.map(Number)
  return vector.every(Number.isFinite) ? vector : null
}

export function createSemanticEmbedding(input) {
  const vector = finiteVector(input?.vector)
  if (!input?.ownerId || !input.noteId || !input.id || !input.sourceFingerprint || !vector) {
    throw new Error('The semantic embedding is invalid.')
  }
  const timestamp = input.generatedAt || new Date().toISOString()
  return {
    id: String(input.id).slice(0, 180),
    ownerId: String(input.ownerId).slice(0, 128),
    noteId: String(input.noteId).slice(0, 128),
    schemaVersion: SEMANTIC_SCHEMA_VERSION,
    chunkIndex: Math.max(0, Math.min(10_000, Number(input.chunkIndex) || 0)),
    sourceFingerprint: String(input.sourceFingerprint).slice(0, 512),
    textPreview: compact(input.textPreview).slice(0, 500),
    target: input.target && typeof input.target === 'object' ? {
      noteId: String(input.noteId).slice(0, 128),
      anchorId: input.target.anchorId ? String(input.target.anchorId).slice(0, 128) : null,
      objectId: input.target.objectId ? String(input.target.objectId).slice(0, 128) : null,
      recognitionId: input.target.recognitionId ? String(input.target.recognitionId).slice(0, 128) : null,
      resourceId: input.target.resourceId ? String(input.target.resourceId).slice(0, 128) : null,
      pageId: input.target.pageId ? String(input.target.pageId).slice(0, 128) : null,
      pageNumber: input.target.pageNumber == null ? null : Math.max(1, Math.round(Number(input.target.pageNumber) || 1)),
      timeMs: input.target.timeMs == null ? null : Math.max(0, Number(input.target.timeMs) || 0),
    } : { noteId: String(input.noteId).slice(0, 128) },
    vector,
    dimensions: vector.length,
    providerId: String(input.providerId || '').slice(0, 160),
    modelId: String(input.modelId || '').slice(0, 160),
    modelVersion: String(input.modelVersion || '').slice(0, 160),
    status: input.status === 'stale' ? 'stale' : 'current',
    generatedAt: timestamp,
    updatedAt: timestamp,
  }
}

export async function replaceNoteSemanticEmbeddings(ownerId, noteId, rows) {
  const normalized = rows.map((row) => createSemanticEmbedding({ ...row, ownerId, noteId }))
  await db.transaction('rw', db.semanticEmbeddings, async () => {
    await db.semanticEmbeddings.where('[ownerId+noteId]').equals([ownerId, noteId]).delete()
    if (normalized.length) await db.semanticEmbeddings.bulkPut(normalized)
  })
  return normalized
}

export async function markStaleSemanticEmbeddings(ownerId, documents) {
  const fingerprints = new Map((documents || []).map((document) => [document.noteId, document.sourceFingerprint]))
  const rows = await db.semanticEmbeddings.where('ownerId').equals(ownerId).toArray()
  const stale = rows.filter((row) => row.status !== 'stale' && fingerprints.get(row.noteId) !== row.sourceFingerprint)
  if (stale.length) {
    const updatedAt = new Date().toISOString()
    await db.semanticEmbeddings.bulkPut(stale.map((row) => ({ ...row, status: 'stale', updatedAt })))
  }
  return stale.length
}

const cosineSimilarity = (left, right) => {
  if (!left || !right || left.length !== right.length) return -1
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : -1
}

export async function findSemanticMatches({ ownerId, queryVector, documents, limit = 60 }) {
  const vector = finiteVector(queryVector)
  if (!ownerId || !vector) return []
  const documentById = new Map((documents || []).filter((document) => !document.deleted && !document.archived && !document.shared)
    .map((document) => [document.noteId, document]))
  const rows = await db.semanticEmbeddings.where('[ownerId+status]').equals([ownerId, 'current']).toArray()
  const best = new Map()
  for (const row of rows) {
    const document = documentById.get(row.noteId)
    if (!document || document.sourceFingerprint !== row.sourceFingerprint || row.dimensions !== vector.length) continue
    const similarity = cosineSimilarity(vector, row.vector)
    if (similarity < 0.18 || similarity <= (best.get(row.noteId)?.similarity ?? -1)) continue
    best.set(row.noteId, { document, row, similarity })
  }
  return [...best.values()]
    .sort((left, right) => right.similarity - left.similarity || left.document.noteId.localeCompare(right.document.noteId))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 60)))
    .map(({ document, row, similarity }) => ({
      ...document,
      semanticSimilarity: similarity,
      semanticLabel: true,
      matchField: 'semantic',
      snippet: row.textPreview,
      target: row.target,
    }))
}

export function mergeHybridResults(lexicalResults, semanticResults, query) {
  const lexical = lexicalResults || []
  const semanticById = new Map((semanticResults || []).map((row) => [row.noteId, row]))
  const normalizedQuery = compact(query).toLocaleLowerCase()
  const merged = lexical.map((row, index) => {
    const semantic = semanticById.get(row.noteId)
    semanticById.delete(row.noteId)
    const exactTitle = compact(row.title).toLocaleLowerCase() === normalizedQuery
    return {
      ...row,
      semanticSimilarity: semantic?.semanticSimilarity ?? null,
      semanticLabel: Boolean(semantic),
      hybridBand: exactTitle ? 3 : 2,
      hybridScore: (lexical.length - index) + (semantic?.semanticSimilarity || 0) * 0.2,
    }
  })
  for (const row of semanticById.values()) merged.push({ ...row, hybridBand: 1, hybridScore: row.semanticSimilarity })
  return merged.sort((left, right) => right.hybridBand - left.hybridBand || right.hybridScore - left.hybridScore || left.noteId.localeCompare(right.noteId))
}
