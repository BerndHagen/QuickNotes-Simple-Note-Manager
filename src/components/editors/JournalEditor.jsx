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
  X,
} from 'lucide-react'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'
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

export default function JournalEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
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
    preferredSection: data?.preferredSection || 'morning',
  })

  const [activeSection, setActiveSection] = useState(data?.preferredSection || 'morning')
  const [newHighlight, setNewHighlight] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newTag, setNewTag] = useState('')
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, journalData, (incoming) => {
    setJournalData(incoming)
    setActiveSection(incoming?.preferredSection || 'morning')
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
    { id: 'morning', label: 'Morning', icon: Sun },
    { id: 'day', label: 'During the Day', icon: Cloud },
    { id: 'evening', label: 'Evening', icon: Moon },
    { id: 'reflect', label: 'Reflect', icon: Heart },
    { id: 'write', label: 'Free Write', icon: BookOpen },
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
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => changeDate(-1)}
                aria-label="Previous journal day"
                className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control border border-subtle bg-surface-raised text-content-muted hover:bg-surface-hover"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-content font-medium">{dateDisplay}</span>
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
        <WorkspaceMetrics
          items={[
            { label: 'Complete', value: `${completionPercent}%`, tone: completionPercent === 100 ? 'success' : 'neutral' },
            { label: 'Mood', value: journalData.mood ? MOODS.find(m => m.id === journalData.mood)?.emoji : 'Not set' },
            { label: 'Energy', value: journalData.energy ? `${journalData.energy}/5` : 'Not set' },
            { label: 'Weather', value: journalData.weather ? WEATHER.find(w => w.id === journalData.weather)?.emoji : 'Not set' },
          ]}
        />
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
        {activeSection === 'morning' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl space-y-6 p-5">
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Smile className="w-5 h-5 text-accent-text" />
                How are you feeling?
              </h3>
              <div className="flex gap-3 justify-center">
                {MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => update('mood', mood.id)}
                    aria-pressed={journalData.mood === mood.id}
                    className={`qn-choice-card flex flex-col items-center gap-2 rounded-card border p-4 ${
 journalData.mood === mood.id
 ? 'border-accent bg-accent-soft ring-2 ring-[var(--qn-accent-soft)]'
                        : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-4xl">{mood.emoji}</span>
                    <span className="text-xs text-content-muted">{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent-text" />
                Energy Level
              </h3>
              <div className="flex gap-2 justify-center">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => update('energy', level.id)}
                    aria-pressed={journalData.energy === level.id}
                    className={`qn-choice-card flex max-w-[100px] flex-1 flex-col items-center gap-1 rounded-card border p-3 ${
 journalData.energy === level.id
 ? 'border-accent bg-accent-soft ring-2 ring-[var(--qn-accent-soft)]'
                        : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-4 rounded-sm ${
 i <= level.id ? 'bg-accent' : 'bg-surface-active dark:bg-surface-active'
 }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-content-muted">{level.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-content mb-3 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-accent-text" />
                Weather
              </h3>
              <div className="flex gap-2 justify-center flex-wrap">
                {WEATHER.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => update('weather', w.id)}
                    aria-pressed={journalData.weather === w.id}
                    className={`qn-choice-card flex items-center gap-2 rounded-card border px-4 py-2 ${
 journalData.weather === w.id
 ? 'border-accent bg-accent-soft ring-2 ring-[var(--qn-accent-soft)]'
                        : 'border-subtle bg-surface-raised hover:border-strong hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-2xl">{w.emoji}</span>
                    <span className="text-sm text-content-muted">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>
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
                  className="flex-1 px-4 py-2 rounded-xl bg-surface-sunken border border-subtle outline-none text-content"
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
                  className="flex-1 px-4 py-2 rounded-xl bg-surface-sunken border border-subtle outline-none text-content"
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
                className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
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
                      className="flex-1 px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content"
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
                className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
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
                  className="flex-1 px-4 py-2 rounded-xl bg-surface-sunken border border-subtle outline-none text-content"
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
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-content mb-1">
                Free Writing
              </h3>
              <p className="text-content-muted text-sm">
                Let your thoughts flow freely. No judgment, no editing.
              </p>
            </div>
            <textarea
              aria-label="Free writing"
              value={journalData.freeWrite}
              onChange={(e) => update('freeWrite', e.target.value)}
              placeholder="Start writing..."
              className="w-full h-[500px] px-4 py-3 rounded-xl bg-surface-sunken border-2 border-subtle focus:border-accent outline-none text-content resize-none text-lg leading-relaxed"
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
