
import {
  FileText,
  CheckSquare,
  Target,
  Users,
  BookOpen,
  Lightbulb,
  ShoppingCart,
  Calendar
} from 'lucide-react'

export const NOTE_TYPES = {
  STANDARD: 'standard',
  TODO_LIST: 'todo',
  PROJECT: 'project',
  MEETING: 'meeting',
  JOURNAL: 'journal',
  BRAINSTORM: 'brainstorm',
  SHOPPING: 'shopping',
  WEEKLY: 'weekly',
}

export const NOTE_TYPE_CONFIG = {
  [NOTE_TYPES.STANDARD]: {
    id: 'standard',
    name: 'Quick Note',
    description: 'Free-form note for quick thoughts',
    icon: FileText,
    color: '#6366f1',
    gradient: 'from-indigo-500 to-purple-600',
    category: 'Basics',
    features: ['Rich text', 'Formatting', 'Images', 'Templates'],
  },
  [NOTE_TYPES.TODO_LIST]: {
    id: 'todo',
    name: 'To-Do List',
    description: 'Task management with priorities & deadlines',
    icon: CheckSquare,
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-600',
    category: 'Productivity',
    features: ['Priorities', 'Deadlines', 'Subtasks', 'Progress'],
  },
  [NOTE_TYPES.PROJECT]: {
    id: 'project',
    name: 'Project Planner',
    description: 'Project tracking with milestones & kanban board',
    icon: Target,
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    category: 'Business',
    features: ['Kanban', 'Milestones', 'Timeline', 'Team'],
  },
  [NOTE_TYPES.MEETING]: {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Structured meeting documentation',
    icon: Users,
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-600',
    category: 'Business',
    features: ['Attendees', 'Agenda', 'Action Items', 'Timer'],
  },
  [NOTE_TYPES.JOURNAL]: {
    id: 'journal',
    name: 'Daily Journal',
    description: 'Daily reflection with mood tracking',
    icon: BookOpen,
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-600',
    category: 'Personal',
    features: ['Calendar', 'Mood', 'Photos', 'Streaks'],
  },
  [NOTE_TYPES.BRAINSTORM]: {
    id: 'brainstorm',
    name: 'Brainstorming',
    description: 'Creative idea collection & evaluation',
    icon: Lightbulb,
    color: '#eab308',
    gradient: 'from-yellow-500 to-amber-600',
    category: 'Creative',
    features: ['Idea cards', 'Voting', 'Grouping', 'Export'],
  },
  [NOTE_TYPES.SHOPPING]: {
    id: 'shopping',
    name: 'Shopping List',
    description: 'Categorized shopping with budget tracking',
    icon: ShoppingCart,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-600',
    category: 'Daily Life',
    features: ['Categories', 'Quantities', 'Prices', 'Share'],
  },
  [NOTE_TYPES.WEEKLY]: {
    id: 'weekly',
    name: 'Weekly Planner',
    description: 'Week overview with goals & schedule',
    icon: Calendar,
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-teal-600',
    category: 'Productivity',
    features: ['Week view', 'Goals', 'Schedule', 'Review'],
  },
}

export const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'Sparkles' },
  { id: 'Basics', name: 'Basics', icon: 'FileText' },
  { id: 'Productivity', name: 'Productivity', icon: 'CheckSquare' },
  { id: 'Business', name: 'Business', icon: 'Briefcase' },
  { id: 'Personal', name: 'Personal', icon: 'Heart' },
  { id: 'Creative', name: 'Creative', icon: 'Lightbulb' },
  { id: 'Daily Life', name: 'Daily Life', icon: 'Home' },
]
export const getDefaultData = (noteType) => {
  switch (noteType) {
    case NOTE_TYPES.TODO_LIST:
      return {
        tasks: [],
        filter: 'all',
        sortBy: 'priority',
      }
    case NOTE_TYPES.PROJECT:
      return {
        columns: [
          { id: 'backlog', name: 'Backlog', tasks: [] },
          { id: 'todo', name: 'To Do', tasks: [] },
          { id: 'inProgress', name: 'In Progress', tasks: [] },
          { id: 'done', name: 'Done', tasks: [] },
        ],
        milestones: [],
        team: [],
      }
    case NOTE_TYPES.MEETING:
      return {
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        location: '',
        attendees: [],
        agenda: [],
        notes: '',
        actionItems: [],
        decisions: [],
      }
    case NOTE_TYPES.JOURNAL:
      return {
        date: new Date().toISOString().split('T')[0],
        mood: null,
        energy: null,
        gratitude: ['', '', ''],
        highlights: [],
        challenges: '',
        lessons: '',
        freeWrite: '',
      }
    case NOTE_TYPES.BRAINSTORM:
      return {
        topic: '',
        question: '',
        ideas: [],
        categories: [],
        selectedIdea: null,
      }
    case NOTE_TYPES.SHOPPING:
      return {
        store: '',
        budget: null,
        categories: [
          { id: 'produce', name: 'Fruits & Vegetables', icon: '\u{1F96C}', items: [] },
          { id: 'dairy', name: 'Dairy', icon: '\u{1F95B}', items: [] },
          { id: 'bakery', name: 'Bakery', icon: '\u{1F35E}', items: [] },
          { id: 'meat', name: 'Meat & Fish', icon: '\u{1F969}', items: [] },
          { id: 'pantry', name: 'Pantry', icon: '\u{1F96B}', items: [] },
          { id: 'frozen', name: 'Frozen', icon: '\u{1F9CA}', items: [] },
          { id: 'household', name: 'Household', icon: '\u{1F9F4}', items: [] },
          { id: 'other', name: 'Other', icon: '\u{1F4E6}', items: [] },
        ],
      }
    case NOTE_TYPES.WEEKLY:
      return {
        weekStart: getWeekStart(),
        goals: [],
        days: {
          monday: { tasks: [], events: [] },
          tuesday: { tasks: [], events: [] },
          wednesday: { tasks: [], events: [] },
          thursday: { tasks: [], events: [] },
          friday: { tasks: [], events: [] },
          saturday: { tasks: [], events: [] },
          sunday: { tasks: [], events: [] },
        },
        review: {
          wins: [],
          improvements: [],
          highlight: '',
        },
      }
    default:
      return null
  }
}
function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.setDate(diff)).toISOString().split('T')[0]
}
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
