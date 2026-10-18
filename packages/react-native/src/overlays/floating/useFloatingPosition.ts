import { useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"

import { createNativeFloatingMeasurement, type TNativeFloatingMeasurable } from "./measurement"
import { useNativeFloatingHost } from "./NativeFloatingLayerHost"
import { getNativeFloatingPlacement, type TNativeFloatingPlacementInput } from "./placement"
import type { useNativeFloatingLayer } from "./useFloatingLayer"

type TPosition = ReturnType<typeof getNativeFloatingPlacement>
type TGeometry = Omit<TNativeFloatingPlacementInput, "host" | "anchor" | "content" | "visibleBoundary">
type TOptions = TGeometry & {
  layer: ReturnType<typeof useNativeFloatingLayer>
  triggerRef: RefObject<TNativeFloatingMeasurable | null>
  contentRef: RefObject<TNativeFloatingMeasurable | null>
  boundaryRef?: RefObject<TNativeFloatingMeasurable | null>
  shouldUpdatePosition?: boolean
  layoutRevision?: number
}

export const useNativeFloatingPosition = ({
  layer,
  triggerRef,
  contentRef,
  boundaryRef,
  shouldUpdatePosition = true,
  layoutRevision = 0,
  placement,
  direction,
  offset,
  crossOffset,
  containerPadding,
  shouldFlip,
  maxHeight,
  arrowSize,
  arrowBoundaryOffset,
  margins,
}: TOptions) => {
  const host = useNativeFloatingHost()
  const [controller] = useState(createNativeFloatingMeasurement)
  const [position, setPosition] = useState<TPosition>(null)
  const established = useRef<TPosition>(null)
  const presentation = useRef<{ host: typeof host.root; layer: string; generation: number } | null>(null)
  const geometry = useMemo(
    () => ({
      placement,
      direction,
      offset,
      crossOffset,
      containerPadding,
      shouldFlip,
      maxHeight,
      arrowSize,
      arrowBoundaryOffset,
      margins: { top: margins?.top, right: margins?.right, bottom: margins?.bottom, left: margins?.left },
    }),
    [
      placement,
      direction,
      offset,
      crossOffset,
      containerPadding,
      shouldFlip,
      maxHeight,
      arrowSize,
      arrowBoundaryOffset,
      margins?.top,
      margins?.right,
      margins?.bottom,
      margins?.left,
    ],
  )
  // Validate caller geometry during render; native coordinates only come from measurements below.
  getNativeFloatingPlacement({
    ...geometry,
    host: { x: 0, y: 0, width: 0, height: 0 },
    anchor: { x: 0, y: 0, width: 0, height: 0 },
    content: { width: 0, height: 0 },
  })
  const current = useRef({ geometry, triggerRef, contentRef, boundaryRef })
  current.current = { geometry, triggerRef, contentRef, boundaryRef }
  const enabled = host.layout !== null && layer.canMeasure()
  useInsertionEffect(() => () => controller.dispose(), [controller])
  useLayoutEffect(() => {
    controller.invalidate()
    if (!enabled) {
      if (layer.phase !== "exiting" && (shouldUpdatePosition || !layer.mounted)) {
        established.current = null
        setPosition(null)
      }
      return
    }
    const prior = presentation.current
    if (prior?.host !== host.root || prior.layer !== layer.id || prior.generation !== layer.generation) {
      established.current = null
      setPosition(null)
      presentation.current = { host: host.root, layer: layer.id, generation: layer.generation }
    }
    let retired = false
    let frame: ReturnType<typeof requestAnimationFrame> | null = null
    const update = () => {
      if (retired || (!shouldUpdatePosition && established.current !== null)) return
      const hostGeneration = host.generation.current
      controller.read(
        { host: host.root, anchor: triggerRef, content: contentRef, boundary: boundaryRef },
        () =>
          !retired &&
          host.live.current &&
          layer.canMeasure() &&
          host.generation.current === hostGeneration &&
          current.current.geometry === geometry &&
          current.current.triggerRef === triggerRef &&
          current.current.contentRef === contentRef &&
          current.current.boundaryRef === boundaryRef,
        (measured) => {
          const next = getNativeFloatingPlacement({
            ...geometry,
            host: measured.host,
            anchor: measured.anchor,
            content: measured.content,
            visibleBoundary: measured.boundary,
          })
          if (JSON.stringify(next) === JSON.stringify(established.current)) return
          established.current = next
          setPosition(next)
        },
      )
      if (!retired && (shouldUpdatePosition || established.current === null)) frame = requestAnimationFrame(update)
    }
    update()
    return () => {
      retired = true
      if (frame !== null) cancelAnimationFrame(frame)
      controller.invalidate()
    }
  }, [
    controller,
    enabled,
    host.layout,
    host.root,
    host.live,
    host.generation,
    layer.id,
    layer.generation,
    layer.phase,
    layer.mounted,
    geometry,
    triggerRef,
    contentRef,
    boundaryRef,
    shouldUpdatePosition,
    layoutRevision,
  ])
  return position
}
