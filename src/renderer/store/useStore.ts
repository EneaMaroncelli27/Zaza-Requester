import { create } from 'zustand'
import type {
  RequestData,
  ResponseData,
  Header,
  BodyType,
  HttpMethod,
  HistoryEntry,
  Project,
  SavedRequest,
  AppStore
} from '@shared/types'

const MAX_HISTORY = 5

const DEFAULT_REQUEST: RequestData = {
  method: 'GET',
  url: '',
  headers: [],
  body: '',
  bodyType: 'none'
}

interface StoreState {
  currentRequest: RequestData
  response: ResponseData | null
  responseError: string | null
  isLoading: boolean
  history: HistoryEntry[]
  projects: Project[]
  showSaveModal: boolean
  initialized: boolean

  // Actions
  setMethod: (method: HttpMethod) => void
  setUrl: (url: string) => void
  setHeaders: (headers: Header[]) => void
  setBody: (body: string) => void
  setBodyType: (bodyType: BodyType) => void
  importRequest: (req: RequestData) => void
  loadFromHistory: (entry: HistoryEntry) => void
  loadSaved: (req: SavedRequest) => void
  send: () => Promise<void>
  saveToProject: (projectId: string | '__new__', name: string, newProjectName?: string) => void
  createProject: (name: string) => void
  deleteProject: (id: string) => void
  deleteHistoryEntry: (id: string) => void
  deleteSaved: (projectId: string, requestId: string) => void
  setShowSaveModal: (show: boolean) => void
  initStore: () => Promise<void>
}

function persist(history: HistoryEntry[], projects: Project[]): void {
  const store: AppStore = { history, projects }
  window.api.writeStore(store).catch(console.error)
}

export const useStore = create<StoreState>((set, get) => ({
  currentRequest: { ...DEFAULT_REQUEST },
  response: null,
  responseError: null,
  isLoading: false,
  history: [],
  projects: [],
  showSaveModal: false,
  initialized: false,

  setMethod: (method) =>
    set((s) => ({ currentRequest: { ...s.currentRequest, method } })),

  setUrl: (url) =>
    set((s) => ({ currentRequest: { ...s.currentRequest, url } })),

  setHeaders: (headers) =>
    set((s) => ({ currentRequest: { ...s.currentRequest, headers } })),

  setBody: (body) =>
    set((s) => ({ currentRequest: { ...s.currentRequest, body } })),

  setBodyType: (bodyType) =>
    set((s) => ({ currentRequest: { ...s.currentRequest, bodyType } })),

  importRequest: (req) => set({ currentRequest: req }),

  loadFromHistory: (entry) => set({ currentRequest: { ...entry.request }, response: entry.response }),

  loadSaved: (saved) => set({ currentRequest: { ...saved.request }, response: null }),

  send: async () => {
    const { currentRequest } = get()
    if (!currentRequest.url.trim()) return

    set({ isLoading: true, response: null, responseError: null })

    try {
      const response = await window.api.execute(currentRequest)

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        request: { ...currentRequest },
        response
      }

      set((s) => {
        const history = [entry, ...s.history].slice(0, MAX_HISTORY)
        persist(history, s.projects)
        return { response, isLoading: false, history }
      })
    } catch (err) {
      set({
        isLoading: false,
        responseError: err instanceof Error ? err.message : String(err)
      })
    }
  },

  saveToProject: (projectId, name, newProjectName) => {
    const { currentRequest, projects } = get()
    const saved: SavedRequest = {
      id: crypto.randomUUID(),
      name,
      request: { ...currentRequest }
    }

    let updatedProjects: Project[]

    if (projectId === '__new__' && newProjectName) {
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: newProjectName,
        requests: [saved]
      }
      updatedProjects = [...projects, newProject]
    } else {
      updatedProjects = projects.map((p) =>
        p.id === projectId ? { ...p, requests: [...p.requests, saved] } : p
      )
    }

    set((s) => {
      persist(s.history, updatedProjects)
      return { projects: updatedProjects, showSaveModal: false }
    })
  },

  createProject: (name) => {
    const project: Project = { id: crypto.randomUUID(), name, requests: [] }
    set((s) => {
      const projects = [...s.projects, project]
      persist(s.history, projects)
      return { projects }
    })
  },

  deleteProject: (id) => {
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id)
      persist(s.history, projects)
      return { projects }
    })
  },

  deleteHistoryEntry: (id) => {
    set((s) => {
      const history = s.history.filter((e) => e.id !== id)
      persist(history, s.projects)
      return { history }
    })
  },

  deleteSaved: (projectId, requestId) => {
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === projectId
          ? { ...p, requests: p.requests.filter((r) => r.id !== requestId) }
          : p
      )
      persist(s.history, projects)
      return { projects }
    })
  },

  setShowSaveModal: (show) => set({ showSaveModal: show }),

  initStore: async () => {
    try {
      const stored = await window.api.readStore()
      set({
        history: stored.history ?? [],
        projects: stored.projects ?? [],
        initialized: true
      })
    } catch {
      set({ initialized: true })
    }
  }
}))
