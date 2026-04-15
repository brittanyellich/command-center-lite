import { useState } from 'react'
import type { ProjectItem, ProjectStatus } from '../../types'

interface ProjectItemCardProps {
  project: ProjectItem
  onUpdateStatus: (id: string, status: ProjectStatus) => Promise<void>
  onUpdateNotes: (id: string, notes: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const statusConfig: Record<ProjectStatus, { label: string; emoji: string; color: string }> = {
  idea: { label: 'Idea', emoji: '💡', color: 'text-mauve' },
  'in-progress': { label: 'In Progress', emoji: '🔨', color: 'text-blue' },
  completed: { label: 'Completed', emoji: '✅', color: 'text-green' },
}

const statusFlow: ProjectStatus[] = ['idea', 'in-progress', 'completed']

export function ProjectItemCard({
  project,
  onUpdateStatus,
  onUpdateNotes,
  onDelete,
}: ProjectItemCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editNotes, setEditNotes] = useState(project.notes || '')
  const [isExpanded, setIsExpanded] = useState(false)

  const currentStatusIndex = statusFlow.indexOf(project.status)
  const nextStatus = currentStatusIndex < statusFlow.length - 1 ? statusFlow[currentStatusIndex + 1] : null

  const handleSaveNotes = async () => {
    await onUpdateNotes(project.id, editNotes)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditNotes(project.notes || '')
    setIsEditing(false)
  }

  return (
    <div className="group bg-mantle border border-surface1 rounded-lg p-3 hover:border-overlay0 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{statusConfig[project.status].emoji}</span>
            <span className="text-sm font-medium text-text truncate">{project.title}</span>
          </div>

          {/* Notes preview (when not expanded) */}
          {project.notes && !isExpanded && !isEditing && (
            <p className="text-xs text-overlay1 truncate ml-6">{project.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Advance status button */}
          {nextStatus && (
            <button
              onClick={() => onUpdateStatus(project.id, nextStatus)}
              className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
              title={`Move to ${statusConfig[nextStatus].label}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}

          {/* Expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-overlay1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(project.id)}
            className="p-1 rounded text-overlay1 hover:text-red hover:bg-red/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Delete project"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="mt-3 ml-6 space-y-2">
          {/* Status changer */}
          <div className="flex gap-1">
            {statusFlow.map((s) => (
              <button
                key={s}
                onClick={() => onUpdateStatus(project.id, s)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  project.status === s
                    ? s === 'idea'
                      ? 'bg-mauve/20 text-mauve'
                      : s === 'in-progress'
                      ? 'bg-blue/20 text-blue'
                      : 'bg-green/20 text-green'
                    : 'bg-surface0 text-overlay1 hover:bg-surface1'
                }`}
              >
                {statusConfig[s].emoji} {statusConfig[s].label}
              </button>
            ))}
          </div>

          {/* Notes editor */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes..."
                rows={3}
                className="w-full bg-surface0 border border-surface1 rounded-lg px-3 py-2 text-sm text-text placeholder:text-overlay0 focus:outline-none focus:ring-2 focus:ring-mauve/50 transition-all resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNotes}
                  className="px-3 py-1 rounded text-xs font-medium bg-mauve text-base hover:bg-mauve/80 transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 rounded text-xs text-overlay1 hover:text-text hover:bg-surface1 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setEditNotes(project.notes || '')
                setIsEditing(true)
              }}
              className="text-sm text-overlay1 cursor-pointer hover:text-text transition-colors p-2 rounded hover:bg-surface0"
            >
              {project.notes || 'Click to add notes...'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
