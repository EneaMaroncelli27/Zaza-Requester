import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function SaveModal() {
  const projects = useStore((s) => s.projects)
  const saveToProject = useStore((s) => s.saveToProject)
  const setShowSaveModal = useStore((s) => s.setShowSaveModal)

  const [name, setName] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>(
    projects[0]?.id ?? '__new__'
  )
  const [newProjectName, setNewProjectName] = useState('')

  const handleSave = () => {
    if (!name.trim()) return
    if (selectedProject === '__new__' && !newProjectName.trim()) return
    saveToProject(selectedProject, name.trim(), newProjectName.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg w-96 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-slate-100">Save Request</h2>
          <button
            onClick={() => setShowSaveModal(false)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
              Request name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My request"
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition-colors"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="__new__">+ New project</option>
            </select>
          </div>

          {selectedProject === '__new__' && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-1.5">
                Project name
              </label>
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My project"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={() => setShowSaveModal(false)}
            className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              !name.trim() ||
              (selectedProject === '__new__' && !newProjectName.trim())
            }
            className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
