import { describe, expect, it } from 'vitest'
import {
  boundsFromPoints,
  constrainSpatialObjectToBounds,
  constrainSpatialTranslation,
  hitTestObject,
  moveSpatialObject,
  screenToWorld,
  worldToScreen,
} from './geometry'

describe('spatial geometry', () => {
  it('round-trips world and screen coordinates across pan and zoom', () => {
    const viewport = { panX: 120, panY: -30, zoom: 1.75 }
    const screen = worldToScreen(42, 18, viewport)
    expect(screenToWorld(screen.x + 10, screen.y + 20, { left: 10, top: 20 }, viewport)).toEqual({ x: 42, y: 18 })
  })

  it('derives bounds, performs stroke hit testing, and moves source points', () => {
    const object = {
      kind: 'stroke',
      bounds: boundsFromPoints([[10, 10], [30, 30]], 3),
      data: { points: [[10, 10, 0.5], [30, 30, 0.5]], width: 2 },
    }
    expect(hitTestObject(object, { x: 20, y: 20 }, 2)).toBe(true)
    expect(hitTestObject(object, { x: 20, y: 40 }, 2)).toBe(false)
    expect(moveSpatialObject(object, 5, -4).data.points).toEqual([
      [15, 6, 0.5],
      [35, 26, 0.5],
    ])
  })

  it('keeps Paper objects and grouped movement inside page-local bounds', () => {
    const object = {
      kind: 'shape',
      bounds: { x: 170, y: -12, width: 50, height: 40 },
      data: { geometry: { x: 170, y: -12, width: 50, height: 40 } },
    }
    const constrained = constrainSpatialObjectToBounds(object, 200, 120)
    expect(constrained.bounds).toEqual({ x: 150, y: 0, width: 50, height: 40 })
    expect(constrained.data.geometry).toEqual({ x: 150, y: 0, width: 50, height: 40 })

    expect(constrainSpatialTranslation([
      { bounds: { x: 20, y: 30, width: 40, height: 20 } },
      { bounds: { x: 80, y: 70, width: 30, height: 25 } },
    ], 150, -100, 200, 120)).toEqual({ dx: 90, dy: -30 })
  })
})
