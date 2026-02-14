import React, { useState, useEffect, useRef } from 'react'
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
  Flame
} from 'lucide-react'
import { generateId } from './noteTypes'
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

export default function JournalEditor({ data, onChange, noteTitle }) {
  const [journalData, setJournalData] = useState({
    date: data?.date || new Date().toISOString().split('T')[0],
    mood: data?.mood || null,
    energy: data?.energy || null,
    weather: data?.weather || null,
    gratitude: data?.gratitude || ['', '', ''],
    highlights: data?.highlights || [],
    challenges: data?.challenges || '',
    lessons: data?.lessons || '',
    goals: data?.goals || [],
    freeWrite: data?.freeWrite || '',
    photos: data?.photos || [],
    tags: data?.tags || [],
  })

  const [activeSection, setActiveSection] = useState('morning')
  const [newHighlight, setNewHighlight] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [newTag, setNewTag] = useState('')
  const [streakDays, setStreakDays] = useState(0)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.(journalData)
  }, [journalData])

  const update = (field, value) => {
    setJournalData(prev => ({ ...prev, [field]: value }))
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
    const current = new Date(journalData.date)
    current.setDate(current.getDate() + days)
    update('date', current.toISOString().split('T')[0])
  }

  const isToday = journalData.date === new Date().toISOString().split('T')[0]
  const dateDisplay = new Date(journalData.date).toLocaleDateString('en-US', {
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-7 h-7" />
              {noteTitle || 'Daily Journal'}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => changeDate(-1)}
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium">{dateDisplay}</span>
              <button
                onClick={() => changeDate(1)}
                disabled={isToday}
                className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-6 h-6 text-white" />
              <span className="text-2xl font-bold text-white">{streakDays}</span>
              <span className="text-amber-100 text-sm">day streak</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="text-white text-sm">{completionPercent}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-100 text-sm">Mood:</span>
            <span className="text-2xl">{journalData.mood ? MOODS.find(m => m.id === journalData.mood)?.emoji : '\u2753'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-100 text-sm">Energy:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`w-3 h-5 rounded-sm ${
                    level <= (journalData.energy || 0)
                      ? 'bg-white'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
          {journalData.weather && (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{WEATHER.find(w => w.id === journalData.weather)?.emoji}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === section.id
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'morning' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Smile className="w-5 h-5 text-amber-500" />
                How are you feeling?
              </h3>
              <div className="flex gap-3 justify-center">
                {MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => update('mood', mood.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                      journalData.mood === mood.id
                        ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500 scale-110'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-4xl">{mood.emoji}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{mood.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Energy Level
              </h3>
              <div className="flex gap-2 justify-center">
                {ENERGY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => update('energy', level.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all flex-1 max-w-[100px] ${
                      journalData.energy === level.id
                        ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-4 rounded-sm ${
                            i <= level.id ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{level.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-amber-500" />
                Weather
              </h3>
              <div className="flex gap-2 justify-center flex-wrap">
                {WEATHER.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => update('weather', w.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      journalData.weather === w.id
                        ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500'
                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-2xl">{w.emoji}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                Goals for Today
              </h3>
              <div className="space-y-2 mb-3">
                {journalData.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      goal.completed
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    <button onClick={() => toggleGoal(goal.id)}>
                      {goal.completed ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                      )}
                    </button>
                    <span className={`flex-1 ${goal.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {goal.text}
                    </span>
                    <button
                      onClick={() => removeGoal(goal.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                  placeholder="Add a goal for today..."
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
                />
                <button
                  onClick={addGoal}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
        {activeSection === 'day' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Today's Highlights
              </h3>
              <div className="space-y-2 mb-3">
                {journalData.highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                  >
                    <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white">{highlight.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(highlight.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeHighlight(highlight.id)}
                      className="p-1 text-amber-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHighlight()}
                  placeholder="Add a highlight moment..."
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
                />
                <button
                  onClick={addHighlight}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-amber-500" />
                Challenges Faced
              </h3>
              <textarea
                value={journalData.challenges}
                onChange={(e) => update('challenges', e.target.value)}
                placeholder="What challenges did you face today?"
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white resize-none"
                rows={4}
              />
            </div>
          </div>
        )}
        {activeSection === 'evening' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
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
                      value={journalData.gratitude[index]}
                      onChange={(e) => updateGratitude(index, e.target.value)}
                      placeholder={`I'm grateful for...`}
                      className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Lessons Learned
              </h3>
              <textarea
                value={journalData.lessons}
                onChange={(e) => update('lessons', e.target.value)}
                placeholder="What did you learn today?"
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white resize-none"
                rows={4}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                Goal Review
              </h3>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                {journalData.goals.length === 0 ? (
                  <p className="text-gray-500 text-center">No goals set for today</p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-600 dark:text-gray-400">
                        {journalData.goals.filter(g => g.completed).length} of {journalData.goals.length} completed
                      </span>
                      <span className="text-lg font-bold text-amber-500">
                        {Math.round((journalData.goals.filter(g => g.completed).length / journalData.goals.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
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
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Tags for this entry
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {journalData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-sm"
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add a tag..."
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
                />
                <button
                  onClick={addTag}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Add
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Reflection Prompts
              </h3>
              <div className="grid grid-cols-2 gap-3">
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
                      setActiveSection('write')
                      update('freeWrite', journalData.freeWrite + (journalData.freeWrite ? '\n\n' : '') + prompt + '\n')
                    }}
                    className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left text-sm text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeSection === 'write' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Free Writing
              </h3>
              <p className="text-gray-500 text-sm">
                Let your thoughts flow freely. No judgment, no editing.
              </p>
            </div>
            <textarea
              value={journalData.freeWrite}
              onChange={(e) => update('freeWrite', e.target.value)}
              placeholder="Start writing..."
              className="w-full h-[500px] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 focus:border-amber-500 outline-none text-gray-900 dark:text-white resize-none text-lg leading-relaxed"
              autoFocus
            />
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
              <span>{journalData.freeWrite.split(/\s+/).filter(Boolean).length} words</span>
              <span>{journalData.freeWrite.length} characters</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
