import { useState, useCallback } from 'react'
import { AppLayout } from './components/layout'
import { TodayView, ContentView } from './views'
import { QuickCaptureModal, type QuickCaptureSubmission } from './components/ui'
import { useKeyboardShortcut } from './hooks'
import { useApp } from './lib'

type ViewType = 'today' | 'content'

function App() {
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [activeView, setActiveView] = useState<ViewType>('today')
  const { addTask } = useApp()

  const openQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(true)
  }, [])

  const closeQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(false)
  }, [])

  const handleQuickCaptureSubmit = useCallback((submission: QuickCaptureSubmission) => {
    if (submission.destination === 'task') {
      const data = submission.data
      addTask({
        title: data.title,
        category: data.category,
        status: 'todo',
        dueDate: data.dueDate,
        notes: data.notes,
        link: data.link,
        isSyncPriority: false,
        sortOrder: 0,
        source: 'local',
      })
    }
  }, [addTask])

  // Register ⌘K keyboard shortcut
  useKeyboardShortcut({
    key: 'k',
    metaKey: true,
    callback: openQuickCapture,
  })

  return (
    <AppLayout>
      {/* View Navigation */}
      <nav className="flex gap-1 mb-8 border-b border-surface1 pb-4">
        <button
          onClick={() => setActiveView('today')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeView === 'today'
              ? 'bg-mauve/20 text-mauve'
              : 'text-overlay1 hover:text-text hover:bg-surface0'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setActiveView('content')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeView === 'content'
              ? 'bg-mauve/20 text-mauve'
              : 'text-overlay1 hover:text-text hover:bg-surface0'
          }`}
        >
          Content
        </button>
      </nav>

      {activeView === 'today' && <TodayView onAddTask={openQuickCapture} />}
      {activeView === 'content' && <ContentView />}

      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={closeQuickCapture}
        onSubmit={handleQuickCaptureSubmit}
      />
    </AppLayout>
  )
}

export default App
