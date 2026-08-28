import { useEffect, useMemo, useState } from 'react'
import { ListTodo } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore } from '../store'
import {
  createCanonicalTaskFromRecognition,
  createRecognitionTaskSource,
  describeTaskSource,
  MAX_CAPTURED_TASK_TEXT_LENGTH,
} from '../lib/taskSources'
import { getDefaultData, NOTE_TYPES } from './editors/noteTypes'
import { Button, Field, Input, Modal, Select, Textarea } from './ui'

const NEW_TASK_LIST = '__new__'
const MEETING_ACTIONS = '__meeting_actions__'

export default function RecognitionTaskModal({ open, onClose, recognition, initialText = '', allowMeetingTarget = true }) {
  const selectedNotes = useNotesStore((state) => state.notes)
  const [text, setText] = useState('')
  const [targetId, setTargetId] = useState(NEW_TASK_LIST)
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('none')
  const [saving, setSaving] = useState(false)
  const sourceLabel = recognition
    ? describeTaskSource(createRecognitionTaskSource(recognition))
    : 'Recognized content'

  const taskLists = useMemo(() => {
    // A few legacy component tests mock the older whole-store call shape.
    // Accept that shape here without weakening production owner scoping.
    const notes = Array.isArray(selectedNotes)
      ? selectedNotes
      : Array.isArray(selectedNotes?.notes)
        ? selectedNotes.notes
        : []
    return notes
      .filter((note) => note.noteType === NOTE_TYPES.TODO_LIST && !note.deleted && !note.archived)
      .sort((left, right) => String(left.title).localeCompare(String(right.title)))
  }, [selectedNotes])
  const meetingNote = useMemo(() => {
    const notes = Array.isArray(selectedNotes)
      ? selectedNotes
      : Array.isArray(selectedNotes?.notes)
        ? selectedNotes.notes
        : []
    if (!allowMeetingTarget) return null
    return notes.find((note) => note.id === recognition?.noteId && note.noteType === NOTE_TYPES.MEETING && !note.deleted) || null
  }, [allowMeetingTarget, recognition?.noteId, selectedNotes])

  useEffect(() => {
    if (!open) return
    setText(String(initialText || recognition?.text || '').trim().slice(0, MAX_CAPTURED_TASK_TEXT_LENGTH))
    setTargetId(meetingNote ? MEETING_ACTIONS : taskLists[0]?.id || NEW_TASK_LIST)
    setDueDate('')
    setPriority('none')
  }, [initialText, meetingNote, open, recognition?.id, recognition?.text, taskLists])

  const createTask = async () => {
    if (!recognition) return
    setSaving(true)
    try {
      const task = createCanonicalTaskFromRecognition({ text, priority, dueDate, recognition })
      const store = useNotesStore.getState()
      const currentTarget = store.notes.find((note) => note.id === targetId)
      if (targetId === MEETING_ACTIONS && meetingNote) {
        const currentMeeting = store.notes.find((note) => note.id === meetingNote.id)
        if (!currentMeeting || currentMeeting.noteType !== NOTE_TYPES.MEETING) {
          throw new Error('The meeting is no longer available.')
        }
        const noteData = currentMeeting.noteData && typeof currentMeeting.noteData === 'object'
          ? currentMeeting.noteData
          : getDefaultData(NOTE_TYPES.MEETING)
        await store.updateNote(currentMeeting.id, {
          noteData: {
            ...noteData,
            actionItems: [{
              id: task.id,
              task: task.text,
              owner: '',
              dueDate: task.dueDate,
              priority: task.priority,
              completed: false,
              source: task.source,
              createdAt: task.createdAt,
            }, ...(Array.isArray(noteData.actionItems) ? noteData.actionItems : [])],
          },
        })
      } else if (targetId !== NEW_TASK_LIST && currentTarget?.noteType === NOTE_TYPES.TODO_LIST) {
        const noteData = currentTarget.noteData && typeof currentTarget.noteData === 'object'
          ? currentTarget.noteData
          : getDefaultData(NOTE_TYPES.TODO_LIST)
        await store.updateNote(currentTarget.id, {
          noteData: { ...noteData, tasks: [task, ...(Array.isArray(noteData.tasks) ? noteData.tasks : [])] },
        })
      } else {
        const noteData = getDefaultData(NOTE_TYPES.TODO_LIST)
        store.createNote({
          title: 'Captured tasks',
          noteType: NOTE_TYPES.TODO_LIST,
          noteData: { ...noteData, tasks: [task] },
        })
      }
      toast.success(targetId === MEETING_ACTIONS ? 'Meeting action item added with its capture source' : 'Task created with its capture source')
      onClose()
    } catch (error) {
      toast.error(error?.message || 'The task could not be created.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create task from recognized text"
      description="Review the task before adding it to QuickNotes."
      icon={ListTodo}
      size="md"
      closeOnBackdrop={!saving}
      footer={(
        <>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon={ListTodo} onClick={createTask} loading={saving} disabled={!text.trim()}>
            {targetId === MEETING_ACTIONS ? 'Add action item' : 'Create task'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Task" hint={`${text.length}/${MAX_CAPTURED_TASK_TEXT_LENGTH} characters`}>
          {({ id, ...props }) => (
            <Textarea
              id={id}
              rows={4}
              maxLength={MAX_CAPTURED_TASK_TEXT_LENGTH}
              value={text}
              onChange={(event) => setText(event.target.value)}
              {...props}
            />
          )}
        </Field>
        <Field label="Destination" hint={targetId === NEW_TASK_LIST ? 'A new task list will open after creation.' : undefined}>
          {({ id, ...props }) => (
            <Select id={id} value={targetId} onChange={(event) => setTargetId(event.target.value)} {...props}>
              {meetingNote && <option value={MEETING_ACTIONS}>Meeting action items — {meetingNote.title || 'Untitled meeting'}</option>}
              {taskLists.map((note) => <option key={note.id} value={note.id}>{note.title || 'Untitled task list'}</option>)}
              <option value={NEW_TASK_LIST}>New “Captured tasks” list</option>
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due date" optional>
            {({ id, ...props }) => <Input id={id} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} {...props} />}
          </Field>
          <Field label="Priority">
            {({ id, ...props }) => (
              <Select id={id} value={priority} onChange={(event) => setPriority(event.target.value)} {...props}>
                <option value="none">No priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            )}
          </Field>
        </div>
        <div className="border-y border-subtle bg-surface-sunken px-3 py-2.5 text-ui-sm text-content-muted">
          <strong className="font-semibold text-content">Source: {sourceLabel}</strong>
          <p className="mt-1 text-ui-xs text-content-subtle">The task keeps a stable link to the original capture. QuickNotes does not infer or create tasks automatically.</p>
        </div>
      </div>
    </Modal>
  )
}
