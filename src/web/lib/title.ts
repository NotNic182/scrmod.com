import { useEffect } from 'react'

/** Sets the document title (built by pageMeta, so it matches the server-rendered one). */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
