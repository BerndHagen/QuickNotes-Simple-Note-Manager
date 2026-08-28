import { db, getActiveWorkspaceOwner } from '../db'
import { generateId } from '../utils'

export const INTELLIGENCE_JOB_TYPES = Object.freeze([
  'handwriting',
  'ocr',
  'pdfText',
  'pdfOcr',
  'transcription',
  'semanticIndex',
  'translation',
  'assistant',
])

export const INTELLIGENCE_JOB_STATUSES = Object.freeze([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const INTELLIGENCE_JOB_PRIORITIES = Object.freeze({
  background: 10,
  normal: 50,
  interactive: 100,
})

const MAX_QUEUED_JOBS = 500
const MAX_JOB_ERROR_LENGTH = 1_000

const now = () => new Date().toISOString()

const requireOwner = (ownerId = getActiveWorkspaceOwner()) => {
  if (!ownerId) throw new Error('An active workspace owner is required.')
  return ownerId
}

const boundedId = (value, required = false) => {
  if (value == null || value === '') {
    if (required) throw new Error('The intelligence job is missing a required identity.')
    return null
  }
  const id = String(value)
  if (id.length > 128) throw new Error('The intelligence job contains an invalid identity.')
  return id
}

const normalizePriority = (value) => Math.max(0, Math.min(100, Number(value) || INTELLIGENCE_JOB_PRIORITIES.normal))

const normalizeSource = (source = {}) => {
  const sourceFingerprint = source.sourceFingerprint == null ? null : String(source.sourceFingerprint)
  if (sourceFingerprint && sourceFingerprint.length > 512) {
    throw new Error('The intelligence job contains an invalid source fingerprint.')
  }
  const normalized = {
    resourceId: boundedId(source.resourceId),
    sourceFingerprint,
    pageId: boundedId(source.pageId),
    pageNumber: source.pageNumber == null ? null : Number(source.pageNumber),
    objectIds: [...new Set((source.objectIds || []).map((id) => boundedId(id, true)))].slice(0, 5_000),
    timeRange: source.timeRange == null ? null : {
      startMs: Number(source.timeRange.startMs),
      endMs: Number(source.timeRange.endMs),
    },
    noteFingerprints: Array.isArray(source.noteFingerprints)
      ? source.noteFingerprints.slice(0, 1_000).map((entry) => ({
          noteId: boundedId(entry?.noteId, true),
          sourceFingerprint: String(entry?.sourceFingerprint || '').slice(0, 512),
        }))
      : [],
  }
  if (normalized.noteFingerprints.some((entry) => !entry.sourceFingerprint)) {
    throw new Error('The intelligence job contains an invalid note fingerprint.')
  }
  if (normalized.pageNumber != null && (!Number.isInteger(normalized.pageNumber) || normalized.pageNumber < 1 || normalized.pageNumber > 100_000)) {
    throw new Error('The intelligence job contains an invalid page number.')
  }
  if (normalized.timeRange && (
    !Number.isFinite(normalized.timeRange.startMs) ||
    !Number.isFinite(normalized.timeRange.endMs) ||
    normalized.timeRange.startMs < 0 ||
    normalized.timeRange.endMs < normalized.timeRange.startMs
  )) throw new Error('The intelligence job contains an invalid time range.')
  return normalized
}

const normalizePageNumbers = (values) => {
  if (values == null) return null
  if (!Array.isArray(values) || values.length === 0 || values.length > 10_000) {
    throw new Error('The intelligence job contains an invalid PDF page selection.')
  }
  const pages = [...new Set(values.map(Number))].sort((left, right) => left - right)
  if (pages.some((page) => !Number.isInteger(page) || page < 1 || page > 100_000)) {
    throw new Error('The intelligence job contains an invalid PDF page selection.')
  }
  return pages
}

export function createIntelligenceJob(input) {
  const timestamp = now()
  const type = input?.type
  if (!INTELLIGENCE_JOB_TYPES.includes(type)) throw new Error('The intelligence job has an unsupported type.')
  const job = {
    id: boundedId(input.id) || generateId(),
    ownerId: boundedId(input.ownerId, true),
    noteId: boundedId(input.noteId, true),
    resourceId: boundedId(input.resourceId),
    recognitionId: boundedId(input.recognitionId),
    providerId: boundedId(input.providerId),
    fallbackProviderId: boundedId(input.fallbackProviderId),
    language: input.language == null ? null : String(input.language).slice(0, 35),
    pageNumbers: normalizePageNumbers(input.pageNumbers),
    ocrScannedPages: Boolean(input.ocrScannedPages),
    externalConfirmed: Boolean(input.externalConfirmed),
    type,
    source: normalizeSource(input.source),
    priority: normalizePriority(input.priority),
    status: 'queued',
    progress: 0,
    attempt: 0,
    resultRef: null,
    error: null,
    createdAt: timestamp,
    startedAt: null,
    completedAt: null,
    updatedAt: timestamp,
  }
  assertIntelligenceJob(job)
  return job
}

export function assertIntelligenceJob(job) {
  if (!job?.id || !job.ownerId || !job.noteId || !INTELLIGENCE_JOB_TYPES.includes(job.type)) {
    throw new Error('The intelligence job is invalid.')
  }
  if (!INTELLIGENCE_JOB_STATUSES.includes(job.status)) throw new Error('The intelligence job has an invalid status.')
  if (!Number.isFinite(job.progress) || job.progress < 0 || job.progress > 1) throw new Error('The intelligence job has invalid progress.')
  if (!Number.isInteger(job.attempt) || job.attempt < 0 || job.attempt > 100) throw new Error('The intelligence job has an invalid attempt count.')
  normalizeSource(job.source)
  normalizePageNumbers(job.pageNumbers)
  if (typeof job.externalConfirmed !== 'boolean') throw new Error('The intelligence job has invalid consent metadata.')
  for (const key of ['createdAt', 'updatedAt']) {
    if (!Number.isFinite(Date.parse(job[key]))) throw new Error('The intelligence job has an invalid timestamp.')
  }
  return true
}

const safeError = (error) => String(error?.message || error || 'The operation failed.').slice(0, MAX_JOB_ERROR_LENGTH)

const safeResultRef = (value) => {
  if (value == null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value: String(value).slice(0, 256) }
  const result = {}
  for (const [key, child] of Object.entries(value).slice(0, 50)) {
    if (child == null || typeof child === 'boolean' || (typeof child === 'number' && Number.isFinite(child))) result[key] = child
    else if (typeof child === 'string') result[key] = child.slice(0, 512)
    else if (Array.isArray(child)) result[key] = child.filter((item) => typeof item === 'string').slice(0, 200).map((item) => item.slice(0, 128))
  }
  return result
}

export function createIntelligenceJobService({ handlers = {}, concurrency = 2 } = {}) {
  const maximumConcurrency = Math.max(1, Math.min(4, Number(concurrency) || 2))
  const queuedIds = new Set()
  const running = new Map()
  const suspendedIds = new Set()
  const listeners = new Set()
  let stopped = false
  let scheduled = false

  const publish = () => listeners.forEach((listener) => listener())

  const getSnapshot = () => ({
    queued: queuedIds.size,
    running: running.size,
    stopped,
  })

  const updateJob = async (id, patch) => {
    await db.intelligenceJobs.update(id, { ...patch, updatedAt: now() })
    publish()
  }

  const run = async (job) => {
    const handler = handlers[job.type]
    if (typeof handler !== 'function') {
      await updateJob(job.id, { status: 'failed', error: `No handler is configured for ${job.type}.`, completedAt: now() })
      return
    }
    const controller = new AbortController()
    running.set(job.id, { controller, ownerId: job.ownerId })
    await updateJob(job.id, {
      status: 'running',
      attempt: job.attempt + 1,
      startedAt: now(),
      completedAt: null,
      error: null,
    })
    let lastProgress = 0
    try {
      const resultRef = await handler(job, {
        signal: controller.signal,
        reportProgress: async (progress) => {
          const normalized = Math.max(0, Math.min(0.99, Number(progress) || 0))
          if (normalized - lastProgress < 0.01 && normalized !== 0) return
          lastProgress = normalized
          await updateJob(job.id, { progress: normalized })
        },
      })
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      await updateJob(job.id, {
        status: 'completed',
        progress: 1,
        resultRef: safeResultRef(resultRef),
        completedAt: now(),
      })
    } catch (error) {
      const suspended = suspendedIds.delete(job.id)
      await updateJob(job.id, suspended ? {
        status: 'queued',
        progress: 0,
        startedAt: null,
        error: null,
        completedAt: null,
      } : {
        status: controller.signal.aborted || error?.name === 'AbortError' ? 'cancelled' : 'failed',
        error: controller.signal.aborted || error?.name === 'AbortError' ? null : safeError(error),
        completedAt: now(),
      })
    } finally {
      running.delete(job.id)
      schedule()
    }
  }

  const pump = async () => {
    scheduled = false
    if (stopped) return
    while (running.size < maximumConcurrency && queuedIds.size > 0) {
      const activeOwner = getActiveWorkspaceOwner()
      const rows = (await db.intelligenceJobs.bulkGet([...queuedIds]))
        .filter((job) => job?.status === 'queued' && job.ownerId === activeOwner)
      rows.sort((left, right) => right.priority - left.priority || Date.parse(left.createdAt) - Date.parse(right.createdAt))
      const job = rows[0]
      if (!job) {
        queuedIds.clear()
        break
      }
      queuedIds.delete(job.id)
      void run(job)
    }
    publish()
  }

  function schedule() {
    if (scheduled || stopped) return
    scheduled = true
    queueMicrotask(() => void pump())
  }

  const enqueue = async (input, ownerId = getActiveWorkspaceOwner()) => {
    const resolvedOwner = requireOwner(ownerId)
    if (stopped) throw new Error('The intelligence job service is stopped.')
    const queuedCount = await db.intelligenceJobs.where('[ownerId+status]').equals([resolvedOwner, 'queued']).count()
    if (queuedCount >= MAX_QUEUED_JOBS) throw new Error('The intelligence queue is full. Finish or cancel existing work first.')
    const job = createIntelligenceJob({ ...input, ownerId: resolvedOwner })
    await db.intelligenceJobs.add(job)
    queuedIds.add(job.id)
    schedule()
    publish()
    return job
  }

  const cancel = async (id, ownerId = getActiveWorkspaceOwner()) => {
    const resolvedOwner = requireOwner(ownerId)
    const job = await db.intelligenceJobs.get(id)
    if (!job || job.ownerId !== resolvedOwner) return false
    queuedIds.delete(id)
    const active = running.get(id)
    if (active) active.controller.abort()
    if (job.status === 'queued') {
      await updateJob(id, { status: 'cancelled', error: null, completedAt: now() })
    }
    return ['queued', 'running'].includes(job.status)
  }

  const resume = async (ownerId = getActiveWorkspaceOwner()) => {
    const resolvedOwner = requireOwner(ownerId)
    const resumable = await db.intelligenceJobs
      .where('ownerId')
      .equals(resolvedOwner)
      .filter((job) => ['queued', 'running'].includes(job.status))
      .toArray()
    for (const job of resumable) {
      if (job.status === 'running') {
        await updateJob(job.id, { status: 'queued', progress: 0, startedAt: null, error: null })
      }
      queuedIds.add(job.id)
    }
    schedule()
    return resumable.length
  }

  const activate = async (ownerId = getActiveWorkspaceOwner()) => {
    const nextOwner = ownerId || null
    const queued = (await db.intelligenceJobs.bulkGet([...queuedIds])).filter(Boolean)
    queued.forEach((job) => {
      if (job.ownerId !== nextOwner) queuedIds.delete(job.id)
    })
    running.forEach((active, id) => {
      if (active.ownerId === nextOwner) return
      suspendedIds.add(id)
      active.controller.abort()
    })
    if (nextOwner) return resume(nextOwner)
    publish()
    return 0
  }

  const retry = async (id, ownerId = getActiveWorkspaceOwner()) => {
    const resolvedOwner = requireOwner(ownerId)
    const job = await db.intelligenceJobs.get(id)
    if (!job || job.ownerId !== resolvedOwner) throw new Error('The intelligence job was not found.')
    if (!['failed', 'cancelled'].includes(job.status)) throw new Error('Only failed or cancelled work can be retried.')
    await updateJob(id, { status: 'queued', progress: 0, error: null, startedAt: null, completedAt: null })
    queuedIds.add(id)
    schedule()
    return { ...job, status: 'queued', progress: 0, error: null }
  }

  const shutdown = () => {
    stopped = true
    queuedIds.clear()
    running.forEach(({ controller }) => controller.abort())
    publish()
  }

  return {
    enqueue,
    cancel,
    resume,
    retry,
    activate,
    shutdown,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
