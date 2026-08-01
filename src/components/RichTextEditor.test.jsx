import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tiptap = vi.hoisted(() => ({ config: null, editor: null }))

vi.mock('@tiptap/react', () => ({
  useEditor: (config) => {
    tiptap.config = config
    return tiptap.editor
  },
  EditorContent: () => <div data-testid="editor-content" />,
  BubbleMenu: ({ children }) => <>{children}</>,
  FloatingMenu: ({ children }) => <>{children}</>,
}))

import RichTextEditor from './RichTextEditor'

const createEditor = () => {
  let html = '<p>Initial</p>'
  const dom = document.createElement('div')
  const commands = {
    setContent: vi.fn((content) => {
      html = content
    }),
    setTextSelection: vi.fn(),
  }

  return {
    editor: {
      isDestroyed: false,
      commands,
      setEditable: vi.fn(),
      getHTML: vi.fn(() => html),
      state: {
        selection: { from: 1, to: 1 },
        doc: { content: { size: 100 } },
      },
      view: { dom },
    },
    setHtml: (value) => {
      html = value
    },
  }
}

describe('RichTextEditor external updates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const fake = createEditor()
    tiptap.editor = fake.editor
    tiptap.setHtml = fake.setHtml
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replays an inbound change after the local typing idle boundary', async () => {
    const props = {
      noteId: 'note-1',
      content: '<p>Initial</p>',
      onChange: vi.fn(),
      onDraftChange: vi.fn(),
      isExternalUpdate: true,
      readOnly: true,
    }
    const { rerender } = render(<RichTextEditor {...props} />)
    tiptap.editor.commands.setContent.mockClear()

    act(() => {
      tiptap.setHtml('<p>Local typing</p>')
      tiptap.config.onUpdate({ editor: tiptap.editor })
    })

    rerender(<RichTextEditor {...props} content="<p>Remote update</p>" />)
    expect(tiptap.editor.commands.setContent).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(2000))

    expect(tiptap.editor.commands.setContent).toHaveBeenCalledWith('<p>Remote update</p>', false)
  })
})
