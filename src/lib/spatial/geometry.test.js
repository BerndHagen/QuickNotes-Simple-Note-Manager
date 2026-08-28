import { describe, expect, it } from 'vitest'
import {
  boundsFromPoints,
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
})

