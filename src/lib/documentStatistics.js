import { htmlToPlainText } from './utils'

const countMatches = (value, pattern) => (String(value || '').match(pattern) || []).length

const calculateReadingTime = (wordCount) => {
  const minutes = Math.ceil(wordCount / 200)
  if (minutes < 1) return 'Less than 1 min'
  if (minutes === 1) return '1 min read'
  return `${minutes} min read`
}
/**
 * The canonical statistics definition for rich-text documents.
 *
 * `characters` includes the single semantic spaces inserted between rendered
 * blocks. The separate `charactersWithoutSpaces` value keeps the more compact
 * count available without letting two surfaces attach different meanings to
 * the same "Characters" label.
 */
export const getDocumentStatistics = (note) => {
  if (!note) return null

  const content = String(note.content || '')
  const plainText = htmlToPlainText(content)
  const allWords = plainText ? plainText.split(/\s+/u).filter(Boolean) : []
  const words = allWords.length
  const characters = plainText.length
  const charactersWithoutSpaces = plainText.replace(/\s/gu, '').length
  const sentenceCount = plainText
    ? plainText.split(/[.!?]+/u).filter((sentence) => sentence.trim()).length
    : 0
  const paragraphCount = countMatches(content, /<p(?:\s[^>]*)?>/gi)
  const speakingMinutes = Math.ceil(words / 150)

  return {
    plainText,
    words,
    characters,
    charactersWithoutSpaces,
    sentences: sentenceCount,
    paragraphs: paragraphCount || (plainText ? 1 : 0),
    lines: plainText ? 1 : 0,
    readingTime: calculateReadingTime(words),
    speakingTime: speakingMinutes < 1 ? 'Less than 1 min' : `${speakingMinutes} min`,
    tagCount: note.tags?.length || 0,
    linkCount: countMatches(content, /<a(?:\s[^>]*)?\shref/gi),
    checklistTotal: countMatches(content, /data-type=["']taskItem["']/gi),
    checklistDone: countMatches(content, /data-checked=["']true["']/gi),
    headingCount: countMatches(content, /<h[1-6](?:\s[^>]*)?>/gi),
    codeBlockCount: countMatches(content, /<pre(?:\s[^>]*)?>/gi),
    imageCount: countMatches(content, /<img(?:\s[^>]*)?>/gi),
    avgWordLength: allWords.length
      ? (allWords.reduce((sum, word) => sum + word.length, 0) / allWords.length).toFixed(1)
      : '0',
    avgSentenceLength: sentenceCount ? Math.round(words / sentenceCount) : 0,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}
