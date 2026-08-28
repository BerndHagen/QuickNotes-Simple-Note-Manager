import { backend, getBackendResumableUploadEndpoint } from '../backend'

export const CAPTURE_RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024
export const CAPTURE_RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024

const accessToken = async () => {
  const { data, error } = await backend.auth.getSession()
  if (error) throw error
  const token = data?.session?.access_token
  if (!token) throw new Error('The cloud session expired before the resource could be uploaded.')
  return token
}

export const uploadCaptureResourceResumably = async ({
  blob,
  bucket,
  path,
  mimeType,
  fingerprint,
}) => {
  if (!(blob instanceof Blob) || blob.size <= CAPTURE_RESUMABLE_THRESHOLD_BYTES) {
    throw new Error('A resumable upload requires a capture payload larger than 6 MB.')
  }
  const endpoint = getBackendResumableUploadEndpoint()
  if (!endpoint) throw new Error('The cloud Storage endpoint is unavailable.')
  const [token, { Upload }] = await Promise.all([
    accessToken(),
    import('tus-js-client'),
  ])

  return new Promise((resolve, reject) => {
    const upload = new Upload(blob, {
      endpoint,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      headers: {
        authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: mimeType,
        cacheControl: '3600',
      },
      chunkSize: CAPTURE_RESUMABLE_CHUNK_BYTES,
      fingerprint: () => Promise.resolve(fingerprint),
      onError: reject,
      onSuccess: () => resolve({ path }),
    })

    upload.findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(reject)
  })
}
