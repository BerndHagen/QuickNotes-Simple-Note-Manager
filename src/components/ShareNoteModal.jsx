import { useCallback, useState, useEffect } from 'react'
import { X, Mail, Link2, Copy, Check, Trash2, UserPlus, Users } from 'lucide-react'
import { useNotesStore } from '../store'
import { useUIStore } from '../store'
import toast from 'react-hot-toast'
import LegacyDialog from './ui/LegacyDialog'
import { ConfirmDialog } from './FolderDialogs'
import { backend } from '../lib/backend'

export default function ShareNoteModal() {
  const { shareModalOpen, shareNoteId, setShareModalOpen } = useUIStore()
  const { notes, shareNote, removeShare, loadSharedNotes } = useNotesStore()
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState('edit')
  const [isLoading, setIsLoading] = useState(false)
  const [shares, setShares] = useState([])
  const [copiedToken, setCopiedToken] = useState(null)
  const [shareToRemove, setShareToRemove] = useState(null)

  const note = notes.find(n => n.id === shareNoteId)

  const loadShares = useCallback(async () => {
    if (!shareNoteId) return
    try {
      const { data, error } = await backend
        .from('shared_notes')
        .select('*')
        .eq('note_id', shareNoteId)
      
      if (error) throw error
      setShares(data || [])
    } catch (error) {
      toast.error(`Could not load sharing details: ${error.message || 'Unknown error'}`)
    }
  }, [shareNoteId])

  useEffect(() => {
    if (shareModalOpen && shareNoteId) void loadShares()
  }, [loadShares, shareModalOpen, shareNoteId])

  const handleShare = async (e) => {
    e.preventDefault()
    if (!email.trim() || !shareNoteId) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      await shareNote(shareNoteId, email.trim(), permission)
      setEmail('')
      await loadShares()
      await loadSharedNotes()
    } catch {
      // The store presents the actionable server error.
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async (shareToken) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareToken}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedToken(shareToken)
      toast.success('Link copied!')
      setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleRemoveShare = async () => {
    if (!shareToRemove) return
    try {
      await removeShare(shareToRemove.id)
      await loadShares()
      await loadSharedNotes()
    } catch {
      // The store presents the actionable server error.
    }
  }

  if (!shareModalOpen || !note) return null

  return (
    <LegacyDialog label="Share note" onClose={() => setShareModalOpen(false)} align="center">
      <div className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Share Note</h2>
              <p className="text-sm text-white/70">{note.title}</p>
            </div>
          </div>
          <button
            onClick={() => setShareModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-content-muted flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Person
            </h3>
            
            <form onSubmit={handleShare} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-muted mb-2">
                  Email Address
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full pl-10 pr-4 py-2 border border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-surface-sunken text-content"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-content-muted mb-2">
                  Permission
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 p-3 border border-subtle rounded-lg cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="radio"
                      value="view"
                      checked={permission === 'view'}
                      onChange={(e) => setPermission(e.target.value)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-content">
                        Read Only
                      </div>
                      <div className="text-xs text-content-muted">
                        Can only view the note
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex-1 flex items-center gap-2 p-3 border border-subtle rounded-lg cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="radio"
                      value="edit"
                      checked={permission === 'edit'}
                      onChange={(e) => setPermission(e.target.value)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-content">
                        Can Edit
                      </div>
                      <div className="text-xs text-content-muted">
                        Can edit the note
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-surface-active dark:disabled:bg-surface-active text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {isLoading ? 'Sharing...' : 'Create Share'}
              </button>
            </form>
          </div>
          {shares.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-content-muted flex items-center gap-2">
                <Users className="w-4 h-4" />
                Shared with ({shares.length})
              </h3>
              
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 bg-surface-sunken dark:bg-surface-sunken rounded-lg border border-subtle "
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-content truncate">
                          {share.email}
                        </div>
                        <div className="text-xs text-content-muted">
                          {share.permission === 'edit' ? 'Can edit' : 'Read only'} {"\u2022"} 
                          {share.status === 'pending' && ' Pending'}
                          {share.status === 'accepted' && ' Accepted'}
                          {share.status === 'declined' && ' Declined'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(share.share_link)}
                        className="p-2 hover:bg-surface-sunken dark:hover:bg-surface-active rounded-lg transition-colors"
                        title="Copy link"
                      >
                        {copiedToken === share.share_link ? (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-content-muted" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => setShareToRemove(share)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Remove share"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex gap-3">
              <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Enter the person's email address</li>
                  <li>Choose the permission (Read or Edit)</li>
                  <li>Copy the link and send it to them</li>
                  <li>They can open the link and accept the share</li>
                  <li>The note will appear in their "Shared Notes" folder</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={!!shareToRemove}
          onClose={() => setShareToRemove(null)}
          onConfirm={handleRemoveShare}
          title="Remove access?"
          description={
            shareToRemove
              ? `${shareToRemove.email} will immediately lose access to this note.`
              : ''
          }
          confirmLabel="Remove access"
        />
      </div>
    </LegacyDialog>
  )
}
