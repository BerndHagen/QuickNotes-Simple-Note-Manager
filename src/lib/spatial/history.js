const HISTORY_LIMIT = 120

export function createSpatialHistory() {
  return { undo: [], redo: [] }
}

export function pushSpatialHistory(history, entry) {
  return {
    undo: [...history.undo, entry].slice(-HISTORY_LIMIT),
    redo: [],
  }
}

export function takeSpatialUndo(history) {
  const entry = history.undo.at(-1)
  if (!entry) return { history, entry: null }
  return {
    entry,
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, entry].slice(-HISTORY_LIMIT),
    },
  }
}

export function takeSpatialRedo(history) {
  const entry = history.redo.at(-1)
  if (!entry) return { history, entry: null }
  return {
    entry,
    history: {
      undo: [...history.undo, entry].slice(-HISTORY_LIMIT),
      redo: history.redo.slice(0, -1),
    },
  }
}

export function invertSpatialChanges(changes, currentObjects, currentPages, currentResources = []) {
  const objectsById = new Map(currentObjects.map((object) => [object.id, object]))
  const pagesById = new Map(currentPages.map((page) => [page.id, page]))
  const resourcesById = new Map(currentResources.map((resource) => [resource.id, resource]))
  const putObjectIds = new Set((changes.putObjects || []).map((object) => object.id))
  const putPageIds = new Set((changes.putPages || []).map((page) => page.id))
  const putResourceIds = new Set((changes.putResources || []).map((resource) => resource.id))

  return {
    putObjects: [
      ...(changes.putObjects || []).flatMap((object) => objectsById.has(object.id) ? [structuredClone(objectsById.get(object.id))] : []),
      ...(changes.deleteObjectIds || []).flatMap((id) => objectsById.has(id) ? [structuredClone(objectsById.get(id))] : []),
    ],
    deleteObjectIds: [...putObjectIds].filter((id) => !objectsById.has(id)),
    putPages: [
      ...(changes.putPages || []).flatMap((page) => pagesById.has(page.id) ? [structuredClone(pagesById.get(page.id))] : []),
      ...(changes.deletePageIds || []).flatMap((id) => pagesById.has(id) ? [structuredClone(pagesById.get(id))] : []),
    ],
    deletePageIds: [...putPageIds].filter((id) => !pagesById.has(id)),
    putResources: [
      ...(changes.putResources || []).flatMap((resource) => resourcesById.has(resource.id) ? [structuredClone(resourcesById.get(resource.id))] : []),
      ...(changes.deleteResourceIds || []).flatMap((id) => resourcesById.has(id) ? [structuredClone(resourcesById.get(id))] : []),
    ],
    deleteResourceIds: [...putResourceIds].filter((id) => !resourcesById.has(id)),
    documentPatch: changes.inverseDocumentPatch || null,
  }
}
