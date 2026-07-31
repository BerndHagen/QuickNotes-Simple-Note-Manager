import { describe, expect, it } from 'vitest'
import {
  NOTE_TYPES,
  NOTE_TYPE_CONFIG,
  NOTE_TYPE_STARTERS,
  getDefaultData,
  getStarterContent,
  getStarterData,
  formatDateKey,
  normalizeNoteData,
  parseDateKey,
} from './noteTypes'

const specializedTypes = Object.values(NOTE_TYPES).filter(
  (type) => type !== NOTE_TYPES.STANDARD
)

describe('professional note type contracts', () => {
  it('gives every note type clear positioning, accurate features, and multiple starters', () => {
    Object.values(NOTE_TYPES).forEach((type) => {
      const config = NOTE_TYPE_CONFIG[type]
      expect(config.name).toBeTruthy()
      expect(config.description.length).toBeGreaterThan(30)
      expect(config.bestFor.length).toBeGreaterThan(30)
      expect(config.features).toHaveLength(4)
      expect(NOTE_TYPE_STARTERS[type].length).toBeGreaterThanOrEqual(4)
      expect(NOTE_TYPE_STARTERS[type].some((starter) => starter.id === 'blank')).toBe(true)
    })
  })

  it('initializes every specialized editor with the fields it actually reads', () => {
    const todo = getDefaultData(NOTE_TYPES.TODO_LIST)
    expect(todo).toMatchObject({ tasks: [], filter: 'all', sortBy: 'priority' })

    const project = getDefaultData(NOTE_TYPES.PROJECT)
    expect(project.columns.map((column) => column.id)).toEqual([
      'backlog',
      'todo',
      'inProgress',
      'done',
    ])
    expect(project).toMatchObject({ milestones: [], team: [] })

    const meeting = getDefaultData(NOTE_TYPES.MEETING)
    expect(meeting).toMatchObject({
      startTime: '',
      endTime: '',
      attendees: [],
      agenda: [],
      actionItems: [],
      decisions: [],
    })

    const journal = getDefaultData(NOTE_TYPES.JOURNAL)
    expect(journal).toMatchObject({
      weather: null,
      goals: [],
      tags: [],
      preferredSection: 'morning',
    })
    expect(journal.gratitude).toHaveLength(3)

    const brainstorm = getDefaultData(NOTE_TYPES.BRAINSTORM)
    expect(brainstorm).toMatchObject({
      ideas: [],
      viewMode: 'grid',
      sortBy: 'newest',
      selectedCategory: 'all',
    })

    const shopping = getDefaultData(NOTE_TYPES.SHOPPING)
    expect(shopping.items).toEqual([])
    expect(shopping.categories.every((category) => category.color && category.icon)).toBe(true)

    const weekly = getDefaultData(NOTE_TYPES.WEEKLY)
    expect(weekly.weeklyGoals).toEqual([])
    expect(Object.keys(weekly.days)).toHaveLength(7)
    expect(weekly.days.monday).toMatchObject({
      tasks: [],
      events: [],
      note: '',
      rating: null,
    })
    expect(weekly.review).toEqual({
      accomplishments: '',
      challenges: '',
      lessons: '',
      nextWeekFocus: '',
    })
  })

  it('builds independent, usable starter workspaces', () => {
    const first = getStarterData(NOTE_TYPES.PROJECT, 'product-launch')
    const second = getStarterData(NOTE_TYPES.PROJECT, 'product-launch')

    expect(first).not.toBe(second)
    expect(first.columns[0].tasks.length).toBeGreaterThan(0)
    expect(first.milestones.length).toBeGreaterThan(0)
    expect(first.columns[0].tasks[0].id).not.toBe(second.columns[0].tasks[0].id)

    expect(getStarterContent(NOTE_TYPES.STANDARD, 'research')).toContain(
      'Research question'
    )

    specializedTypes.forEach((type) => {
      NOTE_TYPE_STARTERS[type].forEach((starter) => {
        const data = getStarterData(type, starter.id)
        expect(data).toBeTruthy()
      })
    })
  })

  it('keeps calendar dates stable in the user’s local timezone', () => {
    const date = new Date(2026, 6, 31, 0, 30)
    expect(formatDateKey(date)).toBe('2026-07-31')

    const parsed = parseDateKey('2026-07-31')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(31)

    const weekly = getDefaultData(NOTE_TYPES.WEEKLY)
    expect(parseDateKey(weekly.weekStart).getDay()).toBe(1)
  })

  it('migrates legacy weekly, meeting, and shopping data without losing content', () => {
    const weekly = normalizeNoteData(NOTE_TYPES.WEEKLY, {
      goals: ['Finish the report'],
      days: {
        monday: {
          tasks: ['Draft the introduction'],
          events: ['Project check-in'],
        },
      },
      review: {
        wins: ['Shipped the release'],
        improvements: ['Protect focus time'],
        highlight: 'Clearer priorities',
      },
    })

    expect(weekly.weeklyGoals[0].text).toBe('Finish the report')
    expect(weekly.days.monday.tasks[0]).toMatchObject({
      text: 'Draft the introduction',
      timeBlock: 'morning',
    })
    expect(weekly.days.monday.events[0].text).toBe('Project check-in')
    expect(weekly.review.accomplishments).toBe('Shipped the release')
    expect(weekly.review.challenges).toBe('Protect focus time')
    expect(weekly.review.lessons).toBe('Clearer priorities')

    const meeting = normalizeNoteData(NOTE_TYPES.MEETING, {
      time: '09:30',
      attendees: ['Alex'],
      agenda: ['Review progress'],
      actionItems: [{ text: 'Send recap', assignee: 'Alex' }],
      decisions: ['Proceed with option B'],
    })

    expect(meeting.startTime).toBe('09:30')
    expect(meeting.attendees[0]).toMatchObject({ name: 'Alex', present: true })
    expect(meeting.agenda[0].topic).toBe('Review progress')
    expect(meeting.actionItems[0]).toMatchObject({ task: 'Send recap', owner: 'Alex' })
    expect(meeting.decisions[0].text).toBe('Proceed with option B')

    const shopping = normalizeNoteData(NOTE_TYPES.SHOPPING, {
      categories: [
        {
          id: 'produce',
          name: 'Produce',
          items: [{ id: 'legacy-item', name: 'Apples', quantity: 4 }],
        },
      ],
    })

    expect(shopping.items[0]).toMatchObject({
      id: 'legacy-item',
      name: 'Apples',
      category: 'produce',
      quantity: 4,
    })
    expect(shopping.categories[0].color).toBeTruthy()
  })
})
