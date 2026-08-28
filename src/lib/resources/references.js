import { db } from '../db'

export const getCanonicalResourceReferenceCounts = async (resourceId) => {
  if (!resourceId) return { noteLinks: 0, spatialObjects: 0, recognizedContent: 0, annotations: 0 }
  const [noteLinks, spatialObjects, recognizedContent, annotations] = await Promise.all([
    db.noteResources.where('resourceId').equals(resourceId).count(),
    db.spatialObjects.filter((object) => object.data?.resourceId === resourceId).count(),
    db.recognizedContent.where('sourceResourceId').equals(resourceId).count(),
    db.spatialAnnotations.where('resourceId').equals(resourceId).count(),
  ])
  return { noteLinks, spatialObjects, recognizedContent, annotations }
}

export const isCanonicalResourceReferenced = async (resourceId) => {
  const counts = await getCanonicalResourceReferenceCounts(resourceId)
  return Object.values(counts).some((count) => count > 0)
}
