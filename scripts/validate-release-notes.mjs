import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const releaseDirectory = path.resolve('docs/releases')
const requestedFiles = process.argv.slice(2)
const files = requestedFiles.length > 0
  ? requestedFiles.map((file) => path.resolve(file))
  : fs.readdirSync(releaseDirectory)
      .filter((file) => /^v.+\.md$/.test(file))
      .map((file) => path.join(releaseDirectory, file))

const genericHeadings = new Set([
  'new features & improvements',
  'bug fixes',
  'maintenance',
  'other changes',
])

const requiredLinks = [
  'https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/issues',
  'https://github.com/BerndHagen/QuickNotes-Simple-Note-Manager/discussions',
]

const failures = []

for (const file of files) {
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/')

  if (!fs.existsSync(file)) {
    failures.push(`${relative}: file does not exist`)
    continue
  }

  const contents = fs.readFileSync(file, 'utf8').trim()
  const lines = contents.split(/\r?\n/)
  const firstLine = lines.find((line) => line.trim())?.trim() || ''
  const headings = lines
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).trim())
  const bullets = lines.filter((line) => line.startsWith('- '))

  if (firstLine.length < 80 || /^(#|[-*>])/.test(firstLine)) {
    failures.push(`${relative}: open with a substantive narrative paragraph`)
  }

  if (headings.length < 2) {
    failures.push(`${relative}: include at least two product-area headings`)
  }

  for (const heading of headings) {
    if (genericHeadings.has(heading.toLowerCase())) {
      failures.push(`${relative}: replace generic heading "${heading}" with a product area`)
    }
  }

  if (bullets.length < 3) {
    failures.push(`${relative}: include at least three user-facing change bullets`)
  }

  for (const bullet of bullets) {
    if (!/^- \*\*[^*]+\*\*: .+/.test(bullet)) {
      failures.push(`${relative}: bullet must start with a bold outcome followed by a colon: ${bullet}`)
    }
  }

  if (/\b\d+\s+(new\s+)?feature\(s\)|\b\d+\s+bug fix\(es\)/i.test(contents)) {
    failures.push(`${relative}: remove automatic feature or bug-fix counts`)
  }

  if (new Set(bullets).size !== bullets.length) {
    failures.push(`${relative}: contains duplicate change bullets`)
  }

  for (const link of requiredLinks) {
    if (!contents.includes(link)) {
      failures.push(`${relative}: missing standard link ${link}`)
    }
  }
}

if (failures.length > 0) {
  process.stderr.write('Release-note validation failed:\n')
  failures.forEach((failure) => process.stderr.write(`- ${failure}\n`))
  process.exit(1)
}

process.stdout.write(`Validated ${files.length} curated release-note file(s).\n`)
