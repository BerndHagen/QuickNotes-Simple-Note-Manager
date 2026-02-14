import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  FolderOpen,
  Star,
  Settings,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Cloud,
  CloudOff,
  Zap,
  FileText,
  Briefcase,
  Home,
  Lightbulb,
  Folder,
  Archive,
  BookOpen,
  Heart,
  Music,
  Camera,
  Globe,
  Code,
  Gamepad2,
  ShoppingBag,
  Plane,
  GraduationCap,
  Palette,
  Coffee,
  Utensils,
  Car,
  Bike,
  Dumbbell,
  Film,
  Headphones,
  Smartphone,
  Laptop,
  Tv,
  Clock,
  Calendar,
  Bell,
  Check,
  X,
  Copy,
  Keyboard,
  LayoutTemplate,
  Users,
  Rocket,
  Umbrella,
  Gift,
  Award,
  Target,
  Compass,
  Map,
  Building,
  Building2,
  Bookmark,
  Feather,
  Leaf,
  Flower2,
  Trees,
  Mountain,
  Waves,
  Flame,
  Snowflake,
  Key,
  Lock,
  Shield,
  Crown,
  Gem,
  Coins,
  Wallet,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Stethoscope,
  Pill,
  Baby,
  Dog,
  Cat,
  Bird,
  Fish,
  Bug,
  Paintbrush,
  Scissors,
  Wrench,
  Hammer,
  Pencil,
  Pen,
  MessageCircle,
  Mail,
  Send,
  Phone,
  Video,
  Mic,
  Image,
  Hash,
  Server,
  Database,
  Cpu,
  Ship,
  Train,
  PartyPopper,
  Sparkles,
  Pizza,
  Cake,
  Apple,
  Wine,
  Recycle,
  ShoppingCart
} from 'lucide-react'
import { useNotesStore, useThemeStore, useUIStore } from '../store'
import { formatSyncTime } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'

const folderIcons = {
  Folder: Folder,
  FolderOpen: FolderOpen,
  Archive: Archive,
  FileText: FileText,
  Bookmark: Bookmark,
  
  Briefcase: Briefcase,
  Building: Building,
  Building2: Building2,
  Target: Target,
  TrendingUp: TrendingUp,
  BarChart3: BarChart3,
  PieChart: PieChart,
  
  Home: Home,
  Heart: Heart,
  Star: Star,
  Crown: Crown,
  Gem: Gem,
  Gift: Gift,
  Award: Award,
  
  Lightbulb: Lightbulb,
  Rocket: Rocket,
  GraduationCap: GraduationCap,
  BookOpen: BookOpen,
  Feather: Feather,
  Pen: Pen,
  Pencil: Pencil,
  
  Code: Code,
  Laptop: Laptop,
  Smartphone: Smartphone,
  Tv: Tv,
  Gamepad2: Gamepad2,
  Server: Server,
  Database: Database,
  Cpu: Cpu,
  
  Music: Music,
  Headphones: Headphones,
  Film: Film,
  Camera: Camera,
  Image: Image,
  Video: Video,
  Mic: Mic,
  
  MessageCircle: MessageCircle,
  Mail: Mail,
  Phone: Phone,
  Send: Send,
  Users: Users,
  
  Globe: Globe,
  Plane: Plane,
  Map: Map,
  Compass: Compass,
  Car: Car,
  Bike: Bike,
  Ship: Ship,
  Train: Train,
  
  Coffee: Coffee,
  Utensils: Utensils,
  Pizza: Pizza,
  Cake: Cake,
  Wine: Wine,
  Apple: Apple,
  
  Dumbbell: Dumbbell,
  Activity: Activity,
  Stethoscope: Stethoscope,
  Pill: Pill,
  
  Leaf: Leaf,
  Flower2: Flower2,
  Trees: Trees,
  Mountain: Mountain,
  Waves: Waves,
  Umbrella: Umbrella,
  Sun: Sun,
  Snowflake: Snowflake,
  
  ShoppingBag: ShoppingBag,
  ShoppingCart: ShoppingCart,
  Wallet: Wallet,
  CreditCard: CreditCard,
  DollarSign: DollarSign,
  Coins: Coins,
  
  Calendar: Calendar,
  Clock: Clock,
  Bell: Bell,
  
  Key: Key,
  Lock: Lock,
  Shield: Shield,
  
  Dog: Dog,
  Cat: Cat,
  Bird: Bird,
  Fish: Fish,
  Bug: Bug,
  Baby: Baby,
  
  Wrench: Wrench,
  Hammer: Hammer,
  Scissors: Scissors,
  Paintbrush: Paintbrush,
  
  Sparkles: Sparkles,
  PartyPopper: PartyPopper,
  Flame: Flame,
  Zap: Zap,
  Hash: Hash,
  Recycle: Recycle,
}

const folderColors = [
  '#10b981',
  '#059669',
  '#3b82f6',
  '#2563eb',
  '#8b5cf6',
  '#7c3aed',
  '#ec4899',
  '#db2777',
  '#f59e0b',
  '#d97706',
  '#ef4444',
  '#dc2626',
  '#14b8a6',
  '#0d9488',
  '#6366f1',
  '#4f46e5',
  '#f97316',
  '#ea580c',
  '#84cc16',
  '#65a30d',
  '#06b6d4',
  '#0891b2',
  '#a855f7',
  '#9333ea',
  '#22c55e',
  '#16a34a',
  '#64748b',
  '#475569',
  '#f43f5e',
  '#be185d',
]

const getFolderIcon = (iconName) => {
  return folderIcons[iconName] || Folder
}

function FolderContextMenu({ x, y, folder, onClose, onRename, onEdit, onDelete }) {
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ x, y })
  const { t } = useTranslation()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const padding = 10
      
      let adjustedX = x
      let adjustedY = y

      if (x + rect.width > window.innerWidth - padding) {
        adjustedX = window.innerWidth - rect.width - padding
      }
      if (adjustedX < padding) adjustedX = padding

      const bottomPadding = 60
      if (y + rect.height > window.innerHeight - bottomPadding) {
        adjustedY = window.innerHeight - rect.height - bottomPadding
      }
      if (adjustedY < padding) adjustedY = padding

      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[160px] backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => { onRename(); onClose() }}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
      >
        <Edit2 className="w-4 h-4 text-gray-400" />
        <span className="text-sm">{t('common.rename') || 'Rename'}</span>
      </button>
      <button
        onClick={() => { onEdit(); onClose() }}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
      >
        <Palette className="w-4 h-4 text-gray-400" />
        <span className="text-sm">{t('common.edit') || 'Edit'}</span>
      </button>
      <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 dark:text-red-400 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        <span className="text-sm">{t('common.delete') || 'Delete'}</span>
      </button>
    </div>
  )
}

function IconPickerModal({ isOpen, onClose, onSelect, currentIcon }) {
  if (!isOpen) return null

  const iconNames = Object.keys(folderIcons)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 modal-backdrop-animate" onClick={onClose}>
      <div
        className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 p-4 max-w-sm w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Choose Icon</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {iconNames.map((name) => {
            const IconComponent = folderIcons[name]
            const isSelected = currentIcon === name
            return (
              <button
                key={name}
                onClick={() => { onSelect(name); onClose() }}
                className={`p-3 rounded-xl transition-all relative ${
                  isSelected 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={name}
              >
                {isSelected && (
                  <div className="absolute inset-0 rounded-xl border-2 border-emerald-500 pointer-events-none" />
                )}
                <IconComponent className={`w-5 h-5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ColorPickerModal({ isOpen, onClose, onSelect, currentColor }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center modal-backdrop-animate" onClick={onClose}>
      <div
        className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 max-w-sm w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <h3 className="text-base font-bold">Choose Color</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {folderColors.map((color) => (
            <button
              key={color}
              onClick={() => { onSelect(color); onClose() }}
              className={`w-9 h-9 rounded-full hover:scale-110 transition-transform shadow-md ${
                currentColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600' : ''
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}

function EditFolderModal({ isOpen, onClose, folder, onUpdate }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState('#10b981')
  const inputRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (isOpen && folder) {
      setName(folder.name || '')
      setIcon(folder.icon || 'Folder')
      setColor(folder.color || '#10b981')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, folder])

  if (!isOpen || !folder) return null

  const IconComponent = getFolderIcon(icon)
  const iconNames = Object.keys(folderIcons)

  const handleSave = () => {
    if (name.trim()) {
      onUpdate(folder.id, { name: name.trim(), icon, color })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 modal-backdrop-animate" onClick={onClose}>
      <div
        className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Folder className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-bold">{t('folders.editFolder') || 'Edit Folder'}</h3>
              <p className="text-sm text-white/70">Customize folder appearance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl mb-6 border border-gray-300 dark:border-gray-700">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: color }}
          >
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{name || 'Folder Name'}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('folders.preview') || 'Preview'}</p>
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('folders.folderName') || 'Folder Name'}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onClose()
            }}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder={t('folders.folderName') || 'Folder Name'}
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('folders.chooseIcon') || 'Choose Icon'}
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl max-h-[200px] overflow-y-auto border border-gray-300 dark:border-gray-700">
            {iconNames.map((iconName) => {
              const Ic = folderIcons[iconName]
              const isSelected = icon === iconName
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`p-2.5 rounded-lg transition-all ${
                    isSelected 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={iconName}
                >
                  <Ic className={`w-5 h-5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </button>
              )
            })}
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('folders.chooseColor') || 'Choose Color'}
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700">
            {folderColors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full hover:scale-110 transition-transform shadow-md ${
                  color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            {t('common.save') || 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors border border-gray-300 dark:border-gray-600"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}

function NewFolderModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('New Folder')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState('#10b981')
  const inputRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (isOpen) {
      setName(t('folders.newFolder') || 'New Folder')
      setIcon('Folder')
      setColor('#10b981')
      setTimeout(() => inputRef.current?.select(), 100)
    }
  }, [isOpen, t])

  if (!isOpen) return null

  const handleCreate = () => {
    if (name.trim()) {
      onCreate({ name: name.trim(), icon, color })
      onClose()
    }
  }

  const IconComponent = folderIcons[icon] || Folder
  const iconNames = Object.keys(folderIcons)

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop-animate"
      onClick={onClose}
    >
      <div 
        className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Folder className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('folders.createFolder') || 'Create New Folder'}</h2>
              <p className="text-sm text-white/70">Organize your notes into folders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl mb-6 border border-gray-300 dark:border-gray-700">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: color }}
            >
              <IconComponent className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{name || t('folders.newFolder') || 'New Folder'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('folders.preview') || 'Preview'}</p>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('folders.folderName') || 'Folder Name'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') onClose()
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder={t('folders.folderName') || 'Folder Name'}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('folders.chooseIcon') || 'Choose Icon'}
            </label>
            <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700">
              {iconNames.map((iconName) => {
                const Ic = folderIcons[iconName]
                const isSelected = icon === iconName
                return (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={`p-2.5 rounded-lg transition-all ${
                      isSelected 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={iconName}
                  >
                    <Ic className={`w-5 h-5 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('folders.chooseColor') || 'Choose Color'}
            </label>
            <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700">
              {folderColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full hover:scale-110 transition-transform shadow-md ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-300 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            {t('common.create') || 'Create'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors border border-gray-300 dark:border-gray-600"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { t, language } = useTranslation()
  const {
    folders,
    tags,
    notes,
    selectedFolderId,
    selectedTagFilter,
    createFolder,
    updateFolder,
    deleteFolder,
    setSelectedFolder,
    setSelectedTagFilter,
    isOnline,
    isSyncing,
    lastSyncTime,
    syncWithBackend,
    user,
    pendingShares,
  } = useNotesStore()

  const { theme, setTheme } = useThemeStore()
  const { sidebarOpen, setSidebarOpen, setQuickNoteOpen, setSettingsOpen, setShowTrash, setDuplicateModalOpen, setArchiveViewOpen, setShortcutsModalOpen, setTemplatesModalOpen, setNoteTypesModalOpen, setTagManagerOpen, setMobileView } = useUIStore()

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
      setMobileView('notes')
    }
  }

  const [expandedSections, setExpandedSections] = useState({
    folders: true,
    tags: true,
  })
  const [editingFolderId, setEditingFolderId] = useState(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [folderContextMenu, setFolderContextMenu] = useState(null)
  const [editingFolder, setEditingFolder] = useState(null)

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleCreateFolder = (folderData) => {
    const newFolder = createFolder(folderData)
    return newFolder
  }

  const handleFolderContextMenu = (e, folder) => {
    e.preventDefault()
    e.stopPropagation()
    setFolderContextMenu({ x: e.clientX, y: e.clientY, folder })
  }

  const handleSaveFolderName = (id) => {
    if (editingFolderName.trim()) {
      updateFolder(id, { name: editingFolderName.trim() })
    }
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  const getNotesCountForFolder = (folderId) => {
    return notes.filter((n) => n.folderId === folderId && !n.deleted).length
  }

  const getNotesCountForTag = (tagName) => {
    return notes.filter((n) => n.tags?.includes(tagName) && !n.deleted).length
  }

  const getFavoritesCount = () => {
    return notes.filter((n) => n.starred && !n.deleted && !n.archived).length
  }

  const getTrashCount = () => {
    return notes.filter((n) => n.deleted).length
  }

  const getArchiveCount = () => {
    return notes.filter((n) => n.archived && !n.deleted).length
  }

  const getActiveNotesCount = () => {
    return notes.filter((n) => !n.deleted && !n.archived).length
  }

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4" />
      case 'dark':
        return <Moon className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  if (!sidebarOpen) return null

  return (
    <div className="w-full sidebar-premium flex flex-col h-full">
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center logo-badge">
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="leading-tight">QuickNotes</span>
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 leading-tight tracking-wide">Note Manager</span>
            </div>
          </h1>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-white/90 dark:hover:bg-gray-800 rounded-xl transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:rotate-45 duration-300"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setQuickNoteOpen(true)}
          className="w-full quick-note-btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl py-2.5 px-4 flex items-center justify-center gap-2.5 transition-all font-medium hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          <Zap className="w-4 h-4" />
          {t('sidebar.quickNote')}
          <span className="text-[11px] opacity-60 ml-1 font-normal">{"\u2318"}+N</span>
        </button>
      </div>
      <div className="mx-5 mb-2 h-px bg-[#cbd1db] dark:bg-gray-800/80" />
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
        <div
          onClick={() => {
            setSelectedFolder(null)
            setSelectedTagFilter(null)
            closeSidebarOnMobile()
          }}
          className={`px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all group nav-item-slide ${
            !selectedFolderId && !selectedTagFilter
              ? 'bg-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-black/5'
              : 'hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <FolderOpen className="w-[18px] h-[18px]" />
            <span className={`text-[13px] ${
              !selectedFolderId && !selectedTagFilter ? 'font-semibold' : 'font-medium'
            }`}>{t('sidebar.allNotes')}</span>
          </div>
          <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md min-w-[24px] text-center font-medium count-badge border border-gray-300 dark:border-gray-600 ${
            !selectedFolderId && !selectedTagFilter
              ? 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500'
          }`}>
            {getActiveNotesCount()}
          </span>
        </div>
        <div
          onClick={() => {
            setSelectedFolder(null)
            setSelectedTagFilter('__starred__')
            closeSidebarOnMobile()
          }}
          className={`px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all group nav-item-slide ${
            selectedTagFilter === '__starred__'
              ? 'bg-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-black/5'
              : 'hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <Star className={`w-[18px] h-[18px] ${selectedTagFilter === '__starred__' ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span className={`text-[13px] ${
              selectedTagFilter === '__starred__' ? 'font-semibold' : 'font-medium'
            }`}>{t('sidebar.favorites')}</span>
          </div>
          <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md min-w-[24px] text-center font-medium count-badge border border-gray-300 dark:border-gray-600 ${
            selectedTagFilter === '__starred__'
              ? 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500'
          }`}>
            {getFavoritesCount()}
          </span>
        </div>

        <div className="h-px mx-5 my-2.5 bg-[#cbd1db] dark:bg-gray-800/60" />

        <div
          onClick={() => setShowTrash(true)}
          className="px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 nav-item-slide"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">{t('sidebar.trash')}</span>
          </div>
          {getTrashCount() > 0 && (
            <span className="text-[10px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 px-1.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-600">
              {getTrashCount()}
            </span>
          )}
        </div>
        <div
          onClick={() => setArchiveViewOpen(true)}
          className="px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 nav-item-slide"
        >
          <div className="flex items-center gap-3">
            <Archive className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">{t('sidebar.archive')}</span>
          </div>
          {getArchiveCount() > 0 && (
            <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-600">
              {getArchiveCount()}
            </span>
          )}
        </div>
        <div
          onClick={() => {
            const { setSharedNotesViewOpen } = useUIStore.getState()
            setSharedNotesViewOpen(true)
          }}
          className="px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 nav-item-slide"
        >
          <div className="flex items-center gap-3">
            <Users className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">Shared Notes</span>
          </div>
          {pendingShares?.length > 0 && (
            <span className="text-[10px] font-semibold bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 px-1.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 animate-pulse">
              {pendingShares.length}
            </span>
          )}
        </div>
        <div
          onClick={() => setDuplicateModalOpen(true)}
          className="px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-500 dark:text-gray-400 nav-item-slide"
        >
          <div className="flex items-center gap-3">
            <Copy className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-medium">{t('sidebar.findDuplicates')}</span>
          </div>
        </div>
        <div className="mt-4">
          <div
            onClick={() => toggleSection('folders')}
            className="px-5 py-1.5 flex items-center justify-between cursor-pointer text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.folders ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {t('sidebar.folders')}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowNewFolderModal(true)
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              style={{ opacity: 1 }}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {expandedSections.folders && (
            <div className="space-y-0.5 mt-1">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolder(folder.id)
                    closeSidebarOnMobile()
                  }}
                  onContextMenu={(e) => handleFolderContextMenu(e, folder)}
                  className={`group px-3.5 py-2 mx-3 rounded-xl cursor-pointer flex items-center justify-between transition-all nav-item-slide ${
                    selectedFolderId === folder.id
                      ? 'bg-white dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-black/5'
                      : 'hover:bg-white/90 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {(() => {
                      const IconComponent = getFolderIcon(folder.icon)
                      return <IconComponent className="w-[18px] h-[18px] flex-shrink-0" style={{ color: folder.color }} />
                    })()}
                    {editingFolderId === folder.id ? (
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={() => handleSaveFolderName(folder.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveFolderName(folder.id)
                          if (e.key === 'Escape') setEditingFolderId(null)
                        }}
                        autoFocus
                        className="flex-1 bg-transparent border-none outline-none text-[13px]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={`text-[13px] truncate ${selectedFolderId === folder.id ? 'font-semibold' : 'font-medium'}`}>{folder.name}</span>
                    )}
                  </div>
                  <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md min-w-[24px] text-center font-medium count-badge border border-gray-300 dark:border-gray-600 ${
                    selectedFolderId === folder.id
                      ? 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-white/70 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500'
                  }`}>
                    {getNotesCountForFolder(folder.id)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div
            onClick={() => toggleSection('tags')}
            className="px-5 py-1.5 flex items-center justify-between cursor-pointer text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.tags ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              {t('sidebar.tags')}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setTagManagerOpen(true)
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={t('tags.manage') || 'Manage Tags'}
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>

          {expandedSections.tags && (
            <div className="px-5 pt-1.5 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTagFilter(tag.name)
                    closeSidebarOnMobile()
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    selectedTagFilter === tag.name
                      ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-gray-950 shadow-sm bg-white/90 dark:bg-transparent'
                      : 'hover:shadow-sm bg-white/40 dark:bg-transparent'
                  }`}
                  style={{
                    backgroundColor: selectedTagFilter === tag.name ? undefined : `${tag.color}12`,
                    color: tag.color,
                  }}
                >
                  #{tag.name}
                  <span className="ml-1 opacity-50 font-medium">
                    {getNotesCountForTag(tag.name)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="divider mb-2.5" />
        <div className="hidden md:flex gap-1.5">
          <button
            onClick={() => setNoteTypesModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/40 dark:hover:to-teal-900/40 transition-all text-[12px] text-emerald-700 dark:text-emerald-400 font-semibold active:scale-[0.98] btn-glow border border-emerald-100/50 dark:border-emerald-800/30"
            title="Note Types"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Note Types
          </button>
          <button
            onClick={() => setShortcutsModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/40 dark:hover:to-teal-900/40 transition-all text-[12px] text-emerald-700 dark:text-emerald-400 font-semibold active:scale-[0.98] btn-glow border border-emerald-100/50 dark:border-emerald-800/30"
            title={t('sidebar.shortcuts')}
          >
            <Keyboard className="w-3.5 h-3.5" />
            {t('sidebar.shortcuts')}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={cycleTheme}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/90 dark:hover:bg-gray-800/50 transition-all text-[12px] text-gray-500 dark:text-gray-400 font-medium"
          >
            {getThemeIcon()}
            <span>
              {theme === 'light' && t('settings.themeLight')}
              {theme === 'dark' && t('settings.themeDark')}
              {theme === 'system' && t('settings.themeSystem')}
            </span>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-gray-400 dark:text-gray-500">
            {isOnline ? (
              <span className="status-dot status-online flex-shrink-0" />
            ) : (
              <span className="status-dot status-offline flex-shrink-0" />
            )}
            {isOnline && !isSyncing ? (
              <button
                onClick={syncWithBackend}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium whitespace-nowrap"
              >
                {t('sidebar.sync')}
              </button>
            ) : (
              <span className="text-[11px] whitespace-nowrap">
                {isSyncing ? t('sidebar.syncing') : t('sidebar.offline')}
              </span>
            )}
          </div>
        </div>
      </div>
      {showNewFolderModal && createPortal(
        <NewFolderModal
          isOpen={showNewFolderModal}
          onClose={() => setShowNewFolderModal(false)}
          onCreate={handleCreateFolder}
        />,
        document.body
      )}
      {folderContextMenu && (
        <FolderContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          folder={folderContextMenu.folder}
          onClose={() => setFolderContextMenu(null)}
          onRename={() => {
            setEditingFolderId(folderContextMenu.folder.id)
            setEditingFolderName(folderContextMenu.folder.name)
          }}
          onEdit={() => setEditingFolder(folderContextMenu.folder)}
          onDelete={() => deleteFolder(folderContextMenu.folder.id)}
        />
      )}
      {editingFolder !== null && createPortal(
        <EditFolderModal
          isOpen={editingFolder !== null}
          onClose={() => setEditingFolder(null)}
          folder={editingFolder}
          onUpdate={updateFolder}
        />,
        document.body
      )}
    </div>
  )
}
