import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createIntelligenceJobService, INTELLIGENCE_JOB_PRIORITIES } from './jobs'

const waitForJob = async (id, statuses) => {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    const job = await db.intelligenceJobs.get(id)
    if (statuses.includes(job?.status)) return job
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`Job ${id} did not reach ${statuses.join(', ')}`)
}

describe('intelligence background jobs', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('owner-a')
  })

  it('persists real progress and completes through a bounded handler', async () => {
    const handler = vi.fn(async (_job, { reportProgress }) => {
      await reportProgress(0.4)
      return { recognitionIds: ['recognition-a'] }
    })
    const service = createIntelligenceJobService({ handlers: { ocr: handler }, concurrency: 1 })
    const job = await service.enqueue({
      type: 'ocr',
      noteId: 'note-a',
      resourceId: 'resource-a',
      priority: INTELLIGENCE_JOB_PRIORITIES.interactive,
    })
    const completed = await waitForJob(job.id, ['completed'])

    expect(handler).toHaveBeenCalledOnce()
    expect(completed).toMatchObject({
      status: 'completed',
      progress: 1,
      resultRef: { recognitionIds: ['recognition-a'] },
    })
    service.shutdown()
  })

  it('cancels active work through AbortSignal without recording a failure', async () => {
    const service = createIntelligenceJobService({
      handlers: {
        transcription: (_job, { signal }) => new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
        }),
      },
      concurrency: 1,
    })
    const job = await service.enqueue({ type: 'transcription', noteId: 'note-a', resourceId: 'audio-a' })
    await waitForJob(job.id, ['running'])
    await service.cancel(job.id)
    const cancelled = await waitForJob(job.id, ['cancelled'])

    expect(cancelled.error).toBeNull()
    service.shutdown()
  })

  it('suspends a running owner on account switch and resumes from persisted canonical source metadata', async () => {
    const handled = []
    const service = createIntelligenceJobService({
      handlers: {
        transcription: (job, { signal }) => new Promise((resolve, reject) => {
          handled.push(job.ownerId)
          if (job.ownerId === 'owner-a') {
            signal.addEventListener('abort', () => reject(new DOMException('Workspace changed', 'AbortError')), { once: true })
          } else resolve({ recognitionIds: ['owner-b-result'] })
        }),
      },
      concurrency: 1,
    })
    const job = await service.enqueue({
      type: 'transcription',
      noteId: 'note-a',
      resourceId: 'audio-a',
      source: { sourceFingerprint: 'sha256:source' },
    })
    await waitForJob(job.id, ['running'])

    setActiveWorkspaceOwner('owner-b')
    await service.activate('owner-b')
    const suspended = await waitForJob(job.id, ['queued'])
    expect(suspended.source.sourceFingerprint).toBe('sha256:source')

    setActiveWorkspaceOwner('owner-a')
    await service.activate('owner-a')
    expect((await waitForJob(job.id, ['running'])).ownerId).toBe('owner-a')
    expect(handled).toEqual(['owner-a', 'owner-a'])
    service.shutdown()
  })
})
