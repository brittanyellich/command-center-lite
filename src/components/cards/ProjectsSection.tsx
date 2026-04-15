import { useState, useEffect, useCallback } from 'react'
import { ProjectItemCard } from './ProjectItemCard'
import { AddProjectModal } from '../ui/AddProjectModal'
import { isElectron } from '../../lib/electron'
import type { ProjectItem, ProjectStatus } from '../../types'

export function ProjectsSection() {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    if (!isElectron() || !window.electronAPI) {
      setIsLoading(false)
      return
    }

    try {
      const items = await window.electronAPI.db.projects.getAll()
      setProjects(items)
      setError(null)
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleAddProject = async (data: { title: string; status: ProjectStatus; notes?: string }) => {
    if (!isElectron() || !window.electronAPI) return

    try {
      await window.electronAPI.db.projects.create(data)
      await loadProjects()
    } catch (err) {
      console.error('Error creating project:', err)
      throw err
    }
  }

  const handleUpdateStatus = async (id: string, status: ProjectStatus) => {
    if (!isElectron() || !window.electronAPI) return

    try {
      await window.electronAPI.db.projects.update(id, { status })
      await loadProjects()
    } catch (err) {
      console.error('Error updating project status:', err)
    }
  }

  const handleUpdateNotes = async (id: string, notes: string) => {
    if (!isElectron() || !window.electronAPI) return

    try {
      await window.electronAPI.db.projects.update(id, { notes })
      await loadProjects()
    } catch (err) {
      console.error('Error updating project notes:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!isElectron() || !window.electronAPI) return

    try {
      await window.electronAPI.db.projects.delete(id)
      await loadProjects()
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  // Group projects by status
  const ideaProjects = projects.filter(p => p.status === 'idea')
  const inProgressProjects = projects.filter(p => p.status === 'in-progress')
  const completedProjects = projects.filter(p => p.status === 'completed')

  if (isLoading) {
    return (
      <div className="bg-surface0 border border-surface1 rounded-2xl p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-surface1 rounded w-1/3" />
          <div className="h-16 bg-surface1 rounded" />
          <div className="h-16 bg-surface1 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface0 border border-surface1 rounded-2xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wider text-overlay1">Projects</h2>
          <p className="text-sm text-overlay0 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-mauve hover:bg-mauve/10 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red/20 text-red px-3 py-2 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-overlay1 text-sm">No projects yet.</p>
          <p className="text-overlay0 text-xs mt-1">Capture your next idea to get started.</p>
        </div>
      )}

      {/* Ideas */}
      {ideaProjects.length > 0 && (
        <div className="mb-4">
          <p className="font-mono text-xs uppercase tracking-wider text-mauve mb-2">
            💡 Ideas ({ideaProjects.length})
          </p>
          <div className="space-y-2">
            {ideaProjects.map(project => (
              <ProjectItemCard
                key={project.id}
                project={project}
                onUpdateStatus={handleUpdateStatus}
                onUpdateNotes={handleUpdateNotes}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgressProjects.length > 0 && (
        <div className="mb-4">
          <p className="font-mono text-xs uppercase tracking-wider text-blue mb-2">
            🔨 In Progress ({inProgressProjects.length})
          </p>
          <div className="space-y-2">
            {inProgressProjects.map(project => (
              <ProjectItemCard
                key={project.id}
                project={project}
                onUpdateStatus={handleUpdateStatus}
                onUpdateNotes={handleUpdateNotes}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedProjects.length > 0 && (
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-green mb-2">
            ✅ Completed ({completedProjects.length})
          </p>
          <div className="space-y-2">
            {completedProjects.map(project => (
              <ProjectItemCard
                key={project.id}
                project={project}
                onUpdateStatus={handleUpdateStatus}
                onUpdateNotes={handleUpdateNotes}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProject={handleAddProject}
      />
    </div>
  )
}
