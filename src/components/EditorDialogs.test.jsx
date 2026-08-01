import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_EMBEDDED_IMAGE_BYTES } from '../lib/imageEmbedding'
import { useUIStore } from '../store'
import HTMLEditorModal, { MAX_HTML_IMPORT_BYTES, readHtmlFile } from './HTMLEditorModal'
import ImageUploadModal from './ImageUploadModal'
import LinkInsertModal from './LinkInsertModal'

const originalUIState = useUIStore.getState()
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function createEditor({ selectedText = '', href = '', selectionEmpty = true, html = '<p>Note</p>' } = {}) {
  const chain = {}
  for (const command of [
    'focus',
    'setImage',
    'setLink',
    'insertContent',
    'extendMarkRange',
    'unsetLink',
  ]) {
    chain[command] = vi.fn(() => chain)
  }
  chain.run = vi.fn(() => true)

  return {
    chain: vi.fn(() => chain),
    commands: { setContent: vi.fn() },
    getHTML: vi.fn(() => html),
    getAttributes: vi.fn(() => ({ href })),
    state: {
      selection: { from: 1, to: selectionEmpty ? 1 : selectedText.length + 1, empty: selectionEmpty },
      doc: { textBetween: vi.fn(() => selectedText) },
    },
    testChain: chain,
  }
}

beforeEach(() => {
  useUIStore.setState({
    imageUploadOpen: false,
    linkModalOpen: false,
    htmlEditorOpen: false,
  })
})

afterEach(() => {
  cleanup()
  useUIStore.setState(originalUIState, true)
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor)
  } else {
    delete navigator.clipboard
  }
  vi.restoreAllMocks()
})

describe('ImageUploadModal', () => {
  it('rejects the former oversized allowance before reading or inserting it', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useUIStore.setState({ imageUploadOpen: true })
    render(<ImageUploadModal editor={editor} />)

    await user.click(screen.getByRole('radio', { name: 'Upload file' }))
    const file = new File(
      [new Uint8Array(MAX_EMBEDDED_IMAGE_BYTES + 1)],
      'oversized.png',
      { type: 'image/png' }
    )
    await user.upload(screen.getByLabelText('Choose image file'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('512 KB or smaller')
    expect(editor.testChain.setImage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeDisabled()
  })

  it('embeds a supported file and supplies useful alternative text', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useUIStore.setState({ imageUploadOpen: true })
    render(<ImageUploadModal editor={editor} />)

    await user.click(screen.getByRole('radio', { name: 'Upload file' }))
    const png = new File(
      [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
      'architecture.png',
      { type: 'image/png' }
    )
    await user.upload(screen.getByLabelText('Choose image file'), png)

    expect(await screen.findByText('Preview')).toBeInTheDocument()
    expect(screen.getByLabelText('Alternative text')).toHaveValue('architecture')
    await user.click(screen.getByRole('button', { name: 'Insert image' }))

    expect(editor.testChain.setImage).toHaveBeenCalledWith(
      expect.objectContaining({
        src: expect.stringMatching(/^data:image\/png;base64,/),
        alt: 'architecture',
      })
    )
    expect(useUIStore.getState().imageUploadOpen).toBe(false)
  })

  it('rejects executable URL schemes instead of rewriting them into a link', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useUIStore.setState({ imageUploadOpen: true })
    render(<ImageUploadModal editor={editor} />)

    const imageUrl = screen.getByLabelText('Image URL')
    fireEvent.change(imageUrl, { target: { value: 'javascript:alert(1)' } })
    expect(imageUrl).toHaveValue('javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Insert image' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only HTTP and HTTPS')
    expect(editor.testChain.setImage).not.toHaveBeenCalled()
  })

  it('keeps a known-broken hosted image out of the note', () => {
    const editor = createEditor()
    useUIStore.setState({ imageUploadOpen: true })
    render(<ImageUploadModal editor={editor} />)

    const imageUrl = screen.getByLabelText('Image URL')
    fireEvent.change(imageUrl, { target: { value: 'images.example.com/missing.png' } })
    fireEvent.blur(imageUrl)
    fireEvent.error(screen.getByRole('img', { name: 'Image preview' }))

    expect(screen.getByRole('alert')).toHaveTextContent('could not load an image')
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeDisabled()
    expect(editor.testChain.setImage).not.toHaveBeenCalled()
  })
})

describe('LinkInsertModal', () => {
  it('validates the scheme and inserts user text as a document node, not interpolated HTML', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useUIStore.setState({ linkModalOpen: true })
    render(<LinkInsertModal editor={editor} />)

    const address = screen.getByLabelText(/Web address/i)
    fireEvent.change(address, { target: { value: 'javascript:alert(1)' } })
    await user.click(screen.getByRole('button', { name: 'Insert link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only HTTP and HTTPS')
    expect(editor.testChain.insertContent).not.toHaveBeenCalled()

    await user.clear(address)
    await user.type(address, 'example.com')
    fireEvent.change(screen.getByLabelText('Text to display'), {
      target: { value: '"><img src=x onerror=alert(1)>' },
    })
    await user.click(screen.getByRole('button', { name: 'Insert link' }))

    expect(editor.testChain.insertContent).toHaveBeenCalledWith({
      type: 'text',
      text: '"><img src=x onerror=alert(1)>',
      marks: [{ type: 'link', attrs: { href: 'https://example.com/' } }],
    })
  })

  it('updates the mark on selected text without replacing unchanged content', async () => {
    const user = userEvent.setup()
    const editor = createEditor({ selectedText: 'Project site', selectionEmpty: false })
    useUIStore.setState({ linkModalOpen: true })
    render(<LinkInsertModal editor={editor} />)

    await user.type(screen.getByLabelText(/Web address/i), 'example.com/project')
    await user.click(screen.getByRole('button', { name: 'Insert link' }))

    expect(editor.testChain.setLink).toHaveBeenCalledWith({ href: 'https://example.com/project' })
    expect(editor.testChain.insertContent).not.toHaveBeenCalled()
  })
})

describe('HTMLEditorModal', () => {
  it('preserves significant code whitespace and sanitizes content when applying changes', async () => {
    const user = userEvent.setup()
    const editor = createEditor({ html: '<pre>line  one\nline two</pre>' })
    useUIStore.setState({ htmlEditorOpen: true })
    render(<HTMLEditorModal editor={editor} />)

    const source = screen.getByRole('textbox', { name: 'HTML source' })
    expect(source).toHaveValue('<pre>line  one\nline two</pre>')
    fireEvent.change(source, {
      target: {
        value: '<pre>line  one\nline two</pre><img src="x" onerror="alert(1)"><script>x()</script>',
      },
    })
    await user.click(screen.getByRole('button', { name: 'Apply changes' }))

    const applied = editor.commands.setContent.mock.calls[0][0]
    expect(applied).toContain('line  one\nline two')
    expect(applied).not.toMatch(/onerror|script/i)
  })

  it('reports blocked clipboard access and leaves the selectable source focused', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const editor = createEditor()
    useUIStore.setState({ htmlEditorOpen: true })
    render(<HTMLEditorModal editor={editor} />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Clipboard access was blocked')
    expect(screen.getByRole('textbox', { name: 'HTML source' })).toHaveFocus()
  })

  it('sanitizes imported HTML and rejects unsupported or oversized files', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    useUIStore.setState({ htmlEditorOpen: true })
    render(<HTMLEditorModal editor={editor} />)

    const hostile = new File(
      ['<p>Keep</p><img src="x" onerror="alert(1)"><script>alert(2)</script>'],
      'note.html',
      { type: 'text/html' }
    )
    await user.upload(screen.getByLabelText('Import HTML file'), hostile)

    await waitFor(() => expect(screen.getByLabelText('HTML source')).toHaveValue('<p>Keep</p><img src="x">'))
    await expect(
      readHtmlFile(new File(['plain'], 'note.txt', { type: 'text/plain' }))
    ).rejects.toThrow(/\.html or \.htm/i)
    await expect(
      readHtmlFile({
        name: 'large.html',
        type: 'text/html',
        size: MAX_HTML_IMPORT_BYTES + 1,
      })
    ).rejects.toThrow(/2 MB or smaller/i)
  })
})
