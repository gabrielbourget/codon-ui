import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"

import { cancelFrame, frame } from "../kernel"

import { nativeWindowNodeGroup } from "./windowGroup"

type TGroup = ReturnType<typeof nativeWindowNodeGroup>
export const NativeLayoutGroupContext = createContext<{ id?: string; group?: TGroup; forceRender?: () => void }>({})
export const NativeLayoutGroup = ({
  children,
  id,
  inherit = true,
}: {
  children?: ReactNode
  id?: string
  inherit?: boolean | "id"
}) => {
  const parent = useContext(NativeLayoutGroupContext)
  const [context] = useState(() => ({
    id: (inherit === true || inherit === "id") && parent.id ? (id ? `${parent.id}-${id}` : parent.id) : id,
    group: inherit === true ? (parent.group ?? nativeWindowNodeGroup()) : nativeWindowNodeGroup(),
  }))
  const [revision, setRevision] = useState(0),
    alive = useRef(true)
  const update = useCallback(() => {
    if (alive.current) setRevision((value) => value + 1)
  }, [])
  const forceRender = useCallback(() => {
    frame.postRender(update)
  }, [update])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      cancelFrame(update)
    }
  }, [update])
  const value = useMemo(() => ({ ...context, forceRender }), [context, forceRender, revision])
  return <NativeLayoutGroupContext.Provider value={value}>{children}</NativeLayoutGroupContext.Provider>
}
