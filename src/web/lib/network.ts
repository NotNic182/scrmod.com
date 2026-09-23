interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Whether to download the other pages in the background. Not when the visitor has asked the browser to save data,
 * or on a 2G link, where it would compete with the page they are actually looking at.
 */
export function shouldPrefetch(nav: { connection?: NetworkInformation }): boolean {
  const c = nav.connection
  if (!c) return true
  return !c.saveData && c.effectiveType !== '2g' && c.effectiveType !== 'slow-2g'
}
