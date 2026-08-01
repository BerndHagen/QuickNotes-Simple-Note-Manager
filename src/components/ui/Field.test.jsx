import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SegmentedControl } from './Field'

const OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'compact', label: 'Compact' },
]

function SegmentedControlHarness() {
  const [value, setValue] = useState('list')
  return (
    <SegmentedControl
      value={value}
      onChange={setValue}
      options={OPTIONS}
      label="Note layout"
    />
  )
}

describe('SegmentedControl', () => {
  it('uses one tab stop and supports arrow-key selection', async () => {
    const user = userEvent.setup()
    render(<SegmentedControlHarness />)

    const list = screen.getByRole('radio', { name: 'List' })
    const grid = screen.getByRole('radio', { name: 'Grid' })
    const compact = screen.getByRole('radio', { name: 'Compact' })

    expect(list).toHaveAttribute('tabindex', '0')
    expect(grid).toHaveAttribute('tabindex', '-1')

    list.focus()
    await user.keyboard('{ArrowRight}')
    expect(grid).toHaveFocus()
    expect(grid).toBeChecked()

    await user.keyboard('{End}')
    expect(compact).toHaveFocus()
    expect(compact).toBeChecked()
  })
})
