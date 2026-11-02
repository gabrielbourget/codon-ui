import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { LayoutRectangle, NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from "react-native"

import type { TNativeCarouselScrollOptions } from "./carouselTypes"
import { measureNativeCarouselPages, nativeCarouselIndex, nearestNativeCarouselPage } from "./pagingGeometry"

type TSize = Readonly<{ width: number; height: number }>
type TScrollEvent = NativeSyntheticEvent<NativeScrollEvent>
const emptyLayout: LayoutRectangle = { x: 0, y: 0, width: 0, height: 0 }
const sameLayout = (left: LayoutRectangle | undefined, right: LayoutRectangle) =>
  !!left && left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height

export const useNativeCarouselPaging = (options: {
  keys: readonly string[]
  initialIndex: number
  axis: "x" | "y"
  align: "start" | "center" | "end"
  isRTL: boolean
  active: boolean
  session: string
  reducedMotion: boolean
  onIndexChange?: (index: number) => void
}) => {
  const { keys, initialIndex, axis, align, isRTL, active, session, reducedMotion, onIndexChange } = options
  const scrollView = useRef<ScrollView | null>(null)
  const nodes = useRef(new Map<string, View>())
  const layouts = useRef(new Map<string, LayoutRectangle>())
  const [revision, invalidate] = useState(0)
  const [viewport, setViewport] = useState(emptyLayout)
  const [container, setContainer] = useState(emptyLayout)
  const [content, setContent] = useState<TSize>({ width: 0, height: 0 })
  const [selection, setSelection] = useState({ index: nativeCarouselIndex(initialIndex, keys.length), ready: false })
  const selected = useRef(selection.index)
  const mounted = useRef(true)
  const offset = useRef(0)
  const pending = useRef<{ index: number; offset: number; animated: boolean; deferred: boolean } | null>(null)
  const movement = useRef<{ kind: "drag" } | { kind: "command"; offset: number; animated: boolean } | null>(null)
  const requested = useRef(selection.index)
  const keysIdentity = JSON.stringify(keys)
  const measuredKeys = useMemo(() => JSON.parse(keysIdentity) as string[], [keysIdentity])
  const geometry = useMemo(() => {
    const items = measuredKeys.map((key) => layouts.current.get(key))
    if (items.some((item) => !item)) return null
    return measureNativeCarouselPages({
      items: items as LayoutRectangle[],
      viewport,
      container,
      content,
      axis,
      align,
      isRTL,
    })
  }, [measuredKeys, revision, viewport, container, content, axis, align, isRTL])
  const geometryIdentity = JSON.stringify(geometry)
  const identity = JSON.stringify([keysIdentity, axis, align, isRTL, session, active, geometryIdentity, viewport])
  const lifetime = useMemo(() => ({}), [identity])
  const live = useRef({ lifetime, keys, geometry, active, reducedMotion, axis })
  useInsertionEffect(() => {
    live.current = { lifetime, keys, geometry, active, reducedMotion, axis }
  })
  const canAct = useCallback(() => mounted.current && live.current.active, [])
  const publish = useCallback((index: number) => {
    selected.current = index
    requested.current = index
    pending.current = null
    movement.current = null
    setSelection((current) => (current.ready && current.index === index ? current : { index, ready: true }))
  }, [])
  const scrollTo = useCallback(
    (index: number, behavior?: TNativeCarouselScrollOptions) => {
      const current = live.current
      if (!canAct() || !current.geometry || !scrollView.current || !current.keys.length) return
      const nextIndex = nativeCarouselIndex(index, current.keys.length)
      const target = current.geometry.itemOffsets[nextIndex]
      const animated = behavior?.animated !== false && !current.reducedMotion
      const atObservedPosition = Math.abs(offset.current - target) <= 0.5
      const deferred = atObservedPosition && movement.current !== null
      requested.current = nextIndex
      pending.current = { index: nextIndex, offset: target, animated, deferred }
      // Native iOS may ignore a request to the current offset without stopping ongoing motion.
      if (deferred) return
      movement.current = { kind: "command", offset: target, animated }
      scrollView.current.scrollTo({
        x: current.axis === "x" ? target : 0,
        y: current.axis === "y" ? target : 0,
        animated,
      })
      // A command to the observed position can change the selected item at a shared finite-edge snap.
      if (atObservedPosition) publish(nextIndex)
    },
    [canAct, publish],
  )
  const scrollPrev = useCallback(
    (behavior?: TNativeCarouselScrollOptions) => scrollTo(requested.current - 1, behavior),
    [scrollTo],
  )
  const scrollNext = useCallback(
    (behavior?: TNativeCarouselScrollOptions) => scrollTo(requested.current + 1, behavior),
    [scrollTo],
  )
  const attachItem = useCallback((key: string, node: View | null) => {
    if (nodes.current.get(key) === node) return
    if (node) nodes.current.set(key, node)
    else nodes.current.delete(key)
    if (layouts.current.delete(key) && mounted.current) invalidate((value) => value + 1)
  }, [])
  const measureItem = useCallback((key: string, node: View, layout: LayoutRectangle) => {
    if (!mounted.current || nodes.current.get(key) !== node || !live.current.keys.includes(key)) return
    if (sameLayout(layouts.current.get(key), layout)) return
    layouts.current.set(key, layout)
    invalidate((value) => value + 1)
  }, [])
  const measureViewport = useCallback((layout: LayoutRectangle) => {
    setViewport((previous) => (sameLayout(previous, layout) ? previous : layout))
  }, [])
  const measureContainer = useCallback((layout: LayoutRectangle) => {
    setContainer((previous) => (sameLayout(previous, layout) ? previous : layout))
  }, [])
  const measureContent = useCallback((width: number, height: number) => {
    setContent((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
  }, [])
  const initialRequest = useRef("")
  useLayoutEffect(() => {
    if (!active) {
      pending.current = null
      movement.current = null
      requested.current = selected.current
      scrollView.current?.scrollTo({
        x: axis === "x" ? offset.current : 0,
        y: axis === "y" ? offset.current : 0,
        animated: false,
      })
      return
    }
    const nextRequest = JSON.stringify([initialIndex, keys.length])
    const index = initialRequest.current !== nextRequest ? initialIndex : (pending.current?.index ?? selected.current)
    if (!keys.length) {
      initialRequest.current = nextRequest
      publish(0)
    } else if (live.current.geometry) {
      initialRequest.current = nextRequest
      scrollTo(index, { animated: false })
    }
  }, [active, identity, geometryIdentity, initialIndex, keys.length, axis, publish, scrollTo])
  useEffect(() => {
    if (selection.ready) onIndexChange?.(selection.index)
  }, [selection.index, selection.ready, onIndexChange])
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      pending.current = null
      movement.current = null
      nodes.current.clear()
      layouts.current.clear()
    }
  }, [])
  const readOffset = (event: TScrollEvent) => {
    if (!canAct() || lifetime !== live.current.lifetime) return null
    const value = event.nativeEvent.contentOffset[axis]
    if (!Number.isFinite(value)) return null
    offset.current = value
    return value
  }
  const settle = (value: number) => {
    const current = live.current.geometry
    if (!current) return
    const command = pending.current
    if (command?.deferred) {
      movement.current = null
      scrollTo(command.index, { animated: command.animated })
      return
    }
    if (pending.current && Math.abs(value - pending.current.offset) > 0.5) return
    publish(nearestNativeCarouselPage(current, value, pending.current?.index ?? selected.current))
  }
  return {
    scrollView,
    viewport,
    selectedIndex: selection.index,
    canScrollPrev: !!geometry && keys.length > 0 && selection.index > 0,
    canScrollNext: !!geometry && selection.index < keys.length - 1,
    snapOffsets: geometry?.snapOffsets ?? [],
    scrollPrev,
    scrollNext,
    scrollTo,
    canAct,
    attachItem,
    measureItem,
    measureViewport,
    measureContainer,
    measureContent,
    onScroll: (event: TScrollEvent) => {
      const value = readOffset(event)
      const command = movement.current
      if (value !== null && command?.kind === "command" && !command.animated && Math.abs(value - command.offset) <= 0.5)
        settle(value)
    },
    onScrollBeginDrag: (event: TScrollEvent) => {
      if (readOffset(event) === null) return
      pending.current = null
      movement.current = { kind: "drag" }
      requested.current = selected.current
    },
    onScrollEndDrag: (event: TScrollEvent) => {
      const value = readOffset(event)
      const current = live.current.geometry
      if (value === null || !current || event.nativeEvent.velocity?.[axis] !== 0) return
      // A motionless release at a snap has no momentum-end event to wait for.
      const index = nearestNativeCarouselPage(current, value, selected.current)
      if (Math.abs((current.itemOffsets[index] ?? 0) - value) <= 0.5) settle(value)
    },
    onMomentumScrollEnd: (event: TScrollEvent) => {
      const value = readOffset(event)
      if (value !== null) settle(value)
    },
  }
}
