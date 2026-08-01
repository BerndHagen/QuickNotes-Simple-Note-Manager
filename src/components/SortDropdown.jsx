import { useRef, useState } from 'react'
import { Filter, Calendar, Type, FileText, Clock, Check, GripVertical } from 'lucide-react'
import { useTranslation } from '../lib/useTranslation'
import { IconButton, Menu, MenuItem, MenuLabel } from './ui'
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
  const triggerRef = useRef(null)

  const currentOption = SORT_OPTION_IDS.find((o) => o.id === currentSort) || SORT_OPTION_IDS[0]

  const handleSelect = (option) => {
    onSortChange(option.id)
    setIsOpen(false)
  }

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon={Filter}
        label={`${t('sort.sortBy')}: ${t(currentOption.labelKey)}`}
        active={isOpen}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      <Menu
        open={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={triggerRef}
        placement="bottom-end"
        label={t('sort.sortBy')}
        width={240}
      >
        <MenuLabel>{t('sort.sortBy')}</MenuLabel>
        {SORT_OPTION_IDS.map((option) => (
          <MenuItem
            key={option.id}
            icon={option.icon}
            selected={currentSort === option.id}
            trailing={
              currentSort === option.id ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : null
            }
            onClick={() => handleSelect(option)}
          >
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </Menu>
    </>
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
        comparison = a.title.localeCompare(b.title, 'en-US')
        break
      case 'content': {
        const aLen = (a.content || '').length
        const bLen = (b.content || '').length
        comparison = aLen - bLen
        break
      }
      case 'createdAt':
      case 'updatedAt': {
        const aDate = new Date(a[option.field])
        const bDate = new Date(b[option.field])
        comparison = aDate - bDate
        break
      }
      default:
        comparison = 0
    }

    return option.order === 'desc' ? -comparison : comparison
  })
}
