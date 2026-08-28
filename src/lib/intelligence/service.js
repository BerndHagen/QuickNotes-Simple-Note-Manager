import { db, getActiveWorkspaceOwner } from '../db'
import { createRecognizedContent, INTELLIGENCE_LIMITS } from './model'
import { createIntelligenceJobService, INTELLIGENCE_JOB_PRIORITIES } from './jobs'
import { createIntelligenceProviderRegistry, IntelligenceProviderError } from './providers'
import {
  getIntelligenceSettings,
  replaceAudioTranscript,
  saveRecognizedContent,
  saveRecognizedContentBatch,
} from './repository'
import { fingerprintInkObjects, fingerprintResource } from './fingerprint'
import { updateCanonicalResourceMetadata } from '../resources/repository'
import { createTesseractOcrProvider } from './tesseractOcr'
import { createPdfTextProvider } from './pdfText'
import { createBrowserHandwritingProvider, isBrowserHandwritingSupported } from './browserHandwriting'
import { createBrowserSpeechProvider, isBrowserSpeechRecognitionSupported } from './browserSpeech'
import { getLinkedResource } from '../resources/repository'
import {
  AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
  createExternalAudioTranscriptionProvider,
  getAudioFileTranscriptionAvailability,
} from './externalAudioTranscription'
import { matchTranscriptSegments } from './transcriptSegments'
import {
  AI_ASSISTANT_PROVIDER_ID,
  AI_EMBEDDING_PROVIDER_ID,
  createExternalAssistantProvider,
  createExternalEmbeddingProvider,
  getExternalAiAvailability,
} from './externalAi'
import {
  chunkKnowledgeDocument,
  createSemanticEmbedding,
  findSemanticMatches,
  markStaleSemanticEmbeddings,
  MAX_SEMANTIC_NOTES_PER_JOB,
  replaceNoteSemanticEmbeddings,
} from './semantic'
import {
  getIndexedKnowledgeDocument,
  getIndexedKnowledgeDocuments,
} from '../knowledge/service'

const registry = createIntelligenceProviderRegistry()
const browserSpeechProvider = createBrowserSpeechProvider()
const audioFileTranscriptionProvider = createExternalAudioTranscriptionProvider()
const externalAssistantProvider = createExternalAssistantProvider()
const externalEmbeddingProvider = createExternalEmbeddingProvider()
registry.register(createTesseractOcrProvider())
registry.register(createPdfTextProvider())
registry.register(createBrowserHandwritingProvider())
registry.register(browserSpeechProvider)
registry.register(audioFileTranscriptionProvider)
registry.register(externalAssistantProvider)
registry.register(externalEmbeddingProvider)

const assertActiveJobOwner = (job) => {
  if (getActiveWorkspaceOwner() !== job.ownerId) throw new DOMException('Workspace changed', 'AbortError')
}

const unionObjectBounds = (objects) => {
  const minX = Math.min(...objects.map((object) => object.bounds.x))
  const minY = Math.min(...objects.map((object) => object.bounds.y))
  const maxX = Math.max(...objects.map((object) => object.bounds.x + object.bounds.width))
  const maxY = Math.max(...objects.map((object) => object.bounds.y + object.bounds.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const sameObjectSelection = (left = [], right = []) => {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

const handleHandwriting = async (job, { signal, reportProgress }) => {
  const [sourceObjects, settings] = await Promise.all([
    db.spatialObjects.bulkGet(job.source.objectIds),
    getIntelligenceSettings(job.ownerId),
  ])
  if (sourceObjects.some((object) => !object || object.noteId !== job.noteId || object.kind !== 'stroke')) {
    throw new IntelligenceProviderError('Some selected source strokes are no longer available.', 'input')
  }
  const pageIds = new Set(sourceObjects.map((object) => object.pageId || null))
  if (pageIds.size !== 1) {
    throw new IntelligenceProviderError('Handwriting recognition can process strokes from only one page at a time.', 'input')
  }
  const provider = registry.resolve('handwriting', {
    providerId: job.providerId,
    settings,
    externalConfirmed: job.externalConfirmed,
  })
  const result = await registry.invoke('handwriting', sourceObjects, {
    providerId: provider.id,
    settings,
    externalConfirmed: job.externalConfirmed,
    signal,
    language: job.language || 'en',
    reportProgress,
  })
  assertActiveJobOwner(job)
  if (!result.text) throw new IntelligenceProviderError('No handwriting could be recognized.', 'input')

  const existing = await db.recognizedContent
    .where('[ownerId+noteId]')
    .equals([job.ownerId, job.noteId])
    .filter((row) => row.type === 'handwriting' && row.status !== 'superseded' && sameObjectSelection(row.sourceObjectIds, job.source.objectIds))
    .first()
  const recognition = createRecognizedContent({
    id: existing?.id,
    ownerId: job.ownerId,
    noteId: job.noteId,
    type: 'handwriting',
    sourceKind: 'ink',
    sourceObjectIds: sourceObjects.map((object) => object.id),
    sourcePageId: sourceObjects[0].pageId || null,
    sourceRegion: unionObjectBounds(sourceObjects),
    machineText: result.text,
    text: existing?.userEdited ? existing.text : result.text,
    confidence: result.confidence,
    providerId: provider.id,
    modelId: provider.modelId,
    modelVersion: provider.modelVersion,
    processingLocation: provider.processingLocation,
    language: result.language,
    sourceFingerprint: await fingerprintInkObjects(sourceObjects),
    userEdited: Boolean(existing?.userEdited),
    editedAt: existing?.editedAt,
    createdAt: existing?.createdAt,
  })
  const saved = await saveRecognizedContent(recognition, { ownerId: job.ownerId, rerun: Boolean(existing) })
  return { recognitionIds: [saved.id], alternatives: result.alternatives || [] }
}

const handleImageOcr = async (job, { signal, reportProgress }) => {
  const [resource, sourceObject, settings] = await Promise.all([
    db.resources.get(job.resourceId),
    job.source.objectIds[0] ? db.spatialObjects.get(job.source.objectIds[0]) : null,
    getIntelligenceSettings(job.ownerId),
  ])
  if (!resource || resource.ownerId !== job.ownerId && sourceObject?.noteId !== job.noteId) {
    throw new IntelligenceProviderError('The source image is no longer available.', 'input')
  }
  if (resource.kind !== 'image' || typeof resource.data !== 'string') {
    throw new IntelligenceProviderError('The selected resource is not a locally stored image.', 'input')
  }
  if (!sourceObject || sourceObject.noteId !== job.noteId || sourceObject.data?.resourceId !== resource.id) {
    throw new IntelligenceProviderError('The source image placement is no longer available.', 'input')
  }

  const provider = registry.resolve('ocr', {
    providerId: job.providerId,
    settings,
  })
  const result = await registry.invoke('ocr', resource.data, {
    providerId: provider.id,
    settings,
    signal,
    language: job.language || 'eng',
    reportProgress,
  })
  assertActiveJobOwner(job)
  if (!result.text) throw new IntelligenceProviderError('No readable text was found in this image.', 'input')

  const existing = await db.recognizedContent
    .where('[ownerId+noteId]')
    .equals([job.ownerId, job.noteId])
    .filter((row) =>
      row.type === 'ocr' &&
      row.sourceResourceId === resource.id &&
      row.sourceObjectIds?.includes(sourceObject.id) &&
      row.status !== 'superseded'
    )
    .first()
  const recognition = createRecognizedContent({
    id: existing?.id,
    ownerId: job.ownerId,
    noteId: job.noteId,
    type: 'ocr',
    sourceKind: 'image',
    sourceResourceId: resource.id,
    sourceObjectIds: [sourceObject.id],
    sourcePageId: sourceObject.pageId || null,
    sourceRegion: sourceObject.bounds,
    text: result.text,
    confidence: result.confidence,
    providerId: provider.id,
    modelId: provider.modelId,
    modelVersion: provider.modelVersion,
    processingLocation: provider.processingLocation,
    language: result.language,
    sourceFingerprint: await fingerprintResource(resource),
  })
  const saved = await saveRecognizedContent(recognition, { ownerId: job.ownerId, rerun: Boolean(existing) })
  return { recognitionIds: [saved.id] }
}

const handlePdfText = async (job, { signal, reportProgress }) => {
  const [linked, settings] = await Promise.all([
    getLinkedResource(job.resourceId, job.noteId, { ownerId: job.ownerId }),
    getIntelligenceSettings(job.ownerId),
  ])
  if (!linked || linked.resource.kind !== 'pdf') {
    throw new IntelligenceProviderError('The source PDF is no longer available.', 'input')
  }
  const pdfProvider = registry.resolve('pdfText', { providerId: job.providerId, settings })
  const ocrProvider = job.ocrScannedPages
    ? registry.resolve('ocr', { providerId: job.fallbackProviderId, settings })
    : null
  const result = await registry.invoke('pdfText', {
    blob: linked.blob,
    pageNumbers: job.pageNumbers,
    ocrScannedPages: job.ocrScannedPages,
    recognizeScannedPage: ocrProvider
      ? (canvas, _pageNumber, pageProgress) => registry.invoke('ocr', canvas, {
          providerId: ocrProvider.id,
          settings,
          signal,
          language: job.language || 'eng',
          reportProgress: pageProgress,
        })
      : null,
  }, {
    providerId: pdfProvider.id,
    settings,
    signal,
    reportProgress,
  })
  assertActiveJobOwner(job)

  if (linked.resource.pageCount !== result.pageCount) {
    await updateCanonicalResourceMetadata(
      linked.resource.id,
      { pageCount: result.pageCount },
      { ownerId: job.ownerId }
    )
  }
  const existing = await db.recognizedContent
    .where('[ownerId+noteId]')
    .equals([job.ownerId, job.noteId])
    .filter((row) => row.sourceResourceId === linked.resource.id && row.status !== 'superseded')
    .toArray()
  const recognitionIds = []
  for (const page of result.pages) {
    const previous = existing.find((row) => row.sourcePageNumber === page.pageNumber)
    const provider = page.recognitionType === 'ocr' ? ocrProvider : pdfProvider
    const recognition = createRecognizedContent({
      id: previous?.id,
      ownerId: job.ownerId,
      noteId: job.noteId,
      type: page.recognitionType,
      sourceKind: 'pdf',
      sourceResourceId: linked.resource.id,
      sourcePageNumber: page.pageNumber,
      machineText: page.text,
      text: previous?.userEdited ? previous.text : page.text,
      confidence: page.confidence,
      providerId: provider.id,
      modelId: provider.modelId,
      modelVersion: provider.modelVersion,
      processingLocation: provider.processingLocation,
      language: page.language,
      sourceFingerprint: `${linked.resource.checksum}:page:${page.pageNumber}`,
      userEdited: Boolean(previous?.userEdited),
      editedAt: previous?.editedAt,
      createdAt: previous?.createdAt,
    })
    const saved = await saveRecognizedContent(recognition, { ownerId: job.ownerId })
    recognitionIds.push(saved.id)
  }
  return {
    recognitionIds,
    pageCount: result.pageCount,
    nativePageCount: result.nativePageCount,
    ocrPageCount: result.ocrPageCount,
  }
}

const handleAudioTranscription = async (job, { signal, reportProgress }) => {
  const [linked, settings] = await Promise.all([
    getLinkedResource(job.resourceId, job.noteId, { ownerId: job.ownerId }),
    getIntelligenceSettings(job.ownerId),
  ])
  if (!linked || linked.resource.kind !== 'audio') {
    throw new IntelligenceProviderError('The source audio is no longer available.', 'input')
  }
  if (!job.source.sourceFingerprint || linked.resource.checksum !== job.source.sourceFingerprint) {
    throw new IntelligenceProviderError('The source audio changed before transcription started.', 'stale')
  }
  const provider = registry.resolve('transcription', {
    providerId: job.providerId,
    settings,
    externalConfirmed: job.externalConfirmed,
  })
  const result = await registry.invoke('transcription', {
    ownerId: job.ownerId,
    noteId: job.noteId,
    resourceId: linked.resource.id,
    sourceFingerprint: linked.resource.checksum,
  }, {
    providerId: provider.id,
    settings,
    externalConfirmed: job.externalConfirmed,
    signal,
    language: job.language && job.language !== 'auto' ? job.language : null,
    reportProgress,
  })
  assertActiveJobOwner(job)

  const existing = await db.recognizedContent
    .where('[ownerId+noteId]')
    .equals([job.ownerId, job.noteId])
    .filter((row) =>
      row.type === 'transcript' &&
      row.sourceResourceId === linked.resource.id &&
      row.status !== 'superseded'
    )
    .toArray()
  const durationMs = Math.min(
    INTELLIGENCE_LIMITS.MAX_SOURCE_TIME_MS,
    Math.max(0, Number(result.durationMs ?? linked.resource.durationMs) || 0)
  )
  const matches = matchTranscriptSegments(existing, result.segments)
  const rows = matches.map(({ segment, existing: previous }) => {
    const startMs = Math.min(durationMs || INTELLIGENCE_LIMITS.MAX_SOURCE_TIME_MS, segment.startMs)
    const endMs = Math.max(startMs, Math.min(durationMs || INTELLIGENCE_LIMITS.MAX_SOURCE_TIME_MS, segment.endMs))
    return createRecognizedContent({
      id: previous?.id,
      ownerId: job.ownerId,
      noteId: job.noteId,
      type: 'transcript',
      sourceKind: 'audio',
      sourceResourceId: linked.resource.id,
      sourceTimeRange: { startMs, endMs },
      machineText: segment.text,
      text: previous?.userEdited ? previous.text : segment.text,
      confidence: null,
      providerId: provider.id,
      modelId: provider.modelId,
      modelVersion: provider.modelVersion,
      processingLocation: provider.processingLocation,
      language: result.language || (job.language === 'auto' ? null : job.language),
      sourceFingerprint: `${linked.resource.checksum}:time:${startMs}:${endMs}`,
      userEdited: Boolean(previous?.userEdited),
      editedAt: previous?.editedAt,
      createdAt: previous?.createdAt,
    })
  })
  const saved = await replaceAudioTranscript(rows, {
    ownerId: job.ownerId,
    noteId: job.noteId,
    resourceId: linked.resource.id,
    providerId: provider.id,
  })
  if (result.durationMs != null && linked.resource.durationMs !== durationMs) {
    await updateCanonicalResourceMetadata(linked.resource.id, { durationMs }, { ownerId: job.ownerId })
  }
  return { recognitionIds: saved.map((row) => row.id), segmentCount: saved.length, durationMs }
}

const handleSemanticIndex = async (job, { signal, reportProgress }) => {
  const settings = await getIntelligenceSettings(job.ownerId)
  const expected = new Map(job.source.noteFingerprints.map((entry) => [entry.noteId, entry.sourceFingerprint]))
  if (expected.size === 0) throw new IntelligenceProviderError('No notes were selected for semantic indexing.', 'input')
  const documents = (await db.searchDocuments.where('ownerId').equals(job.ownerId).toArray())
    .filter((document) => expected.has(document.noteId))
  if (documents.length !== expected.size || documents.some((document) =>
    document.shared || document.deleted || document.archived || document.sourceFingerprint !== expected.get(document.noteId)
  )) throw new IntelligenceProviderError('The selected note scope changed before semantic indexing started.', 'stale')

  const provider = registry.resolve('embedding', {
    providerId: job.providerId,
    settings,
    externalConfirmed: job.externalConfirmed,
  })
  const chunksByNote = documents.map((document) => ({ document, chunks: chunkKnowledgeDocument(document) }))
    .filter((entry) => entry.chunks.length > 0)
  const totalChunks = chunksByNote.reduce((sum, entry) => sum + entry.chunks.length, 0)
  if (!totalChunks) throw new IntelligenceProviderError('The selected notes do not contain indexable text.', 'input')

  await db.semanticIndexState.put({
    ownerId: job.ownerId,
    status: 'building',
    providerId: provider.id,
    modelId: provider.modelId,
    modelVersion: provider.modelVersion,
    sourceCount: documents.length,
    completedSourceCount: 0,
    error: null,
    updatedAt: new Date().toISOString(),
  })
  await markStaleSemanticEmbeddings(job.ownerId, documents)
  let completedChunks = 0
  let completedNotes = 0
  try {
    for (let start = 0; start < chunksByNote.length;) {
      const group = []
      let groupChunks = 0
      while (start < chunksByNote.length) {
        const candidate = chunksByNote[start]
        if (group.length && groupChunks + candidate.chunks.length > 24) break
        group.push(candidate)
        groupChunks += candidate.chunks.length
        start += 1
      }
      const sources = group.flatMap((entry) => entry.chunks.map((chunk) => ({
        id: chunk.id,
        noteId: chunk.noteId,
        title: chunk.title,
        text: chunk.text,
        sourceFingerprint: chunk.sourceFingerprint,
        anchorId: chunk.target.anchorId || null,
      })))
      const result = await registry.invoke('embedding', { kind: 'sources', sources }, {
        providerId: provider.id,
        settings,
        externalConfirmed: job.externalConfirmed,
        signal,
      })
      assertActiveJobOwner(job)
      const vectorById = new Map(result.embeddings.map((entry) => [entry.id, entry.vector]))
      for (const entry of group) {
        const rows = entry.chunks.map((chunk) => createSemanticEmbedding({
          ...chunk,
          ownerId: job.ownerId,
          textPreview: chunk.text,
          vector: vectorById.get(chunk.id),
          providerId: provider.id,
          modelId: result.modelId || provider.modelId,
          modelVersion: result.modelVersion || provider.modelVersion,
        }))
        await replaceNoteSemanticEmbeddings(job.ownerId, entry.document.noteId, rows)
        completedNotes += 1
      }
      completedChunks += sources.length
      await reportProgress(completedChunks / totalChunks)
      await db.semanticIndexState.update(job.ownerId, {
        completedSourceCount: completedNotes,
        updatedAt: new Date().toISOString(),
      })
    }
    await db.semanticIndexState.update(job.ownerId, {
      status: 'ready',
      completedSourceCount: completedNotes,
      embeddingCount: totalChunks,
      error: null,
      updatedAt: new Date().toISOString(),
    })
    return { noteIds: documents.map((document) => document.noteId), embeddingCount: totalChunks }
  } catch (error) {
    await db.semanticIndexState.update(job.ownerId, {
      status: signal.aborted ? 'cancelled' : 'error',
      error: signal.aborted ? null : String(error?.message || error).slice(0, 500),
      updatedAt: new Date().toISOString(),
    })
    throw error
  }
}

const jobService = createIntelligenceJobService({
  handlers: {
    handwriting: handleHandwriting,
    ocr: handleImageOcr,
    pdfText: handlePdfText,
    transcription: handleAudioTranscription,
    semanticIndex: handleSemanticIndex,
  },
  concurrency: 1,
})

export const requestSpatialImageOcr = async ({ noteId, objectId, resourceId, language = 'eng' }) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId) throw new Error('An active workspace is required for OCR.')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('ocr', { settings })
  return jobService.enqueue({
    type: 'ocr',
    noteId,
    resourceId,
    providerId: provider.id,
    language,
    source: { objectIds: [objectId] },
    priority: INTELLIGENCE_JOB_PRIORITIES.interactive,
  }, ownerId)
}

export const requestHandwritingRecognition = async ({
  noteId,
  objectIds,
  language = typeof navigator === 'undefined' ? 'en' : navigator.language || 'en',
  externalConfirmed = false,
}) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId) throw new Error('An active workspace is required for handwriting recognition.')
  if (!isBrowserHandwritingSupported()) throw new Error('Browser handwriting recognition is not available on this device.')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('handwriting', { settings, externalConfirmed })
  return jobService.enqueue({
    type: 'handwriting',
    noteId,
    providerId: provider.id,
    language,
    externalConfirmed,
    source: { objectIds },
    priority: INTELLIGENCE_JOB_PRIORITIES.interactive,
  }, ownerId)
}

export const startBrowserManagedLiveTranscription = async ({
  language = typeof navigator === 'undefined' ? 'en' : navigator.language || 'en',
  externalConfirmed = false,
  getElapsedMs,
  onSegment,
  onInterim,
  onStatus,
  onError,
  signal,
}) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId) throw new Error('An active workspace is required for live transcription.')
  if (!isBrowserSpeechRecognitionSupported()) throw new Error('Browser live transcription is not available on this device.')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('transcription', {
    providerId: browserSpeechProvider.id,
    settings,
    externalConfirmed,
  })
  const session = await registry.invoke('transcription', {
    getElapsedMs,
    onSegment,
    onInterim,
    onStatus,
    onError,
  }, {
    providerId: browserSpeechProvider.id,
    settings,
    externalConfirmed,
    signal,
    language,
  })
  return {
    session,
    provider: {
      id: provider.id,
      modelId: provider.modelId,
      modelVersion: provider.modelVersion,
      processingLocation: provider.processingLocation,
    },
    language: session.language || language,
  }
}

export const getImportedAudioTranscriptionAvailability = (options) => getAudioFileTranscriptionAvailability(options)
export const getAiIntelligenceAvailability = (options) => getExternalAiAvailability(options)

const normalizeAssistantSources = (noteIds, selection = null) => {
  const uniqueIds = [...new Set(noteIds || [])].slice(0, 24)
  const sources = uniqueIds.map((noteId) => getIndexedKnowledgeDocument(noteId)).filter(Boolean)
  if (sources.length !== uniqueIds.length || sources.some((document) => document.shared || document.deleted || document.archived)) {
    throw new IntelligenceProviderError('External intelligence is available only for explicitly selected notes you own.', 'permission')
  }
  return sources.map((document, index) => ({
    id: `${document.noteId}:${index}`,
    noteId: document.noteId,
    title: document.title,
    text: index === 0 && selection?.text ? String(selection.text).slice(0, 20_000) : document.searchableText.slice(0, 20_000),
    anchorId: index === 0 ? selection?.anchorId || null : null,
    sourceFingerprint: document.sourceFingerprint,
  }))
}

export const runAssistantOperation = async ({
  operation,
  noteIds,
  selection = null,
  question = '',
  scopeLabel = '',
  externalConfirmed = false,
  signal,
}) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId || ownerId === 'local') throw new IntelligenceProviderError('Sign in to use external intelligence.', 'unavailable')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('assistant', {
    providerId: AI_ASSISTANT_PROVIDER_ID,
    settings,
    externalConfirmed,
  })
  return registry.invoke('assistant', {
    operation,
    question,
    scopeLabel,
    sources: normalizeAssistantSources(noteIds, selection),
  }, {
    providerId: provider.id,
    settings,
    externalConfirmed,
    signal,
  })
}

export const requestSemanticIndex = async ({ noteIds, externalConfirmed = false }) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId || ownerId === 'local') throw new IntelligenceProviderError('Sign in to build an external semantic index.', 'unavailable')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('embedding', {
    providerId: AI_EMBEDDING_PROVIDER_ID,
    settings,
    externalConfirmed,
  })
  const ids = [...new Set(noteIds || [])].slice(0, MAX_SEMANTIC_NOTES_PER_JOB)
  const documents = ids.map((id) => getIndexedKnowledgeDocument(id)).filter(Boolean)
  if (documents.length !== ids.length || documents.some((document) => document.shared || document.deleted || document.archived)) {
    throw new IntelligenceProviderError('Choose only accessible notes you own for semantic indexing.', 'permission')
  }
  if (!documents.length) throw new IntelligenceProviderError('Choose at least one note to index.', 'input')
  return jobService.enqueue({
    type: 'semanticIndex',
    noteId: documents[0].noteId,
    providerId: provider.id,
    externalConfirmed,
    source: {
      noteFingerprints: documents.map((document) => ({
        noteId: document.noteId,
        sourceFingerprint: document.sourceFingerprint,
      })),
    },
    priority: INTELLIGENCE_JOB_PRIORITIES.background,
  }, ownerId)
}

export const searchSemantically = async ({ query, externalConfirmed = false, signal, limit = 60 }) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId || ownerId === 'local') throw new IntelligenceProviderError('Sign in to search semantically.', 'unavailable')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('embedding', {
    providerId: AI_EMBEDDING_PROVIDER_ID,
    settings,
    externalConfirmed,
  })
  const result = await registry.invoke('embedding', { kind: 'query', query }, {
    providerId: provider.id,
    settings,
    externalConfirmed,
    signal,
  })
  const documents = getIndexedKnowledgeDocuments()
  await markStaleSemanticEmbeddings(ownerId, documents)
  return findSemanticMatches({ ownerId, queryVector: result.embeddings[0]?.vector, documents, limit })
}

export const requestImportedAudioTranscription = async ({
  noteId,
  resourceId,
  language = 'auto',
  externalConfirmed = false,
}) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId || ownerId === 'local') throw new Error('A signed-in QuickNotes cloud account is required for audio-file transcription.')
  const [settings, linked] = await Promise.all([
    getIntelligenceSettings(ownerId),
    getLinkedResource(resourceId, noteId, { ownerId }),
  ])
  if (!linked || linked.resource.kind !== 'audio') throw new Error('The source audio is no longer available.')
  const provider = registry.resolve('transcription', {
    providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
    settings,
    externalConfirmed,
  })
  const availability = await getAudioFileTranscriptionAvailability()
  if (!availability.available) throw new IntelligenceProviderError(availability.reason, 'unavailable')
  if (linked.resource.byteSize > availability.maxBytes) {
    throw new IntelligenceProviderError(`This provider accepts audio files up to ${Math.round(availability.maxBytes / 1024 / 1024)} MB.`, 'input')
  }
  const existingJobs = await db.intelligenceJobs
    .where('ownerId')
    .equals(ownerId)
    .filter((job) =>
      job.type === 'transcription' &&
      job.noteId === noteId &&
      job.resourceId === resourceId &&
      ['queued', 'running'].includes(job.status)
    )
    .toArray()
  if (existingJobs[0]) return existingJobs[0]
  const normalizedLanguage = language === 'auto' ? 'auto' : String(language || '').trim().toLowerCase().slice(0, 2)
  return jobService.enqueue({
    type: 'transcription',
    noteId,
    resourceId,
    providerId: provider.id,
    language: normalizedLanguage,
    externalConfirmed,
    source: { resourceId, sourceFingerprint: linked.resource.checksum },
    priority: INTELLIGENCE_JOB_PRIORITIES.interactive,
  }, ownerId)
}

export const saveBrowserManagedTranscript = async ({ noteId, resourceId, segments, language }) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId) throw new Error('An active workspace is required to save a transcript.')
  const linked = await getLinkedResource(resourceId, noteId, { ownerId })
  if (!linked || linked.resource.kind !== 'audio') throw new Error('The source recording is no longer available.')
  const values = Array.isArray(segments) ? segments.slice(0, 5_000) : []
  let totalTextLength = 0
  const rows = []
  for (const segment of values) {
    const text = String(segment?.text || '').trim()
    if (!text) continue
    totalTextLength += text.length
    if (totalTextLength > 200_000) throw new Error('The live transcript exceeds the safe text limit.')
    const startMs = Math.max(0, Math.min(linked.resource.durationMs || Number.MAX_SAFE_INTEGER, Number(segment.startMs) || 0))
    const endMs = Math.max(startMs, Math.min(linked.resource.durationMs || Number.MAX_SAFE_INTEGER, Number(segment.endMs) || startMs))
    rows.push(createRecognizedContent({
      ownerId,
      noteId,
      type: 'transcript',
      sourceKind: 'audio',
      sourceResourceId: resourceId,
      sourceTimeRange: { startMs, endMs },
      text,
      confidence: segment.confidence,
      providerId: browserSpeechProvider.id,
      modelId: browserSpeechProvider.modelId,
      modelVersion: browserSpeechProvider.modelVersion,
      processingLocation: browserSpeechProvider.processingLocation,
      language,
      sourceFingerprint: `${linked.resource.checksum}:time:${startMs}:${endMs}`,
    }))
  }
  if (rows.length > 0) await saveRecognizedContentBatch(rows, { ownerId })
  return rows
}

export const requestPdfRecognition = async ({
  noteId,
  resourceId,
  pageNumbers = null,
  ocrScannedPages = true,
  language = 'eng',
}) => {
  const ownerId = getActiveWorkspaceOwner()
  if (!ownerId) throw new Error('An active workspace is required for PDF recognition.')
  const settings = await getIntelligenceSettings(ownerId)
  const provider = registry.resolve('pdfText', { settings })
  const fallbackProvider = ocrScannedPages ? registry.resolve('ocr', { settings }) : null
  return jobService.enqueue({
    type: 'pdfText',
    noteId,
    resourceId,
    providerId: provider.id,
    fallbackProviderId: fallbackProvider?.id,
    language,
    pageNumbers,
    ocrScannedPages,
    source: {},
    priority: INTELLIGENCE_JOB_PRIORITIES.interactive,
  }, ownerId)
}

export const cancelIntelligenceJob = (id) => jobService.cancel(id)
export const retryIntelligenceJob = (id) => jobService.retry(id)
export const resumeIntelligenceJobs = (ownerId) => jobService.resume(ownerId)
export const activateIntelligenceJobOwner = (ownerId) => jobService.activate(ownerId)
export const getIntelligenceJobService = () => jobService
export const getIntelligenceProviderRegistry = () => registry
