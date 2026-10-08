/** Kept separate from render/data failures so recovery replaces the cached failed page load. */
export class PageLoadError extends Error {
  constructor(cause: unknown) {
    super('This page could not load.', { cause })
    this.name = 'PageLoadError'
  }
}

export function reloadPage() {
  window.location.reload()
}
