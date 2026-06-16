# ZazaRequester — UI/UX Improvement Pass

## Context

The app is built and working (curl GUI: method/URL/headers/body, response viewer, curl import, history + projects). It's functional but visually flat — it sits on the generic "near-black + single indigo accent" look, and has real UX friction: you can't copy the response, can't turn your built request back into a curl command, the request/response split is locked 50/50, and the JSON body editor has no format or validity feedback.

This pass improves **UX first, UI second**, without a heavy reskin. Two threads:

1. **Visual identity (signature):** make the **HTTP method the spine of the UI**. The method colors already exist but are decorative and duplicated. We promote them to an ambient identity — the active method tints the URL focus ring and the Send button — so a `GET` reads green and a `DELETE` reads red. This is subject-derived (HTTP verb semantics), distinctive without being loud, and is genuinely safer UX: you get ambient awareness of what you're about to fire before you fire it.
2. **Functional UX:** Copy response + Copy as cURL, a draggable request/response split, and JSON prettify + live validity.

Out of scope this pass (not selected): confirm-on-delete, toast system, modal Escape/backdrop close, `https://` auto-prefix. Inline button feedback (transient "Copied ✓") is used instead of toasts.

---

## Design Tokens

**Palette** — refine, don't replace. Keep the dark base, name it, warm the neutrals very slightly off pure slate so it reads intentional rather than default.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0E141B` | app background (slightly warmer/deeper than current slate-900) |
| `surface` | `#161E27` | panels, sidebar |
| `surface-2` | `#1E2832` | inputs, raised rows |
| `border` | `#2A3641` | hairlines |
| `text` | `#E6EDF3` | primary text |
| `text-dim` | `#8B98A5` | labels, secondary |

**Method accents** (the signature spine — already semantically correct, now load-bearing):
`GET #34D399` · `POST #60A5FA` · `PUT #FBBF24` · `PATCH #FB923C` · `DELETE #F87171` · `HEAD #C084FC` · `OPTIONS #94A3B8`

**Type** — intentional pairing, bundled locally (offline-safe, no CDN):
- **UI / chrome:** Inter (`@fontsource/inter`)
- **All HTTP data** (URL, headers, body, response, method labels): **JetBrains Mono** (`@fontsource/jetbrains-mono`) — the data *is* the subject; it should look like code throughout.

**Signature element:** the method-tinted request bar. Everything else stays quiet and disciplined — one bold place only.

---

## Changes

### 1 — Shared method theme (dedupe + promote)
**New `src/renderer/lib/methodTheme.ts`** — single source of truth. `METHOD_COLORS` is currently duplicated in `RequestPanel.tsx` and `Sidebar.tsx`; replace both with this. Export a map per method with **complete static class strings** (Tailwind purges dynamic names, so no string interpolation — full classes per slot):

```ts
export const METHOD_THEME: Record<HttpMethod, {
  text: string    // e.g. 'text-emerald-400'   — labels in sidebar/history
  ring: string    // e.g. 'focus:border-emerald-500'  — URL input focus
  btn: string     // e.g. 'bg-emerald-600 hover:bg-emerald-500' — Send button
  dot: string     // e.g. 'bg-emerald-400'      — status/identity dot
}>
```
Add the corresponding classes to `tailwind.config.ts` **safelist** so they survive purge.

### 2 — Method-color identity in the request bar
**`src/renderer/components/RequestPanel.tsx`**
- URL `<input>`: swap the fixed `focus:border-indigo-500` for `METHOD_THEME[method].ring`.
- Send button: swap fixed `bg-indigo-600 hover:bg-indigo-500` for `METHOD_THEME[method].btn` (keep the disabled state as-is).
- Method `<select>` keeps its colored text via `METHOD_THEME[method].text`.
- Add a smooth `transition-colors` so switching method animates the tint.

### 3 — Copy as cURL (symmetric to Import)
**New `src/renderer/lib/buildCurlCommand.ts`** — pure `RequestData → string`. Produces a clean, **human-pasteable** curl (multi-line with `\` continuations, single-quoted values, `-X METHOD`, one `-H` per enabled header, `--data-raw` for body). This is distinct from the existing `src/main/curlBuilder.ts`, which builds internal `-s -i` spawn args — do not reuse that; it's for execution, not display.

**`RequestPanel.tsx`** — add a "Copy as cURL" button in the request bar (next to Save). On click: `navigator.clipboard.writeText(buildCurlCommand(currentRequest))` and show a transient `Copied ✓` state on the button (~1.5s) via local `useState`. No toast.

### 4 — Copy response body
**`src/renderer/components/ResponsePanel.tsx`** — add a copy icon button in the response header bar (visible when a response exists). Copies `prettyBody` (already computed) to clipboard with the same transient `Copied ✓` inline feedback.

### 5 — Resizable request/response split
**New `src/renderer/hooks/useResizableSplit.ts`** — dependency-free vertical drag. Tracks a split ratio (default `0.5`), mouse-down on the divider → `mousemove` updates ratio (clamped, e.g. 0.2–0.8) → `mouseup` releases. Persist ratio to `localStorage` so it survives reloads.

**`src/renderer/App.tsx`** — replace the two fixed `flex-1` panel wrappers with `flex-basis` driven by the ratio, and insert a ~4px draggable divider between them (`cursor-row-resize`, hover highlights to the active method color for a subtle through-line). Keep `min-h-0 overflow-hidden` (the fix from the last pass) intact.

### 6 — JSON prettify + validate
**`src/renderer/components/BodyEditor.tsx`** — when `bodyType === 'json'`, add a header row above the editor:
- **Validity dot + label:** parse `body` on change → `● valid` (emerald) / `● invalid` (red) / nothing when empty.
- **Format button:** `JSON.stringify(JSON.parse(body), null, 2)` → `setBody(...)`; disabled when invalid/empty.

### 7 — Type + base styling
- `bun add @fontsource/inter @fontsource/jetbrains-mono`.
- Import both in `src/renderer/main.tsx`.
- `tailwind.config.ts`: set `fontFamily.sans = ['Inter', ...]`, `fontFamily.mono = ['JetBrains Mono', ...]`. Apply `font-mono` to all HTTP-data surfaces (URL already has it; extend to header inputs, response, method labels).
- Apply the named palette tokens (extend `colors` in tailwind config, or map to closest existing slate steps + the warmer bg) and refresh the few hardcoded `slate-900/800` references to the tokens. Keep changes mechanical and contained.

---

## Files

| File | Change |
|---|---|
| `src/renderer/lib/methodTheme.ts` | **new** — single method→classes source |
| `src/renderer/lib/buildCurlCommand.ts` | **new** — RequestData → pasteable curl string |
| `src/renderer/hooks/useResizableSplit.ts` | **new** — drag-to-resize hook |
| `src/renderer/components/RequestPanel.tsx` | method-tint ring+button, Copy-as-cURL |
| `src/renderer/components/ResponsePanel.tsx` | copy response button |
| `src/renderer/components/BodyEditor.tsx` | JSON format + validity |
| `src/renderer/components/Sidebar.tsx` | use shared methodTheme (dedupe) |
| `src/renderer/App.tsx` | resizable split + divider |
| `tailwind.config.ts` | fonts, palette tokens, method safelist |
| `src/renderer/main.tsx` | font imports |
| `package.json` | `@fontsource/inter`, `@fontsource/jetbrains-mono` |

---

## Verification

1. `bun run build` — clean typecheck + bundle.
2. `bun run dev` — window opens; capture via CDP `Page.captureScreenshot` (X11 grab returns black on this VM — use CDP).
3. **Method identity:** switch GET → DELETE; confirm URL focus ring + Send button retint green → red with transition.
4. **Copy as cURL:** build a POST with a header + JSON body, click Copy as cURL, paste — verify it's a valid, runnable curl that round-trips through the existing Import cURL parser.
5. **Copy response:** send a request, click copy on the response, verify clipboard matches the pretty body.
6. **Resize:** drag the divider; response grows; reload app — ratio persists.
7. **JSON validate:** type `{"a":1` → `● invalid`, Format disabled; complete to `{"a":1}` → `● valid`, Format pretty-prints.
8. Confirm the previous layout fix still holds (request bar visible, not collapsed).
