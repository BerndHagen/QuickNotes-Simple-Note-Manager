import React, { useState, useRef, useEffect } from 'react'
import { Filter, Calendar, Type, FileText, Clock, ChevronDown, Check, GripVertical } from 'lucide-react'
import { useTranslation } from '../lib/useTranslation'
const SORT_OPTION_IDS = [
  { id: 'manual', labelKey: 'sort.manual', icon: GripVertical, field: 'order', order: 'asc' },
  { id: 'updated-desc', labelKey: 'sort.lastModified', icon: Clock, field: 'updatedAt', order: 'desc' },
  { id: 'updated-asc', labelKey: 'sort.oldestModified', icon: Clock, field: 'updatedAt', order: 'asc' },
  { id: 'created-desc', labelKey: 'sort.recentlyCreated', icon: Calendar, field: 'createdAt', order: 'desc' },
  { id: 'created-asc', labelKey: 'sort.oldestFirst', icon: Calendar, field: 'createdAt', order: 'asc' },
  { id: 'title-asc', labelKey: 'sort.titleAZ', icon: Type, field: 'title', order: 'asc' },
  { id: 'title-desc', labelKey: 'sort.titleZA', icon: Type, field: 'title', order: 'desc' },
  { id: 'size-desc', labelKey: 'sort.sizeDesc', icon: FileText, field: 'content', order: 'desc' },
  { id: 'size-asc', labelKey: 'sort.sizeAsc', icon: FileText, field: 'content', order: 'asc' },
]
const SORT_OPTIONS = SORT_OPTION_IDS

export default function SortDropdown({ currentSort, onSortChange }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const currentOption = SORT_OPTION_IDS.find((o) => o.id === currentSort) || SORT_OPTION_IDS[0]

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option) => {
    onSortChange(option.id)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-2 text-sm text-gray-600 transition-colors rounded-lg dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        title={`${t('sort.sortBy')}: ${t(currentOption.labelKey)}`}
        aria-label={`${t('sort.sortBy')}: ${t(currentOption.labelKey)}`}
        aria-expanded={isOpen}
      >
        <Filter className="w-4 h-4" />
        <span className="sr-only">{t(currentOption.labelKey)}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-56 py-1.5 mt-1.5 bg-white border border-[#cbd1db] rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 dark:bg-gray-900 dark:border-gray-700 backdrop-blur-xl">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 uppercase dark:text-gray-400">
              {t('sort.sortBy')}
            </p>
          </div>
          {SORT_OPTION_IDS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                currentSort === option.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <option.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{t(option.labelKey)}</span>
              {currentSort === option.id && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export function sortNotes(notes, sortOption) {
  const option = SORT_OPTIONS.find((o) => o.id === sortOption) || SORT_OPTIONS[0]
  if (option.field === 'order') {
    return [...notes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      const aOrder = a.order ?? Infinity
      const bOrder = b.order ?? Infinity
      return aOrder - bOrder
    })
  }

  return [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (a.starred && !b.starred) return -1
    if (!a.starred && b.starred) return 1

    let comparison = 0

    switch (option.field) {
      case 'title':
        comparison = a.title.localeCompare(b.title, 'de')
        break
      case 'content':
        const aLen = (a.content || '').length
        const bLen = (b.content || '').length
        comparison = aLen - bLen
        break
      case 'createdAt':
      case 'updatedAt':
        const aDate = new Date(a[option.field])
        const bDate = new Date(b[option.field])
        comparison = aDate - bDate
        break
      default:
        comparison = 0
    }

    return option.order === 'desc' ? -comparison : comparison
  })
}
