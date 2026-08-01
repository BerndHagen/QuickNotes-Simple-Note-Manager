import { useCallback, useEffect, useRef, useState } from 'react'
import { FileImage, Image as ImageIcon, Link, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUIStore } from '../store'
import {
  MAX_EMBEDDED_IMAGE_BYTES,
  SUPPORTED_EMBEDDED_IMAGE_TYPES,
  formatFileSize,
  validateEmbeddedImage,
} from '../lib/imageEmbedding'
import { normalizeWebUrl } from '../lib/webUrls'
import { Button, Field, Input, Modal, SegmentedControl } from './ui'

const FILE_ACCEPT = SUPPORTED_EMBEDDED_IMAGE_TYPES.join(',')

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('The image could not be read.'))
    reader.onabort = () => reject(new Error('Reading the image was cancelled.'))
    reader.readAsDataURL(file)
  })

export default function ImageUploadModal({ editor }) {
  const { imageUploadOpen, setImageUploadOpen } = useUIStore()
  const [activeTab, setActiveTab] = useState('url')
  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [failedPreviewUrl, setFailedPreviewUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef(null)
  const readRequestRef = useRef(0)

  const reset = useCallback(() => {
    readRequestRef.current += 1
    setActiveTab('url')
    setImageUrl('')
    setAltText('')
    setPreviewUrl('')
    setFailedPreviewUrl('')
    setUrlError('')
    setFileError('')
    setIsLoading(false)
    setDragActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = useCallback(() => {
    setImageUploadOpen(false)
    reset()
  }, [reset, setImageUploadOpen])

  useEffect(() => {
    if (!imageUploadOpen) reset()
  }, [imageUploadOpen, reset])

  const processFile = useCallback(async (file) => {
    const validation = validateEmbeddedImage(file)
    if (!validation.ok) {
      setFileError(validation.error)
      setImageUrl('')
      setPreviewUrl('')
      setFailedPreviewUrl('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const requestId = readRequestRef.current + 1
    readRequestRef.current = requestId
    setFileError('')
    setFailedPreviewUrl('')
    setIsLoading(true)

    try {
      const dataUrl = await readAsDataUrl(file)
      if (readRequestRef.current !== requestId) return
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith(`data:${file.type};base64,`)) {
        throw new Error('The selected file is not a valid embedded image.')
      }
      setImageUrl(dataUrl)
      setPreviewUrl(dataUrl)
      setFailedPreviewUrl('')
      setAltText(file.name.replace(/\.[^/.]+$/, '').slice(0, 500))
    } catch (error) {
      if (readRequestRef.current === requestId) {
        setFileError(error.message || 'The image could not be read.')
        setImageUrl('')
        setPreviewUrl('')
        setFailedPreviewUrl('')
      }
    } finally {
      if (readRequestRef.current === requestId) setIsLoading(false)
    }
  }, [])

  const handleDrag = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (isLoading) return
    setDragActive(event.type === 'dragenter' || event.type === 'dragover')
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    if (!isLoading && event.dataTransfer.files?.[0]) void processFile(event.dataTransfer.files[0])
  }

  const handleUrlChange = (event) => {
    setImageUrl(event.target.value)
    setPreviewUrl('')
    setFailedPreviewUrl('')
    setUrlError('')
  }

  const validateRemoteImage = () => {
    const normalized = normalizeWebUrl(imageUrl)
    setUrlError(normalized.error)
    if (!normalized.value) {
      setPreviewUrl('')
      return ''
    }
    if (normalized.value === failedPreviewUrl) {
      setUrlError('QuickNotes could not load an image from this address.')
      return ''
    }
    setImageUrl(normalized.value)
    setPreviewUrl(normalized.value)
    return normalized.value
  }

  const handleInsert = () => {
    const source = activeTab === 'url' ? validateRemoteImage() : imageUrl
    if (!source) {
      if (activeTab === 'upload' && !fileError) setFileError('Choose an image to embed.')
      return
    }
    if (!editor) {
      toast.error('The editor is not available. Reopen the note and try again.')
      return
    }

    editor
      .chain()
      .focus()
      .setImage({
        src: source,
        alt: altText.trim(),
        title: altText.trim(),
      })
      .run()
    toast.success('Image inserted')
    handleClose()
  }

  const canInsert =
    activeTab === 'url'
      ? imageUrl.trim().length > 0 && imageUrl !== failedPreviewUrl
      : imageUrl.length > 0

  return (
    <Modal
      open={imageUploadOpen}
      onClose={handleClose}
      title="Insert image"
      description="Add a hosted image or embed a small file in this note."
      icon={ImageIcon}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleInsert} disabled={!canInsert || isLoading}>
            Insert image
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <SegmentedControl
          label="Image source"
          value={activeTab}
          onChange={(value) => {
            if (value === activeTab) return
            setActiveTab(value)
            setImageUrl('')
            setAltText('')
            setUrlError('')
            setFileError('')
            setPreviewUrl('')
            setFailedPreviewUrl('')
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          options={[
            { value: 'url', label: 'Image URL' },
            { value: 'upload', label: 'Upload file' },
          ]}
        />

        {activeTab === 'url' ? (
          <div className="space-y-3">
            <Field
              label="Image URL"
              error={urlError}
              hint="HTTPS is added automatically when no protocol is entered."
            >
              {(fieldProps) => (
                <div className="relative">
                  <Link
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                    aria-hidden="true"
                  />
                  <Input
                    {...fieldProps}
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={imageUrl}
                    onChange={handleUrlChange}
                    onBlur={validateRemoteImage}
                    placeholder="https://example.com/image.jpg"
                    className="pl-9"
                  />
                </div>
              )}
            </Field>
            <p className="rounded-control border border-subtle bg-surface-sunken px-3 py-2 text-ui-sm text-content-muted">
              Hosted images are not saved with the note and may change or disappear. Loading them
              contacts the image host, which can see connection details such as your IP address.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              aria-label="Choose image file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void processFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              disabled={isLoading}
              className={`flex w-full flex-col items-center rounded-control border-2 border-dashed px-4 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qn-focus-ring)] disabled:cursor-wait disabled:opacity-60 ${
                dragActive
                  ? 'border-accent bg-accent-soft'
                  : 'border-strong bg-surface-sunken hover:border-accent hover:bg-surface-hover'
              }`}
            >
              {isLoading ? (
                <>
                  <Upload className="mb-3 h-9 w-9 animate-pulse text-accent-text" aria-hidden="true" />
                  <span className="text-ui-md font-medium text-content">Reading image...</span>
                </>
              ) : (
                <>
                  <FileImage className="mb-3 h-9 w-9 text-content-subtle" aria-hidden="true" />
                  <span className="text-ui-md font-medium text-content">Choose an image</span>
                  <span className="mt-1 text-ui-sm text-content-muted">or drag one here</span>
                  <span className="mt-3 text-ui-xs text-content-subtle">
                    JPG, PNG, GIF, or WebP &middot; up to {formatFileSize(MAX_EMBEDDED_IMAGE_BYTES)}
                  </span>
                </>
              )}
            </button>
            {fileError && (
              <p role="alert" className="text-ui-sm text-danger-text">
                {fileError}
              </p>
            )}
            <p className="text-ui-sm text-content-subtle">
              Embedded images work offline but count toward this browser&apos;s QuickNotes storage.
            </p>
          </div>
        )}

        <Field
          label="Alternative text"
          hint="Describe the image for screen readers. Leave blank only when it is decorative."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              value={altText}
              maxLength={500}
              onChange={(event) => setAltText(event.target.value)}
              placeholder="What the image shows"
            />
          )}
        </Field>

        {previewUrl && (
          <figure className="rounded-control border border-subtle bg-surface-sunken p-3">
            <figcaption className="mb-2 text-ui-sm font-medium text-content-muted">Preview</figcaption>
            <img
              src={previewUrl}
              alt={altText.trim() || 'Image preview'}
              referrerPolicy="no-referrer"
              className="mx-auto max-h-48 max-w-full rounded-control object-contain"
              onError={() => {
                setPreviewUrl('')
                if (activeTab === 'upload') {
                  setImageUrl('')
                  setFileError('The selected file could not be decoded as an image.')
                } else {
                  setFailedPreviewUrl(previewUrl)
                  setUrlError('QuickNotes could not load an image from this address.')
                }
              }}
            />
          </figure>
        )}
      </div>
    </Modal>
  )
}
