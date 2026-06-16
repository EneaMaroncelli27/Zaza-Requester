# ZazaRequester

A desktop GUI for `curl` — build, send, and inspect HTTP requests without leaving a window. Compose the URL, method, headers, and body; import a command straight from your browser's "Copy as cURL"; and preview HTML responses as a real rendered page.

Built with Electron + React + TypeScript. Requests run by shelling out to the **system `curl` binary** (no bundled HTTP client), so what you see is what curl does.

## Features

- **Request builder** — method selector, URL bar, key/value headers, and a body editor (raw / JSON) with live validity and a Format button.
- **Method-color identity** — the active verb tints the URL focus ring and Send button (a `GET` reads green, a `DELETE` reads red), so you always know what you're about to fire.
- **Import cURL** — paste a command copied from the browser Network tab; it populates every field. **Copy as cURL** does the reverse.
- **Response viewer** — status, timing, size; pretty-printed JSON; raw headers; one-click copy.
- **HTML preview** — renders an HTML response as a real page in an isolated embedded browser (runs the site's own JS, loads its CSS — faithful for SSR and React/SPA sites).
- **History & projects** — the last 5 requests are kept automatically; save any request permanently into a named project.
- **Resizable** request/response split, persisted across launches.

## Install

Grab a build from `release/` (or build it yourself — see below).

**AppImage** (portable, any distro):

```bash
chmod +x ZazaRequester-*.AppImage
./ZazaRequester-*.AppImage
```

**Debian / Ubuntu (.deb):**

```bash
sudo apt install ./zaza-requester_*_amd64.deb
# launch "ZazaRequester" from the app menu, or run: zaza-requester
```

> Requires the system `curl` binary (`which curl` to check) — preinstalled on most Linux systems.

## Development

Uses [Bun](https://bun.sh) as the package manager.

```bash
bun install
bun run dev      # launch the app with hot reload
```

## Build

```bash
bun run build           # type-check + bundle to out/
bun run build:linux     # package AppImage + .deb into release/
bun run build:appimage  # just the AppImage
bun run build:deb       # just the .deb
```

## Stack

Electron 32 · electron-vite · React 18 · TypeScript · Tailwind CSS · Zustand · CodeMirror 6.

## Notes

- The HTML **Preview** re-fetches the URL with a `GET` in an isolated session to render it faithfully. For responses that depended on custom headers, auth, or a non-GET method, the exact bytes curl received are always on the **Body** tab.
- History keeps the 5 most recent requests (rolling). Use a **project** to keep a request and its response forever.

## License

[MIT](./LICENSE) © ZazaMan
