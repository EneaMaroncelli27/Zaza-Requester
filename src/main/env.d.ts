// electron-vite exposes bundled assets via the `?asset` query suffix, resolved
// to an absolute file path at build time (e.g. the app/window icon).
declare module '*?asset' {
  const src: string
  export default src
}
