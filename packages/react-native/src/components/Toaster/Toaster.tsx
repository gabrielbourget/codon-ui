import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useReducer,
  useState,
} from "react"
import { findNodeHandle, View, type ViewProps, type ViewStyle } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import {
  captureNativeFocusTarget,
  focusNativeTarget,
  getNativeFocusedTarget,
  getNativeFocusTargetWindow,
  getNativePreviousFocusTarget,
  isNativeFocusTarget,
  subscribeNativeFocus,
} from "../../input/focus"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyboardObservation, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewRef } from "../../input/types"
import { NativeFloatingPortal, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { OverlayRegistryContext } from "../../overlays/NativeOverlayProvider"
import { encodeCollectionKey } from "../collection"

import { createNativeToasterFocus, NativeToasterFocusContext } from "./focus"
import { matchesNativeToastObservedHotkey } from "./keyboard"
import { applyToastPublication, getNativeToastStacks } from "./model"
import { ToasterObserver } from "./stateManagement"
import { Toast } from "./Toast"
import {
  AVAILABLE_TOAST_POSITIONS,
  DEFAULT_MAX_VISIBLE_TOASTS,
  DEFAULT_TOAST_GAP,
  DEFAULT_TOAST_POSITION,
  DEFAULT_TOAST_WIDTH,
  DEFAULT_VIEWPORT_OFFSET,
  type TNativeToast,
  type TNativeToastHeight,
  type TNativeToastID,
  type TNativeToastPublication,
  type TNativeToasterProps,
} from "./types"

type TToasterState = { toasts: TNativeToast[]; expanded: boolean }
type TToasterAction =
  | { type: "publication"; publication: TNativeToastPublication }
  | { type: "remove"; id: TNativeToastID }
  | { type: "expand"; expanded: boolean }
const reduceToaster = (state: TToasterState, action: TToasterAction): TToasterState => {
  if (action.type === "expand") return { ...state, expanded: action.expanded }
  const toasts =
    action.type === "publication"
      ? applyToastPublication(state.toasts, action.publication)
      : state.toasts.filter((toast) => toast.id !== action.id)
  // Each canonical publication commits separately; preserve its collapse even when native React batches publications.
  return { toasts, expanded: toasts.length > 1 && state.expanded }
}

export const Toaster = forwardRef<TNativeFocusViewRef, TNativeToasterProps>((props, forwardedRef) => {
  const {
    duration,
    pauseWhenPageIsHidden = true,
    expandToggleHotkey = ["altKey", "KeyE"],
    dismissalHotkey = ["Escape"],
    position = DEFAULT_TOAST_POSITION,
    toastGap = DEFAULT_TOAST_GAP,
    offset = DEFAULT_VIEWPORT_OFFSET,
    expandByDefault = false,
    maxVisibleToasts = DEFAULT_MAX_VISIBLE_TOASTS,
    toastLabels,
    customRootStyles,
    customStyles,
    customStackStyles,
    customToastBridgeStyles,
    style,
    testID,
    "data-testid": aliasTestID,
    accessibilityLabel,
    "aria-label": aliasLabel,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-labelledby": nativeLabelledBy,
    "aria-describedby": nativeDescription,
    "aria-details": nativeDetails,
    labels,
    ...native
  } = props
  for (const [name, value] of Object.entries({ toastGap, offset, maxVisibleToasts }))
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`Toaster: ${name} must be finite and nonnegative`)
  if (!Number.isInteger(maxVisibleToasts)) throw new TypeError("Toaster: maxVisibleToasts must be an integer")
  if (!AVAILABLE_TOAST_POSITIONS.includes(position)) throw new TypeError("Toaster: unsupported position")
  const host = useNativeFloatingHost()
  const scope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const inputScope = useNativeKeyScope()
  const overlays = useContext(OverlayRegistryContext)
  const insets = useContext(SafeAreaInsetsContext)
  const [{ toasts, expanded }, dispatch] = useReducer(reduceToaster, { toasts: [], expanded: false })
  const setExpanded = useCallback((expanded: boolean) => dispatch({ type: "expand", expanded }), [])
  const [heights, setHeights] = useState<TNativeToastHeight[]>([])
  const [interacting, setInteracting] = useState(false)
  const live = useRef(true)
  const collapse = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stackRefs = useRef(new Map<string, TNativeFocusViewRef>())
  const current = useRef({ expanded, expandToggleHotkey, scope, windowActive, inputScope })
  useInsertionEffect(() => {
    current.current = { expanded, expandToggleHotkey, scope, windowActive, inputScope }
  })
  useInsertionEffect(
    () => () => {
      live.current = false
      if (collapse.current !== null) clearTimeout(collapse.current)
    },
    [],
  )
  useEffect(
    () =>
      ToasterObserver.subscribe((publication) => {
        if (live.current) dispatch({ type: "publication", publication })
      }),
    [],
  )
  const canAct = () =>
    live.current &&
    host.live.current &&
    current.current.scope?.canAct() !== false &&
    current.current.windowActive?.() !== false
  const windowKey = () => {
    const input = current.current.inputScope
    const session = input?.acknowledgedSession()
    return `${input?.ownerId ?? ""}:${session?.windowId ?? ""}:${session?.epoch ?? 0}`
  }
  const [focus] = useState(() =>
    createNativeToasterFocus({
      current: getNativeFocusedTarget,
      previous: getNativePreviousFocusTarget,
      canAct: () =>
        host.live.current &&
        current.current.inputScope?.isWindowActive() !== false &&
        current.current.scope?.canAct() !== false &&
        current.current.windowActive?.() !== false &&
        host.layers.canRestore(current.current.scope?.id ?? null),
      lifetime: windowKey,
      isLiveTarget: isNativeFocusTarget,
      lease: captureNativeFocusTarget,
      canCaptureUnmatched: (target) =>
        !!current.current.inputScope?.acknowledgedSession().windowId &&
        getNativeFocusTargetWindow(target) === windowKey(),
      tag: findNodeHandle,
      request: focusNativeTarget,
      schedule: requestAnimationFrame,
      cancel: cancelAnimationFrame,
    }),
  )
  useInsertionEffect(() => () => focus.dispose(), [focus])
  useLayoutEffect(() => subscribeNativeFocus(focus.changed), [focus])
  useLayoutEffect(() => inputScope?.subscribe(focus.changed), [focus, inputScope])
  useLayoutEffect(() => host.layers.subscribe(focus.changed), [focus, host.layers])
  useLayoutEffect(() => {
    const release = overlays?.subscribe(focus.changed)
    return () => {
      release?.()
    }
  }, [focus, overlays])
  useLayoutEffect(() => {
    if (!canAct() || inputScope?.isWindowActive() === false) focus.invalidate()
  }, [focus, inputScope, scope, windowActive])
  useNativeKeyboardObservation({
    targetTag: 0,
    isEnabled: true,
    lifetimeKey: "toaster",
    canAct,
    onKeyDown: (event) => {
      const data = event.nativeEvent
      if (!matchesNativeToastObservedHotkey(data, current.current.expandToggleHotkey)) return
      const next = !current.current.expanded
      if (next && "focusedTarget" in data && typeof data.focusedTarget === "number" && data.focusedTarget > 0)
        focus.capture(data.focusedTarget)
      setExpanded(next)
      if (next) focusNativeTarget([...stackRefs.current.values()].at(-1) ?? null)
    },
  })
  const removeToast = useCallback((toast: TNativeToast) => {
    if (!live.current) return
    dispatch({ type: "remove", id: toast.id })
    setHeights((current) => current.filter((entry) => entry.id !== toast.id))
  }, [])
  const requestExpand = () => {
    if (!canAct()) return
    if (collapse.current !== null) clearTimeout(collapse.current)
    collapse.current = null
    setExpanded(true)
  }
  const requestCollapse = () => {
    if (!canAct() || interacting) return
    if (collapse.current !== null) clearTimeout(collapse.current)
    collapse.current = setTimeout(() => {
      if (live.current) setExpanded(false)
      collapse.current = null
    }, 120)
  }
  const stacks = getNativeToastStacks(toasts, heights, position, toastGap, maxVisibleToasts)
  if (!toasts.length) return null
  const hotkeyLabel = expandToggleHotkey.join("+").replace(/Key/g, "").replace(/Digit/g, "")
  const captureHandlers: { onTouchStartCapture?: ViewProps["onTouchStart"] } = {
    onTouchStartCapture: () => focus.capture(),
  }
  return (
    <NativeFloatingPortal>
      <NativeToasterFocusContext.Provider value={focus}>
        <NativeFocusHost
          {...native}
          {...captureHandlers}
          ref={forwardedRef}
          testID={testID ?? aliasTestID ?? "toaster"}
          focusable={false}
          accessible={false}
          pointerEvents="box-none"
          accessibilityLabel={`${accessibilityLabel ?? aliasLabel ?? ariaLabel ?? "Notifications Toaster"} - ${hotkeyLabel}`}
          nativeLabelledBy={nativeAccessibilityIDs(
            native.accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy,
          )}
          nativeDescribedBy={nativeAccessibilityIDs(nativeDescription ?? ariaDescribedBy)}
          nativeDetailsBy={nativeAccessibilityIDs(nativeDetails ?? ariaDetails)}
          nativeDescriptionLabel={labels?.descriptionLabel}
          nativeDetailsLabel={labels?.detailsLabel}
          onBubbledFocus={(event) => {
            const target = getNativeFocusedTarget()
            if (target && findNodeHandle(target) === event.nativeEvent.target) focus.enter(target)
          }}
          onBubbledBlur={focus.changed}
          style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }, customRootStyles, style]}
        >
          {stacks.map((stack) => {
            const top = stack.position.startsWith("top")
            const side = stack.position.split("-")[1]
            const availableWidth = host.layout?.width
            const width =
              availableWidth !== undefined && availableWidth <= 500
                ? Math.max(0, availableWidth - 32)
                : DEFAULT_TOAST_WIDTH
            const stackStyle: ViewStyle = {
              position: "absolute",
              width,
              height: expanded ? stack.stackHeight : stack.firstHeight,
              [top ? "top" : "bottom"]: Math.max(offset, top ? (insets?.top ?? 0) : (insets?.bottom ?? 0)),
              ...(side === "center"
                ? { left: "50%", transform: [{ translateX: -width / 2 }] }
                : { [side]: Math.max(offset, side === "left" ? (insets?.left ?? 0) : (insets?.right ?? 0)) }),
            }
            const onHeight = (id: TNativeToastID, height: number) => {
              if (!live.current || !Number.isFinite(height) || height < 0) return
              setHeights((current) => {
                const old = current.find((entry) => entry.id === id)
                if (old?.height === height && old.position === stack.position) return current
                return [...current.filter((entry) => entry.id !== id), { id, height, position: stack.position }]
              })
            }
            return (
              <NativeFocusHost
                key={stack.position}
                testID={`toaster-stack-${stack.position}`}
                ref={(target) => {
                  if (target) {
                    stackRefs.current.set(stack.position, target)
                    const release = focus.register(target)
                    return () => {
                      release()
                      if (stackRefs.current.get(stack.position) === target) stackRefs.current.delete(stack.position)
                    }
                  } else stackRefs.current.delete(stack.position)
                }}
                accessible={false}
                focusable
                pointerEvents="box-none"
                onPointerEnter={requestExpand}
                onPointerMove={requestExpand}
                onPointerLeave={requestCollapse}
                onPointerDown={() => {
                  if (canAct()) setInteracting(true)
                }}
                onPointerUp={() => {
                  if (live.current) setInteracting(false)
                }}
                onPointerCancel={() => {
                  if (live.current) setInteracting(false)
                }}
                onTouchStart={() => {
                  if (canAct()) setInteracting(true)
                }}
                onTouchEnd={() => {
                  if (live.current) setInteracting(false)
                }}
                onTouchCancel={() => {
                  if (live.current) setInteracting(false)
                }}
                style={[stackStyle, customStyles, customStackStyles]}
              >
                {stack.toasts.map((toast, index) => (
                  <Toast
                    key={encodeCollectionKey(toast.id)}
                    toast={toast}
                    index={index}
                    numToasts={stack.toasts.length}
                    position={stack.position}
                    offset={stack.offsets[index]}
                    firstHeight={stack.firstHeight}
                    maxVisibleToasts={maxVisibleToasts}
                    toasterExpanded={expanded}
                    interacting={interacting}
                    expandByDefault={expandByDefault}
                    pauseWhenPageIsHidden={pauseWhenPageIsHidden}
                    duration={duration}
                    dismissalHotkey={dismissalHotkey}
                    toastLabels={toastLabels}
                    toastGap={toastGap}
                    removeToast={removeToast}
                    onHeight={onHeight}
                  />
                ))}
                {stack.bridges.map((bridge) => (
                  <View
                    key={bridge.key}
                    testID={`toaster-bridge-${bridge.key}`}
                    accessible={false}
                    onPointerEnter={requestExpand}
                    onPointerMove={requestExpand}
                    style={[
                      {
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: toastGap + 1,
                        [top ? "top" : "bottom"]: bridge.offset,
                      },
                      customToastBridgeStyles,
                    ]}
                  />
                ))}
              </NativeFocusHost>
            )
          })}
        </NativeFocusHost>
      </NativeToasterFocusContext.Provider>
    </NativeFloatingPortal>
  )
})
Toaster.displayName = "Toaster"
