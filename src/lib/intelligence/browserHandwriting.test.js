import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recognizeWithBrowserHandwriting } from './browserHandwriting'

class FakeStroke {
  constructor() {
    this.points = []
  }

  addPoint(point) {
    this.points.push({ ...point })
  }
}

const ink = (id, points, createdAt = '2026-08-27T10:00:00.000Z') => ({
  id,
  kind: 'stroke',
  createdAt,
  zIndex: 1,
  data: { points },
})

describe('browser handwriting provider', () => {
  let finishDrawing
  let finishRecognizer
  let drawing

  beforeEach(() => {
    finishDrawing = vi.fn()
    finishRecognizer = vi.fn()
    drawing = {
      strokes: [],
      addStroke(stroke) { this.strokes.push(stroke) },
      getPrediction: vi.fn(async () => [{ text: 'Quick notes' }, { text: 'Quick note' }]),
      finish: finishDrawing,
    }
    globalThis.HandwritingStroke = FakeStroke
    navigator.queryHandwritingRecognizer = vi.fn(async () => ({ textAlternatives: true }))
    navigator.createHandwritingRecognizer = vi.fn(async () => ({
      startDrawing: vi.fn(() => drawing),
      finish: finishRecognizer,
    }))
  })

  afterEach(() => {
    delete globalThis.HandwritingStroke
    delete navigator.queryHandwritingRecognizer
    delete navigator.createHandwritingRecognizer
  })

  it('converts canonical stroke points and returns ranked alternatives', async () => {
    const result = await recognizeWithBrowserHandwriting([
      ink('stroke-a', [[10, 20, 0.5, 0, 0, 100], [12, 24, 0.5, 0, 0, 130]]),
      ink('stroke-b', [[20, 30, 0.5, 0, 0, 20], [21, 33, 0.5, 0, 0, 50]], '2026-08-27T10:00:01.000Z'),
    ], { language: 'en-US' })

    expect(result).toEqual({ text: 'Quick notes', alternatives: ['Quick notes', 'Quick note'], language: 'en-US' })
    expect(drawing.strokes).toHaveLength(2)
    expect(drawing.strokes[0].points).toEqual([
      { x: 10, y: 20, t: 0 },
      { x: 12, y: 24, t: 30 },
    ])
    expect(drawing.strokes[1].points[0].t).toBeGreaterThan(drawing.strokes[0].points.at(-1).t)
    expect(finishDrawing).toHaveBeenCalledOnce()
    expect(finishRecognizer).toHaveBeenCalledOnce()
  })

  it('does not query the platform after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(recognizeWithBrowserHandwriting([
      ink('stroke-a', [[0, 0, 0.5, 0, 0, 0], [1, 1, 0.5, 0, 0, 10]]),
    ], { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(navigator.queryHandwritingRecognizer).not.toHaveBeenCalled()
  })
})
