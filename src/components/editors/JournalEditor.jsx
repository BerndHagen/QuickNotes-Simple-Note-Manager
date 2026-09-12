import { useState, useEffect, useRef } from 'react'
import { IconButton, Input } from '../ui'
import {
  BookOpen,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Smile,
  Laugh,
  Meh,
  Frown,
  Annoyed,
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
import StructuredWorkspaceShell, { WorkspaceTabs } from './StructuredWorkspaceShell'
import TodayAgenda from '../workspace/TodayAgenda'
const MOODS = [
  { id: 1, icon: Annoyed, label: 'Terrible' },
  { id: 2, icon: Frown, label: 'Bad' },
  { id: 3, icon: Meh, label: 'Okay' },
  { id: 4, icon: Smile, label: 'Good' },
  { id: 5, icon: Laugh, label: 'Great' },
]
const ENERGY_LEVELS = [
  { id: 1, label: 'Exhausted' },
  { id: 2, label: 'Low' },
  { id: 3, label: 'Normal' },
  { id: 4, label: 'Good' },
  { id: 5, label: 'Energized' },
]
const WEATHER = [
  { id: 'sunny', icon: Sun, label: 'Sunny' },
  { id: 'cloudy', icon: Cloud, label: 'Cloudy' },
  { id: 'rainy', icon: CloudRain, label: 'Rainy' },
  { id: 'stormy', icon: CloudLightning, label: 'Stormy' },
  { id: 'snowy', icon: Snowflake, label: 'Snowy' },
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
    <StructuredWorkspaceShell
      className="qn-type-editor qn-type-journal"
      typeLabel="Journal workspace"
      title={noteTitle}
      fallback="Daily journal"
      onTitleChange={onTitleChange}
      readOnly={readOnly}
      summary={(
        <>
          <button type="button" className="qn-journal-date-button" onClick={() => changeDate(-1)} aria-label="Previous journal day">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="qn-journal-date">{dateDisplay}</span>
          <button type="button" className="qn-journal-date-button" onClick={() => changeDate(1)} disabled={isToday} aria-label="Next journal day">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {journalData.mood && <span>{MOODS.find((mood) => mood.id === journalData.mood)?.label} mood</span>}
          {journalData.energy && <span>Energy {journalData.energy}/5</span>}
          <span>{completionPercent}% check-in</span>
        </>
      )}
      commands={<WorkspaceTabs tabs={sections} activeTab={activeSection} onChange={selectSection} />}
    >
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
                        <mood.icon className="h-4 w-4" aria-hidden="true" />
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
                      ><weather.icon className="h-4 w-4" aria-hidden="true" /></button>
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success">
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
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="lg"
                  aria-label="New journal goal"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                  placeholder="Add a goal for today..."
                  className="min-w-0 flex-1"
                />
                <IconButton
                  icon={Plus}
                  variant="primary"
                  size="lg"
                  label="Add journal goal"
                  onClick={addGoal}
                />
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
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="lg"
                  aria-label="New highlight"
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHighlight()}
                  placeholder="Add a highlight moment..."
                  className="min-w-0 flex-1"
                />
                <IconButton
                  icon={Plus}
                  variant="primary"
                  size="lg"
                  label="Add highlight"
                  onClick={addHighlight}
                />
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
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="lg"
                  aria-label="New journal tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add a tag..."
                  className="min-w-0 flex-1"
                />
                <IconButton
                  icon={Plus}
                  variant="primary"
                  size="lg"
                  label="Add journal tag"
                  onClick={addTag}
                />
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
              className="qn-journal-writing-area min-h-[32rem] w-full resize-none border-0 border-t border-subtle bg-surface-raised px-4 py-4 text-lg leading-relaxed text-content outline-none focus:border-accent"
              autoFocus
            />
            <div className="flex justify-between items-center mt-2 text-sm text-content-muted">
              <span>{journalData.freeWrite.split(/\s+/).filter(Boolean).length} words</span>
              <span>{journalData.freeWrite.length} characters</span>
            </div>
          </div>
        )}
    </StructuredWorkspaceShell>
  )
}
