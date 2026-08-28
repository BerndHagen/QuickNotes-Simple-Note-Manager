import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { createKnowledgeSearchEngine } from '../src/lib/knowledge/searchEngine.js'

const count = Math.max(1, Math.min(Number(process.argv[2]) || 50_000, 100_000))
const documents = Array.from({ length: count }, (_, index) => ({
  id: `note-${index}`,
  noteId: `note-${index}`,
  title: `Project record ${index}`,
  titleNormalized: `project record ${index}`,
  headings: [],
  headingsText: index % 10 === 0 ? 'Release planning' : '',
  tags: index % 3 === 0 ? ['work'] : [],
  tagsText: index % 3 === 0 ? 'work' : '',
  folderName: index % 2 === 0 ? 'Projects' : 'Reference',
  bodyText: `Operational planning record ${index} with stable offline context`,
  objectText: '',
  resourceText: '',
  metadataText: 'document standard',
  searchableText: `Project record ${index} operational planning stable offline context`,
  noteType: 'standard',
  contentKind: 'document',
  deleted: false,
  archived: false,
  pinned: false,
  starred: false,
  shared: false,
  updatedAt: new Date(1_700_000_000_000 + index).toISOString(),
}))
documents[count - 1].title = 'Zephyr launch checklist'
documents[count - 1].titleNormalized = 'zephyr launch checklist'
documents[count - 1].searchableText += ' Zephyr launch checklist'

const buildStarted = performance.now()
const engine = createKnowledgeSearchEngine(documents)
const buildMs = performance.now() - buildStarted
const searchStarted = performance.now()
const result = engine.search('zephyr launch', { limit: 20 })
const searchMs = performance.now() - searchStarted

process.stdout.write(JSON.stringify({
  documents: count,
  buildMs: Math.round(buildMs),
  searchMs: Number(searchMs.toFixed(2)),
  topResult: result[0]?.noteId || null,
  memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
}, null, 2) + '\n')
