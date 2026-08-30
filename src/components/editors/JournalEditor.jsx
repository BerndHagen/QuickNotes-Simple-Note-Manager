import { useState, useEffect, useRef } from 'react'
import { buttonClasses } from '../ui'
import {
  BookOpen,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Smile,
  Heart,
  Star,
  Plus,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
  Target,
  CalendarClock,
  X,
} from 'lucide-react'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'
import TodayAgenda from '../workspace/TodayAgenda'
const MOODS = [
  { id: 1, emoji: '\u{1F622}', label: 'Terrible', color: '#ef4444' },
  { id: 2, emoji: '\u{1F614}', label: 'Bad', color: '#f97316' },
  { id: 3, emoji: '\u{1F610}', label: 'Okay', color: '#eab308' },
  { id: 4, emoji: '\u{1F642}', label: 'Good', color: '#84cc16' },
  { id: 5, emoji: '\u{1F604}', label: 'Great', color: '#22c55e' },
]
const ENERGY_LEVELS = [
  { id: 1, label: 'Exhausted', icon: '\u{1F50B}', color: '#ef4444' },
  { id: 2, label: 'Low', icon: '\u{1F50B}', color: '#f97316' },
  { id: 3, label: 'Normal', icon: '\u{1F50B}', color: '#eab308' },
  { id: 4, label: 'Good', icon: '\u{1F50B}', color: '#84cc16' },
  { id: 5, label: 'Energized', icon: '\u26A1', color: '#22c55e' },
]
const WEATHER = [
  { id: 'sunny', emoji: '\u2600\uFE0F', label: 'Sunny' },
  { id: 'cloudy', emoji: '\u2601\uFE0F', label: 'Cloudy' },
  { id: 'rainy', emoji: '\u{1F327}\uFE0F', label: 'Rainy' },
  { id: 'stormy', emoji: '\u26C8\uFE0F', label: 'Stormy' },
  { id: 'snowy', emoji: '\u2744\uFE0F', label: 'Snowy' },
]

export default function JournalEditor({ data, onChange, note, noteTitle, onTitleChange, readOnly, todayViewToken }) {
  const [journalData, setJournalData] = useState({
    date: data?.date || formatDateKey(),
    mood: data?.mood || null,
    energy: data?.energy || null,
    weather: data?.weather || null,
    gratitude: data?.gratitude || ['', '', ''],
    highlights: data?.highlights || [],
    challenges: data?.challenges || '',
    lessons: data?.lessons || '',
    goals: data?.goals || [],
    freeWrite: data?.freeWrite || '',
    tags: data?.tags || [],
    preferredSection: data?.preferredSection || 'write',
  })

  const [activeSection, setActiveSection] = useState(data?.preferredSection || 'write')
  const [newHighlight, setNewHighlight] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newTag, setNewTag] = useState('')
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, journalData, (incoming) => {
    setJournalData(incoming)
    setActiveSection(incoming?.preferredSection || 'write')
  })
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(journalData)
  }, [journalData, onChangeRef, skipChangeRef])

  const update = (field, value) => {
    setJournalData(prev => ({ ...prev, [field]: value }))
  }
  const selectSection = (section) => {
    setActiveSection(section)
    update('preferredSection', section)
  }

  const updateGratitude = (index, value) => {
    const newGratitude = [...journalData.gratitude]
    newGratitude[index] = value
    update('gratitude', newGratitude)
  }
  const addHighlight = () => {
    if (!newHighlight.trim()) return
    update('highlights', [...journalData.highlights, {
      id: generateId(),
      text: newHighlight.trim(),
      timestamp: new Date().toISOString(),
    }])
    setNewHighlight('')
  }

  const removeHighlight = (id) => {
    update('highlights', journalData.highlights.filter(h => h.id !== id))
  }
  const addGoal = () => {
    if (!newGoal.trim()) return
    update('goals', [...journalData.goals, {
      id: generateId(),
      text: newGoal.trim(),
      completed: false,
    }])
    setNewGoal('')
  }

  const toggleGoal = (id) => {
    update('goals', journalData.goals.map(g =>
      g.id === id ? { ...g, completed: !g.completed } : g
    ))
  }

  const removeGoal = (id) => {
    update('goals', journalData.goals.filter(g => g.id !== id))
  }
  const addTag = () => {
    if (!newTag.trim() || journalData.tags.includes(newTag.trim())) return
    update('tags', [...journalData.tags, newTag.trim()])
    setNewTag('')
  }

  const removeTag = (tag) => {
    update('tags', journalData.tags.filter(t => t !== tag))
  }
  const changeDate = (days) => {
    const current = parseDateKey(journalData.date)
    current.setDate(current.getDate() + days)
    update('date', formatDateKey(current))
  }

  const isToday = journalData.date === formatDateKey()
  useEffect(() => {
    if (todayViewToken && isToday) setActiveSection('today')
  }, [isToday, todayViewToken])
  useEffect(() => {
    if (!isToday && activeSection === 'today') setActiveSection('write')
  }, [activeSection, isToday])
  const dateDisplay = parseDateKey(journalData.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const completion = {
    mood: journalData.mood !== null,
    energy: journalData.energy !== null,
    gratitude: journalData.gratitude.some(g => g.trim()),
    freeWrite: journalData.freeWrite.trim().length > 0,
  }
  const completionPercent = Math.round(
    (Object.values(completion).filter(Boolean).length / Object.keys(completion).length) * 100
  )

  const sections = [
    { id: 'write', label: 'Write', icon: BookOpen },
    ...(isToday ? [{ id: 'today', label: 'Daily agenda', icon: CalendarClock }] : []),
    { id: 'morning', label: 'Check-in & goals', icon: Sun },
    { id: 'day', label: 'During the Day', icon: Cloud },
    { id: 'evening', label: 'Evening', icon: Moon },
    { id: 'reflect', label: 'Reflect', icon: Heart },
  ]

  return (
    <div className="qn-type-editor qn-type-journal flex h-full flex-col">
      <header className="qn-type-hero qn-workspace-header flex-shrink-0 border-b border-subtle">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <FocusedNoteTitle
              icon={BookOpen}
              typeLabel="Journal workspace"
              title={noteTitle}
              fallback="Daily journal"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <div className="ml-12 mt-1 flex items-center gap-2">
              <button
                onClick={() => changeDate(-1)}
                aria-label="Previous journal day"
                className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control border border-subtle bg-surface-raised text-content-muted hover:bg-surface-hover"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-ui-md font-medium text-content">{dateDisplay}</span>
              <button
                onClick={() => changeDate(1)}
                disabled={isToday}
                aria-label="Next journal day"
                className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control border border-subtle bg-surface-raised text-content-muted hover:bg-surface-hover disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
        </div>
        {(journalData.mood || journalData.energy || journalData.weather || completionPercent > 0) && (
          <WorkspaceMetrics
            items={[
              ...(journalData.mood ? [{ label: 'Mood', value: MOODS.find(m => m.id === journalData.mood)?.label }] : []),
              ...(journalData.energy ? [{ label: 'Energy', value: `${journalData.energy}/5` }] : []),
              ...(journalData.weather ? [{ label: 'Weather', value: WEATHER.find(w => w.id === journalData.weather)?.label }] : []),
              ...(journalData.freeWrite.trim() ? [{ label: 'Writing', value: `${journalData.freeWrite.split(/\s+/).filter(Boolean).length} words` }] : []),
            ]}
          />
        )}
      </header>
      <div className="qn-type-tabs flex-shrink-0 flex gap-1 p-2 border-b border-subtle bg-surface-sunken overflow-x-auto">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => selectSection(section.id)}
            aria-pressed={activeSection === section.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
 activeSection === section.id
 ? 'bg-accent-soft text-accent-text'
                : 'text-content-muted hover:bg-surface-hover'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>
      <div className="qn-workspace-canvas flex-1 overflow-y-auto p-4">
        {activeSection === 'today' && isToday && <TodayAgenda currentNoteId={note?.id} />}
        {activeSection === 'morning' && (
          <div className="qn-workspace-panel qn-journal-checkin mx-auto max-w-3xl space-y-5 p-5">
            <section className="qn-journal-metadata border-b border-subtle pb-5">
              <h3 className="mb-3 flex items-center gap-2 text-ui-lg font-semibold text-content">
                <Smile className="w-5 h-5 text-accent-text" />
                Daily check-in
              </h3>
              <div className="qn-journal-metadata-grid grid gap-4 sm:grid-cols-3">
                <fieldset>
                  <legend className="mb-2 text-ui-sm font-medium text-content-muted">Mood</legend>
                  <div className="flex gap-1">
                    {MOODS.map((mood) => (
                      <button
                        key={mood.id}
                        onClick={() => update('mood', mood.id)}
                        aria-label={`Mood: ${mood.label}`}
                        title={mood.label}
                        aria-pressed={journalData.mood === mood.id}
                        className={`qn-journal-choice ${journalData.mood === mood.id ? 'qn-journal-choice--active' : ''}`}
                      >
                        <span aria-hidden="true">{mood.emoji}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 flex items-center gap-1 text-ui-sm font-medium text-content-muted"><Zap className="h-3.5 w-3.5" />Energy</legend>
                  <div className="flex gap-1">
                    {ENERGY_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => update('energy', level.id)}
                        aria-label={`Energy: ${level.label}`}
                        title={level.label}
                        aria-pressed={journalData.energy === level.id}
                        className={`qn-journal-choice qn-journal-choice--number ${journalData.energy === level.id ? 'qn-journal-choice--active' : ''}`}
                      >{level.id}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 flex items-center gap-1 text-ui-sm font-medium text-content-muted"><Cloud className="h-3.5 w-3.5" />Weather</legend>
                  <div className="flex gap-1">
                    {WEATHER.map((weather) => (
                      <button
                        key={weather.id}
                        onClick={() => update('weather', weather.id)}
                        aria-label={`Weather: ${weather.label}`}
                        title={weather.label}
                        aria-pressed={journalData.weather === weather.id}
                        className={`qn-journal-choice ${journalData.weather === weather.id ? 'qn-journal-choice--active' : ''}`}
                      ><span aria-hidden="true">{weather.emoji}</span></button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-accent-text" />
                Goals for Today
              </h3>
              <div className="space-y-2 mb-3">
                {journalData.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`qn-domain-card flex items-center gap-3 rounded-card border p-3 ${
 goal.completed
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                        : 'border-subtle bg-surface-raised shadow-xs'
                    }`}
                  >
                    <button
                      onClick={() => toggleGoal(goal.id)}
                      aria-label={goal.completed ? `Mark ${goal.text} incomplete` : `Complete ${goal.text}`}
                    >
                      {goal.completed ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-subtle" />
                      )}
                    </button>
                    <span className={`flex-1 ${goal.completed ? 'line-through text-content-subtle' : 'text-content'}`}>
                      {goal.text}
                    </span>
                    <button
                      onClick={() => removeGoal(goal.id)}
                      aria-label={`Delete ${goal.text}`}
                      className="p-1 text-content-subtle hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  aria-label="New journal goal"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                  placeholder="Add a goal for today..."
                  className="flex-1 rounded-control border border-subtle bg-surface-sunken px-4 py-2 text-content outline-none"
                />
                <button
                  onClick={addGoal}
                  aria-label="Add journal goal"
                  className={buttonClasses({ variant: 'primary' })}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {activeSection === 'day' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl space-y-6 p-5">
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-accent-text" />
                Today's Highlights
              </h3>
              <div className="space-y-2 mb-3">
                {journalData.highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                  className="qn-domain-card flex items-start gap-3 rounded-card border border-[var(--qn-warning-border)] bg-warning-soft p-3"
                  >
                    <Star className="w-5 h-5 text-accent-text flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-content">{highlight.text}</p>
                      <p className="text-xs text-content-muted mt-1">
                        {new Date(highlight.timestamp).toLocaleTimeString('en-US')}
                      </p>
                    </div>
                    <button
                      onClick={() => removeHighlight(highlight.id)}
                      aria-label={`Delete ${highlight.text}`}
                      className="p-1 text-amber-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  aria-label="New highlight"
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHighlight()}
                  placeholder="Add a highlight moment..."
                  className="flex-1 rounded-control border border-subtle bg-surface-sunken px-4 py-2 text-content outline-none"
                />
                <button
                  onClick={addHighlight}
                  aria-label="Add highlight"
                  className={buttonClasses({ variant: 'primary' })}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-accent-text" />
                Challenges Faced
              </h3>
              <textarea
                aria-label="Challenges faced today"
                value={journalData.challenges}
                onChange={(e) => update('challenges', e.target.value)}
                placeholder="What challenges did you face today?"
                className="w-full resize-none rounded-control border border-subtle bg-surface-sunken px-4 py-3 text-content outline-none"
                rows={4}
              />
            </div>
          </div>
        )}
        {activeSection === 'evening' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl space-y-6 p-5">
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                3 Things I'm Grateful For
              </h3>
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      aria-label={`Gratitude item ${index + 1}`}
                      value={journalData.gratitude[index]}
                      onChange={(e) => updateGratitude(index, e.target.value)}
                      placeholder={`I'm grateful for...`}
                      className="flex-1 rounded-control border border-subtle bg-surface-sunken px-4 py-3 text-content outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent-text" />
                Lessons Learned
              </h3>
              <textarea
                aria-label="Lessons learned today"
                value={journalData.lessons}
                onChange={(e) => update('lessons', e.target.value)}
                placeholder="What did you learn today?"
                className="w-full resize-none rounded-control border border-subtle bg-surface-sunken px-4 py-3 text-content outline-none"
                rows={4}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-accent-text" />
                Goal Review
              </h3>
            <div className="rounded-card border border-subtle bg-surface-sunken p-4">
                {journalData.goals.length === 0 ? (
                  <p className="text-content-muted text-center">No goals set for today</p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-content-muted">
                        {journalData.goals.filter(g => g.completed).length} of {journalData.goals.length} completed
                      </span>
                      <span className="text-lg font-bold text-accent-text">
                        {Math.round((journalData.goals.filter(g => g.completed).length / journalData.goals.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-surface-sunken dark:bg-surface-sunken overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-base"
                        style={{
                          width: `${(journalData.goals.filter(g => g.completed).length / journalData.goals.length) * 100}%`
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {activeSection === 'reflect' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl space-y-6 p-5">
            <div>
              <h3 className="text-lg font-semibold text-content mb-3">
                Tags for this entry
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {journalData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-accent-soft text-accent-text text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag} tag`}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  aria-label="New journal tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add a tag..."
                  className="flex-1 rounded-control border border-subtle bg-surface-sunken px-4 py-2 text-content outline-none"
                />
                <button
                  onClick={addTag}
                  className={buttonClasses({ variant: 'primary' })}
                >
                  Add
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3">
                Reflection Prompts
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  'What made me smile today?',
                  'What would I do differently?',
                  'Who am I thankful for?',
                  'What am I looking forward to?',
                  'What did I accomplish?',
                  'How did I help someone?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      selectSection('write')
                      update('freeWrite', journalData.freeWrite + (journalData.freeWrite ? '\n\n' : '') + prompt + '\n')
                    }}
                  className="rounded-card border border-subtle bg-surface-raised p-3 text-left text-sm text-content-muted transition-colors hover:border-accent-border hover:bg-accent-soft"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeSection === 'write' && (
          <div className="qn-workspace-panel qn-journal-writing mx-auto max-w-3xl p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-content mb-1">
                Journal entry
              </h3>
              <p className="text-content-muted text-sm">
                Write first. Check-ins and guided reflection are available when they help.
              </p>
            </div>
            <textarea
              aria-label="Free writing"
              value={journalData.freeWrite}
              onChange={(e) => update('freeWrite', e.target.value)}
              placeholder="Start writing..."
              className="qn-journal-writing-area min-h-[32rem] w-full resize-none border-0 border-t border-subtle bg-surface-raised px-1 py-4 text-lg leading-relaxed text-content outline-none focus:border-accent"
              autoFocus
            />
            <div className="flex justify-between items-center mt-2 text-sm text-content-muted">
              <span>{journalData.freeWrite.split(/\s+/).filter(Boolean).length} words</span>
              <span>{journalData.freeWrite.length} characters</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
