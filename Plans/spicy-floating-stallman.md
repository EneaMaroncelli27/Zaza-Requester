# ZazaRequester — curl GUI Desktop App

## Context

Build a Linux desktop HTTP client that wraps curl in a GUI. The user needs to visually compose requests (URL, method, headers, body), execute them via the system `curl` binary, view formatted responses, and import raw curl commands copied from the browser network tab. History auto-saves last 5 requests (rolling); users can also save requests permanently into named project folders.

---

## Stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 30 |
| Bundler | electron-vite (Vite-based, fast HMR) |
| UI framework | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Body/response editor | CodeMirror 6 (lighter than Monaco in Electron) |
| Persistence | electron-store (JSON, stored in `~/.config/ZazaRequester/`) |
| HTTP execution | `child_process.spawn('curl', [...args])` in main process |

---

## App Layout

```
┌──────────────────┬────────────────────────────────────────────┐
│  SIDEBAR         │  REQUEST PANEL                             │
│                  │                                            │
│  ▼ History (5)   │  [GET ▼]  [URL input..................]  [Send] │
│    · GET /api    │                                            │
│    · POST /auth  │  [Headers] [Body] [Import cURL]            │
│                  │  ┌──────────────────────────────────────┐  │
│  ▼ Projects      │  │  key-value table / body editor /     │  │
│    ▼ MyProject   │  │  curl paste textarea                 │  │
│      · save1     │  └──────────────────────────────────────┘  │
│      · save2     │  [Save to project ▼]                       │
│  [+ New Project] │                                            │
│                  │  ── RESPONSE ──────────────────────────    │
│                  │  200 OK  · 142ms  · 1.2kb               │
│                  │  [Headers] [Body]                          │
│                  │  { "data": ...  }                          │
└──────────────────┴────────────────────────────────────────────┘
```

---

## File Structure

```
ZazaRequester/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron app entry, BrowserWindow creation
│   │   ├── ipc.ts            # All ipcMain handlers
│   │   ├── curl.ts           # curl execution: spawn + response parsing
│   │   └── store.ts          # electron-store instance (persistence)
│   ├── preload/
│   │   └── index.ts          # contextBridge — exposes typed API to renderer
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx           # Root layout: Sidebar + RequestPanel
│       ├── components/
│       │   ├── Sidebar.tsx           # History list + Projects tree
│       │   ├── RequestPanel.tsx      # Method/URL bar + tabs + send button
│       │   ├── HeadersEditor.tsx     # Key-value rows (add/remove/toggle)
│       │   ├── BodyEditor.tsx        # CodeMirror 6 textarea with JSON highlight
│       │   ├── CurlImport.tsx        # Paste curl → parse → populate fields
│       │   ├── ResponsePanel.tsx     # Status badge + headers + body viewer
│       │   └── SaveModal.tsx         # Dropdown/modal to pick project + name
│       ├── store/
│       │   └── useStore.ts           # Zustand: current request state + UI state
│       └── lib/
│           ├── curlParser.ts         # Pure function: string → RequestData
│           ├── curlBuilder.ts        # RequestData → curl args array
│           └── types.ts              # Shared TS interfaces
```

---

## Data Types (`src/renderer/lib/types.ts`)

```ts
interface Header { key: string; value: string; enabled: boolean }

interface RequestData {
  method: string           // GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS
  url: string
  headers: Header[]
  body: string
  bodyType: 'none' | 'raw' | 'json'
}

interface ResponseData {
  status: number
  statusText: string
  headers: Header[]
  body: string
  durationMs: number
  sizeBytes: number
}

interface HistoryEntry {
  id: string
  timestamp: number
  request: RequestData
  response: ResponseData
}

interface SavedRequest {
  id: string
  name: string
  request: RequestData
}

interface Project {
  id: string
  name: string
  requests: SavedRequest[]
}

interface AppStore {
  history: HistoryEntry[]    // max 5, rolling — newest first
  projects: Project[]
}
```

---

## IPC Contract

All renderer ↔ main communication goes through the contextBridge. Three channels:

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `curl:execute` | renderer→main | `RequestData` | `ResponseData` |
| `store:read` | renderer→main | — | `AppStore` |
| `store:write` | renderer→main | `AppStore` | `void` |

Preload exposes: `window.api.execute(req)`, `window.api.readStore()`, `window.api.writeStore(store)`.

---

## Implementation Steps

### 1 — Project Scaffold
- `bun create electron-vite@latest . --template react-ts`
- Install: `tailwindcss`, `shadcn/ui`, `zustand`, `electron-store`, `@codemirror/lang-json`, `@codemirror/view`, `nanoid`
- Configure Tailwind, tsconfigs, electron-vite config
- Add `.gitignore`, `README.md`

### 2 — Types & lib (`src/renderer/lib/`)
- `types.ts` — all interfaces above
- `curlParser.ts` — parse pasted curl string into `RequestData`:
  - Tokenize handling backslash continuations and quoted strings
  - Extract: URL (bare arg or `--url`), method (`-X`/`--request`, infer POST if body present), headers (`-H`/`--header`), body (`-d`/`--data`/`--data-raw`/`--data-binary`), ignore `--compressed`
  - Auto-detect `Content-Type: application/json` → set `bodyType: 'json'`
- `curlBuilder.ts` — `RequestData` → `string[]` args for spawn:
  - `-s -i -X METHOD URL`
  - `-H 'Key: Value'` per enabled header
  - `--data-raw 'body'` if body present
  - Return args array (never interpolate into shell string — avoids injection)

### 3 — Main Process (`src/main/`)
- `store.ts`: electron-store schema with defaults (`{ history: [], projects: [] }`)
- `curl.ts`: `executeCurl(req: RequestData): Promise<ResponseData>`
  - Build args via `curlBuilder`
  - `spawn('curl', args)` — capture stdout (headers+body via `-i`), stderr, timing
  - Parse stdout: split on `\r\n\r\n`, first chunk = status line + response headers, rest = body
  - Return `ResponseData`
- `ipc.ts`: register handlers for all three channels
- `index.ts`: create BrowserWindow (800×600 min, frameless optional), load renderer, register IPC

### 4 — Preload (`src/preload/index.ts`)
- `contextBridge.exposeInMainWorld('api', { execute, readStore, writeStore })`
- Each method calls `ipcRenderer.invoke(channel, payload)`

### 5 — Zustand Store (`src/renderer/store/useStore.ts`)
- State: `currentRequest: RequestData`, `response: ResponseData | null`, `isLoading: boolean`, `appStore: AppStore`
- Actions: `setRequest`, `send` (calls `window.api.execute`, updates history, caps at 5), `saveToProject`, `loadFromHistory`, `loadSaved`, `createProject`, `deleteProject`
- Load `appStore` from `window.api.readStore()` on init; persist on every mutation via `window.api.writeStore()`

### 6 — Components

**`HeadersEditor.tsx`**
- Rendered table of rows: enabled checkbox, key input, value input, delete button
- "Add header" row at bottom
- Controlled by Zustand `currentRequest.headers`

**`BodyEditor.tsx`**
- Tabs: None / Raw / JSON
- CodeMirror 6 editor for Raw and JSON modes (JSON mode adds syntax highlight + fold)
- Bound to `currentRequest.body`

**`CurlImport.tsx`**
- `<textarea>` for paste
- "Import" button → calls `curlParser(text)` → dispatches `setRequest(parsed)`
- Shows parse errors inline

**`RequestPanel.tsx`**
- Method `<Select>` + URL `<Input>` in top bar
- "Send" button → calls `store.send()`
- Tabs: Headers | Body | Import cURL
- "Save to project" button → opens `SaveModal`

**`ResponsePanel.tsx`**
- Status badge (green/red based on 2xx/4xx/5xx)
- Duration + size metadata
- Tabs: Response Headers (key-value table) | Body (CodeMirror read-only)
- Auto-detect JSON body → pretty-print

**`Sidebar.tsx`**
- History section: last 5 entries, click loads into request panel
- Projects section: collapsible tree, click loads saved request
- "New project" button

**`SaveModal.tsx`**
- Dropdown to pick existing project or "New project" (inline name input)
- Name field for the saved request
- Calls `store.saveToProject()`

**`App.tsx`**
- Two-column layout: `<Sidebar>` (fixed width) + `<RequestPanel>` + `<ResponsePanel>` (stacked or split)

### 7 — Wiring & Polish
- Keyboard shortcut: `Ctrl+Enter` sends request
- Loading spinner on Send while curl is running
- Error display if curl fails (network error, binary not found)
- `Content-Type: application/json` auto-added when body tab is JSON mode

---

## Verification

1. `bun run dev` → Electron window opens
2. Enter `https://httpbin.org/get`, click Send → 200 response with JSON body displayed
3. Switch to POST, add header `Content-Type: application/json`, add body `{"hello":"world"}`, send to `https://httpbin.org/post` → response echoes body
4. Copy a curl from browser DevTools network tab, paste into "Import cURL" tab, click Import → all fields populate
5. Send a request → check Sidebar History shows entry (max 5, oldest drops)
6. Create a project, save current request → appears in sidebar under project
7. Reload app → saved project persists, history persists

---

## Out of Scope (v1)

- Auth tab (OAuth, Bearer, API key — can add headers manually)
- Environment variables / variable interpolation
- Response download to file
- WebSocket / GraphQL
- Windows / macOS packaging (Linux only for now)
