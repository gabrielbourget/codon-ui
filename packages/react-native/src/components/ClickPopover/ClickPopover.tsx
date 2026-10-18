import {
  forwardRef,
  useContext,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  Animated,
  findNodeHandle,
  I18nManager,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"
import Svg, { Path, type PathProps } from "react-native-svg"

import { useNativeFloatingMotion } from "../../overlays/floating/motion"
import { useNativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { NativeFloatingPortal, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeFloatingLayer } from "../../overlays/floating/useFloatingLayer"
import { useNativeFloatingPosition } from "../../overlays/floating/useFloatingPosition"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeContentContext } from "../NativeContentContext"

import { getNativeClickPopoverStyles } from "./styles"
import type { TNativeClickPopoverProps, TNativeClickPopoverRef } from "./types"

export const ClickPopover = forwardRef<TNativeClickPopoverRef, TNativeClickPopoverProps>((props, ref) => {
  const {
    children,
    isOpen,
    defaultOpen,
    onOpenChange,
    triggerRef: authoredTrigger,
    boundaryRef,
    scrollRef,
    initialFocusRef,
    restoreFocusRef,
    placement = "bottom",
    direction = I18nManager.isRTL ? "rtl" : "ltr",
    offset,
    crossOffset,
    containerPadding,
    shouldFlip,
    maxHeight,
    arrowBoundaryOffset,
    shouldUpdatePosition,
    isNonModal = false,
    isKeyboardDismissDisabled = false,
    shouldCloseOnInteractOutside,
    isEntering = false,
    isExiting = false,
    trigger: _trigger,
    childIsDialog = true,
    showOverlayArrow = false,
    raised: _raised,
    geometry: _geometry,
    color: _color,
    order: _order,
    width: _width,
    height: _height,
    customStyles: _customStyles,
    style: _style,
    customOverlayArrowStyles: _arrowStyle,
    customDialogStyles: _dialogStyle,
    testID,
    "data-testid": aliasTestID,
    "aria-label": aliasLabel,
    accessibilityLabel,
    onLayout,
    onFocus,
    onBlur,
    ...nativeProps
  } = props
  const theme = useNativeTheme()
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const trigger = useNativeDialogTrigger()
  const contextOwned = isOpen === undefined && defaultOpen === undefined && trigger !== null
  const mode = contextOwned ? "trigger" : isOpen !== undefined ? "controlled" : "local"
  const ownership = useRef(mode)
  if ((mode === "local") !== (ownership.current === "local"))
    throw new TypeError("ClickPopover: changing controlled/uncontrolled ownership is unsupported")
  const [local, setLocal] = useState(() => defaultOpen ?? false)
  const open = contextOwned ? trigger!.isOpen : (isOpen ?? local)
  const fallbackTrigger = useRef<View>(null)
  const anchor = authoredTrigger ?? trigger?.triggerRef ?? fallbackTrigger
  if (open && authoredTrigger === undefined && trigger === null)
    throw new TypeError("ClickPopover: supply a native triggerRef or NativeDialogTrigger")
  const root = useRef<View>(null)
  const dialog = useRef<View>(null)
  const live = useRef(false)
  useImperativeHandle(ref, () => root.current!)
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const current = useRef({ open, contextOwned, trigger, onOpenChange, shouldCloseOnInteractOutside })
  current.current = { open, contextOwned, trigger, onOpenChange, shouldCloseOnInteractOutside }
  const close = () => {
    const owner = current.current
    if (!live.current || !owner.open) return
    if (owner.contextOwned) owner.trigger!.request(false)
    else {
      if (ownership.current === "local") setLocal(false)
      owner.onOpenChange?.(false)
    }
  }
  type TSide = "top" | "bottom" | "left" | "right"
  const requested = placement.split(" ")[0]
  const initialSide: TSide =
    requested === "start"
      ? direction === "rtl"
        ? "right"
        : "left"
      : requested === "end"
        ? direction === "rtl"
          ? "left"
          : "right"
        : (requested as TSide)
  const [side, setSide] = useState<TSide>(initialSide)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const [arrowLayout, setArrowLayout] = useState<{ width: number; height: number } | null>(null)
  const calibrated = getNativeClickPopoverStyles(theme, props, side, direction, host.layout?.width ?? 0)
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: parent?.id ?? null,
    isOpen: open,
    isModal: !isNonModal,
    isKeyboardDismissDisabled,
    priority: calibrated.priority,
    onDismiss: close,
    onOutside: (interaction) => {
      if (interaction.kind === "focus") {
        if (isNonModal) {
          if (current.current.shouldCloseOnInteractOutside?.(interaction) !== false) close()
        } else (childIsDialog ? dialog : root).current?.focus()
        return
      }
      if (!isNonModal && current.current.shouldCloseOnInteractOutside?.(interaction) !== false) close()
    },
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
  const painted = getNativeClickPopoverStyles(
    theme,
    props,
    position?.placement ?? side,
    direction,
    host.layout?.width ?? 0,
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
  const focused = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (
      !ready ||
      !layer.active ||
      focused.current === layer.generation ||
      (isNonModal && !childIsDialog && !initialFocusRef)
    )
      return
    const frame = requestAnimationFrame(() => {
      if (!layer.canAct()) return
      const target = (initialFocusRef ?? (childIsDialog ? dialog : root)).current
      if (target) {
        target.focus()
        focused.current = layer.generation
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, layer.active, layer.generation, initialFocusRef, childIsDialog, isNonModal])
  const wasMounted = useRef(false)
  useLayoutEffect(() => {
    const restore = wasMounted.current && !layer.mounted
    wasMounted.current = layer.mounted
    if (!restore) return
    const frame = requestAnimationFrame(() => {
      if (!live.current || windowActive?.() === false || !host.layers.canRestore(parent?.id ?? null)) return
      const target = (restoreFocusRef ?? anchor).current
      if (target && "focus" in target && typeof target.focus === "function") target.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [layer.mounted, host.layers, parent?.id, restoreFocusRef, anchor, windowActive])
  const [dialogFocused, setDialogFocused] = useState(false)
  if (!layer.mounted && !isExiting) return null
  const identity = testID ?? aliasTestID ?? "click-popover"
  const mark = (event: GestureResponderEvent) => {
    if (layer.canAct()) host.interactions.mark(layer.id, event)
  }
  const updateLayout = (event: LayoutChangeEvent) => {
    if (!live.current || !layer.canMeasure()) return
    setLayoutRevision((value) => value + 1)
    onLayout?.(event)
  }
  const body = getNativeButtonContent(children, childIsDialog ? painted.dialogText : painted.rootText)
  const arrowCenter = position ? position.arrowCrossOffset + position.arrowSize / 2 : 0
  const vertical = (position?.placement ?? side) === "top" || (position?.placement ?? side) === "bottom"
  const arrowWidth = arrowLayout?.width ?? 10,
    arrowHeight = arrowLayout?.height ?? 10
  const arrowPosition = vertical
    ? { left: arrowCenter, transform: [{ translateX: -arrowWidth / 2 }] }
    : { top: arrowCenter, transform: [{ translateY: -arrowHeight / 2 }] }
  const rotation = ({ top: "0deg", bottom: "180deg", right: "90deg", left: "270deg" } as const)[
    position?.placement ?? side
  ]
  return (
    <NativeFloatingPortal layerId={layer.mounted ? layer.id : undefined}>
      <View
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden={layer.covered}
        importantForAccessibility={layer.covered ? "no-hide-descendants" : "auto"}
      >
        {!isNonModal && layer.mounted && (
          <View
            testID={`${identity}-underlay`}
            accessible={false}
            collapsable={false}
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
          />
        )}
        <View
          pointerEvents={ready && layer.active ? "box-none" : "none"}
          style={[StyleSheet.absoluteFill, !ready && !(!open && isExiting) ? { opacity: 0 } : undefined]}
          accessibilityElementsHidden={!ready || !layer.active}
        >
          <NativeFloatingScopeContext.Provider value={{ id: layer.id, canAct: layer.canAct }}>
            <Animated.View
              {...nativeProps}
              ref={root}
              testID={identity}
              collapsable={false}
              accessible={false}
              accessibilityLabel={accessibilityLabel ?? aliasLabel}
              role={!childIsDialog && !isNonModal ? "dialog" : undefined}
              accessibilityViewIsModal={!isNonModal}
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
              {...{
                onTouchStartCapture: mark,
                onTouchEndCapture: mark,
                onFocusCapture: (event: Parameters<NonNullable<TNativeClickPopoverProps["onFocus"]>>[0]) => {
                  if (layer.canAct()) host.interactions.mark(layer.id, event)
                },
              }}
              onLayout={updateLayout}
              onFocus={(event) => {
                if (layer.canAct()) onFocus?.(event)
              }}
              onBlur={(event) => {
                if (layer.canAct()) onBlur?.(event)
              }}
              onAccessibilityEscape={() => {
                if (layer.canAct()) host.layers.requestDismiss("accessibilityEscape")
              }}
            >
              <NativeContentContext.Provider
                value={{ foregroundColor: painted.rootText.color ?? theme.colors.foreground, isButton: false }}
              >
                {showOverlayArrow && (
                  <View
                    testID={`${identity}-overlay-arrow`}
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[
                      {
                        position: "absolute",
                        width: 10,
                        height: 10,
                        [position?.placement ?? side]: "100%",
                        ...arrowPosition,
                      },
                      painted.arrow,
                    ]}
                    onLayout={({ nativeEvent }) => {
                      if (!live.current || !layer.canMeasure()) return
                      const { width, height } = nativeEvent.layout
                      setArrowLayout((value) =>
                        value?.width === width && value.height === height ? value : { width, height },
                      )
                    }}
                  >
                    <View style={{ width: 10, height: 10, transform: [{ rotate: rotation }] }}>
                      <Svg width={10} height={10} viewBox="0 0 10 10" color={painted.arrowColor}>
                        <Path {...(painted.arrowPaint as PathProps)} d="M0 0 L5 5 L10 0" />
                      </Svg>
                    </View>
                  </View>
                )}
                {childIsDialog ? (
                  <View
                    ref={dialog}
                    testID={`${identity}-dialog`}
                    role="dialog"
                    accessible={false}
                    accessibilityLabel={accessibilityLabel ?? aliasLabel}
                    style={[
                      dialogFocused
                        ? { outlineWidth: 1.5, outlineOffset: theme.spacing.unit, outlineColor: theme.colors.focusRing }
                        : undefined,
                      painted.dialog,
                    ]}
                    onFocus={(event) => {
                      if (layer.canAct()) setDialogFocused(event.nativeEvent.target === findNodeHandle(dialog.current))
                    }}
                    onBlur={() => setDialogFocused(false)}
                  >
                    <NativeContentContext.Provider
                      value={{ foregroundColor: painted.dialogText.color ?? theme.colors.foreground, isButton: false }}
                    >
                      {body}
                    </NativeContentContext.Provider>
                  </View>
                ) : (
                  body
                )}
              </NativeContentContext.Provider>
            </Animated.View>
          </NativeFloatingScopeContext.Provider>
        </View>
      </View>
    </NativeFloatingPortal>
  )
})
ClickPopover.displayName = "ClickPopover"
