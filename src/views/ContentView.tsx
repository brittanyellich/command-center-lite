import { ProjectsSection } from '../components/cards'

export function ContentView() {
  return (
    <div className="space-y-8">
      {/* Section header */}
      <div>
        <h2 className="text-2xl font-display text-text mb-1">Content</h2>
        <p className="text-sm text-overlay1">Track your projects, writing, and reading.</p>
      </div>

      {/* Projects Section */}
      <ProjectsSection />
    </div>
  )
}
