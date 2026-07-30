import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'
import Button from './Button'

const renderModal = (props = {}) =>
  render(
    <>
      <button type="button">outside</button>
      <Modal open onClose={() => {}} title="Delete folder" {...props}>
        <input aria-label="first field" />
        <input aria-label="second field" />
      </Modal>
    </>
  )

describe('Modal', () => {
  it('exposes a labelled dialog to assistive technology', () => {
    renderModal({ description: 'This cannot be undone' })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Delete folder')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone')
  })

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </Modal>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves initial focus into the dialog', async () => {
    renderModal()
    await waitFor(() => expect(screen.getByLabelText('first field')).toHaveFocus())
  })

  it('honours an explicit initial focus target', async () => {
    const Wrapper = () => {
      const ref = { current: null }
      return (
        <Modal open onClose={() => {}} title="T" initialFocusRef={ref}>
          <input aria-label="ignored" />
          <Button ref={ref}>Confirm</Button>
        </Modal>
      )
    }
    render(<Wrapper />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus())
  })

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getByLabelText('first field')).toHaveFocus())

    await user.tab()
    expect(screen.getByLabelText('second field')).toHaveFocus()
    await user.tab()
    // Wraps back to the close button rather than escaping to the page.
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    expect(screen.getByRole('button', { name: 'outside' })).not.toHaveFocus()
  })

  it('wraps backwards with Shift+Tab', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getByLabelText('first field')).toHaveFocus())
    await user.tab({ shift: true })
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <p>body</p>
      </Modal>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click, unless disabled', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open onClose={onClose} title="T">
        <p>body</p>
      </Modal>
    )
    await user.click(document.querySelector('[aria-hidden="true"]'))
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    rerender(
      <Modal open onClose={onClose} title="T" closeOnBackdrop={false}>
        <p>body</p>
      </Modal>
    )
    await user.click(document.querySelector('[aria-hidden="true"]'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores focus to the trigger when it unmounts', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(
      <Modal open onClose={() => {}} title="T">
        <input aria-label="field" />
      </Modal>
    )
    await waitFor(() => expect(screen.getByLabelText('field')).toHaveFocus())
    unmount()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('locks background scrolling while open', async () => {
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'))
  })
})
