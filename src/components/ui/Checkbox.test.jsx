import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Checkbox from './Checkbox'

describe('Checkbox', () => {
  it('keeps a real named input and renders a high-contrast selected mark', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <label>
        <Checkbox checked onChange={onChange} />
        Include tags
      </label>
    )

    const input = screen.getByRole('checkbox', { name: 'Include tags' })
    expect(input).toBeChecked()
    expect(container.querySelector('.qn-checkbox-mark[data-checked="true"] svg')).toBeInTheDocument()
    await userEvent.click(input)
    expect(onChange).toHaveBeenCalledOnce()
  })
})
