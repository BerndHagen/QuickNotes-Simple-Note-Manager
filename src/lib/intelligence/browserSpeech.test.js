import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserSpeechSession } from './browserSpeech'

class FakeSpeechRecognition {
  static instance = null

  constructor() {
    this.started = false
    FakeSpeechRecognition.instance = this
  }

  start() {
    this.started = true
    this.onstart?.()
  }

  stop() {
    this.started = false
    this.onend?.()
  }

  abort() {
    this.started = false
    this.onend?.()
  }

  result(text, isFinal = true, confidence = 0.8) {
    const alternative = { transcript: text, confidence }
    const result = Object.assign([alternative], { isFinal })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }
}

describe('browser speech transcription session', () => {
  beforeEach(() => {
    window.SpeechRecognition = FakeSpeechRecognition
  })

  afterEach(() => {
    delete window.SpeechRecognition
  })

  it('emits bounded capture-time segments and can pause and stop', async () => {
    let elapsedMs = 1_000
    const onSegment = vi.fn()
    const session = createBrowserSpeechSession({ getElapsedMs: () => elapsedMs, onSegment }, { language: 'en-US' })
    elapsedMs = 2_500
    FakeSpeechRecognition.instance.result('deployment timeline')

    expect(onSegment).toHaveBeenCalledWith({ text: 'deployment timeline', startMs: 1_000, endMs: 2_500, confidence: 0.8 })
    session.pause()
    expect(FakeSpeechRecognition.instance.started).toBe(false)
    session.resume()
    expect(FakeSpeechRecognition.instance.started).toBe(true)
    await session.stop()
    expect(FakeSpeechRecognition.instance.started).toBe(false)
  })
})
