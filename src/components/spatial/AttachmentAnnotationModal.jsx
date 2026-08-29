import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PencilLine } from 'lucide-react'
import { renderPdfPreviewPage } from '../../lib/intelligence/pdfText'
import { Button, Modal } from '../ui'
import SpatialAnnotationOverlay from './SpatialAnnotationOverlay'

export default function AttachmentAnnotationModal({
  open,
  onClose,
  noteId,
  resource,
  pdfDocument = null,
  initialPage = 1,
  readOnly = false,
  ownerId = null,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [availableWidth, setAvailableWidth] = useState(900)
  const [size, setSize] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setPageNumber(initialPage)
  }, [initialPage, open, resource?.id])

  useEffect(() => {
    const container = containerRef.current
    if (!open || !container) return undefined
    const update = () => setAvailableWidth(Math.max(280, Math.min(1100, container.clientWidth - 32)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (!open || !resource) return undefined
    const controller = new AbortController()
    setError(null)
    if (resource.kind === 'pdf') {
      if (!pdfDocument || !canvasRef.current) return undefined
      renderPdfPreviewPage(pdfDocument, pageNumber, canvasRef.current, availableWidth, controller.signal)
        .then((value) => { if (!controller.signal.aborted) setSize(value) })
        .catch((cause) => { if (!controller.signal.aborted) setError(cause?.message || 'This PDF page could not be rendered.') })
      return () => controller.abort()
    }

    const image = new Image()
    image.onload = () => {
      if (controller.signal.aborted) return
      const logicalWidth = Math.max(320, resource.pixelWidth || image.naturalWidth || 320)
      const logicalHeight = Math.max(320, resource.pixelHeight || image.naturalHeight || 320)
      const scale = Math.min(1, availableWidth / logicalWidth)
      setSize({
        logicalWidth,
        logicalHeight,
        displayWidth: Math.round(logicalWidth * scale),
        displayHeight: Math.round(logicalHeight * scale),
      })
    }
    image.onerror = () => { if (!controller.signal.aborted) setError('This image could not be rendered.') }
    image.src = resource.thumbnailData || resource.data
    return () => controller.abort()
  }, [availableWidth, open, pageNumber, pdfDocument, resource])

  const pageCount = resource?.kind === 'pdf' ? pdfDocument?.numPages || resource.pageCount || 1 : 1
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Annotate ${resource?.fileName || resource?.name || 'attachment'}`}
      description="A non-destructive QuickNotes spatial overlay over the original source."
      icon={PencilLine}
      size="3xl"
      bodyPadding="none"
      contentClassName="sm:h-[min(90dvh,900px)]"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-subtle bg-surface-raised px-3 py-2">
          {resource?.kind === 'pdf' && (
            <>
              <Button size="sm" icon={ChevronLeft} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} disabled={pageNumber <= 1}>Previous</Button>
              <span className="text-ui-sm tabular-nums text-content-muted">Page {pageNumber} of {pageCount}</span>
              <Button size="sm" iconRight={ChevronRight} onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))} disabled={pageNumber >= pageCount}>Next</Button>
            </>
          )}
          <span className="ml-auto text-ui-xs text-content-subtle">Original {resource?.kind === 'pdf' ? 'PDF' : 'image'} is unchanged</span>
        </header>
        <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-surface-sunken p-4">
          {error && <p role="alert" className="mx-auto max-w-xl border border-danger bg-danger-soft p-3 text-ui-sm text-danger-text">{error}</p>}
          <div
            className="relative mx-auto overflow-hidden border border-strong bg-white shadow-sm"
            style={size ? { width: size.displayWidth, height: size.displayHeight } : { width: Math.min(availableWidth, 720), height: 480 }}
          >
            {resource?.kind === 'pdf'
              ? <canvas ref={canvasRef} className="block" aria-label={`PDF page ${pageNumber} annotation source`} />
              : resource && <img src={resource.thumbnailData || resource.data} alt={resource.name || 'Annotation source'} draggable="false" className="h-full w-full object-fill" />}
            {size && !error && (
              <SpatialAnnotationOverlay
                noteId={noteId}
                resourceId={resource.id}
                pageNumber={pageNumber}
                logicalWidth={size.logicalWidth}
                logicalHeight={size.logicalHeight}
                displayWidth={size.displayWidth}
                displayHeight={size.displayHeight}
                readOnly={readOnly}
                ownerId={ownerId}
                scrollContainerRef={containerRef}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
