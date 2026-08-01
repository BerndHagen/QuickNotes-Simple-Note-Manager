import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TodoListEditor from './TodoListEditor'

const createData = (taskText = 'Original task') => ({
  tasks: [{
    id: 'task-1',
    text: taskText,
    completed: false,
    priority: 'none',
    dueDate: null,
    starred: false,
    subtasks: [],
    notes: '',
    createdAt: '2026-08-01T10:00:00.000Z',
    completedAt: null,
  }],
  filter: 'all',
  sortBy: 'priority',
})

describe('focused editor state synchronization', () => {
  it('uses the latest change callback without emitting merely because it changed', async () => {
    const staleCallback = vi.fn()
    const latestCallback = vi.fn()
    const data = createData()
    const { rerender } = render(
      <TodoListEditor data={data} onChange={staleCallback} noteTitle="Tasks" onTitleChange={() => {}} />
    )

    rerender(
      <TodoListEditor data={data} onChange={latestCallback} noteTitle="Tasks" onTitleChange={() => {}} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filter tasks' }))
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))

    await waitFor(() => expect(latestCallback).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'active' })
    ))
    expect(staleCallback).not.toHaveBeenCalled()
  })

  it('applies same-note external data without echoing it back as a local edit', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <TodoListEditor data={createData()} onChange={onChange} noteTitle="Tasks" onTitleChange={() => {}} />
    )

    rerender(
      <TodoListEditor
        data={createData('Restored task')}
        onChange={onChange}
        noteTitle="Tasks"
        onTitleChange={() => {}}
      />
    )

    expect(await screen.findByText('Restored task')).toBeInTheDocument()
    expect(screen.queryByText('Original task')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
