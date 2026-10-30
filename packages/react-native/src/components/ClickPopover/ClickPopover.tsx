import {
  forwardRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
  type Provider,
  useContext,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  Animated,
  Easing,
  findNodeHandle,
  I18nManager,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewProps,
  type StyleProp,
} from "react-native"
import type { PathProps } from "react-native-svg"

import { useNativeContextProps } from "../../collection/context"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { focusNativeContainer, focusNativeTarget } from "../../input/focus"
import { NativeDialogOverlayFocusOwner, useNativeDialogFocusMembership } from "../../input/NativeDialogFocusScope"
import { NativeFocusView, type NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeFloatingMotion } from "../../overlays/floating/motion"
import { useNativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { NativeFloatingArrow } from "../../overlays/floating/NativeFloatingArrow"
import { NativeFloatingPortal, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeFloatingLayer } from "../../overlays/floating/useFloatingLayer"
import { useNativeFloatingPosition } from "../../overlays/floating/useFloatingPosition"
import { useNativeFloatingScrollAnchor } from "../../overlays/floating/useFloatingScrollAnchor"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { useOverlayTriggerState } from "../ComboBox/state/useOverlayTriggerState"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext } from "../NativeContentContext"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"

import { NativePopoverContext, NativeOverlayTriggerStateContext } from "./context"
import type { TNativeClearContext } from "./context"
import { NativePopoverDialog } from "./NativePopoverDialog"
import { getNativeClickPopoverStyles } from "./styles"
import type { TNativeClickPopoverProps, TNativeClickPopoverRef, TNativeClickPopoverRootStyle } from "./types"

export type TNativeFloatingRenderState = Readonly<{
  trigger: string | null
  placement: "top" | "bottom" | "left" | "right" | null
  isEntering: boolean
  isExiting: boolean
}>
type TFloatingHostProps = ComponentPropsWithoutRef<typeof NativeFocusHost> & RefAttributes<View>
export type TNativeFloatingHostRender = (props: TFloatingHostProps, state: TNativeFloatingRenderState) => ReactElement
const FloatingHost = forwardRef<
  View,
  ComponentPropsWithoutRef<typeof NativeFocusHost> & {
    nativeRender?: TNativeFloatingHostRender
    nativeRenderState: TNativeFloatingRenderState
  }
>(({ nativeRender, nativeRenderState, ...props }, ref) =>
  nativeRender ? nativeRender({ ...props, ref }, nativeRenderState) : <NativeFocusView {...props} ref={ref} />,
)
const AnimatedFocusView = Animated.createAnimatedComponent(FloatingHost)
const textColorEasing = Easing.bezier(0.42, 0, 0.58, 1)
const subscribeNone = () => () => {}
const zero = () => 0
const ClearedContexts = ({ contexts, children }: { contexts?: readonly TNativeClearContext[]; children: ReactNode }) =>
  contexts?.reduce((content, context) => {
    const ContextProvider = context.Provider as unknown as Provider<null>
    return <ContextProvider value={null}>{content}</ContextProvider>
  }, children) ?? children
const getFocusSessionKey = (scope: ReturnType<typeof useNativeKeyScope>) => {
  const session = scope?.acknowledgedSession()
  return JSON.stringify([session?.windowId, session?.epoch])
}

export const NativeFloatingSurface = forwardRef<
  TNativeClickPopoverRef,
  TNativeClickPopoverProps & {
    nativeRootRole?: ViewProps["role"] | null
    nativeRender?: TNativeFloatingHostRender
    nativeStyle?: (
      state: TNativeFloatingRenderState & { defaultStyle: TNativeClickPopoverRootStyle },
    ) => StyleProp<TNativeClickPopoverRootStyle>
    nativeChildren?: (state: TNativeFloatingRenderState & { defaultChildren: undefined }) => ReactNode
    nativeClearContexts?: readonly TNativeClearContext[]
  }
>((props, ref) => {
  const {
    children,
    render: _publicRender,
    nativeRootRole,
    nativeRender,
    nativeStyle,
    nativeChildren,
    nativeClearContexts,
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
    trigger: triggerName,
    slot,
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
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    "aria-details": detailsBy,
    descriptionLabel = "Description",
    detailsLabel = "Details",
    onLayout,
    onFocus,
    onBlur,
    ...nativeProps
  } = props
  const theme = useNativeTheme()
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  useSyncExternalStore(input?.subscribe ?? subscribeNone, input?.snapshot ?? zero, zero)
  const inputSession = getFocusSessionKey(input)
  const inputReady = input?.isNativeReady() ?? true
  const trigger = useNativeDialogTrigger()
  const boundTrigger = slot === null ? null : trigger
  const inheritedState = useContext(NativeOverlayTriggerStateContext)
  const localState = useOverlayTriggerState({ isOpen, defaultOpen, onOpenChange })
  const contextState = slot === null ? null : inheritedState
  const contextOwned =
    isOpen === undefined && defaultOpen === undefined && (contextState !== null || boundTrigger !== null)
  const open = contextOwned ? (contextState?.isOpen ?? boundTrigger!.isOpen) : localState.isOpen
  const submenu = triggerName === "SubmenuTrigger"
  const fallbackTrigger = useRef<View>(null)
  const anchor = authoredTrigger ?? boundTrigger?.triggerRef ?? fallbackTrigger
  if (open && authoredTrigger === undefined && boundTrigger === null)
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
  const current = useRef({
    open,
    contextOwned,
    trigger: boundTrigger,
    contextState,
    localState,
    shouldCloseOnInteractOutside,
  })
  current.current = {
    open,
    contextOwned,
    trigger: boundTrigger,
    contextState,
    localState,
    shouldCloseOnInteractOutside,
  }
  const suppressRestore = useRef(false)
  const priorOpen = useRef(open)
  if (open && !priorOpen.current) suppressRestore.current = false
  priorOpen.current = open
  const close = () => {
    const owner = current.current
    if (!live.current || !owner.open || input?.isWindowActive() === false || windowActive?.() === false) return
    if (owner.contextOwned) {
      if (owner.contextState) owner.contextState.close()
      else owner.trigger!.request(false)
    } else owner.localState.close()
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
  const committedDynamicStyle = useRef<StyleProp<TNativeClickPopoverRootStyle>>(undefined)
  const [, refreshDynamicStyle] = useState(0)
  const calibrated = getNativeClickPopoverStyles(
    theme,
    nativeStyle ? { ...props, style: [props.style, committedDynamicStyle.current] } : props,
    side,
    direction,
    host.layout?.width ?? 0,
  )
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: parent?.id ?? null,
    isOpen: open,
    isModal: !isNonModal,
    isKeyboardDismissDisabled,
    priority: calibrated.priority,
    onDismiss: close,
    onOutside: (interaction) => {
      if (!live.current || input?.isWindowActive() === false || windowActive?.() === false) return
      if (interaction.kind === "focus") {
        if (isNonModal) {
          suppressRestore.current = true
          if (current.current.shouldCloseOnInteractOutside?.(interaction) !== false) close()
        } else if (input?.isNativeReady() !== false) focusNativeContainer((childIsDialog ? dialog : root).current)
        return
      }
      if ((!isNonModal || submenu) && current.current.shouldCloseOnInteractOutside?.(interaction) !== false) close()
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
    onAncestorScroll: () => {
      if (isNonModal && !submenu && layer.canAct()) close()
    },
  })
  useLayoutEffect(() => {
    if (position) setSide(position.placement)
  }, [position?.placement])
  const baseline = getNativeClickPopoverStyles(
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
  const renderState: TNativeFloatingRenderState = {
    trigger: triggerName || null,
    placement: position?.placement ?? null,
    isEntering: isEntering || (!!position && motion.isEntering),
    isExiting: motion.isExiting,
  }
  const dynamicStyle =
    layer.mounted || isExiting
      ? nativeStyle?.({ ...renderState, defaultStyle: { ...baseline.root, ...baseline.rootText } })
      : undefined
  const painted = nativeStyle
    ? getNativeClickPopoverStyles(
        theme,
        { ...props, style: [props.style, dynamicStyle] },
        position?.placement ?? side,
        direction,
        host.layout?.width ?? 0,
      )
    : baseline
  useInsertionEffect(() => {
    committedDynamicStyle.current = dynamicStyle
  })
  const dynamicPosition = JSON.stringify([painted.margins, painted.priority])
  const measuredPosition = JSON.stringify([calibrated.margins, calibrated.priority])
  useLayoutEffect(() => {
    if (nativeStyle && dynamicPosition !== measuredPosition) refreshDynamicStyle((value) => value + 1)
  }, [nativeStyle, dynamicPosition, measuredPosition])
  const ready =
    geometryReady && motion.preferenceReady && windowActive?.() !== false && input?.isWindowActive() !== false
  useNativeDialogFocusMembership(root, () => ready && layer.canAct())
  const scrollAnchorTag = useNativeFloatingScrollAnchor(
    open && layer.active && shouldUpdatePosition !== false,
    scrollRef,
  )
  const scrollAnchorKey = JSON.stringify([layer.id, layer.generation, inputSession, host.generation.current])
  const scrollAnchorRevision = JSON.stringify([position?.frame, position?.positionStyle, position?.maxHeight])
  useLayoutEffect(() => {
    if (ready && layer.phase === "entering") layer.entered()
  }, [ready, layer.phase, layer.generation])
  const focused = useRef<{ generation: number; target: View | null; explicit: boolean } | null>(null)
  const entryIntent = useRef({ generation: -1, pointer: false })
  if (entryIntent.current.generation !== layer.generation)
    entryIntent.current = { generation: layer.generation, pointer: input?.lastInput()?.origin === "pointer" }
  useLayoutEffect(() => {
    if (
      !ready ||
      !inputReady ||
      !layer.active ||
      (focused.current?.generation === layer.generation &&
        (focused.current.explicit || focused.current.target === (childIsDialog ? dialog : root).current)) ||
      (isNonModal && !submenu && !childIsDialog && !initialFocusRef) ||
      (submenu && !childIsDialog && !initialFocusRef && entryIntent.current.pointer)
    )
      return
    let retired = false
    const frame = requestAnimationFrame(() => {
      if (
        retired ||
        !live.current ||
        !layer.canAct() ||
        input?.isNativeReady() === false ||
        getFocusSessionKey(input) !== inputSession
      )
        return
      const target = (initialFocusRef ?? (childIsDialog ? dialog : root)).current
      if (initialFocusRef ? focusNativeTarget(target) : focusNativeContainer(target))
        focused.current = {
          generation: layer.generation,
          target: (childIsDialog ? dialog : root).current,
          explicit: initialFocusRef !== undefined,
        }
    })
    return () => {
      retired = true
      cancelAnimationFrame(frame)
    }
  }, [
    ready,
    layer.active,
    layer.generation,
    initialFocusRef,
    childIsDialog,
    isNonModal,
    submenu,
    input,
    inputSession,
    inputReady,
  ])
  const returnSnapshot = useRef<{
    mounted: boolean
    parent: string | null
    input: typeof input
    target: typeof anchor
  } | null>(null)
  const returnLease = useRef<ReturnType<typeof host.focusReturns.request>>(undefined)
  const latestReturn = useRef({ parent: parent?.id ?? null, input, target: restoreFocusRef ?? anchor })
  latestReturn.current = { parent: parent?.id ?? null, input, target: restoreFocusRef ?? anchor }
  useLayoutEffect(() => {
    if (layer.mounted) {
      host.focusReturns.cancel(layer.id)
      returnLease.current = undefined
      returnSnapshot.current = { mounted: true, ...latestReturn.current }
      return
    }
    const snapshot = returnSnapshot.current
    if (snapshot?.mounted) {
      snapshot.mounted = false
      if (!suppressRestore.current)
        returnLease.current = host.focusReturns.request(
          layer.id,
          snapshot.parent,
          snapshot.input,
          latestReturn.current.target,
        )
    } else returnLease.current?.updateTarget(latestReturn.current.target)
  }, [layer.mounted, layer.id, host.focusReturns, restoreFocusRef, anchor, parent?.id, input])
  useLayoutEffect(
    () => () => {
      if (returnSnapshot.current?.mounted && !suppressRestore.current) {
        const snapshot = latestReturn.current
        host.focusReturns.request(layer.id, snapshot.parent, snapshot.input, snapshot.target)
      }
    },
    [host.focusReturns, layer.id],
  )
  const [dialogFocused, setDialogFocused] = useState(false)
  const currentForeground = useNativeLinkColor(painted.rootText.color ?? theme.colors.foreground, 250, textColorEasing)
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
  const renderedChildren = nativeChildren ? nativeChildren({ ...renderState, defaultChildren: undefined }) : children
  const body = getNativeButtonContent(renderedChildren, { ...painted.rootText, color: currentForeground })
  const defaultDialog = getNativeClickPopoverStyles(
    theme,
    { ...props, customDialogStyles: undefined },
    position?.placement ?? side,
    direction,
    host.layout?.width ?? 0,
  )
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
            <NativeDialogOverlayFocusOwner
              rootRef={root}
              entryRef={childIsDialog ? dialog : undefined}
              canAct={() => ready && layer.canAct()}
            >
              <AnimatedFocusView
                nativeRender={nativeRender}
                nativeRenderState={renderState}
                {...nativeProps}
                ref={root}
                testID={identity}
                collapsable={false}
                accessible={false}
                focusable={nativeProps.focusable !== false && !childIsDialog && ready && layer.active}
                accessibilityLabel={accessibilityLabel ?? aliasLabel}
                nativeLabelledBy={nativeAccessibilityIDs(nativeProps.accessibilityLabelledBy ?? labelledBy)}
                nativeDescribedBy={nativeAccessibilityIDs(describedBy)}
                nativeDetailsBy={nativeAccessibilityIDs(detailsBy)}
                nativeDescriptionLabel={descriptionLabel}
                nativeDetailsLabel={detailsLabel}
                nativeScrollAnchorTag={ready ? scrollAnchorTag : 0}
                nativeScrollAnchorKey={scrollAnchorKey}
                nativeScrollAnchorRevision={scrollAnchorRevision}
                role={
                  nativeRootRole === null
                    ? undefined
                    : (nativeRootRole ?? (!childIsDialog && (!isNonModal || submenu) ? "dialog" : undefined))
                }
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
                  onTouchStartCapture: (event: GestureResponderEvent) => {
                    if (live.current && layer.canAct() && input?.isWindowActive() !== false) {
                      mark(event)
                      nativeProps.onTouchStartCapture?.(event)
                    }
                  },
                  onTouchEndCapture: (event: GestureResponderEvent) => {
                    if (live.current && layer.canAct() && input?.isWindowActive() !== false) {
                      mark(event)
                      nativeProps.onTouchEndCapture?.(event)
                    }
                  },
                  onFocusCapture: (event: Parameters<NonNullable<TNativeClickPopoverProps["onFocus"]>>[0]) => {
                    if (layer.canAct()) {
                      suppressRestore.current = false
                      host.interactions.mark(layer.id, event)
                    }
                  },
                }}
                onLayout={updateLayout}
                onBubbledFocus={(event) => {
                  if (layer.canAct()) onFocus?.(event)
                }}
                onBubbledBlur={(event) => {
                  if (layer.canAct()) onBlur?.(event)
                }}
                onAccessibilityEscape={() => {
                  if (layer.canAct()) host.layers.requestDismiss("accessibilityEscape")
                }}
              >
                <ClearedContexts contexts={nativeClearContexts}>
                  <NativeTextStyleProvider style={painted.rootText}>
                    <NativeContentContext.Provider
                      value={{
                        foregroundColor: currentForeground,
                        isButton: false,
                        textStyle: painted.rootText,
                      }}
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
                            if (!live.current || !layer.canMeasure()) return
                            const { width, height } = nativeEvent.layout
                            setArrowLayout((value) =>
                              value?.width === width && value.height === height ? value : { width, height },
                            )
                          }}
                        />
                      )}
                      {childIsDialog ? (
                        <NativePopoverDialog
                          ref={dialog}
                          testID={`${identity}-dialog`}
                          nativeFocusable={ready && layer.active}
                          nativeFallbackLabel={accessibilityLabel ?? aliasLabel}
                          style={props.customDialogStyles}
                          nativeBaselineStyle={[
                            dialogFocused
                              ? {
                                  outlineWidth: 1.5,
                                  outlineOffset: theme.spacing.unit,
                                  outlineColor: theme.colors.focusRing,
                                }
                              : undefined,
                            defaultDialog.dialog,
                            defaultDialog.dialogText,
                          ]}
                          onFocus={(event) => {
                            if (layer.canAct())
                              setDialogFocused(event.nativeEvent.target === findNodeHandle(dialog.current))
                          }}
                          onBlur={() => setDialogFocused(false)}
                        >
                          {renderedChildren}
                        </NativePopoverDialog>
                      ) : (
                        body
                      )}
                    </NativeContentContext.Provider>
                  </NativeTextStyleProvider>
                </ClearedContexts>
              </AnimatedFocusView>
            </NativeDialogOverlayFocusOwner>
          </NativeFloatingScopeContext.Provider>
        </View>
      </View>
    </NativeFloatingPortal>
  )
})
NativeFloatingSurface.displayName = "ClickPopover"
export const ClickPopover: ForwardRefExoticComponent<TNativeClickPopoverProps & RefAttributes<TNativeClickPopoverRef>> =
  forwardRef((authored, forwardedRef) => {
    const [props, ref] = useNativeContextProps(
      {
        ...authored,
        accessibilityLabel: authored.accessibilityLabel ?? authored["aria-label"],
        "aria-label": undefined,
        accessibilityLabelledBy: authored.accessibilityLabelledBy ?? authored["aria-labelledby"],
        "aria-labelledby": undefined,
        style: [authored.customStyles, authored.style],
      },
      forwardedRef,
      NativePopoverContext,
    )
    const style = props.style as TNativePopoverContextStyle
    const { clearContexts, ...native } = props as typeof props &
      Pick<import("./context").TNativePopoverContextProps, "clearContexts">
    return (
      <NativeFloatingSurface
        {...native}
        ref={ref}
        style={typeof style === "function" ? undefined : style}
        nativeStyle={typeof style === "function" ? style : undefined}
        nativeRender={props.render}
        nativeClearContexts={clearContexts}
      />
    )
  })

type TNativePopoverContextStyle = NonNullable<import("./context").TNativePopoverContextProps["style"]>
