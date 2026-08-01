import {
  FileText,
  CheckSquare,
  Target,
  Users,
  BookOpen,
  Lightbulb,
  ShoppingCart,
  Calendar,
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

export const formatDateKey = (date = new Date()) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = safeDate.getFullYear()
  const month = String(safeDate.getMonth() + 1).padStart(2, '0')
  const day = String(safeDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return new Date()

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return new Date()
  return date
}

const today = () => formatDateKey()

const getWeekStart = () => {
  const date = new Date()
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return formatDateKey(date)
}

export const generateId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

export const normalizePositiveQuantity = (value, fallback = 1) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export const normalizeOptionalAmount = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

const task = (text, options = {}) => ({
  id: generateId(),
  text,
  completed: false,
  priority: 'none',
  dueDate: null,
  starred: false,
  subtasks: [],
  notes: '',
  createdAt: new Date().toISOString(),
  completedAt: null,
  ...options,
})

const projectTask = (title, options = {}) => ({
  id: generateId(),
  title,
  description: '',
  priority: 'medium',
  dueDate: null,
  assignee: null,
  labels: [],
  createdAt: new Date().toISOString(),
  ...options,
})

const agendaItem = (topic, duration, presenter = '') => ({
  id: generateId(),
  topic,
  duration,
  presenter,
  notes: '',
  completed: false,
  actualDuration: 0,
})

const shoppingItem = (name, category, options = {}) => ({
  id: generateId(),
  name,
  category,
  quantity: 1,
  unit: 'pcs',
  price: null,
  checked: false,
  note: '',
  createdAt: new Date().toISOString(),
  ...options,
})

export const SHOPPING_CATEGORIES = [
  { id: 'produce', name: 'Produce', icon: '🥬', color: '#22c55e' },
  { id: 'dairy', name: 'Dairy', icon: '🥛', color: '#60a5fa' },
  { id: 'meat', name: 'Meat & seafood', icon: '🥩', color: '#ef4444' },
  { id: 'bakery', name: 'Bakery', icon: '🥖', color: '#f59e0b' },
  { id: 'frozen', name: 'Frozen', icon: '🧊', color: '#06b6d4' },
  { id: 'beverages', name: 'Beverages', icon: '🥤', color: '#8b5cf6' },
  { id: 'snacks', name: 'Snacks', icon: '🍿', color: '#ec4899' },
  { id: 'household', name: 'Household', icon: '🏠', color: '#64748b' },
  { id: 'personal', name: 'Personal care', icon: '🧴', color: '#10b981' },
  { id: 'other', name: 'Other', icon: '📦', color: '#94a3b8' },
]

const emptyDays = () =>
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .reduce((days, day) => {
      days[day] = { tasks: [], events: [], note: '', rating: null }
      return days
    }, {})

const baseData = {
  [NOTE_TYPES.TODO_LIST]: () => ({
    tasks: [],
    filter: 'all',
    sortBy: 'priority',
  }),
  [NOTE_TYPES.PROJECT]: () => ({
    columns: [
      { id: 'backlog', name: 'Backlog', tasks: [] },
      { id: 'todo', name: 'To do', tasks: [] },
      { id: 'inProgress', name: 'In progress', tasks: [] },
      { id: 'done', name: 'Done', tasks: [] },
    ],
    milestones: [],
    team: [],
  }),
  [NOTE_TYPES.MEETING]: () => ({
    date: today(),
    startTime: '',
    endTime: '',
    location: '',
    attendees: [],
    agenda: [],
    notes: '',
    actionItems: [],
    decisions: [],
  }),
  [NOTE_TYPES.JOURNAL]: () => ({
    date: today(),
    mood: null,
    energy: null,
    weather: null,
    gratitude: ['', '', ''],
    highlights: [],
    challenges: '',
    lessons: '',
    goals: [],
    freeWrite: '',
    tags: [],
    preferredSection: 'morning',
  }),
  [NOTE_TYPES.BRAINSTORM]: () => ({
    topic: '',
    ideas: [],
    categories: [
      { id: 'uncategorized', name: 'Uncategorized', color: '#64748b' },
      { id: 'feature', name: 'Feature', color: '#3b82f6' },
      { id: 'improvement', name: 'Improvement', color: '#10b981' },
      { id: 'design', name: 'Design', color: '#ec4899' },
      { id: 'research', name: 'Research', color: '#8b5cf6' },
      { id: 'marketing', name: 'Marketing', color: '#f59e0b' },
    ],
    viewMode: 'grid',
    sortBy: 'newest',
    selectedCategory: 'all',
  }),
  [NOTE_TYPES.SHOPPING]: () => ({
    items: [],
    categories: SHOPPING_CATEGORIES.map((category) => ({ ...category })),
    budget: null,
    currency: 'EUR',
    showPrices: true,
  }),
  [NOTE_TYPES.WEEKLY]: () => ({
    weekStart: getWeekStart(),
    weeklyGoals: [],
    days: emptyDays(),
    review: {
      accomplishments: '',
      challenges: '',
      lessons: '',
      nextWeekFocus: '',
    },
    preferredView: 'week',
  }),
}

export const NOTE_TYPE_CONFIG = {
  [NOTE_TYPES.STANDARD]: {
    id: NOTE_TYPES.STANDARD,
    name: 'Document',
    shortName: 'Document',
    description: 'A flexible rich-text canvas for writing, research, and reference.',
    bestFor: 'Notes, documentation, study material, and long-form writing',
    icon: FileText,
    color: '#168966',
    category: 'Writing',
    features: ['Rich text', 'Tables & tasks', 'Media & links', 'Focus tools'],
    keywords: ['note', 'document', 'writing', 'research', 'study'],
  },
  [NOTE_TYPES.TODO_LIST]: {
    id: NOTE_TYPES.TODO_LIST,
    name: 'Task List',
    shortName: 'Tasks',
    description: 'A focused task manager with the context needed to finish work.',
    bestFor: 'Personal backlogs, checklists, routines, and delivery plans',
    icon: CheckSquare,
    color: '#168966',
    category: 'Planning',
    features: ['Priorities', 'Due dates', 'Subtasks', 'Progress & filters'],
    keywords: ['todo', 'checklist', 'tasks', 'deadline', 'routine'],
  },
  [NOTE_TYPES.PROJECT]: {
    id: NOTE_TYPES.PROJECT,
    name: 'Project Board',
    shortName: 'Project',
    description: 'Plan delivery on a practical board with milestones and ownership.',
    bestFor: 'Product launches, client work, sprints, and multi-step initiatives',
    icon: Target,
    color: '#6d5bd0',
    category: 'Work',
    features: ['Kanban board', 'Milestones', 'Assignees', 'Task details'],
    keywords: ['kanban', 'project', 'sprint', 'milestone', 'team'],
  },
  [NOTE_TYPES.MEETING]: {
    id: NOTE_TYPES.MEETING,
    name: 'Meeting Workspace',
    shortName: 'Meeting',
    description: 'Prepare the agenda, capture outcomes, and assign follow-up work.',
    bestFor: 'Team syncs, 1:1s, workshops, interviews, and decision reviews',
    icon: Users,
    color: '#3978c5',
    category: 'Work',
    features: ['Agenda & timer', 'Attendees', 'Decisions', 'Action owners'],
    keywords: ['meeting', 'agenda', 'minutes', 'decision', 'one on one'],
  },
  [NOTE_TYPES.JOURNAL]: {
    id: NOTE_TYPES.JOURNAL,
    name: 'Daily Journal',
    shortName: 'Journal',
    description: 'A guided daily reflection that adapts from morning to evening.',
    bestFor: 'Mood check-ins, gratitude, reflection, goals, and free writing',
    icon: BookOpen,
    color: '#b7791f',
    category: 'Personal',
    features: ['Mood & energy', 'Daily goals', 'Gratitude', 'Guided reflection'],
    keywords: ['journal', 'diary', 'mood', 'gratitude', 'reflection'],
  },
  [NOTE_TYPES.BRAINSTORM]: {
    id: NOTE_TYPES.BRAINSTORM,
    name: 'Idea Board',
    shortName: 'Ideas',
    description: 'Capture ideas quickly, then group, evaluate, and develop them.',
    bestFor: 'Problem solving, product discovery, campaigns, and workshops',
    icon: Lightbulb,
    color: '#c58a12',
    category: 'Creative',
    features: ['Rapid capture', 'Categories', 'Voting & starring', 'Idea notes'],
    keywords: ['brainstorm', 'ideas', 'creative', 'vote', 'discovery'],
  },
  [NOTE_TYPES.SHOPPING]: {
    id: NOTE_TYPES.SHOPPING,
    name: 'Shopping List',
    shortName: 'Shopping',
    description: 'A practical list organized by aisle, quantity, price, and budget.',
    bestFor: 'Groceries, household restocks, event supplies, and errands',
    icon: ShoppingCart,
    color: '#c04476',
    category: 'Personal',
    features: ['Smart categories', 'Units & quantities', 'Prices', 'Budget tracking'],
    keywords: ['shopping', 'groceries', 'budget', 'errands', 'supplies'],
  },
  [NOTE_TYPES.WEEKLY]: {
    id: NOTE_TYPES.WEEKLY,
    name: 'Weekly Planner',
    shortName: 'Week',
    description: 'Turn weekly priorities into a realistic day-by-day plan.',
    bestFor: 'Work weeks, study plans, balanced schedules, and weekly reviews',
    icon: Calendar,
    color: '#147d86',
    category: 'Planning',
    features: ['Week overview', 'Goals', 'Events & time blocks', 'Weekly review'],
    keywords: ['week', 'planner', 'schedule', 'goals', 'review'],
  },
}

export const CATEGORIES = [
  { id: 'all', name: 'All types' },
  { id: 'Writing', name: 'Writing' },
  { id: 'Planning', name: 'Planning' },
  { id: 'Work', name: 'Work' },
  { id: 'Personal', name: 'Personal' },
  { id: 'Creative', name: 'Creative' },
]

export const NOTE_TYPE_STARTERS = {
  [NOTE_TYPES.STANDARD]: [
    {
      id: 'blank',
      name: 'Blank document',
      description: 'Start with a clean, distraction-free writing canvas.',
      title: 'Untitled document',
      content: '',
    },
    {
      id: 'structured',
      name: 'Structured document',
      description: 'A clear brief with purpose, context, decisions, and next steps.',
      title: 'New document',
      content: '<h2>Purpose</h2><p>What should this document achieve?</p><h2>Context</h2><p>Add the essential background.</p><h2>Key points</h2><ul><li>First important point</li></ul><h2>Decisions & next steps</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Capture the first next step</p></li></ul>',
    },
    {
      id: 'research',
      name: 'Research notes',
      description: 'Organize a question, sources, evidence, and conclusions.',
      title: 'Research notes',
      content: '<h2>Research question</h2><p>What are you trying to understand?</p><h2>Sources</h2><ul><li>Add a source and the reason it matters</li></ul><h2>Evidence & observations</h2><p>Record findings in your own words.</p><h2>Conclusion</h2><p>Summarize the strongest answer and remaining uncertainty.</p>',
    },
    {
      id: 'learning',
      name: 'Learning notes',
      description: 'Turn a course, book, or talk into durable understanding.',
      title: 'Learning notes',
      content: '<h2>Big idea</h2><p>Explain the central concept simply.</p><h2>Key concepts</h2><ul><li>Concept and explanation</li></ul><h2>Questions</h2><ul><li>What is still unclear?</li></ul><h2>Apply it</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Try the concept in practice</p></li></ul>',
    },
  ],
  [NOTE_TYPES.TODO_LIST]: [
    {
      id: 'blank',
      name: 'Clean task list',
      description: 'An empty prioritized backlog with filters and progress.',
      title: 'Task list',
    },
    {
      id: 'daily-priorities',
      name: 'Daily priorities',
      description: 'A focused plan for must-do work and smaller follow-ups.',
      title: 'Today’s priorities',
      data: () => ({
        ...baseData[NOTE_TYPES.TODO_LIST](),
        tasks: [
          task('Complete the most important outcome', { priority: 'high', starred: true }),
          task('Handle one meaningful follow-up', { priority: 'medium' }),
          task('Close the day with a five-minute review', { priority: 'low' }),
        ],
      }),
    },
    {
      id: 'launch-checklist',
      name: 'Launch checklist',
      description: 'Prepare, validate, publish, and monitor a release.',
      title: 'Launch checklist',
      data: () => ({
        ...baseData[NOTE_TYPES.TODO_LIST](),
        tasks: [
          task('Confirm scope and success criteria', { priority: 'high' }),
          task('Complete quality and accessibility checks', { priority: 'high' }),
          task('Prepare release notes and communication', { priority: 'medium' }),
          task('Publish and monitor the rollout', { priority: 'medium' }),
          task('Capture follow-up improvements', { priority: 'low' }),
        ],
      }),
    },
    {
      id: 'weekly-reset',
      name: 'Weekly reset',
      description: 'Review open loops and prepare the week with less clutter.',
      title: 'Weekly reset',
      data: () => ({
        ...baseData[NOTE_TYPES.TODO_LIST](),
        tasks: [
          task('Review unfinished tasks and commitments', { priority: 'high' }),
          task('Choose the week’s three outcomes', { priority: 'high' }),
          task('Clear inboxes and loose notes', { priority: 'medium' }),
          task('Schedule time for important work', { priority: 'medium' }),
        ],
      }),
    },
  ],
  [NOTE_TYPES.PROJECT]: [
    {
      id: 'blank',
      name: 'Blank project board',
      description: 'Start with a clean backlog-to-done workflow.',
      title: 'New project',
    },
    {
      id: 'product-launch',
      name: 'Product launch',
      description: 'Shape the release, prepare go-to-market work, and track launch.',
      title: 'Product launch',
      data: () => {
        const data = baseData[NOTE_TYPES.PROJECT]()
        data.columns[0].tasks = [
          projectTask('Define launch goal and audience', { priority: 'high' }),
          projectTask('Draft launch story and release notes'),
        ]
        data.columns[1].tasks = [
          projectTask('Complete launch-readiness review', { priority: 'high' }),
        ]
        data.milestones = [
          { id: generateId(), name: 'Launch-ready build', dueDate: '', completed: false, createdAt: new Date().toISOString() },
          { id: generateId(), name: 'Public release', dueDate: '', completed: false, createdAt: new Date().toISOString() },
        ]
        return data
      },
    },
    {
      id: 'software-sprint',
      name: 'Software sprint',
      description: 'Prioritize a small increment and move it through delivery.',
      title: 'Sprint board',
      data: () => {
        const data = baseData[NOTE_TYPES.PROJECT]()
        data.columns[0].tasks = [
          projectTask('Clarify acceptance criteria', { priority: 'high' }),
          projectTask('Identify dependencies and risks', { priority: 'medium' }),
        ]
        data.columns[1].tasks = [
          projectTask('Implement the highest-value increment', { priority: 'high' }),
          projectTask('Add regression coverage', { priority: 'medium' }),
        ]
        data.milestones = [
          { id: generateId(), name: 'Sprint review', dueDate: '', completed: false, createdAt: new Date().toISOString() },
        ]
        return data
      },
    },
    {
      id: 'client-delivery',
      name: 'Client delivery',
      description: 'Coordinate discovery, review, delivery, and handover.',
      title: 'Client delivery',
      data: () => {
        const data = baseData[NOTE_TYPES.PROJECT]()
        data.columns[0].tasks = [
          projectTask('Confirm requirements and constraints', { priority: 'high' }),
          projectTask('Document open questions', { priority: 'medium' }),
        ]
        data.columns[1].tasks = [
          projectTask('Prepare the first reviewable delivery', { priority: 'high' }),
        ]
        data.milestones = [
          { id: generateId(), name: 'Client review', dueDate: '', completed: false, createdAt: new Date().toISOString() },
          { id: generateId(), name: 'Final handover', dueDate: '', completed: false, createdAt: new Date().toISOString() },
        ]
        return data
      },
    },
  ],
  [NOTE_TYPES.MEETING]: [
    {
      id: 'blank',
      name: 'Blank meeting',
      description: 'Build an agenda and capture outcomes from scratch.',
      title: 'Meeting notes',
    },
    {
      id: 'team-sync',
      name: 'Team sync',
      description: 'Share progress, surface blockers, and agree on next steps.',
      title: 'Team sync',
      data: () => ({
        ...baseData[NOTE_TYPES.MEETING](),
        agenda: [
          agendaItem('Progress and wins', 10),
          agendaItem('Blockers and decisions needed', 15),
          agendaItem('Priorities and owners', 10),
        ],
      }),
    },
    {
      id: 'one-to-one',
      name: 'One-to-one',
      description: 'Create space for check-in, feedback, growth, and support.',
      title: '1:1 meeting',
      data: () => ({
        ...baseData[NOTE_TYPES.MEETING](),
        agenda: [
          agendaItem('Personal check-in', 10),
          agendaItem('Current priorities and support', 15),
          agendaItem('Feedback and growth', 15),
          agendaItem('Commitments before next time', 5),
        ],
      }),
    },
    {
      id: 'decision-review',
      name: 'Decision review',
      description: 'Frame a decision, compare options, and record the outcome.',
      title: 'Decision review',
      data: () => ({
        ...baseData[NOTE_TYPES.MEETING](),
        agenda: [
          agendaItem('Decision and constraints', 10),
          agendaItem('Options and evidence', 20),
          agendaItem('Risks and objections', 10),
          agendaItem('Decision, owner, and follow-up', 10),
        ],
      }),
    },
    {
      id: 'workshop',
      name: 'Workshop',
      description: 'Set context, run activities, synthesize, and commit.',
      title: 'Workshop notes',
      data: () => ({
        ...baseData[NOTE_TYPES.MEETING](),
        agenda: [
          agendaItem('Welcome, objective, and working agreement', 10),
          agendaItem('Individual thinking', 15),
          agendaItem('Group activity', 30),
          agendaItem('Synthesis and next steps', 20),
        ],
      }),
    },
  ],
  [NOTE_TYPES.JOURNAL]: [
    {
      id: 'blank',
      name: 'Full daily reflection',
      description: 'Check in, notice the day, reflect, and free-write.',
      title: 'Daily journal',
      data: () => baseData[NOTE_TYPES.JOURNAL](),
    },
    {
      id: 'morning-reset',
      name: 'Morning clarity',
      description: 'Name your state and choose a small set of meaningful goals.',
      title: 'Morning journal',
      data: () => ({ ...baseData[NOTE_TYPES.JOURNAL](), preferredSection: 'morning', tags: ['morning'] }),
    },
    {
      id: 'evening-review',
      name: 'Evening review',
      description: 'Capture gratitude, lessons, challenges, and what mattered.',
      title: 'Evening reflection',
      data: () => ({ ...baseData[NOTE_TYPES.JOURNAL](), preferredSection: 'evening', tags: ['reflection'] }),
    },
    {
      id: 'wellbeing',
      name: 'Wellbeing check-in',
      description: 'Track mood and energy, then write without judgment.',
      title: 'Wellbeing check-in',
      data: () => ({ ...baseData[NOTE_TYPES.JOURNAL](), preferredSection: 'write', tags: ['wellbeing'] }),
    },
  ],
  [NOTE_TYPES.BRAINSTORM]: [
    {
      id: 'blank',
      name: 'Open idea board',
      description: 'Capture freely, then organize the strongest directions.',
      title: 'Idea board',
    },
    {
      id: 'problem-solving',
      name: 'Problem solving',
      description: 'Explore causes, approaches, experiments, and constraints.',
      title: 'Problem-solving session',
      data: () => ({
        ...baseData[NOTE_TYPES.BRAINSTORM](),
        categories: [
          { id: 'uncategorized', name: 'Uncategorized', color: '#64748b' },
          { id: 'cause', name: 'Possible cause', color: '#ef4444' },
          { id: 'solution', name: 'Solution', color: '#10b981' },
          { id: 'experiment', name: 'Experiment', color: '#3b82f6' },
          { id: 'constraint', name: 'Constraint', color: '#f59e0b' },
        ],
      }),
    },
    {
      id: 'product-discovery',
      name: 'Product discovery',
      description: 'Collect user needs, opportunities, solutions, and questions.',
      title: 'Product discovery',
      data: () => ({
        ...baseData[NOTE_TYPES.BRAINSTORM](),
        categories: [
          { id: 'uncategorized', name: 'Uncategorized', color: '#64748b' },
          { id: 'need', name: 'User need', color: '#ef4444' },
          { id: 'opportunity', name: 'Opportunity', color: '#8b5cf6' },
          { id: 'solution', name: 'Solution', color: '#10b981' },
          { id: 'question', name: 'Open question', color: '#3b82f6' },
        ],
      }),
    },
    {
      id: 'campaign',
      name: 'Campaign concepts',
      description: 'Develop messages, channels, creative ideas, and experiments.',
      title: 'Campaign concepts',
      data: () => ({
        ...baseData[NOTE_TYPES.BRAINSTORM](),
        categories: [
          { id: 'uncategorized', name: 'Uncategorized', color: '#64748b' },
          { id: 'message', name: 'Message', color: '#8b5cf6' },
          { id: 'creative', name: 'Creative', color: '#ec4899' },
          { id: 'channel', name: 'Channel', color: '#3b82f6' },
          { id: 'experiment', name: 'Experiment', color: '#10b981' },
        ],
      }),
    },
  ],
  [NOTE_TYPES.SHOPPING]: [
    {
      id: 'blank',
      name: 'Blank shopping list',
      description: 'Start with smart categories, quantities, and optional prices.',
      title: 'Shopping list',
    },
    {
      id: 'groceries',
      name: 'Weekly groceries',
      description: 'A practical grocery starter organized around everyday staples.',
      title: 'Weekly groceries',
      data: () => ({
        ...baseData[NOTE_TYPES.SHOPPING](),
        items: [
          shoppingItem('Fresh fruit', 'produce'),
          shoppingItem('Fresh vegetables', 'produce'),
          shoppingItem('Milk or alternative', 'dairy'),
          shoppingItem('Bread', 'bakery'),
          shoppingItem('Protein for main meals', 'meat'),
        ],
      }),
    },
    {
      id: 'household',
      name: 'Household restock',
      description: 'Review cleaning, paper goods, pantry, and personal essentials.',
      title: 'Household restock',
      data: () => ({
        ...baseData[NOTE_TYPES.SHOPPING](),
        items: [
          shoppingItem('Cleaning supplies', 'household'),
          shoppingItem('Paper goods', 'household'),
          shoppingItem('Laundry supplies', 'household'),
          shoppingItem('Personal-care essentials', 'personal'),
        ],
      }),
    },
    {
      id: 'event',
      name: 'Event supplies',
      description: 'Plan food, drinks, serving supplies, and final essentials.',
      title: 'Event supplies',
      data: () => ({
        ...baseData[NOTE_TYPES.SHOPPING](),
        items: [
          shoppingItem('Food and snacks', 'snacks'),
          shoppingItem('Drinks', 'beverages'),
          shoppingItem('Serving supplies', 'household'),
          shoppingItem('Last-minute essentials', 'other'),
        ],
      }),
    },
  ],
  [NOTE_TYPES.WEEKLY]: [
    {
      id: 'blank',
      name: 'Blank week',
      description: 'Start with an empty week, goals, and review.',
      title: 'Weekly plan',
    },
    {
      id: 'balanced',
      name: 'Balanced week',
      description: 'Plan work, personal priorities, and recovery together.',
      title: 'Balanced weekly plan',
      data: () => {
        const data = baseData[NOTE_TYPES.WEEKLY]()
        data.weeklyGoals = [
          { id: generateId(), text: 'Complete one meaningful work outcome', completed: false, priority: true },
          { id: generateId(), text: 'Protect time for health or recovery', completed: false, priority: true },
          { id: generateId(), text: 'Make time for an important relationship', completed: false, priority: false },
        ]
        return data
      },
    },
    {
      id: 'work-sprint',
      name: 'Focused work week',
      description: 'Anchor the week around outcomes, deep work, and review.',
      title: 'Focused work week',
      data: () => {
        const data = baseData[NOTE_TYPES.WEEKLY]()
        data.weeklyGoals = [
          { id: generateId(), text: 'Deliver the week’s primary outcome', completed: false, priority: true },
          { id: generateId(), text: 'Resolve the most important blocker', completed: false, priority: true },
          { id: generateId(), text: 'Review progress and prepare next steps', completed: false, priority: false },
        ]
        return data
      },
    },
    {
      id: 'study',
      name: 'Study week',
      description: 'Balance learning goals, practice blocks, and consolidation.',
      title: 'Study week',
      data: () => {
        const data = baseData[NOTE_TYPES.WEEKLY]()
        data.weeklyGoals = [
          { id: generateId(), text: 'Define the concepts to understand', completed: false, priority: true },
          { id: generateId(), text: 'Complete focused practice sessions', completed: false, priority: true },
          { id: generateId(), text: 'Summarize learning and open questions', completed: false, priority: false },
        ]
        return data
      },
    },
  ],
}

export const getDefaultData = (noteType) =>
  baseData[noteType]?.() || null

const asRecord = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const asList = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' || (item && typeof item === 'object'))
    : []

const allowedValue = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback

/**
 * Bring notes created by older QuickNotes releases onto the current
 * editor contract without discarding user fields. Several historical
 * defaults used different names than their editors (`goals` vs
 * `weeklyGoals`, `time` vs `startTime`, and nested shopping items).
 */
export const normalizeNoteData = (noteType, value) => {
  const data = asRecord(value)
  const defaults = getDefaultData(noteType)
  if (!defaults) return value || null

  switch (noteType) {
    case NOTE_TYPES.TODO_LIST:
      return {
        ...defaults,
        ...data,
        tasks: asList(data.tasks).map((item) => {
          const taskData = typeof item === 'string' ? { text: item } : item
          return {
            ...task(taskData.text || taskData.title || 'Untitled task'),
            ...taskData,
            text: String(taskData.text || taskData.title || 'Untitled task'),
            priority: allowedValue(taskData.priority, ['high', 'medium', 'low', 'none'], 'none'),
            completed: !!taskData.completed,
            subtasks: asList(taskData.subtasks).map((subtask) => {
              const subtaskData = typeof subtask === 'string' ? { text: subtask } : subtask
              return {
                ...subtaskData,
                id: subtaskData.id || generateId(),
                text: String(subtaskData.text || subtaskData.title || 'Subtask'),
                completed: !!subtaskData.completed,
              }
            }),
          }
        }),
        filter: allowedValue(data.filter, ['all', 'active', 'completed', 'today', 'overdue', 'starred'], 'all'),
        sortBy: allowedValue(data.sortBy, ['priority', 'dueDate', 'created', 'alphabetical'], 'priority'),
      }

    case NOTE_TYPES.PROJECT: {
      const sourceColumns = asList(data.columns).filter((column) => typeof column === 'object')
      return {
        ...defaults,
        ...data,
        columns: (sourceColumns.length ? sourceColumns : defaults.columns).map((column) => ({
          ...column,
          tasks: asList(column.tasks).map((item) => {
            const taskData = typeof item === 'string' ? { title: item } : item
            return {
              ...projectTask(taskData.title || taskData.text || 'Untitled task'),
              ...taskData,
              title: String(taskData.title || taskData.text || 'Untitled task'),
              priority: allowedValue(taskData.priority, ['high', 'medium', 'low'], 'medium'),
            }
          }),
        })),
        milestones: asList(data.milestones).map((milestone) =>
          typeof milestone === 'string'
            ? {
                id: generateId(),
                name: milestone,
                dueDate: null,
                completed: false,
                createdAt: new Date().toISOString(),
              }
            : {
                id: milestone.id || generateId(),
                name: milestone.name || milestone.title || milestone.text || 'Milestone',
                dueDate: milestone.dueDate || milestone.date || null,
                completed: !!milestone.completed,
                createdAt: milestone.createdAt || new Date().toISOString(),
              }
        ),
        team: asList(data.team).map((member) =>
          typeof member === 'string'
            ? { id: generateId(), name: member, role: '', avatar: member.charAt(0).toUpperCase() }
            : {
                ...member,
                id: member.id || generateId(),
                name: member.name || 'Team member',
                role: member.role || '',
                avatar: member.avatar || (member.name || '?').charAt(0).toUpperCase(),
              }
        ),
      }
    }

    case NOTE_TYPES.MEETING:
      return {
        ...defaults,
        ...data,
        startTime: data.startTime || data.time || '',
        endTime: data.endTime || '',
        notes: typeof data.notes === 'string' ? data.notes : '',
        attendees: asList(data.attendees).map((attendee) =>
          typeof attendee === 'string'
            ? { id: generateId(), name: attendee, present: true, role: '' }
            : {
                ...attendee,
                id: attendee.id || generateId(),
                name: attendee.name || attendee.email || 'Attendee',
                present: attendee.present !== false,
                role: attendee.role || '',
              }
        ),
        agenda: asList(data.agenda).map((item) =>
          typeof item === 'string'
            ? agendaItem(item, 10)
            : {
                ...agendaItem(
                  item.topic || item.text || item.title || 'Agenda item',
                  normalizePositiveQuantity(item.duration, 10)
                ),
                ...item,
                duration: normalizePositiveQuantity(item.duration, 10),
                actualDuration: normalizeOptionalAmount(item.actualDuration) ?? 0,
              }
        ),
        actionItems: asList(data.actionItems).map((item) =>
          typeof item === 'string'
            ? { id: generateId(), task: item, owner: '', dueDate: '', completed: false }
            : {
                id: item.id || generateId(),
                task: item.task || item.text || item.title || 'Action item',
                owner: item.owner || item.assignee || '',
                dueDate: item.dueDate || '',
                completed: !!item.completed,
              }
        ),
        decisions: asList(data.decisions).map((decision) =>
          typeof decision === 'string'
            ? { id: generateId(), text: decision, timestamp: new Date().toISOString() }
            : {
                ...decision,
                id: decision.id || generateId(),
                text: decision.text || decision.title || 'Decision',
                timestamp: decision.timestamp || new Date().toISOString(),
              }
        ),
      }

    case NOTE_TYPES.JOURNAL: {
      const gratitude = asList(data.gratitude).map((item) =>
        typeof item === 'string' ? item : String(item.text || '')
      )
      while (gratitude.length < 3) gratitude.push('')
      return {
        ...defaults,
        ...data,
        mood: [1, 2, 3, 4, 5].includes(data.mood) ? data.mood : null,
        energy: [1, 2, 3, 4, 5].includes(data.energy) ? data.energy : null,
        weather: allowedValue(data.weather, ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy'], null),
        preferredSection: allowedValue(
          data.preferredSection,
          ['morning', 'day', 'evening', 'reflect', 'write'],
          'morning'
        ),
        challenges: typeof data.challenges === 'string' ? data.challenges : '',
        lessons: typeof data.lessons === 'string' ? data.lessons : '',
        freeWrite: typeof data.freeWrite === 'string' ? data.freeWrite : '',
        gratitude: gratitude.slice(0, 3),
        highlights: asList(data.highlights).map((highlight) =>
          typeof highlight === 'string'
            ? { id: generateId(), text: highlight, timestamp: new Date().toISOString() }
            : {
                ...highlight,
                id: highlight.id || generateId(),
                text: highlight.text || highlight.title || 'Highlight',
                timestamp: highlight.timestamp || new Date().toISOString(),
              }
        ),
        goals: asList(data.goals).map((goal) =>
          typeof goal === 'string'
            ? { id: generateId(), text: goal, completed: false }
            : {
                ...goal,
                id: goal.id || generateId(),
                text: goal.text || goal.title || 'Daily goal',
                completed: !!goal.completed,
              }
        ),
        tags: asList(data.tags).filter((tag) => typeof tag === 'string'),
      }
    }

    case NOTE_TYPES.BRAINSTORM: {
      const categories = asList(data.categories).filter((category) => typeof category === 'object')
      const safeCategories = (categories.length ? categories : defaults.categories).map(
        (category, index) => ({
          ...category,
          id: category.id || `category-${index + 1}`,
          name: category.name || `Category ${index + 1}`,
          color: category.color || '#64748b',
        })
      )
      const categoryIds = new Set(safeCategories.map((category) => category.id))
      const fallbackCategory = categoryIds.has('uncategorized')
        ? 'uncategorized'
        : safeCategories[0]?.id
      return {
        ...defaults,
        ...data,
        ideas: asList(data.ideas).map((idea) =>
          typeof idea === 'string'
            ? {
                id: generateId(),
                text: idea,
                category: fallbackCategory,
                votes: 0,
                starred: false,
                notes: '',
                createdAt: new Date().toISOString(),
              }
            : {
                id: idea.id || generateId(),
                text: idea.text || idea.title || 'Untitled idea',
                category: categoryIds.has(idea.category) ? idea.category : fallbackCategory,
                votes: Number.isFinite(Number(idea.votes)) ? Number(idea.votes) : 0,
                starred: !!idea.starred,
                notes: idea.notes || idea.description || '',
                createdAt: idea.createdAt || new Date().toISOString(),
              }
        ),
        categories: safeCategories,
        topic: typeof data.topic === 'string' ? data.topic : '',
        viewMode: allowedValue(data.viewMode, ['grid', 'list'], 'grid'),
        sortBy: allowedValue(data.sortBy, ['newest', 'oldest', 'votes', 'starred'], 'newest'),
        selectedCategory: data.selectedCategory === 'all' || categoryIds.has(data.selectedCategory)
          ? data.selectedCategory
          : 'all',
      }
    }

    case NOTE_TYPES.SHOPPING: {
      const sourceCategories = asList(data.categories).filter((category) => typeof category === 'object')
      const legacyItems = sourceCategories.flatMap((category) =>
        asList(category.items)
          .filter((item) => typeof item === 'object')
          .map((item) => ({ ...item, category: item.category || category.id }))
      )
      const directItems = asList(data.items).filter((item) => typeof item === 'object')
      const sourceItems = directItems.length ? directItems : legacyItems
      const categories = (sourceCategories.length ? sourceCategories : defaults.categories).map((category, index) => {
        const known = SHOPPING_CATEGORIES.find((item) => item.id === category.id)
        return {
          ...known,
          ...category,
          id: category.id || `category-${index + 1}`,
          name: category.name || `Category ${index + 1}`,
          icon: category.icon || '📦',
          color: category.color || '#64748b',
          items: undefined,
        }
      })
      const categoryIds = new Set(categories.map((category) => category.id))
      const fallbackCategory = categoryIds.has('other') ? 'other' : categories[0]?.id
      return {
        ...defaults,
        ...data,
        items: sourceItems.map((item) => ({
          ...shoppingItem(item.name || item.text || 'Untitled item', item.category || 'other'),
          ...item,
          quantity: normalizePositiveQuantity(item.quantity),
          price: normalizeOptionalAmount(item.price),
          category: categoryIds.has(item.category) ? item.category : fallbackCategory,
          checked: !!item.checked,
        })),
        categories,
        budget: normalizeOptionalAmount(data.budget),
        currency: allowedValue(data.currency, ['USD', 'EUR', 'GBP', 'JPY'], defaults.currency),
        showPrices: data.showPrices !== false,
      }
    }

    case NOTE_TYPES.WEEKLY: {
      const days = emptyDays()
      Object.keys(days).forEach((day) => {
        const sourceDay = asRecord(asRecord(data.days)[day])
        days[day] = {
          ...days[day],
          ...sourceDay,
          tasks: asList(sourceDay.tasks).map((item) =>
            typeof item === 'string'
              ? {
                  id: generateId(),
                  text: item,
                  timeBlock: 'morning',
                  completed: false,
                }
              : {
                  ...item,
                  id: item.id || generateId(),
                  text: item.text || item.title || 'Task',
                  timeBlock: allowedValue(item.timeBlock, ['morning', 'afternoon', 'evening'], 'morning'),
                  completed: !!item.completed,
                }
          ),
          events: asList(sourceDay.events).map((item) =>
            typeof item === 'string'
              ? { id: generateId(), text: item, time: '' }
              : {
                  ...item,
                  id: item.id || generateId(),
                  text: item.text || item.title || 'Event',
                  time: item.time || '',
                }
          ),
        }
      })
      const review = asRecord(data.review)
      const legacyWins = asList(review.wins)
        .map((item) => typeof item === 'string' ? item : item.text)
        .filter(Boolean)
        .join('\n')
      const legacyImprovements = asList(review.improvements)
        .map((item) => typeof item === 'string' ? item : item.text)
        .filter(Boolean)
        .join('\n')
      const sourceGoals = asList(data.weeklyGoals).length
        ? asList(data.weeklyGoals)
        : asList(data.goals)
      const weeklyGoals = sourceGoals.map((goal) =>
        typeof goal === 'string'
          ? { id: generateId(), text: goal, completed: false, priority: false }
          : {
              ...goal,
              id: goal.id || generateId(),
              text: goal.text || goal.title || 'Weekly goal',
              completed: !!goal.completed,
              priority: !!goal.priority,
            }
      )

      return {
        ...defaults,
        ...data,
        weeklyGoals,
        days,
        preferredView: allowedValue(data.preferredView, ['week', 'goals', 'review'], 'week'),
        review: {
          ...defaults.review,
          ...review,
          accomplishments: review.accomplishments || legacyWins,
          challenges: review.challenges || legacyImprovements,
          lessons: review.lessons || review.highlight || '',
          nextWeekFocus: review.nextWeekFocus || '',
        },
      }
    }

    default:
      return { ...defaults, ...data }
  }
}

export const getStarterData = (noteType, starterId = 'blank') => {
  const starters = NOTE_TYPE_STARTERS[noteType] || []
  const starter = starters.find((item) => item.id === starterId) || starters[0]

  if (!starter || noteType === NOTE_TYPES.STANDARD) return null
  return starter.data?.() || getDefaultData(noteType)
}

export const getStarterContent = (noteType, starterId = 'blank') => {
  const starters = NOTE_TYPE_STARTERS[noteType] || []
  const starter = starters.find((item) => item.id === starterId) || starters[0]
  return starter?.content || ''
}
