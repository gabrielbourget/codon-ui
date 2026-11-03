import { useEffect, useRef, useState } from "react"
import { Linking } from "react-native"

import { parseShowcaseLink, SHOWCASE_LINK_PREFIX, type TShowcaseRequest } from "./scenarioLink"

export const useShowcaseLink = (onRequest: (request: TShowcaseRequest) => void) => {
  const [error, setError] = useState<"invalid-scenario-link" | "initial-link-unavailable" | null>(null)
  const initialURL = useRef<Promise<string | null> | null>(null)
  const initialHandled = useRef(false)
  useEffect(() => {
    let active = true
    const receive = (url: string) => {
      if (!active) return
      const request = parseShowcaseLink(url)
      if (request) {
        setError(null)
        onRequest(request)
      } else if (url.startsWith(SHOWCASE_LINK_PREFIX)) setError("invalid-scenario-link")
    }
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(SHOWCASE_LINK_PREFIX)) initialHandled.current = true
      receive(url)
    })
    // Effect restarts (including compatible Fast Refresh) must not replay a launch reset.
    if (!initialHandled.current) {
      initialURL.current ??= Promise.resolve().then(() => Linking.getInitialURL())
      void initialURL.current
        .then((url) => {
          if (!active || initialHandled.current) return
          initialHandled.current = true
          if (url) receive(url)
        })
        .catch(() => {
          if (!active || initialHandled.current) return
          initialHandled.current = true
          setError("initial-link-unavailable")
        })
    }
    return () => {
      active = false
      subscription.remove()
    }
  }, [onRequest])
  return error
}
