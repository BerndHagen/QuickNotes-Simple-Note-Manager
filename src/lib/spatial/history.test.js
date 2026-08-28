import { describe, expect, it } from 'vitest'
import {
  createSpatialHistory,
  invertSpatialChanges,
  pushSpatialHistory,
  takeSpatialRedo,
  takeSpatialUndo,
} from './history'

const apply = (objects, changes) => {
  const deleted = new Set(changes.deleteObjectIds || [])
  const updates = new Map((changes.putObjects || []).map((object) => [object.id, object]))
  const result = objects.filter((object) => !deleted.has(object.id)).map((object) => updates.get(object.id) || object)
  for (const object of updates.values()) if (!objects.some((candidate) => candidate.id === object.id)) result.push(object)
  return result.sort((first, second) => first.id.localeCompare(second.id))
}

describe('spatial transaction history', () => {
  it('undoes and redoes draw, move, and delete as atomic commands', () => {
    const stroke = { id: 'stroke', kind: 'stroke', bounds: { x: 0, y: 0, width: 10, height: 10 } }
    const moved = { ...stroke, bounds: { ...stroke.bounds, x: 25 } }
    let objects = []
    let history = createSpatialHistory()

    for (const [label, changes] of [
      ['Draw stroke', { putObjects: [stroke] }],
      ['Move selection', { putObjects: [moved] }],
      ['Delete selection', { deleteObjectIds: ['stroke'] }],
    ]) {
      const inverse = invertSpatialChanges(changes, objects, [])
      objects = apply(objects, changes)
      history = pushSpatialHistory(history, { label, forward: changes, inverse })
    }

    expect(objects).toEqual([])
    expect(history.undo.map((entry) => entry.label)).toEqual(['Draw stroke', 'Move selection', 'Delete selection'])

    for (let count = 0; count < 3; count += 1) {
      const result = takeSpatialUndo(history)
      history = result.history
      objects = apply(objects, result.entry.inverse)
    }
    expect(objects).toEqual([])

    for (let count = 0; count < 3; count += 1) {
      const result = takeSpatialRedo(history)
      history = result.history
      objects = apply(objects, result.entry.forward)
    }
    expect(objects).toEqual([])
    expect(history.redo).toEqual([])
  })

  it('clears redo after a new command and keeps one stroke in one entry', () => {
    const entry = { label: 'Draw stroke', forward: { putObjects: [{ id: 'one-stroke' }] }, inverse: { deleteObjectIds: ['one-stroke'] } }
    let history = pushSpatialHistory(createSpatialHistory(), entry)
    history = takeSpatialUndo(history).history
    history = pushSpatialHistory(history, { ...entry, label: 'Replacement stroke' })
    expect(history.undo).toHaveLength(1)
    expect(history.redo).toHaveLength(0)
  })
})
