import React, { useState } from 'react'
import { X, Sparkles, ChevronRight, RefreshCw } from 'lucide-react'
import { useUIStore, useNotesStore } from '../store'
import { NOTE_TYPES, NOTE_TYPE_CONFIG, getDefaultData, CATEGORIES } from './editors'
import { useTranslation } from '../lib/useTranslation'
import toast from 'react-hot-toast'

export default function NoteTypesModal() {
  const { noteTypesModalOpen, setNoteTypesModalOpen, noteTypeConvertId, setNoteTypeConvertId } = useUIStore()
  const { createNote, updateNote, notes } = useNotesStore()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [hoveredType, setHoveredType] = useState(null)
  const { t } = useTranslation()

  const isConvertMode = !!noteTypeConvertId
  const convertNote = isConvertMode ? notes.find(n => n.id === noteTypeConvertId) : null

  const handleClose = () => {
    setNoteTypesModalOpen(false)
    setNoteTypeConvertId(null)
  }

  if (!noteTypesModalOpen) return null
  const noteTypes = Object.entries(NOTE_TYPE_CONFIG).map(([key, config]) => ({
    id: key,
    ...config,
  }))
  const filteredTypes = selectedCategory === 'all'
    ? noteTypes
    : noteTypes.filter(t => t.category === selectedCategory)
  const handleSelectType = (typeId) => {
    const config = NOTE_TYPE_CONFIG[typeId]
    
    if (isConvertMode && convertNote) {
      if (convertNote.noteType === typeId) {
        toast('Note is already this type', { icon: 'ℹ️' })
        handleClose()
        return
      }
      updateNote(convertNote.id, {
        noteType: typeId,
        noteData: typeId === NOTE_TYPES.STANDARD ? null : getDefaultData(typeId),
      })
      toast.success(`Converted to ${config.name}`)
      handleClose()
      return
    }

    if (typeId === NOTE_TYPES.STANDARD) {
      createNote({
        title: 'New Note',
        content: '',
        noteType: NOTE_TYPES.STANDARD,
        noteData: null,
      })
    } else {
      createNote({
        title: config.name,
        content: '',
        noteType: typeId,
        noteData: getDefaultData(typeId),
      })
    }
    
    handleClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {isConvertMode ? <RefreshCw className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
              {isConvertMode ? (t('noteTypes.convertTitle') || 'Convert Note Type') : t('noteTypes.title')}
            </h2>
            <p className="text-sm text-white/70 mt-1 ml-10">
              {isConvertMode ? (t('noteTypes.convertSubtitle') || 'Choose a new type for this note') : t('noteTypes.subtitle')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex items-center gap-2 p-4 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t('noteTypes.allTypes')}
          </button>
          {CATEGORIES.filter(cat => cat.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTypes.map((type) => {
              const IconComponent = type.icon
              const isHovered = hoveredType === type.id
              
              return (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  onMouseEnter={() => setHoveredType(type.id)}
                  onMouseLeave={() => setHoveredType(null)}
                  className={`relative p-5 rounded-xl text-left transition-all duration-200 group border-2 flex flex-col h-full ${
                    isConvertMode && convertNote?.noteType === type.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 opacity-60'
                      : isHovered
                        ? 'border-indigo-500 shadow-lg scale-[1.02]'
                        : 'border-[#cbd1db] dark:border-gray-700 hover:border-[#cbd1db] dark:hover:border-gray-600'
                  }`}
                  style={{
                    background: isHovered
                      ? `linear-gradient(135deg, ${type.color}10, ${type.color}05)`
                      : undefined
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ 
                      backgroundColor: `${type.color}20`,
                      color: type.color
                    }}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                    {type.name}
                    {isConvertMode && convertNote?.noteType === type.id 
                      ? <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">(current)</span>
                      : <ChevronRight className={`w-4 h-4 transition-transform ${isHovered ? 'translate-x-1' : ''}`} style={{ color: type.color }} />
                    }
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {type.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-auto pt-3">
                    {type.features.map((feature, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div 
                    className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${type.color}15`,
                      color: type.color
                    }}
                  >
                    {CATEGORIES.find(c => c.id === type.category)?.name || type.category}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-4 border-t border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {isConvertMode 
              ? (t('noteTypes.convertWarning') || 'Converting will change the editor type. Your existing content will be preserved where possible.')
              : (<>{t('noteTypes.footer1')}<br />{t('noteTypes.footer2')}</>)
            }
          </p>
        </div>
      </div>
    </div>
  )
}
