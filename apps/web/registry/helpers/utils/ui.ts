// codon-ui-helper-file-marker

import { useEffect, useState } from "react"

export const useIsDocumentHidden = () => {
  const [isDocumentHidden, setIsDocumentHidden] = useState(false)

  useEffect(() => {
    const callback = () => setIsDocumentHidden(document.hidden)
    document.addEventListener("visibilitychange", callback)
    return () => window.removeEventListener("visibilitychange", callback)
  }, [])

  return isDocumentHidden
}
