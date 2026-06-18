import React, { useState } from 'react'
import { Clock, FolderOpen, ChevronDown, ChevronRight, Trash2, Plus, Radio } from 'lucide-react'
import { useStore } from '../store/useStore'
import { methodText } from '../lib/methodTheme'
import logo from '../assets/logo.png'
import type { HistoryEntry, Project, SavedRequest } from '@shared/types'

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname || url
  } catch {
    return url.length > 28 ? url.slice(0, 28) + '…' : url
  }
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const loadFromHistory = useStore((s) => s.loadFromHistory)
  const deleteHistoryEntry = useStore((s) => s.deleteHistoryEntry)

  return (
    <div
      onClick={() => loadFromHistory(entry)}
      className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 cursor-pointer rounded mx-1 transition-colors"
    >
      <span className={`text-xs font-bold font-mono w-14 shrink-0 ${methodText(entry.request.method)}`}>
        {entry.request.method}
      </span>
      <span className="flex-1 text-xs text-slate-300 truncate font-mono">
        {truncateUrl(entry.request.url)}
      </span>
      {entry.response && (
        <span className={`text-xs shrink-0 ${
          entry.response.status >= 400 ? 'text-red-400' : 'text-emerald-400'
        }`}>
          {entry.response.status}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id) }}
        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function ProjectItem({ project }: { project: Project }) {
  const [open, setOpen] = useState(true)
  const loadSaved = useStore((s) => s.loadSaved)
  const deleteProject = useStore((s) => s.deleteProject)
  const deleteSaved = useStore((s) => s.deleteSaved)

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700/50 cursor-pointer rounded mx-1 transition-colors"
      >
        {open ? <ChevronDown size={13} className="text-slate-500" /> : <ChevronRight size={13} className="text-slate-500" />}
        <FolderOpen size={13} className="text-slate-400 shrink-0" />
        <span className="flex-1 text-xs text-slate-300 font-medium truncate">{project.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); deleteProject(project.id) }}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && project.requests.map((req) => (
        <SavedItem key={req.id} saved={req} projectId={project.id} />
      ))}
      {open && project.requests.length === 0 && (
        <p className="pl-10 py-1 text-xs text-slate-600 italic">Empty</p>
      )}
    </div>
  )
}

function SavedItem({ saved, projectId }: { saved: SavedRequest; projectId: string }) {
  const loadSaved = useStore((s) => s.loadSaved)
  const deleteSaved = useStore((s) => s.deleteSaved)

  return (
    <div
      onClick={() => loadSaved(saved)}
      className="group flex items-center gap-2 pl-8 pr-3 py-1.5 hover:bg-slate-700/50 cursor-pointer rounded mx-1 transition-colors"
    >
      <span className={`text-xs font-bold font-mono w-12 shrink-0 ${methodText(saved.request.method)}`}>
        {saved.request.method}
      </span>
      <span className="flex-1 text-xs text-slate-300 truncate">{saved.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); deleteSaved(projectId, saved.id) }}
        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export default function Sidebar() {
  const history = useStore((s) => s.history)
  const projects = useStore((s) => s.projects)
  const createProject = useStore((s) => s.createProject)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [newProjectInput, setNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim())
      setNewProjectName('')
      setNewProjectInput(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/60 border-r border-slate-700 overflow-hidden w-64 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-700">
        <img src={logo} alt="ZazaRequester logo" className="w-16 h-16 shrink-0" />
        <h1 className="text-sm font-bold text-slate-100 tracking-wide">ZazaRequester</h1>
      </div>

      <button
        onClick={() => window.api.openIntercept()}
        className="flex items-center gap-2 mx-3 my-2 px-3 py-2 bg-slate-700 hover:bg-indigo-600 rounded text-sm text-slate-200 transition-colors"
      >
        <Radio size={14} /> Open Intercept
      </button>

      <div className="flex-1 overflow-auto py-2">
        {/* History section */}
        <div className="mb-2">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-1.5 w-full px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
          >
            {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Clock size={12} />
            History
            <span className="ml-auto text-slate-600">{history.length}/5</span>
          </button>
          {historyOpen && (
            <div>
              {history.length === 0 ? (
                <p className="px-4 py-2 text-xs text-slate-600 italic">No history yet</p>
              ) : (
                history.map((entry) => <HistoryItem key={entry.id} entry={entry} />)
              )}
            </div>
          )}
        </div>

        {/* Projects section */}
        <div>
          <div className="flex items-center w-full px-4 py-1.5">
            <button
              onClick={() => setProjectsOpen((o) => !o)}
              className="flex items-center gap-1.5 flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
            >
              {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FolderOpen size={12} />
              Projects
            </button>
            <button
              onClick={() => setNewProjectInput(true)}
              className="text-slate-500 hover:text-indigo-400 transition-colors"
              title="New project"
            >
              <Plus size={13} />
            </button>
          </div>

          {newProjectInput && (
            <div className="px-3 py-1.5 flex gap-1.5">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') { setNewProjectInput(false); setNewProjectName('') }
                }}
                placeholder="Project name"
                autoFocus
                className="flex-1 bg-slate-700 border border-indigo-500 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 outline-none"
              />
              <button
                onClick={handleCreateProject}
                className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-500 transition-colors"
              >
                Add
              </button>
            </div>
          )}

          {projectsOpen && (
            <div>
              {projects.length === 0 && !newProjectInput ? (
                <p className="px-4 py-2 text-xs text-slate-600 italic">No projects yet</p>
              ) : (
                projects.map((p) => <ProjectItem key={p.id} project={p} />)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
