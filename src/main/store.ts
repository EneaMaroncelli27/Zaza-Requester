import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppStore } from '../shared/types'

const DEFAULT_STORE: AppStore = { history: [], projects: [] }

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'store.json')
}

export function readStore(): AppStore {
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppStore>
    return {
      history: parsed.history ?? [],
      projects: parsed.projects ?? []
    }
  } catch {
    return { ...DEFAULT_STORE }
  }
}

export function writeStore(store: AppStore): void {
  const filePath = getStorePath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8')
}
