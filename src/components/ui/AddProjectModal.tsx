import { useEffect, useRef, useState } from 'react'
import type { ProjectStatus } from '../../types'

interface AddProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onAddProject: (data: {
    title: string
    status: ProjectStatus
    notes?: string
  }) => Promise<void>
}

export function AddProjectModal({
  isOpen,
  onClose,
  onAddProject,
}: AddProjectModalProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('idea')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setStatus('idea')
      setNotes('')
      setError(null)
      setTimeout(() => titleInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onAddProject({
        title: title.trim(),
        status,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-crust/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-project-title"
    >
      <div className="bg-surface0 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-mantle px-6 py-4 border-b border-surface1">
          <div className="flex items-center justify-between">
            <h2 id="add-project-title" className="text-lg font-medium text-text">
              New Project Idea
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-overlay1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red/20 text-red px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="project-title" className="block text-sm text-overlay1 mb-2">
              Project Title <span className="text-red">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Build a CLI tool, Start a blog"
              className="w-full bg-mantle border border-surface1 rounded-lg px-3 py-2 text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve/50 focus:border-mauve transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm text-overlay1 mb-2">Status</label>
            <div className="flex gap-2">
              {(['idea', 'in-progress', 'completed'] as ProjectStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    status === s
                      ? s === 'idea'
                        ? 'bg-mauve/20 text-mauve'
                        : s === 'in-progress'
                        ? 'bg-blue/20 text-blue'
                        : 'bg-green/20 text-green'
                      : 'bg-mantle text-overlay1 hover:bg-surface1'
                  }`}
                >
                  {s === 'idea' ? '💡 Idea' : s === 'in-progress' ? '🔨 In Progress' : '✅ Completed'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="project-notes" className="block text-sm text-overlay1 mb-2">
              Notes
            </label>
            <textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's the idea? Any initial thoughts?"
              rows={3}
              className="w-full bg-mantle border border-surface1 rounded-lg px-3 py-2 text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve/50 focus:border-mauve transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-overlay1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mauve text-base hover:bg-mauve/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
