import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FindReplaceBar from './FindReplaceBar'

const createEditor = (text = 'p') => {
  const transaction = {
    replacements: [],
    insertText(value, from, to) {
      this.replacements.push({ value, from, to })
      return this
    },
  }
  const doc = {
    descendants(callback) {
      callback({ isText: true, text }, 1)
    },
  }

  return {
    state: { doc, tr: transaction },
    view: {
      dispatch: vi.fn(),
      dom: { getBoundingClientRect: () => ({ top: 0, bottom: 500, height: 500 }), scrollTop: 0 },
    },
    commands: { focus: vi.fn() },
    chain: vi.fn(() => ({
      focus() { return this },
      setTextSelection() { return this },
      run: vi.fn(),
    })),
    on: vi.fn(),
    off: vi.fn(),
    transaction,
  }
}

describe('FindReplaceBar', () => {
  it('replaces document text with a transaction instead of rewriting serialized HTML', async () => {
    const user = userEvent.setup()
    const editor = createEditor('p')
    render(<FindReplaceBar editor={editor} isOpen onClose={() => {}} />)

    await user.type(screen.getByRole('textbox', { name: /find/i }), 'p')
    await waitFor(() => expect(screen.getByText('1 of 1')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /toggle replace/i }))
    await user.type(screen.getByRole('textbox', { name: /replace with/i }), 'q')
    await user.click(screen.getByRole('button', { name: /replace all/i }))

    expect(editor.transaction.replacements).toEqual([{ value: 'q', from: 1, to: 2 }])
    expect(editor.view.dispatch).toHaveBeenCalledWith(editor.transaction)
    expect(editor.chain).not.toHaveBeenCalled()
  })

  it('explains invalid regular expressions and disables replacement', async () => {
    const user = userEvent.setup()
    const editor = createEditor('text')
    render(<FindReplaceBar editor={editor} isOpen onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /regular expression/i }))
    await user.type(screen.getByRole('textbox', { name: /find/i }), '(')

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid regular expression.')
    await user.click(screen.getByRole('button', { name: /toggle replace/i }))
    expect(screen.getByRole('button', { name: /replace all/i })).toBeDisabled()
  })
})
