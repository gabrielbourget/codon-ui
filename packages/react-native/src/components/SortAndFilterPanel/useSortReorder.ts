import { useContext, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionRendererContext, type TNativeCollectionDropTarget } from "../../collection/renderer"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { focusNativeTarget } from "../../input/focus"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"

type TBounds = { x: number; y: number; width: number; height: number }
type TTarget = { key: string; position: "before" | "after" }
type TDrag = {
  source: string
  collection: TNativeCollectionSnapshot<object>
  view: View
  window: string
  gap: number | null
  keyboard: boolean
  admitted: boolean
  released: boolean
  point: { x: number; y: number } | null
  dropping: boolean
  measurement: number
  measuring: boolean
  root: View
  delegate: React.ContextType<typeof NativeCollectionRendererContext>["dropTargetDelegate"]
  layout: React.ContextType<typeof NativeCollectionRendererContext>["layoutDelegate"]
  rendererRoot: React.ContextType<typeof NativeCollectionRendererContext>["CollectionRoot"]
  viewport: TBounds | null
  target: TTarget | null
  requested: string | null
}
export type TSortReorderRequest = (source: string, target: string, position: "before" | "after") => void

// This list only reorders its own sort instructions. The query controller remains the draft owner.
export const useSortReorder = (
  collection: TNativeCollectionSnapshot<object>,
  canAct: () => boolean,
  onReorder: TSortReorderRequest | undefined,
  root: RefObject<View | null>,
) => {
  const actions = useContext(NativeCollectionActionsContext)!
  const input = useNativeKeyScope()
  const floating = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const renderer = useContext(NativeCollectionRendererContext)
  const targets = useRef(new Map<string, View>())
  const bounds = useRef(new Map<string, TBounds>())
  const drag = useRef<TDrag | null>(null)
  const ticket = useRef(0)
  const [indicator, setIndicator] = useState<number | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [targetKey, setTargetKey] = useState<string | null>(null)
  const [indicatorKey, setIndicatorKey] = useState<string | null>(null)
  const owner = useRef({ collection, canAct, onReorder, input, floating, windowActive, root, renderer, live: true })
  useInsertionEffect(() => {
    owner.current = { collection, canAct, onReorder, input, floating, windowActive, root, renderer, live: true }
  })
  useInsertionEffect(
    () => () => {
      owner.current.live = false
      ticket.current++
      drag.current = null
    },
    [],
  )
  const controls = useMemo(() => {
    const rows = () => Array.from(owner.current.collection).filter((node) => node.type === "item")
    const window = () => {
      const current = owner.current
      return JSON.stringify([current.input?.ownerId, current.input?.acknowledgedSession()])
    }
    const available = () => {
      const current = owner.current
      return (
        current.live &&
        !!current.onReorder &&
        current.canAct() &&
        current.floating?.canAct() !== false &&
        current.windowActive?.() !== false &&
        current.input?.isWindowActive() !== false
      )
    }
    const valid = (current: TDrag) =>
      available() &&
      drag.current === current &&
      current.collection === owner.current.collection &&
      current.window === window() &&
      current.root === owner.current.root.current &&
      current.delegate === owner.current.renderer.dropTargetDelegate &&
      current.layout === owner.current.renderer.layoutDelegate &&
      current.rendererRoot === owner.current.renderer.CollectionRoot &&
      targets.current.get(current.source) === current.view
    const cancel = () => {
      ticket.current++
      drag.current = null
      bounds.current.clear()
      if (owner.current.live) {
        setIndicator(null)
        setSource(null)
        setTargetKey(null)
        setIndicatorKey(null)
      }
    }
    const gaps = (source: string) => {
      const current = rows()
      const index = current.findIndex((row) => row.key === source)
      return Array.from({ length: current.length + 1 }, (_, gap) => gap).filter(
        (gap) => gap !== index && gap !== index + 1,
      )
    }
    const targetForGap = (gap: number | null): TTarget | null => {
      const ordered = rows()
      if (gap === null) return null
      const last = gap === ordered.length
      const node = ordered[last ? ordered.length - 1 : gap]
      return node ? { key: String(node.key), position: last ? "after" : "before" } : null
    }
    const choose = (current: TDrag, gap: number | null, target = targetForGap(gap)) => {
      if (!valid(current)) return cancel()
      if (current.target?.key !== target?.key || current.target?.position !== target?.position) {
        current.requested = null
        current.target = target
      }
      current.gap = gap
      setIndicator(gap)
      setTargetKey(target?.key ?? null)
      setIndicatorKey(targetForGap(gap)?.key ?? null)
    }
    const admit = (node: TNativeCollectionNode<object>, view: View, action: () => void) => {
      const target = findNodeHandle(view)
      const generation = ticket.current
      if (target && available())
        actions.request(node, target, action, (outcome) => {
          if (outcome !== "accepted" && ticket.current === generation) cancel()
        })
      else cancel()
    }
    const measure = (current: TDrag) => {
      const revision = ++current.measurement
      current.measuring = true
      if (current.delegate) {
        const originalRoot = current.root
        originalRoot.measureInWindow((x, y, width, height) => {
          if (!valid(current) || current.measurement !== revision) return
          if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return cancel()
          current.viewport = { x, y, width, height }
          current.measuring = false
          updateIndicator(current)
          if (current.released) drop()
        })
        return
      }
      const originalTargets = rows().map((row) => ({
        key: String(row.key),
        target: targets.current.get(String(row.key)),
      }))
      const rectangles = new Map<string, TBounds>()
      for (const { key, target } of originalTargets) {
        if (!valid(current) || current.measurement !== revision) return
        if (!target) return cancel()
        target.measureInWindow((x, y, width, height) => {
          if (!valid(current) || current.measurement !== revision) return
          if (
            targets.current.get(key) !== target ||
            ![x, y, width, height].every(Number.isFinite) ||
            width <= 0 ||
            height <= 0
          )
            return cancel()
          rectangles.set(key, { x, y, width, height })
          if (rectangles.size !== originalTargets.length) return
          bounds.current = rectangles
          current.measuring = false
          updateIndicator(current)
          if (current.released) drop()
        })
      }
    }
    const begin = (source: string, keyboard: boolean) => {
      cancel()
      if (!available()) return
      const node = owner.current.collection.getItem(source)
      const view = targets.current.get(source)
      const root = owner.current.root.current
      if (!node || !view || !root) return
      const collection = owner.current.collection
      const identity = window()
      const generation = ticket.current
      const current: TDrag = {
        source,
        collection,
        view,
        window: identity,
        keyboard,
        gap: null,
        admitted: false,
        released: false,
        point: null,
        dropping: false,
        measurement: 0,
        measuring: false,
        root,
        delegate: owner.current.renderer.dropTargetDelegate,
        layout: owner.current.renderer.layoutDelegate,
        rendererRoot: owner.current.renderer.CollectionRoot,
        viewport: null,
        target: null,
        requested: null,
      }
      drag.current = current
      setSource(source)
      admit(node, view, () => {
        if (
          ticket.current !== generation ||
          !available() ||
          owner.current.collection !== collection ||
          window() !== identity ||
          targets.current.get(source) !== view
        )
          return
        current.admitted = true
        if (keyboard) {
          const index = rows().findIndex((row) => row.key === source)
          const allowed = gaps(source)
          choose(current, allowed.find((gap) => gap > index + 1) ?? allowed.at(-1) ?? null)
        }
        if (!keyboard) measure(current)
        if (keyboard && current.released) drop()
      })
    }
    const updateIndicator = (current: TDrag) => {
      if (!valid(current)) return cancel()
      if (!current.point) return
      const { x, y } = current.point
      if (current.delegate) {
        const viewport = current.viewport
        if (!viewport) return
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < viewport.x ||
          y < viewport.y ||
          x > viewport.x + viewport.width ||
          y > viewport.y + viewport.height
        )
          return choose(current, null)
        const gapFor = (target: TNativeCollectionDropTarget) => {
          if (target.type !== "item" || target.dropPosition === "on" || typeof target.key !== "string") return null
          const index = rows().findIndex((row) => row.key === target.key)
          const gap = index + Number(target.dropPosition === "after")
          return index >= 0 && gaps(current.source).includes(gap) ? gap : null
        }
        try {
          const target = current.delegate.getDropTargetFromPoint(
            x - viewport.x,
            y - viewport.y,
            (target) => gapFor(target) !== null,
          )
          const gap = target && gapFor(target)
          if (gap === null || !target || target.type !== "item" || target.dropPosition === "on")
            return choose(current, null)
          choose(current, gap, { key: String(target.key), position: target.dropPosition })
        } catch (error) {
          cancel()
          throw error
        }
        return
      }
      const measured = rows().map((row) => bounds.current.get(String(row.key)))
      if (measured.some((rect) => !rect)) return
      const rectangles = measured as TBounds[]
      const first = rectangles[0]
      const last = rectangles.at(-1)
      if (
        !first ||
        !last ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < Math.min(...rectangles.map((rect) => rect.x)) ||
        x > Math.max(...rectangles.map((rect) => rect.x + rect.width)) ||
        y < first.y ||
        y > last.y + last.height
      )
        return choose(current, null)
      const gap = rectangles.findIndex((rect) => y <= rect.y + rect.height / 2)
      const candidate = gap < 0 ? rectangles.length : gap
      choose(current, gaps(current.source).includes(candidate) ? candidate : null)
    }
    const move = (x: number, y: number) => {
      const current = drag.current
      if (!current || current.keyboard) return
      if (!valid(current)) return cancel()
      current.point = { x, y }
      // Native layout and ancestor scrolling can change without replacing a row.
      // Only the latest complete batch may choose a target or settle a release.
      if (current.admitted) measure(current)
    }
    const drop = () => {
      const current = drag.current
      if (!current || !valid(current)) return cancel()
      current.released = true
      if (
        !current.admitted ||
        (!current.keyboard &&
          (current.measuring || (current.delegate ? !current.viewport : bounds.current.size !== rows().length)))
      )
        return
      if (current.dropping) return
      if (current.gap === null) return cancel()
      const target = current.target
      const node = target && owner.current.collection.getItem(target.key)
      if (!node || !target) return cancel()
      const view = targets.current.get(target.key)
      if (!view) {
        if (current.requested !== target.key) {
          current.requested = target.key
          try {
            current.layout?.requestRendering?.(target.key)
          } catch (error) {
            cancel()
            throw error
          }
        }
        return
      }
      const gap = current.gap
      current.dropping = true
      admit(node, view, () => {
        if (
          !valid(current) ||
          current.gap !== gap ||
          current.target !== target ||
          targets.current.get(target.key) !== view
        )
          return cancel()
        const request = owner.current.onReorder
        cancel()
        request?.(current.source, target.key, target.position)
        if (current.keyboard && available() && targets.current.get(current.source) === current.view)
          focusNativeTarget(current.view)
      })
    }
    return {
      begin,
      move,
      drop,
      dropAt: (key: string, position: "before" | "after") => {
        const current = drag.current
        if (!current || !valid(current)) return cancel()
        const index = rows().findIndex((row) => row.key === key)
        const gap = index + Number(position === "after")
        if (index < 0 || !gaps(current.source).includes(gap)) return
        choose(current, gap)
        drop()
      },
      cancel,
      validate: () => {
        if (drag.current && !valid(drag.current)) cancel()
      },
      register: (node: TNativeCollectionNode<object>, view: View | null) => {
        const key = String(node.key)
        if (view) targets.current.set(key, view)
        else {
          targets.current.delete(key)
          bounds.current.delete(key)
          if (drag.current?.source === key) cancel()
        }
        const current = drag.current
        if (view && current?.released && !current.dropping && current.target?.key === key) {
          if (current.keyboard) drop()
          else measure(current)
        }
      },
      key: (key: string, event: TNativeKeyboardEvent) => {
        const data = event.nativeEvent
        const current = drag.current
        if (data.cancelled || data.repeat || data.altKey || data.ctrlKey || data.metaKey) return false
        if (!current && data.key !== "Enter") return false
        if (!available() || (current && !valid(current))) {
          cancel()
          return false
        }
        if (!current && data.target !== findNodeHandle(targets.current.get(key) ?? null)) return false
        event.preventDefault()
        event.stopPropagation()
        if (data.key === "Enter" && data.phase === "up") {
          if (current) drop()
          else begin(key, true)
        } else if (current && data.phase === "down") {
          if (data.key === "Escape") {
            cancel()
            if (available()) focusNativeTarget(current.view)
          } else {
            const allowed = gaps(current.source)
            const index = allowed.indexOf(current.gap ?? -1)
            if (data.key === "Home" || data.key === "PageUp") choose(current, allowed[0] ?? null)
            else if (data.key === "End" || data.key === "PageDown") choose(current, allowed.at(-1) ?? null)
            else if (data.key === "ArrowDown") choose(current, allowed[(index + 1) % allowed.length] ?? null)
            else if (data.key === "ArrowUp")
              choose(current, allowed[(index - 1 + allowed.length) % allowed.length] ?? null)
          }
        }
        return true
      },
    }
  }, [actions])
  useLayoutEffect(controls.validate)
  useLayoutEffect(() => input?.subscribe(controls.validate), [input, controls])
  return { ...controls, indicator, source, targetKey, indicatorKey, enabled: !!onReorder }
}
