import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AudioRecorder from './AudioRecorder'
import {
  appendRecordingChunk,
  beginRecordingSession,
} from '../../lib/resources/repository'

vi.mock('../../lib/resources/repository', () => ({
  appendRecordingChunk: vi.fn(),
  beginRecordingSession: vi.fn(),
  finalizeRecordingSession: vi.fn(),
}))

vi.mock('../../lib/intelligence/service', () => ({
  saveBrowserManagedTranscript: vi.fn(),
  startBrowserManagedLiveTranscription: vi.fn(),
}))

vi.mock('../../lib/intelligence/browserSpeech', () => ({
  isBrowserSpeechRecognitionSupported: () => false,
}))

class FakeMediaRecorder {
  static instances = []
  static isTypeSupported = () => true

  constructor(stream, options = {}) {
    this.stream = stream
    this.mimeType = options.mimeType || 'audio/webm'
    this.state = 'inactive'
    this.listeners = new Map()
    FakeMediaRecorder.instances.push(this)
  }

  start() { this.state = 'recording' }
  requestData() {}
  stop() {
    this.state = 'inactive'
    this.listeners.get('stop')?.()
  }
  pause() { this.state = 'paused' }
  resume() { this.state = 'recording' }
  addEventListener(type, listener) { this.listeners.set(type, listener) }
}

describe('durable audio recorder resource lifecycle', () => {
  let track
  let stream
  let originalMediaDevices
  let originalMediaRecorder

  beforeEach(() => {
    track = { stop: vi.fn() }
    stream = { getTracks: () => [track] }
    originalMediaDevices = navigator.mediaDevices
    originalMediaRecorder = globalThis.MediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    })
    globalThis.MediaRecorder = FakeMediaRecorder
    FakeMediaRecorder.instances = []
    beginRecordingSession.mockResolvedValue({ id: 'session-a' })
    appendRecordingChunk.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices })
    globalThis.MediaRecorder = originalMediaRecorder
    vi.restoreAllMocks()
  })

  it('releases microphone tracks if durable session creation fails', async () => {
    beginRecordingSession.mockRejectedValueOnce(new DOMException('Storage full', 'QuotaExceededError'))
    render(<AudioRecorder noteId="note-a" />)

    fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage full')
    expect(track.stop).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Record audio' })).toBeEnabled()
  })

  it('stops the recorder and every microphone track when the surface unmounts', async () => {
    const view = render(<AudioRecorder noteId="note-a" />)
    fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))
    await screen.findByText('Recording')
    const recorder = FakeMediaRecorder.instances[0]
    const requestData = vi.spyOn(recorder, 'requestData')
    const stop = vi.spyOn(recorder, 'stop')

    view.unmount()

    await waitFor(() => expect(track.stop).toHaveBeenCalledOnce())
    expect(requestData).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('surfaces a failed background chunk without creating an unhandled rejection', async () => {
    appendRecordingChunk.mockRejectedValueOnce(new DOMException('Storage quota reached', 'QuotaExceededError'))
    render(<AudioRecorder noteId="note-a" />)
    fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))
    await screen.findByText('Recording')

    FakeMediaRecorder.instances[0].ondataavailable({
      data: new Blob(['audio'], { type: 'audio/webm' }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('earlier saved chunks remain recoverable')
  })
})
