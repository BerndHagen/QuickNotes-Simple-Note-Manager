import { useEffect, useState } from 'react'
import { X, Users, ExternalLink, LogOut, RefreshCw, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useNotesStore } from '../store'
import { useUIStore } from '../store'

export default function SharedNotesView() {
  const { sharedNotesViewOpen, setSharedNotesViewOpen } = useUIStore()
  const { 
    sharedNotes, 
    pendingShares, 
    loadSharedNotes, 
    acceptShare, 
    declineShare, 
    leaveSharedNote,
    setSelectedNoteId 
  } = useNotesStore()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('accepted')

  useEffect(() => {
    if (sharedNotesViewOpen) {
      handleRefresh()
    }
  }, [sharedNotesViewOpen])

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      await loadSharedNotes()
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async (shareId) => {
    try {
      await acceptShare(shareId)
      setActiveTab('accepted')
    } catch (error) {
      await handleRefresh()
    }
  }

  const handleDecline = async (shareId) => {
    if (!confirm('Do you really want to decline this share?')) return
    
    try {
      await declineShare(shareId)
      await handleRefresh()
    } catch (error) {
    }
  }

  const handleLeave = async (noteId) => {
    if (!confirm('Do you really want to leave this shared note?')) return
    
    try {
      await leaveSharedNote(noteId)
      await handleRefresh()
    } catch (error) {
    }
  }

  const handleOpenNote = (noteId) => {
    setSelectedNoteId(noteId)
    setSharedNotesViewOpen(false)
  }

  if (!sharedNotesViewOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Shared Notes</h2>
              <p className="text-sm text-white/70">Notes shared with you</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => setSharedNotesViewOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="border-b border-[#cbd1db] dark:border-gray-700 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('accepted')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'accepted'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Accepted ({sharedNotes.length})
            </button>
            
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors relative ${
                activeTab === 'pending'
                  ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Pending ({pendingShares.length})
              {pendingShares.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'accepted' && (
            <div className="space-y-3">
              {sharedNotes.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No shared notes
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    When someone shares a note with you, it will appear here
                  </p>
                </div>
              ) : (
                sharedNotes.map((share) => {
                  const note = share.notes
                  if (!note) return null
                  
                  return (
                    <div
                      key={share.id}
                      className="p-4 border border-[#cbd1db] dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              {note.title}
                            </h3>
                            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                              {share.permission === 'edit' ? 'Can Edit' : 'Read Only'}
                            </span>
                          </div>
                          
                          {note.content && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                              {(note.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => note.id && handleOpenNote(note.id)}
                            disabled={!note.id}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </button>
                          
                          <button
                            onClick={() => handleLeave(note.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Leave"
                          >
                            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingShares.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No pending shares
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Share requests will appear here
                  </p>
                </div>
              ) : (
                pendingShares.map((share) => {
                  const note = share.notes || share
                  if (!note || !note.id) {
                    return null
                  }
                  
                  return (
                    <div
                      key={share.id}
                      className="p-4 border-2 border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              New share: {note.title}
                            </h3>
                          </div>
                          
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <span className="font-medium">{share.shared_by}</span> wants to share this note with you
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-[#cbd1db] dark:border-gray-600">
                              {share.permission === 'edit' ? 'Edit Permission' : 'Read Only'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleAccept(share.id)}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Accept
                          </button>
                          
                          <button
                            onClick={() => handleDecline(share.id)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-[#cbd1db] dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>
              Shared notes are synchronized in real-time. Changes are immediately visible to all participants.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
