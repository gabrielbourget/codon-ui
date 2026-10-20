// Native ownership adaptation of Motion 12.40.0 AnimatePresence. See UPSTREAM.json.
import {
  Children,
  Component,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactElement, ReactNode, RefObject } from "react"
import type { View } from "react-native"

import { NativeLayoutGroupContext } from "../projection/NativeLayoutGroup"

import { NativePresenceContext, NativePopRootContext, useNativePresence } from "./context"
import type { TNativePopFrame, TNativePopRoot, TNativePresence } from "./context"

export type TNativeAnimatePresenceProps = {
  children?: ReactNode
  custom?: unknown
  initial?: boolean
  onExitComplete?: () => void
  presenceAffectsLayout?: boolean
  mode?: "sync" | "wait" | "popLayout"
  propagate?: boolean
  anchorX?: "left" | "right"
  anchorY?: "top" | "bottom"
  root?: RefObject<View | null>
}
type TPopMeasureProps = {
  children: ReactElement
  present: boolean
  pop: boolean
  roots: Set<TNativePopRoot>
  frame: { current?: { owner: TNativePopRoot; frame: TNativePopFrame } }
  root?: RefObject<View | null>
}
class NativePopMeasure extends Component<TPopMeasureProps> {
  override getSnapshotBeforeUpdate(previous: TPopMeasureProps) {
    if (previous.present && !this.props.present && this.props.pop) {
      if (this.props.roots.size !== 1) throw new Error("Native popLayout: one actual owned native root is required")
      const owner = [...this.props.roots][0]
      this.props.frame.current = { owner, frame: owner.read(this.props.root) }
    }
    return null
  }
  override componentDidUpdate() {}
  override render() {
    return this.props.children
  }
}
const NativePresenceChild = ({
  children,
  isPresent,
  initial,
  custom,
  onExitComplete,
  presenceAffectsLayout,
  mode,
  anchorX,
  anchorY,
  root,
}: {
  children: ReactElement
  isPresent: boolean
  initial?: false
  custom?: unknown
  onExitComplete?: () => void
  presenceAffectsLayout: boolean
  mode: NonNullable<TNativeAnimatePresenceProps["mode"]>
  anchorX: "left" | "right"
  anchorY: "top" | "bottom"
  root?: RefObject<View | null>
}) => {
  const [participants] = useState(() => new Map<string | number, boolean>())
  const [roots] = useState(() => new Set<TNativePopRoot>())
  const frame = useRef<{ owner: TNativePopRoot; frame: TNativePopFrame }>(undefined)
  const id = useId(),
    generation = useMemo(() => ({}), [isPresent])
  const committed = useRef({ generation, isPresent, onExitComplete })
  useInsertionEffect(() => {
    committed.current = { generation, isPresent, onExitComplete }
  })
  const register = useMemo(
    () => (key: string | number) => {
      participants.set(key, false)
      return () => {
        participants.delete(key)
      }
    },
    [participants],
  )
  const complete = useMemo(
    () => (key: string | number) => {
      if (committed.current.generation !== generation || committed.current.isPresent || !participants.has(key)) return
      participants.set(key, true)
      if ([...participants.values()].every(Boolean)) committed.current.onExitComplete?.()
    },
    [generation, participants],
  )
  useMemo(() => {
    participants.forEach((_, key) => participants.set(key, false))
  }, [isPresent, participants])
  const context = useMemo<TNativePresence>(
    () => ({ id, initial, isPresent, custom, register, onExitComplete: complete }),
    [id, initial, isPresent, custom, register, complete],
  )
  useEffect(() => {
    if (!isPresent && !participants.size) committed.current.onExitComplete?.()
  }, [isPresent, participants])
  useInsertionEffect(() => {
    const snapshot = frame.current
    if (!isPresent && mode === "popLayout" && snapshot && snapshot.frame.width && snapshot.frame.height)
      return snapshot.owner.freeze(snapshot.frame, anchorX, anchorY)
  }, [isPresent, mode, anchorX, anchorY])
  const registerRoot = useMemo(
    () => (owner: TNativePopRoot) => {
      roots.add(owner)
      return () => {
        roots.delete(owner)
      }
    },
    [roots],
  )
  return (
    <NativePresenceContext.Provider value={presenceAffectsLayout ? { ...context } : context}>
      <NativePopRootContext.Provider value={registerRoot}>
        <NativePopMeasure present={isPresent} pop={mode === "popLayout"} roots={roots} frame={frame} root={root}>
          {children}
        </NativePopMeasure>
      </NativePopRootContext.Provider>
    </NativePresenceContext.Provider>
  )
}
const elements = (children: ReactNode) => {
  const result: ReactElement[] = []
  Children.forEach(children, (child) => {
    if (isValidElement(child)) result.push(child)
  })
  return result
}
const keyOf = (child: ReactElement) => child.key || ""
export const NativeAnimatePresence = ({
  children,
  custom,
  initial = true,
  onExitComplete,
  presenceAffectsLayout = true,
  mode = "sync",
  propagate = false,
  anchorX = "left",
  anchorY = "top",
  root,
}: TNativeAnimatePresenceProps) => {
  const { forceRender } = useContext(NativeLayoutGroupContext)
  const [parentPresent, removeParent] = useNativePresence(propagate)
  const present = useMemo(() => elements(children), [children])
  const keys = propagate && !parentPresent ? [] : present.map(keyOf)
  const first = useRef(true),
    pending = useRef(present)
  const [exits] = useState(() => new Map<string | number, boolean>())
  const processing = useRef(new Set<string | number>())
  const [diffed, setDiffed] = useState(present),
    [rendered, setRendered] = useState(present)
  useLayoutEffect(() => {
    first.current = false
    pending.current = present
    for (const child of rendered) {
      const key = keyOf(child)
      if (!keys.includes(key)) {
        if (exits.get(key) !== true) exits.set(key, false)
      } else {
        exits.delete(key)
        processing.current.delete(key)
      }
    }
  }, [rendered, keys.length, keys.join("-")])
  if (present !== diffed) {
    let next = [...present]
    const leaving: ReactElement[] = []
    rendered.forEach((child, index) => {
      if (!keys.includes(keyOf(child))) {
        next.splice(index, 0, child)
        leaving.push(child)
      }
    })
    if (mode === "wait" && leaving.length) next = leaving
    setRendered(next)
    setDiffed(present)
    return null
  }
  return (
    <>
      {rendered.map((child) => {
        const key = keyOf(child),
          isPresent = propagate && !parentPresent ? false : present === rendered || keys.includes(key)
        const complete = () => {
          if (processing.current.has(key) || !exits.has(key)) return
          processing.current.add(key)
          exits.set(key, true)
          if ([...exits.values()].every(Boolean)) {
            forceRender?.()
            setRendered(pending.current)
            if (propagate) removeParent?.()
            onExitComplete?.()
          }
        }
        return (
          <NativePresenceChild
            key={key}
            isPresent={isPresent}
            initial={!first.current || initial ? undefined : false}
            custom={custom}
            onExitComplete={isPresent ? undefined : complete}
            presenceAffectsLayout={presenceAffectsLayout}
            mode={mode}
            anchorX={anchorX}
            anchorY={anchorY}
            root={root}
          >
            {child}
          </NativePresenceChild>
        )
      })}
    </>
  )
}
