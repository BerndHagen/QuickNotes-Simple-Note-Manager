import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Star,
  Pin,
  Trash2,
  MoreVertical,
  Tag,
  FolderOpen,
  Copy,
  Share2,
  Clock,
  X,
  Plus,
  ChevronDown,
  History,
  FileText,
  Search,
  Bell,
  Download,
  Upload,
  Link2,
  Image as ImageIcon,
  Focus,
  Mic,
  Archive,
  ArrowLeft,
  Folder,
  Briefcase,
  Home,
  Lightbulb,
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
  Calendar,
  Eye,
  Building,
  Building2,
  Target,
  TrendingUp,
  BarChart3,
  PieChart,
  Crown,
  Gem,
  Gift,
  Award,
  Rocket,
  Feather,
  Pen,
  Pencil,
  Server,
  Database,
  Cpu,
  Video,
  MessageCircle,
  Mail,
  Phone,
  Send,
  Users,
  Map,
  Compass,
  Ship,
  Train,
  Pizza,
  Cake,
  Apple,
  Wine,
  Activity,
  Stethoscope,
  Pill,
  Leaf,
  Flower2,
  Trees,
  Mountain,
  Waves,
  Umbrella,
  Sun,
  Snowflake,
  ShoppingCart,
  Wallet,
  CreditCard,
  DollarSign,
  Coins,
  Key,
  Lock,
  Shield,
  Dog,
  Cat,
  Bird,
  Fish,
  Bug,
  Baby,
  Wrench,
  Hammer,
  Scissors,
  Paintbrush,
  Sparkles,
  PartyPopper,
  Flame,
  Zap,
  Hash,
  Recycle,
  Bookmark,
  Newspaper,
  Trophy,
  PenTool,
  Megaphone,
  Layers,
  Package,
  Box,
  Anchor,
  Tent,
  Crosshair,
  Microscope,
  Printer,
  Wifi,
  Link,
  MapPin,
  Navigation,
  Radio,
  Disc3,
  Speaker,
  Clapperboard,
  Glasses,
  Watch,
  Footprints,
  TreePine,
  CloudRain,
  Rainbow,
  Wand2,
  Swords,
  Ghost,
  Skull,
  Bone,
  Library,
  TestTube2,
  Atom,
  Candy,
  Shirt,
  PawPrint,
  Scan,
  CircleDot,
  Hexagon,
  Triangle,
  Pentagon,
  HandMetal,
  ThumbsUp,
  Truck,
  Factory,
} from 'lucide-react'
import { useNotesStore, useUIStore, useThemeStore } from '../store'
import RichTextEditor from './RichTextEditor'
import FindReplaceBar from './FindReplaceBar'
import NoteStatistics from './NoteStatistics'
import NoteLinkPopover, { useNoteLinkHandler, useBacklinks } from './NoteLinkPopover'
import VoiceInput from './VoiceInput'
import ImageUploadModal from './ImageUploadModal'
import LinkInsertModal from './LinkInsertModal'
import HTMLEditorModal from './HTMLEditorModal'
import { formatDate, debounce } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import { saveNoteVersion } from '../lib/db'
import { useRealtimeCollaboration } from '../lib/useCollaboration'
import toast from 'react-hot-toast'

import { hasSpecializedEditor, getEditorForNoteType, NOTE_TYPE_CONFIG } from './editors'

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
  Image: ImageIcon,
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
  Newspaper: Newspaper,
  Trophy: Trophy,
  PenTool: PenTool,
  Megaphone: Megaphone,
  Layers: Layers,
  Package: Package,
  Box: Box,
  Anchor: Anchor,
  Tent: Tent,
  Crosshair: Crosshair,
  Microscope: Microscope,
  Printer: Printer,
  Wifi: Wifi,
  Link: Link,
  MapPin: MapPin,
  Navigation: Navigation,
  Radio: Radio,
  Disc3: Disc3,
  Speaker: Speaker,
  Clapperboard: Clapperboard,
  Glasses: Glasses,
  Watch: Watch,
  Footprints: Footprints,
  TreePine: TreePine,
  CloudRain: CloudRain,
  Rainbow: Rainbow,
  Wand2: Wand2,
  Swords: Swords,
  Ghost: Ghost,
  Skull: Skull,
  Bone: Bone,
  Library: Library,
  TestTube2: TestTube2,
  Atom: Atom,
  Candy: Candy,
  Shirt: Shirt,
  PawPrint: PawPrint,
  Eye: Eye,
  Scan: Scan,
  CircleDot: CircleDot,
  Hexagon: Hexagon,
  Triangle: Triangle,
  Pentagon: Pentagon,
  HandMetal: HandMetal,
  ThumbsUp: ThumbsUp,
  Truck: Truck,
  Factory: Factory,
}

const getFolderIcon = (iconName) => {
  return folderIcons[iconName] || Folder
}

export default function NoteEditor() {
  const { t, language } = useTranslation()
  const {
    notes,
    folders,
    tags,
    selectedNoteId,
    getSelectedNote,
    updateNote,
    deleteNote,
    toggleStar,
    togglePin,
    duplicateNote,
    moveNote,
    addTagToNote,
    removeTagFromNote,
    createTag,
    archiveNote,

  } = useNotesStore()

  const { 
    findReplaceOpen, 
    setFindReplaceOpen, 
    setReminderModalOpen, 
    setExportModalOpen,
    setImportModalOpen,
    noteLinkPopoverOpen,
    setNoteLinkPopoverOpen,
    noteLinkPosition,
    setImageUploadOpen,
    setVersionHistoryOpen,
    setFocusModeOpen,
    voiceInputActive,
    setVoiceInputActive,
    setMobileEditorOpen,
    setShareModalOpen,
    showNoteStatistics,
    confirmBeforeDelete,
  } = useUIStore()

  const note = getSelectedNote()

  const backlinks = useBacklinks(note?.id)
  useNoteLinkHandler()
  
  useRealtimeCollaboration(note?.id)
  
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [editorRef, setEditorRef] = useState(null)
  const [specializedContextMenu, setSpecializedContextMenu] = useState(null)
  const menuRef = useRef(null)
  const menuDropdownRef = useRef(null)
  const tagPickerRef = useRef(null)
  const tagDropdownRef = useRef(null)
  const folderPickerRef = useRef(null)
  const folderDropdownRef = useRef(null)
  const titleInputRef = useRef(null)
  const specializedContextMenuRef = useRef(null)
  const lastNoteDataRef = useRef(null)
  const [titleCursorPosition, setTitleCursorPosition] = useState(null)
  
  const { theme } = useThemeStore()
  
  const isDarkMode = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  const [paperType, setPaperType] = useState(() => isDarkMode ? 'dark' : 'plain')
  
  const [userChangedPaper, setUserChangedPaper] = useState(false)
  
  useEffect(() => {
    if (!userChangedPaper) {
      setPaperType(isDarkMode ? 'dark' : 'plain')
    }
  }, [isDarkMode, userChangedPaper])
  
  const handlePaperTypeChange = (newType) => {
    setPaperType(newType)
    setUserChangedPaper(true)
  }

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      if (hasSpecializedEditor(note.noteType) && note.noteData) {
        lastNoteDataRef.current = note.noteData
      }
    }
  }, [note?.id])

  useEffect(() => {
    if (note?._isExternalUpdate) {
      setTimeout(() => {
        updateNote(note.id, { _isExternalUpdate: false })
      }, 100)
    }
  }, [note?._isExternalUpdate, note?.id, updateNote])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current && titleCursorPosition !== null) {
      titleInputRef.current.focus()
      titleInputRef.current.setSelectionRange(titleCursorPosition, titleCursorPosition)
      setTitleCursorPosition(null)
    }
  }, [isEditingTitle, titleCursorPosition])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          (!menuDropdownRef.current || !menuDropdownRef.current.contains(event.target))) {
        setShowMenu(false)
      }
      if (tagPickerRef.current && !tagPickerRef.current.contains(event.target) &&
          (!tagDropdownRef.current || !tagDropdownRef.current.contains(event.target))) {
        setShowTagPicker(false)
      }
      if (folderPickerRef.current && !folderPickerRef.current.contains(event.target) &&
          (!folderDropdownRef.current || !folderDropdownRef.current.contains(event.target))) {
        setShowFolderPicker(false)
      }
      if (specializedContextMenuRef.current && !specializedContextMenuRef.current.contains(event.target)) {
        setSpecializedContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const debouncedTitleUpdate = useCallback(
    debounce(async (newTitle) => {
      if (note && newTitle !== note.title) {
        try {
          await updateNote(note.id, { title: newTitle })
        } catch (error) {
          toast.error('Failed to save title')
        }
      }
    }, 500),
    [note?.id]
  )

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    debouncedTitleUpdate(newTitle)
  }

  const handleContentChange = async (content) => {
    if (note) {
      const oldContent = note.content || ''
      const oldLength = oldContent.length
      const newLength = content.length
      
      if (Math.abs(newLength - oldLength) > 100) {
        saveNoteVersion(note.id, oldContent, note.title)
      }
      
      try {
        await updateNote(note.id, { content })
      } catch (error) {
        toast.error('Failed to save content')
      }
    }
  }

  const handleDelete = () => {
    if (note) {
      if (confirmBeforeDelete && !window.confirm(t('settings.confirmDeleteMessage'))) {
        setShowMenu(false)
        return
      }
      deleteNote(note.id)
    }
    setShowMenu(false)
  }

  const handleDuplicate = () => {
    if (note) {
      duplicateNote(note.id)
    }
    setShowMenu(false)
  }

  const handleAddTag = (tagName) => {
    if (note && tagName) {
      addTagToNote(note.id, tagName)
      
      if (!tags.find((t) => t.name === tagName)) {
        createTag({ name: tagName, color: getRandomColor() })
      }
    }
    setNewTagName('')
  }

  const handleCreateAndAddTag = () => {
    if (newTagName.trim()) {
      handleAddTag(newTagName.trim().toLowerCase())
    }
  }

  const getRandomColor = () => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7',
      '#ec4899', '#f43f5e'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const getCurrentFolder = () => {
    if (!note?.folderId) return null
    return folders.find((f) => f.id === note.folderId)
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full bg-gradient-to-br from-gray-50/80 via-white to-emerald-50/20 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 editor-paper">
        <div className="flex flex-col items-center max-w-xs text-center">
          <div className="relative mb-8 empty-state-glow">
            <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-sm border border-[#cbd1db]/50 dark:border-gray-700/30">
              <FileText className="w-9 h-9 text-gray-200 dark:text-gray-700" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25 badge-shine">
              <Plus className="w-4 h-4 text-white" />
            </div>
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white tracking-tight">No note selected</h3>
          <p className="text-[13px] text-gray-400 dark:text-gray-500 leading-relaxed max-w-[220px]">Select a note from the list or create a new one to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-gradient-to-b from-white via-[#fefefe] to-[#f8f9fb] dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 editor-paper">
      <div className="flex-shrink-0 px-5 py-4 md:px-6 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 dark:from-gray-950/80 dark:via-gray-950/80 dark:to-gray-950/80 backdrop-blur-sm border-b border-emerald-700 dark:border-gray-800" style={{ boxShadow: '0 1px 3px -1px rgba(0,0,0,0.05), 0 1px 2px -1px rgba(0,0,0,0.03)' }}>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <button
            onClick={() => setMobileEditorOpen(false)}
            className="flex-shrink-0 p-2 -ml-2 transition-colors rounded-xl md:hidden hover:bg-white/10 dark:hover:bg-gray-800"
            title="Back to notes list"
          >
            <ArrowLeft className="w-5 h-5 text-white/80 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={handleTitleChange}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur()
                  setIsEditingTitle(false)
                }
              }}
              className={`w-full px-2 py-1.5 -mx-2 text-xl font-bold bg-transparent border-none outline-none md:text-2xl cursor-text rounded-xl transition-all text-white dark:text-white placeholder-white/40 dark:placeholder-gray-600 tracking-tight ${
                isEditingTitle 
                  ? 'bg-white/10 dark:bg-gray-800/50 ring-2 ring-white/20' 
                  : 'hover:bg-white/10 dark:hover:bg-gray-800/30'
              }`}
              placeholder="Note title..."
            />
          </div>
          <div className="flex items-center flex-shrink-0 gap-0.5 md:gap-0.5">
            {!hasSpecializedEditor(note.noteType) && (
              <button
                onClick={() => setFindReplaceOpen(!findReplaceOpen)}
                className={`p-2 rounded-xl transition-all ${
                  findReplaceOpen
                    ? 'bg-white/20 dark:bg-emerald-900/30 text-white dark:text-emerald-400'
                    : 'hover:bg-white/10 dark:hover:bg-gray-800 text-white/60 hover:text-white dark:text-gray-300'
                }`}
                title="Find & Replace (Ctrl+F)"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
            )}
            <button
              onClick={() => setReminderModalOpen(true, note.id)}
              className={`hidden md:block p-2 rounded-xl transition-all ${
                note.reminders?.length > 0
                  ? 'bg-orange-400/20 dark:bg-orange-900/20 text-orange-300 dark:text-orange-400'
                  : 'hover:bg-white/10 dark:hover:bg-gray-800 text-white/60 hover:text-white dark:text-gray-300'
              }`}
              title="Reminders"
            >
              <Bell className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => togglePin(note.id)}
              className={`hidden md:block p-2 rounded-xl transition-all ${
                note.pinned
                  ? 'bg-white/20 dark:bg-emerald-900/30 text-white dark:text-emerald-400'
                  : 'hover:bg-white/10 dark:hover:bg-gray-800 text-white/60 hover:text-white dark:text-gray-300'
              }`}
              title={note.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className={`w-[18px] h-[18px] ${note.pinned ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => toggleStar(note.id)}
              className={`p-2 rounded-xl transition-all ${
                note.starred
                  ? 'bg-amber-400/20 dark:bg-amber-900/20 text-amber-300 dark:text-amber-400'
                  : 'hover:bg-white/10 dark:hover:bg-gray-800 text-white/60 hover:text-white dark:text-gray-300'
              }`}
              title={note.starred ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-[18px] h-[18px] ${note.starred ? 'fill-current' : ''}`} />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-white/10 dark:hover:bg-gray-800 rounded-xl transition-all text-white/60 hover:text-white dark:hover:text-gray-300"
              >
                <MoreVertical className="w-[18px] h-[18px]" />
              </button>

              {showMenu && createPortal(
                <div 
                  ref={menuDropdownRef}
                  className="fixed bg-white dark:bg-gray-900 border border-[#cbd1db] dark:border-gray-700 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 py-1.5 z-[9999] min-w-[200px] backdrop-blur-xl float-up overflow-y-auto"
                  style={{
                    top: menuRef.current ? menuRef.current.getBoundingClientRect().bottom + 6 : 0,
                    left: menuRef.current ? Math.min(menuRef.current.getBoundingClientRect().right - 200, window.innerWidth - 216) : 0,
                    maxHeight: menuRef.current ? `${window.innerHeight - menuRef.current.getBoundingClientRect().bottom - 20}px` : 'auto',
                  }}
                >
                  <button
                    onClick={handleDuplicate}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                    Duplicate
                  </button>
                  <button
                    onClick={() => {
                      setShareModalOpen(true, note.id)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Share2 className="w-4 h-4 text-gray-400" />
                    Share note
                  </button>
                  <button
                    onClick={() => {
                      setShowFolderPicker(true)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <FolderOpen className="w-4 h-4 text-gray-400" />
                    Move to folder
                  </button>
                  <button
                    onClick={() => {
                      setExportModalOpen(true)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                    Export
                  </button>
                  <button
                    onClick={() => {
                      setImportModalOpen(true)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    Import
                  </button>
                  {!hasSpecializedEditor(note.noteType) && (
                    <button
                      onClick={() => {
                        const rect = menuRef.current?.getBoundingClientRect()
                        setNoteLinkPopoverOpen(true, { x: rect?.left || 100, y: (rect?.bottom || 100) + 10 })
                        setShowMenu(false)
                      }}
                      className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                    >
                      <Link2 className="w-4 h-4 text-gray-400" />
                      Insert note link
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReminderModalOpen(true, note.id)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Bell className="w-4 h-4 text-gray-400" />
                    Set reminder
                  </button>
                  {!hasSpecializedEditor(note.noteType) && (
                    <button
                      onClick={() => {
                        setImageUploadOpen(true)
                        setShowMenu(false)
                      }}
                      className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                    >
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                      Insert image
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setVersionHistoryOpen(true, note.id)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <History className="w-4 h-4 text-gray-400" />
                    Version history
                  </button>
                  {!hasSpecializedEditor(note.noteType) && (
                    <button
                      onClick={() => {
                        setFocusModeOpen(true)
                        setShowMenu(false)
                      }}
                      className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                    >
                      <Focus className="w-4 h-4 text-gray-400" />
                      Focus mode
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setVoiceInputActive(true)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Mic className="w-4 h-4 text-gray-400" />
                    Voice input
                  </button>
                  <button
                    onClick={() => {
                      archiveNote(note.id)
                      setShowMenu(false)
                    }}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors rounded-lg mx-0"
                  >
                    <Archive className="w-4 h-4 text-gray-400" />
                    Archive note
                  </button>
                  <div className="my-1.5 mx-3 border-t border-[#cbd1db] dark:border-gray-800" />
                  <button
                    onClick={handleDelete}
                    className="flex items-center w-full gap-3 px-4 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 dark:text-red-400 transition-colors rounded-lg mx-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    Move to trash
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[13px] text-white/80 dark:text-emerald-400">
          <span className="flex items-center gap-1.5 px-2 py-1 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{formatDate(note.updatedAt, language)}</span>
            <span className="sm:hidden">{new Date(note.updatedAt).toLocaleDateString()}</span>
          </span>
          <div className="relative" ref={folderPickerRef}>
            <button
              onClick={() => setShowFolderPicker(!showFolderPicker)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 dark:hover:bg-gray-800 transition-all text-white/70 dark:text-gray-400"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="text-[13px] font-medium">{getCurrentFolder()?.name || 'No folder'}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {showFolderPicker && createPortal(
              <div
                ref={folderDropdownRef}
                className="fixed bg-white dark:bg-gray-900 border border-[#cbd1db] dark:border-gray-700 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 py-1.5 z-[9999] min-w-[180px] backdrop-blur-xl overflow-y-auto"
                style={(() => {
                  const rect = folderPickerRef.current?.getBoundingClientRect()
                  if (!rect) return {}
                  const dropdownHeight = Math.min((folders.length + 1) * 36 + 12, 300)
                  const spaceBelow = window.innerHeight - rect.bottom - 10
                  const spaceAbove = rect.top - 10
                  const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow
                  return {
                    left: Math.max(8, Math.min(rect.left, window.innerWidth - 196)),
                    ...(showAbove
                      ? { bottom: window.innerHeight - rect.top + 6, maxHeight: `${Math.min(spaceAbove, 300)}px` }
                      : { top: rect.bottom + 6, maxHeight: `${Math.min(spaceBelow, 300)}px` }),
                  }
                })()}
              >
                <button
                  onClick={() => {
                    moveNote(note.id, null)
                    setShowFolderPicker(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
                    !note.folderId ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  No folder
                </button>
                {folders.map((folder) => {
                  const IconComponent = getFolderIcon(folder.icon)
                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        moveNote(note.id, folder.id)
                        setShowFolderPicker(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2.5 rounded-lg transition-colors ${
                        note.folderId === folder.id ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" style={{ color: folder.color }} />
                      <span className="font-medium">{folder.name}</span>
                    </button>
                  )
                })}
              </div>,
              document.body
            )}
          </div>
          {note.tags && note.tags.length > 0 && <div className="flex flex-wrap items-center gap-1.5">
            {note.tags.map((tagName) => {
              const tag = tags.find((t) => t.name === tagName)
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: `${tag?.color || '#6b7280'}12`,
                    color: tag?.color || '#6b7280',
                  }}
                >
                  #{tagName}
                  <button
                    onClick={() => removeTagFromNote(note.id, tagName)}
                    className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 ml-0.5 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )
            })}
          </div>}
          <div className="relative" ref={tagPickerRef}>
              <button
                onClick={() => setShowTagPicker(!showTagPicker)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 dark:hover:bg-gray-800 transition-all text-white/70 dark:text-gray-400"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="text-[13px] font-medium">Tag</span>
              </button>

              {showTagPicker && createPortal(
                <div
                  ref={tagDropdownRef}
                  className="fixed bg-white dark:bg-gray-900 border border-[#cbd1db] dark:border-gray-700 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 p-2.5 z-[9999] min-w-[220px] backdrop-blur-xl"
                  style={(() => {
                    const rect = tagPickerRef.current?.getBoundingClientRect()
                    if (!rect) return {}
                    const spaceBelow = window.innerHeight - rect.bottom - 10
                    const spaceAbove = rect.top - 10
                    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow
                    return {
                      left: Math.max(8, Math.min(rect.left, window.innerWidth - 236)),
                      ...(showAbove
                        ? { bottom: window.innerHeight - rect.top + 6, maxHeight: `${Math.min(spaceAbove, 300)}px` }
                        : { top: rect.bottom + 6, maxHeight: `${Math.min(spaceBelow, 300)}px` }),
                    }
                  })()}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateAndAddTag()
                          setShowTagPicker(false)
                        }
                      }}
                      placeholder="New Tag..."
                      className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => {
                        handleCreateAndAddTag()
                        setShowTagPicker(false)
                      }}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                    {tags
                      .filter((t) => !note.tags?.includes(t.name))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            handleAddTag(tag.name)
                            setShowTagPicker(false)
                          }}
                          className="w-full px-2.5 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl flex items-center gap-2.5 transition-colors"
                        >
                          <span
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="font-medium text-gray-700 dark:text-gray-300">#{tag.name}</span>
                        </button>
                      ))}
                  </div>
                </div>,
                document.body
              )}
            </div>
        </div>
      </div>
      <FindReplaceBar 
        editor={editorRef}
        isOpen={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
      />
      {backlinks.length > 0 && (
        <div className="px-6 py-2 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={() => setShowBacklinks(!showBacklinks)}
            className="flex items-center gap-2 text-sm text-gray-600 transition-colors dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Link2 className="w-4 h-4" />
            {backlinks.length} backlink{backlinks.length > 1 ? 's' : ''}
            <ChevronDown className={`w-4 h-4 transition-transform ${showBacklinks ? 'rotate-180' : ''}`} />
          </button>
          {showBacklinks && (
            <div className="mt-2 space-y-1">
              {backlinks.map(bl => (
                <button
                  key={bl.id}
                  onClick={() => useNotesStore.getState().setSelectedNote(bl.id)}
                  className="flex items-center w-full gap-2 px-2 py-1 text-sm text-left text-gray-700 transition-colors rounded dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  {bl.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {note.isShared && note.sharePermission === 'view' && (
        <div className="mx-4 mt-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <Eye className="w-4 h-4 flex-shrink-0" />
          Read-only — you have view permission for this shared note
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {hasSpecializedEditor(note.noteType) ? (
          (() => {
            const SpecializedEditor = getEditorForNoteType(note.noteType)
            const isReadOnly = note.isShared && note.sharePermission === 'view'
            return (
              <div 
                className="h-full"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setSpecializedContextMenu({ x: e.clientX, y: e.clientY })
                }}
              >
                <SpecializedEditor
                  data={note.noteData}
                  onChange={isReadOnly ? () => {} : (newData) => {
                    const oldData = lastNoteDataRef.current
                    if (oldData) {
                      const oldStr = JSON.stringify(oldData)
                      const newStr = JSON.stringify(newData)
                      if (Math.abs(newStr.length - oldStr.length) > 100) {
                        saveNoteVersion(note.id, '', note.title, oldData)
                      }
                    }
                    lastNoteDataRef.current = newData
                    updateNote(note.id, { noteData: newData })
                  }}
                  noteTitle={note.title}
                  readOnly={isReadOnly}
                />
              </div>
            )
          })()
        ) : (
          <RichTextEditor
            noteId={note.id}
            content={note.content}
            onChange={handleContentChange}
            placeholder="Start writing..."
            paperType={paperType}
            onPaperTypeChange={handlePaperTypeChange}
            onEditorReady={setEditorRef}
            isExternalUpdate={note?._isExternalUpdate || false}
          />
        )}
      </div>
      {showNoteStatistics && <NoteStatistics note={note} />}
      {!hasSpecializedEditor(note.noteType) && (
        <NoteLinkPopover
          editor={editorRef}
          isOpen={noteLinkPopoverOpen}
          onClose={() => setNoteLinkPopoverOpen(false)}
          position={noteLinkPosition}
        />
      )}
      {voiceInputActive && (
        <VoiceInput
          isActive={voiceInputActive}
          onTranscript={(text) => {
            if (editorRef && !hasSpecializedEditor(note.noteType)) {
              editorRef.commands.insertContent(text + ' ')
            } else {
              const activeEl = document.activeElement
              if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                const start = activeEl.selectionStart ?? activeEl.value.length
                const end = activeEl.selectionEnd ?? activeEl.value.length
                const val = activeEl.value
                activeEl.value = val.slice(0, start) + text + ' ' + val.slice(end)
                activeEl.selectionStart = activeEl.selectionEnd = start + text.length + 1
                const inputEvent = new Event('input', { bubbles: true })
                activeEl.dispatchEvent(inputEvent)
              } else {
                toast('Click on a text field first, then speak', { icon: '🎤' })
              }
            }
          }}
          onToggle={(active) => setVoiceInputActive(active)}
        />
      )}
      {!hasSpecializedEditor(note.noteType) && <ImageUploadModal editor={editorRef} />}
      {!hasSpecializedEditor(note.noteType) && <LinkInsertModal editor={editorRef} />}
      {!hasSpecializedEditor(note.noteType) && <HTMLEditorModal editor={editorRef} />}
      {specializedContextMenu && hasSpecializedEditor(note.noteType) && createPortal(
        <SpecializedEditorContextMenu
          ref={specializedContextMenuRef}
          x={specializedContextMenu.x}
          y={specializedContextMenu.y}
          onClose={() => setSpecializedContextMenu(null)}
          onVersionHistory={() => {
            setVersionHistoryOpen(true, note.id)
            setSpecializedContextMenu(null)
          }}
          onVoiceInput={() => {
            setVoiceInputActive(true)
            setSpecializedContextMenu(null)
          }}
          onExport={() => {
            setExportModalOpen(true)
            setSpecializedContextMenu(null)
          }}
          onDuplicate={() => {
            handleDuplicate()
            setSpecializedContextMenu(null)
          }}
          onReminder={() => {
            setReminderModalOpen(true, note.id)
            setSpecializedContextMenu(null)
          }}
          noteType={note.noteType}
        />,
        document.body
      )}
    </div>
  )
}

const SpecializedEditorContextMenu = React.forwardRef(({ x, y, onClose, onVersionHistory, onVoiceInput, onExport, onDuplicate, onReminder, noteType }, ref) => {
  const [position, setPosition] = useState({ x, y })
  const menuRef = useRef(null)

  const config = NOTE_TYPE_CONFIG[noteType]
  const typeName = config?.name || 'Note'

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const padding = 8
      let adjustedX = x
      let adjustedY = y

      if (adjustedX + menuRect.width > window.innerWidth - padding) {
        adjustedX = window.innerWidth - menuRect.width - padding
      }
      if (adjustedY + menuRect.height > window.innerHeight - padding) {
        adjustedY = window.innerHeight - menuRect.height - padding
      }
      if (adjustedX < padding) adjustedX = padding
      if (adjustedY < padding) adjustedY = padding

      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  const menuItems = [
    { icon: <Mic className="w-4 h-4" />, label: 'Voice input', action: onVoiceInput },
    { icon: <History className="w-4 h-4" />, label: 'Version history', action: onVersionHistory },
    { type: 'divider' },
    { icon: <Copy className="w-4 h-4" />, label: 'Duplicate note', action: onDuplicate },
    { icon: <Download className="w-4 h-4" />, label: 'Export', action: onExport },
    { icon: <Bell className="w-4 h-4" />, label: 'Set reminder', action: onReminder },
  ]

  return (
    <div
      ref={(node) => {
        menuRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className="fixed z-[9999] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[200px] max-h-[400px] overflow-y-auto backdrop-blur-xl float-up"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {typeName}
      </div>
      {menuItems.map((item, index) => (
        item.type === 'divider' ? (
          <div key={index} className="my-1.5 mx-3 border-t border-[#cbd1db] dark:border-gray-800" />
        ) : (
          <button
            key={index}
            onClick={() => item.action()}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
          </button>
        )
      ))}
    </div>
  )
})
