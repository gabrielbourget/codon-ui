import { forwardRef, useContext, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react"
import { Animated, I18nManager, StyleSheet, View } from "react-native"
import type { PathProps } from "react-native-svg"

import { useNativeFloatingMotion } from "../../overlays/floating/motion"
import { NativeFloatingArrow } from "../../overlays/floating/NativeFloatingArrow"
import { NativeFloatingPortal, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { useNativeTooltipTrigger } from "../../overlays/floating/NativeTooltipTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { getNativeFloatingSurfaceStyles } from "../../overlays/floating/styles"
import { useNativeFloatingLayer } from "../../overlays/floating/useFloatingLayer"
import { useNativeFloatingPosition } from "../../overlays/floating/useFloatingPosition"
import { useNativeTooltipTriggerState } from "../../overlays/floating/useTooltipTriggerState"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext } from "../NativeContentContext"

import type { TNativeTooltipProps, TNativeTooltipRef } from "./types"

export const NativeTooltipSurface = forwardRef<
  TNativeTooltipRef,
  TNativeTooltipProps & { profile: "tooltip" | "hover-popover" }
>((props, ref) => {
  const {
    profile,
    children,
    isOpen,
    defaultOpen,
    onOpenChange,
    triggerRef: authoredTrigger,
    boundaryRef,
    placement = "top",
    direction = I18nManager.isRTL ? "rtl" : "ltr",
    offset = 0,
    crossOffset,
    containerPadding,
    shouldFlip,
    maxHeight,
    arrowBoundaryOffset,
    shouldUpdatePosition,
    isEntering = false,
    isExiting = false,
    showOverlayArrow = profile === "tooltip",
    raised: _raised,
    geometry: _geometry,
    color: _color,
    order: _order,
    width: _width,
    height: _height,
    customStyles: _customStyles,
    style: _style,
    customOverlayArrowStyles: _arrowStyle,
    testID,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    accessibilityLabel,
    onLayout,
    onPointerEnter,
    onPointerLeave,
    ...nativeProps
  } = props
  const theme = useNativeTheme()
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const trigger = useNativeTooltipTrigger()
  const contextOwned = isOpen === undefined && defaultOpen === undefined && trigger !== null
  const localState = useNativeTooltipTriggerState({
    isOpen: contextOwned ? trigger.isOpen : isOpen,
    defaultOpen,
    onOpenChange,
  })
  const owner = contextOwned ? trigger : localState
  const open = owner.isOpen
  const currentOwner = useRef(owner)
  currentOwner.current = owner
  const fallbackTrigger = useRef<View>(null)
  const anchor = authoredTrigger ?? trigger?.triggerRef ?? fallbackTrigger
  if (open && authoredTrigger === undefined && trigger === null)
    throw new TypeError(`${profile}: supply a native triggerRef or NativeTooltipTrigger`)
  const root = useRef<View>(null)
  useImperativeHandle(ref, () => root.current!)
  const [side, setSide] = useState<"top" | "bottom" | "left" | "right">(() => {
    const requested = placement.split(" ")[0]
    if (requested === "start") return direction === "rtl" ? "right" : "left"
    if (requested === "end") return direction === "rtl" ? "left" : "right"
    return requested as "top" | "bottom" | "left" | "right"
  })
  const [layoutRevision, setLayoutRevision] = useState(0)
  const [arrowLayout, setArrowLayout] = useState<{ width: number; height: number } | null>(null)
  const calibrated = getNativeFloatingSurfaceStyles(theme, props, side, direction, host.layout?.width ?? 0, profile)
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: parent?.id ?? null,
    isOpen: open,
    isModal: false,
    isKeyboardDismissDisabled: false,
    capturesOutside: false,
    priority: calibrated.priority,
    onDismiss: () => currentOwner.current.close(true),
  })
  const position = useNativeFloatingPosition({
    layer,
    triggerRef: anchor,
    contentRef: root,
    boundaryRef,
    placement,
    direction,
    offset,
    crossOffset,
    containerPadding,
    shouldFlip,
    maxHeight,
    arrowBoundaryOffset,
    shouldUpdatePosition,
    arrowSize: showOverlayArrow ? (arrowLayout?.width ?? 10) : 0,
    margins: calibrated.margins,
    layoutRevision,
  })
  useLayoutEffect(() => {
    if (position) setSide(position.placement)
  }, [position?.placement])
  const painted = getNativeFloatingSurfaceStyles(
    theme,
    props,
    position?.placement ?? side,
    direction,
    host.layout?.width ?? 0,
    profile,
  )
  const geometryReady = position !== null && (!showOverlayArrow || arrowLayout?.width === position.arrowSize)
  const positionedGeneration = useRef<number | null>(null)
  if (geometryReady) positionedGeneration.current = layer.generation
  const transitionReady = geometryReady || positionedGeneration.current === layer.generation || (!open && isExiting)
  const motion = useNativeFloatingMotion(layer, transitionReady, open, isEntering, isExiting)
  const ready = geometryReady && motion.preferenceReady && windowActive?.() !== false
  useLayoutEffect(() => {
    if (ready && layer.phase === "entering") layer.entered()
  }, [ready, layer.phase, layer.generation])
  const contentHovered = useRef(false)
  useLayoutEffect(() => {
    contentHovered.current = false
  }, [layer.generation])
  const standaloneId = useId()
  if (!layer.mounted && !isExiting) return null
  const identity = testID ?? aliasTestID ?? profile
  return (
    <NativeFloatingPortal layerId={layer.mounted ? layer.id : undefined}>
      <View
        pointerEvents={ready && layer.active ? "box-none" : "none"}
        style={[StyleSheet.absoluteFill, !ready && !(!open && isExiting) ? { opacity: 0 } : undefined]}
        accessibilityElementsHidden={!ready || !layer.active}
        importantForAccessibility={!ready || !layer.active ? "no-hide-descendants" : "auto"}
      >
        <NativeFloatingScopeContext.Provider value={{ id: layer.id, canAct: layer.canAct }}>
          <Animated.View
            {...nativeProps}
            ref={root}
            testID={identity}
            nativeID={nativeProps.nativeID ?? trigger?.tooltipProps.nativeID ?? `codon-tooltip-${standaloneId}`}
            collapsable={false}
            accessible={false}
            role="tooltip"
            accessibilityLabel={accessibilityLabel ?? aliasLabel}
            accessibilityViewIsModal={false}
            style={[
              {
                position: "absolute",
                zIndex: 100000,
                ...(position?.positionStyle ?? { top: 0, left: 0 }),
                maxHeight: position?.maxHeight,
              },
              painted.root,
              motion.style,
            ]}
            onPointerEnter={(event) => {
              if (!layer.canAct()) return
              onPointerEnter?.(event)
              if (event.nativeEvent.pointerType === "touch" || contentHovered.current) return
              contentHovered.current = true
              if (contextOwned) trigger.openFromNative(true, layer.canAct)
              else localState.open(true, layer.canAct)
            }}
            onPointerLeave={(event) => {
              if (!layer.canAct()) return
              onPointerLeave?.(event)
              if (event.nativeEvent.pointerType === "touch" || !contentHovered.current) return
              contentHovered.current = false
              if (contextOwned) trigger.closeFromNative(false, layer.canAct)
              else localState.close(false, layer.canAct)
            }}
            {...{
              onTouchStartCapture: (event: Parameters<NonNullable<TNativeTooltipProps["onTouchStart"]>>[0]) => {
                if (layer.canAct()) host.interactions.mark(layer.id, event)
              },
              onTouchEndCapture: (event: Parameters<NonNullable<TNativeTooltipProps["onTouchEnd"]>>[0]) => {
                if (layer.canAct()) host.interactions.mark(layer.id, event)
              },
            }}
            onLayout={(event) => {
              if (!layer.canMeasure()) return
              setLayoutRevision((value) => value + 1)
              onLayout?.(event)
            }}
            onAccessibilityEscape={() => {
              if (layer.canAct()) host.layers.requestDismiss("accessibilityEscape")
            }}
          >
            <NativeContentContext.Provider
              value={{ foregroundColor: painted.rootText.color ?? theme.colors.foreground, isButton: false }}
            >
              {showOverlayArrow && (
                <NativeFloatingArrow
                  position={position}
                  side={side}
                  layout={arrowLayout}
                  style={painted.arrow}
                  graphicStyle={painted.arrowGraphic}
                  paint={painted.arrowPaint as PathProps}
                  color={painted.arrowColor}
                  testID={`${identity}-overlay-arrow`}
                  onLayout={({ nativeEvent }) => {
                    if (!layer.canMeasure()) return
                    const { width, height } = nativeEvent.layout
                    setArrowLayout((value) =>
                      value?.width === width && value.height === height ? value : { width, height },
                    )
                  }}
                />
              )}
              {getNativeButtonContent(children, painted.rootText)}
            </NativeContentContext.Provider>
          </Animated.View>
        </NativeFloatingScopeContext.Provider>
      </View>
    </NativeFloatingPortal>
  )
})
NativeTooltipSurface.displayName = "NativeTooltipSurface"
