import { sanitizeNoteHtml } from './sanitizeHtml'
import { getNotePaperType, paperStyles } from './paperStyles'

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

const formatDate = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getTypography = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('editorSettings') || '{}')
    return {
      fontFamily: typeof settings.defaultFontFamily === 'string' ? settings.defaultFontFamily : 'Inter, sans-serif',
      fontSize: /^\d+(?:\.\d+)?px$/.test(settings.defaultFontSize) ? settings.defaultFontSize : '16px',
      lineHeight: /^\d+(?:\.\d+)?$/.test(settings.defaultLineHeight) ? settings.defaultLineHeight : '1.5',
    }
  } catch {
    return { fontFamily: 'Inter, sans-serif', fontSize: '16px', lineHeight: '1.5' }
  }
}

export const buildPdfExportElement = (noteItems) => {
  const notes = Array.isArray(noteItems) ? noteItems : [noteItems]
  const root = document.createElement('div')
  root.className = 'qn-pdf-export'
  root.setAttribute('aria-hidden', 'true')
  const typography = getTypography()

  notes.forEach((note) => {
    const paperType = getNotePaperType(note, false)
    const paper = paperStyles[paperType] || paperStyles.plain
    const article = document.createElement('article')
    article.className = `qn-pdf-note qn-editor-page ${paper.className || ''}`
    article.dataset.paperType = paperType
    Object.assign(article.style, paper.style)

    const header = document.createElement('header')
    header.className = 'qn-pdf-note__header'
    const title = document.createElement('h1')
    title.textContent = note.title || 'Untitled note'
    header.appendChild(title)

    const created = formatDate(note.createdAt)
    const updated = formatDate(note.updatedAt)
    const dates = [created ? `Created ${created}` : '', updated ? `Updated ${updated}` : ''].filter(Boolean)
    if (dates.length > 0) {
      const metadata = document.createElement('p')
      metadata.className = 'qn-pdf-note__meta'
      metadata.textContent = dates.join(' · ')
      header.appendChild(metadata)
    }

    if (note.tags?.length) {
      const tags = document.createElement('div')
      tags.className = 'qn-pdf-note__tags'
      note.tags.forEach((tag) => {
        const item = document.createElement('span')
        item.textContent = `#${tag}`
        tags.appendChild(item)
      })
      header.appendChild(tags)
    }

    const content = document.createElement('div')
    content.className = 'ProseMirror qn-pdf-note__content'
    content.style.fontFamily = typography.fontFamily
    content.style.fontSize = typography.fontSize
    content.style.lineHeight = typography.lineHeight
    content.innerHTML = sanitizeNoteHtml(note.content) || '<p>No content</p>'

    article.append(header, content)
    root.appendChild(article)
  })

  return root
}

const waitForRenderableAssets = async (element) => {
  await document.fonts?.ready
  const images = [...element.querySelectorAll('img')]
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve()
    return new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, 10_000)
      const finish = () => {
        window.clearTimeout(timeout)
        resolve()
      }
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
    })
  }))
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

const getPageSlices = (article, canvas, pageHeight) => {
  const articleHeight = Math.max(article.scrollHeight, 1)
  const scale = canvas.height / articleHeight
  const articleTop = article.getBoundingClientRect().top
  const breakpoints = [...article.querySelectorAll([
    '.qn-pdf-note__header',
    '.qn-pdf-note__content > *',
    '.qn-pdf-note__content li',
    '.qn-pdf-note__content tr',
  ].join(','))]
    .map((element) => Math.round((element.getBoundingClientRect().bottom - articleTop) * scale))
    .filter((position) => position > 0 && position < canvas.height)
    .sort((first, second) => first - second)

  const slices = []
  let start = 0
  while (start < canvas.height) {
    const naturalEnd = Math.min(start + pageHeight, canvas.height)
    let end = naturalEnd

    if (naturalEnd < canvas.height) {
      const earliestUsefulBreak = start + pageHeight * 0.55
      const safeBottom = naturalEnd - Math.max(24 * scale, pageHeight * 0.025)
      const candidates = breakpoints.filter(
        (position) => position >= earliestUsefulBreak && position <= safeBottom
      )
      if (candidates.length > 0) end = candidates[candidates.length - 1]
    }

    slices.push({ start, height: Math.max(1, end - start) })
    start = end
  }
  return slices
}

const addCanvasToPdf = (pdf, article, canvas, addPage) => {
  const pageHeightInCanvas = Math.floor(canvas.width * A4_HEIGHT_MM / A4_WIDTH_MM)

  for (const slice of getPageSlices(article, canvas, pageHeightInCanvas)) {
    if (addPage()) pdf.addPage('a4', 'portrait')
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = slice.height
    const context = pageCanvas.getContext('2d', { alpha: false })
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    context.drawImage(
      canvas,
      0,
      slice.start,
      canvas.width,
      slice.height,
      0,
      0,
      canvas.width,
      slice.height
    )
    const renderedHeight = slice.height / canvas.width * A4_WIDTH_MM
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, A4_WIDTH_MM, renderedHeight, undefined, 'FAST')
  }
}

export const exportNotesToPdf = async (noteItems, filename) => {
  const notes = Array.isArray(noteItems) ? noteItems : [noteItems]
  if (notes.length === 0) throw new Error('There are no notes available to export.')

  const root = buildPdfExportElement(notes)
  document.body.appendChild(root)

  try {
    await waitForRenderableAssets(root)
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    pdf.setProperties({
      title: notes.length === 1 ? notes[0].title || 'Untitled note' : 'QuickNotes export',
      subject: 'QuickNotes note export',
      creator: 'QuickNotes',
    })

    let pageCount = 0
    for (const article of root.querySelectorAll('.qn-pdf-note')) {
      const canvas = await html2canvas(article, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
        imageTimeout: 15_000,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        windowHeight: A4_HEIGHT_PX,
      })
      addCanvasToPdf(pdf, article, canvas, () => pageCount++ > 0)
    }

    const blob = pdf.output('blob')
    downloadBlob(blob, filename)
    return blob
  } finally {
    root.remove()
  }
}

export const escapePdfFilename = (value) =>
  `${String(value || '').replace(/[^a-z0-9_-]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 70) || 'QuickNotes_note'}.pdf`
