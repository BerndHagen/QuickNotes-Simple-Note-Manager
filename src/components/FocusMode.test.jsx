import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesStore, useUIStore } from '../store'
import FocusMode from './FocusMode'

vi.mock('./RichTextEditor', () => ({
  default: ({ content, readOnly }) => (
    <div role="textbox" aria-label="Focus editor" aria-readonly={readOnly}>
      {content}
    </div>
  ),
}))

describe('FocusMode', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [{ id: 'note-1', title: 'Project brief', content: '<p>one two three</p>' }],
      selectedNoteId: 'note-1',
    })
    useUIStore.setState({ focusModeOpen: true })
  })

  it('opens as a labelled modal with initialized metrics and a named exit control', async () => {
    const user = userEvent.setup()
    render(<FocusMode />)

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Project brief')
    expect(screen.getByText('3 words')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Exit focus mode' }))
    expect(useUIStore.getState().focusModeOpen).toBe(false)
  })

  it('reports ambient-audio failures instead of showing a false playing state', async () => {
    const play = vi.fn().mockRejectedValue(new Error('blocked'))
    const pause = vi.fn()
    vi.stubGlobal(
      'Audio',
      vi.fn(function AudioMock() {
        this.play = play
        this.pause = pause
      })
    )
    const user = userEvent.setup()
    render(<FocusMode />)

    await user.selectOptions(screen.getByLabelText('Ambient sound'), 'rain')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ambient audio could not be played')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pause ambient sound' })).not.toBeInTheDocument())
    expect(play).toHaveBeenCalledOnce()
    expect(pause).toHaveBeenCalled()
  })
})
