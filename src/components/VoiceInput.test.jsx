import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VoiceInput from './VoiceInput'

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

class FakeSpeechRecognition {
  static instances = []

  constructor() {
    this.started = false
    this.startCalls = 0
    this.stopCalls = 0
    this.abortCalls = 0
    FakeSpeechRecognition.instances.push(this)
  }

  start() {
    this.startCalls += 1
    if (this.started) {
      const error = new Error('Already started')
      error.name = 'InvalidStateError'
      throw error
    }
    this.started = true
    this.onstart?.()
  }

  stop() {
    this.stopCalls += 1
    this.started = false
    this.onend?.()
  }

  abort() {
    this.abortCalls += 1
    this.started = false
    this.onend?.()
  }

  finishUnexpectedly() {
    this.started = false
    this.onend?.()
  }

  emitFinal(transcript) {
    const result = Object.assign([{ transcript }], { isFinal: true })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }
}

describe('VoiceInput', () => {
  beforeEach(() => {
    FakeSpeechRecognition.instances = []
    window.SpeechRecognition = FakeSpeechRecognition
    delete window.webkitSpeechRecognition
  })

  afterEach(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  it('delivers results to the latest callback after a rerender', () => {
    const firstCallback = vi.fn()
    const latestCallback = vi.fn()
    const { rerender } = render(
      <VoiceInput isActive onTranscript={firstCallback} onToggle={() => {}} />
    )
    const recognition = FakeSpeechRecognition.instances[0]

    rerender(<VoiceInput isActive onTranscript={latestCallback} onToggle={() => {}} />)
    act(() => recognition.emitFinal('Updated callback'))

    expect(latestCallback).toHaveBeenCalledWith('Updated callback')
    expect(firstCallback).not.toHaveBeenCalled()
  })

  it('recovers from an unexpected end but stays stopped after a manual pause', () => {
    render(<VoiceInput isActive onTranscript={() => {}} onToggle={() => {}} />)
    const recognition = FakeSpeechRecognition.instances[0]
    const startsBeforeEnd = recognition.startCalls

    act(() => recognition.finishUnexpectedly())
    expect(recognition.startCalls).toBe(startsBeforeEnd + 1)

    const startsBeforePause = recognition.startCalls
    fireEvent.click(screen.getByRole('button', { name: 'Pause voice input' }))
    expect(recognition.stopCalls).toBe(1)
    expect(recognition.startCalls).toBe(startsBeforePause)
    expect(screen.getByRole('button', { name: 'Resume voice input' })).toBeInTheDocument()
  })

  it('closes with Escape and does not restart during cleanup', () => {
    const onToggle = vi.fn()
    const { unmount } = render(
      <VoiceInput isActive onTranscript={() => {}} onToggle={onToggle} />
    )
    const recognition = FakeSpeechRecognition.instances[0]

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onToggle).toHaveBeenCalledWith(false)

    const startsBeforeUnmount = recognition.startCalls
    unmount()
    expect(recognition.abortCalls).toBe(1)
    expect(recognition.startCalls).toBe(startsBeforeUnmount)
  })

  it('provides an accessible dismissal when speech recognition is unavailable', () => {
    delete window.SpeechRecognition

    const onToggle = vi.fn()
    render(<VoiceInput isActive onTranscript={() => {}} onToggle={onToggle} />)

    expect(screen.getByRole('alert', { name: 'Voice input unavailable' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close voice input' }))
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
