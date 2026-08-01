import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { insertTextIntoActiveField } from './textFieldInsertion'

function ControlledField({ readOnly = false }) {
  const [value, setValue] = useState('Before after')
  return (
    <textarea
      aria-label="Focused field"
      value={value}
      readOnly={readOnly}
      onChange={(event) => setValue(event.target.value)}
    />
  )
}

describe('insertTextIntoActiveField', () => {
  it('updates React-controlled fields at the current selection', () => {
    render(<ControlledField />)
    const field = screen.getByRole('textbox', { name: 'Focused field' })
    field.focus()
    field.setSelectionRange(7, 7)

    act(() => {
      expect(insertTextIntoActiveField('voice')).toBe(true)
    })

    expect(field).toHaveValue('Before voice after')
    expect(field.selectionStart).toBe(13)
  })

  it('does not alter read-only fields', () => {
    render(<ControlledField readOnly />)
    const field = screen.getByRole('textbox', { name: 'Focused field' })
    fireEvent.focus(field)

    expect(insertTextIntoActiveField('voice')).toBe(false)
    expect(field).toHaveValue('Before after')
  })
})
