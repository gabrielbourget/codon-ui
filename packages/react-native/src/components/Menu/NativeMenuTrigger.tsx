import {
  createContext,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { findNodeHandle } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import {
  NativeDialogTrigger,
  type TNativeDialogTriggerProps,
  type TNativeDialogTriggerRenderState,
} from "../../overlays/floating/NativeDialogTrigger"
import type { TNativeButtonProps } from "../Button/types"

import { NativeMenuTriggerNamingContext, NativeRootMenuTriggerStateContext } from "./context"
import { nativeMenuLongPressDescription } from "./triggerMessages"
import { useNativeMenuTriggerState } from "./triggerState"

type TStrategy = "first" | "last" | null
const StrategyContext = createContext<RefObject<TStrategy> | null>(null)
export const useNativeMenuFocusStrategy = () => {
  const strategy = useContext(StrategyContext)
  return strategy ? strategy.current : false
}
export const NATIVE_MENU_TRIGGER_MODES = ["press", "longPress"] as const
export type TNativeMenuTriggerMode = (typeof NATIVE_MENU_TRIGGER_MODES)[number]
export type TNativeMenuTriggerState = Omit<TNativeDialogTriggerRenderState, "triggerProps"> & {
  triggerProps: TNativeDialogTriggerRenderState["triggerProps"] &
    Pick<
      TNativeButtonProps,
      | "onKeyDown"
      | "onPressStart"
      | "onPressEnd"
      | "onPointerDown"
      | "onLongPress"
      | "delayLongPress"
      | "accessibilityHint"
      | "onLayout"
    >
}
export type TNativeMenuTriggerProps = Omit<TNativeDialogTriggerProps, "trigger"> & {
  triggerMode?: TNativeMenuTriggerMode
  locale?: string
  longPressDescription?: string
  trigger: (state: TNativeMenuTriggerState) => ReactNode
}
const arrowTokens = ["ArrowDown", "ArrowUp"].flatMap(nativeKeyTokens)
type TPointerType = "mouse" | "touch" | "pen" | "virtual" | "keyboard"
const TriggerBinding = ({
  state,
  render,
  strategy,
  mode,
  description,
}: {
  state: TNativeDialogTriggerRenderState
  render: TNativeMenuTriggerProps["trigger"]
  strategy: RefObject<TStrategy>
  mode: TNativeMenuTriggerMode
  description: string
}) => {
  const [tag, setTag] = useState(0)
  const input = useNativeKeyScope()
  const windowStamp = () => JSON.stringify(input?.acknowledgedSession() ?? null)
  const pointer = useRef<{
    type: TPointerType
    target: typeof state.triggerRef.current
    window: string
    suppressed: () => boolean
  } | null>(null)
  const cycle = useRef<{
    type: TPointerType
    target: typeof state.triggerRef.current
    window: string
    mode: TNativeMenuTriggerMode
    ended?: boolean
    suppressed: () => boolean
  } | null>(null)
  const live = useRef(false)
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      cycle.current = null
      pointer.current = null
    }
  }, [])
  useEffect(
    () =>
      input?.subscribe(() => {
        if (input.isWindowActive() === false) {
          cycle.current = null
          pointer.current = null
        }
      }),
    [input],
  )
  const layout = () => {
    setTag(findNodeHandle(state.triggerRef.current) ?? 0)
    if (cycle.current?.target !== state.triggerRef.current) cycle.current = null
  }
  useLayoutEffect(layout, [state.triggerRef])
  const typeFor = (event: TNativePressEvent): TPointerType => {
    const data = event.nativeEvent
    if ("kind" in data) return data.kind === "keyboard" ? "keyboard" : "virtual"
    return pointer.current?.target === state.triggerRef.current && pointer.current.window === windowStamp()
      ? pointer.current.type
      : "touch"
  }
  const canPress = (allowEnded = false) =>
    !!(
      live.current &&
      !state.isDisabled &&
      input?.isWindowActive() !== false &&
      cycle.current?.target &&
      cycle.current.target === state.triggerRef.current &&
      cycle.current.window === windowStamp() &&
      cycle.current.mode === mode &&
      (allowEnded || !cycle.current.ended) &&
      !cycle.current.suppressed()
    )
  const key = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      state.isDisabled ||
      data.phase !== "down" ||
      data.cancelled ||
      !data.nativeDefaultHandled ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.()
    )
      return
    if (mode === "longPress" && (!data.altKey || !["ArrowDown", "ArrowUp"].includes(data.key))) return
    if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(data.key)) return
    strategy.current = data.key === "ArrowUp" ? "last" : "first"
    state.toggle()
    if (data.key === "ArrowDown" || data.key === "ArrowUp") event.preventDefault()
  }
  useNativeKeyPolicy({
    tokens: mode === "longPress" ? arrowTokens.filter((token) => token[1] === "1") : arrowTokens,
    targetTag: tag,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !!tag && !state.isDisabled,
    lifetimeKey: `${tag}:${state.isOpen}:${mode}`,
    canAct: () => !state.isDisabled,
    onKey: key,
  })
  return render({
    ...state,
    triggerProps: {
      ...state.triggerProps,
      onKeyDown: key,
      onLayout: layout,
      accessibilityHint: mode === "longPress" && !state.isDisabled ? description : undefined,
      delayLongPress: mode === "longPress" ? 500 : undefined,
      onPointerDown: (event) => {
        event.persist?.()
        const data = event.nativeEvent
        pointer.current = {
          type:
            data.pointerType === "mouse" || data.pointerType === "pen" || data.pointerType === "touch"
              ? data.pointerType
              : "touch",
          target: state.triggerRef.current,
          window: windowStamp(),
          suppressed: () => event.defaultPrevented || event.isDefaultPrevented?.() === true,
        }
      },
      onPressStart: (event) => {
        event.persist?.()
        const type = typeFor(event)
        const originalPointer =
          type !== "keyboard" &&
          type !== "virtual" &&
          pointer.current?.target === state.triggerRef.current &&
          pointer.current.window === windowStamp()
            ? pointer.current
            : null
        cycle.current = {
          type,
          target: state.triggerRef.current,
          window: windowStamp(),
          mode,
          suppressed: () =>
            event.defaultPrevented || event.isDefaultPrevented?.() === true || originalPointer?.suppressed() === true,
        }
        if (!canPress()) return
        if (mode === "longPress") {
          if (type === "mouse" || type === "touch") state.close()
        } else if (type !== "touch" && type !== "keyboard") {
          strategy.current = type === "virtual" ? "first" : null
          focusNativeTarget(state.triggerRef.current)
          state.open()
        }
      },
      onPressEnd: () => {
        if (cycle.current) cycle.current.ended = true
      },
      onLongPress:
        mode === "longPress"
          ? () => {
              if (canPress() && (cycle.current?.type === "mouse" || cycle.current?.type === "touch")) {
                strategy.current = "first"
                focusNativeTarget(state.triggerRef.current)
                state.open()
              }
            }
          : undefined,
      onPress: (event) => {
        if (mode === "press" && typeFor(event) === "touch" && canPress(true)) {
          strategy.current = null
          focusNativeTarget(state.triggerRef.current)
          state.triggerProps.onPress(event)
        }
        cycle.current = null
        pointer.current = null
      },
    },
  })
}
export const NativeMenuTrigger = ({
  trigger,
  triggerMode = "press",
  locale,
  longPressDescription,
  ...props
}: TNativeMenuTriggerProps) => {
  if (!NATIVE_MENU_TRIGGER_MODES.includes(triggerMode))
    throw new TypeError("NativeMenuTrigger: unsupported triggerMode")
  const strategy = useRef<TStrategy>(null)
  const description = longPressDescription ?? nativeMenuLongPressDescription(locale)
  const state = useNativeMenuTriggerState(props)
  return (
    <NativeRootMenuTriggerStateContext.Provider value={state}>
      <StrategyContext.Provider value={strategy}>
        <NativeDialogTrigger
          {...props}
          isOpen={state.isOpen}
          onOpenChange={(next) => (next ? state.open(strategy.current) : state.close())}
          trigger={(state) => (
            <TriggerBinding
              state={state}
              render={trigger}
              strategy={strategy}
              mode={triggerMode}
              description={description}
            />
          )}
        >
          {(dialog) => (
            <NativeMenuTriggerNamingContext.Provider value={dialog.triggerProps.nativeID}>
              {typeof props.children === "function" ? props.children(dialog) : props.children}
            </NativeMenuTriggerNamingContext.Provider>
          )}
        </NativeDialogTrigger>
      </StrategyContext.Provider>
    </NativeRootMenuTriggerStateContext.Provider>
  )
}
