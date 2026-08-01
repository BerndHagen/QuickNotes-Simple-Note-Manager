import { useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Menu, MenuItem } from './Menu'

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
