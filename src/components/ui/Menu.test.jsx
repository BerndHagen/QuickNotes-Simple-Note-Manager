import { useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getVisibleViewport, Menu, MenuItem } from './Menu'

function MenuHarness() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Open actions
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label="Note actions"
      >
        <MenuItem onClick={() => setOpen(false)}>Archive</MenuItem>
      </Menu>
    </>
  )
}

describe('Menu', () => {
  it('clamps an over-reported Safari visual viewport to the layout viewport', () => {
    const visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    const widthDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth')
    const heightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight')

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { offsetLeft: 0, offsetTop: 0, width: 325, height: 570 },
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 568 })
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 325 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 570 })

    expect(getVisibleViewport()).toEqual({
      left: 0,
      top: 0,
      right: 320,
      bottom: 568,
      width: 320,
      height: 568,
    })

    if (visualViewportDescriptor) Object.defineProperty(window, 'visualViewport', visualViewportDescriptor)
    else delete window.visualViewport
    if (innerWidthDescriptor) Object.defineProperty(window, 'innerWidth', innerWidthDescriptor)
    if (innerHeightDescriptor) Object.defineProperty(window, 'innerHeight', innerHeightDescriptor)
    if (widthDescriptor) Object.defineProperty(document.documentElement, 'clientWidth', widthDescriptor)
    else delete document.documentElement.clientWidth
    if (heightDescriptor) Object.defineProperty(document.documentElement, 'clientHeight', heightDescriptor)
    else delete document.documentElement.clientHeight
  })

  it('returns focus to its trigger when Escape closes it', async () => {
    const user = userEvent.setup()
    render(<MenuHarness />)

    const trigger = screen.getByRole('button', { name: 'Open actions' })
    await user.click(trigger)
    expect(await screen.findByRole('menuitem', { name: 'Archive' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
