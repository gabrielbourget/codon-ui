import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { findNodeHandle } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyPolicy } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import {
  NativeDialogTrigger,
  type TNativeDialogTriggerProps,
  type TNativeDialogTriggerRenderState,
} from "../../overlays/floating/NativeDialogTrigger"
import type { TNativeButtonProps } from "../Button/types"

const StrategyContext = createContext<RefObject<"first" | "last"> | null>(null)
export const useNativeMenuFocusStrategy = () => useContext(StrategyContext)?.current ?? "first"
export type TNativeMenuTriggerState = Omit<TNativeDialogTriggerRenderState, "triggerProps"> & {
  triggerProps: TNativeDialogTriggerRenderState["triggerProps"] & Pick<TNativeButtonProps, "onKeyDown">
}
export type TNativeMenuTriggerProps = Omit<TNativeDialogTriggerProps, "trigger"> & {
  trigger: (state: TNativeMenuTriggerState) => ReactNode
}
const arrowTokens = ["ArrowDown", "ArrowUp"].flatMap(nativeKeyTokens)
const TriggerBinding = ({
  state,
  render,
  strategy,
}: {
  state: TNativeDialogTriggerRenderState
  render: TNativeMenuTriggerProps["trigger"]
  strategy: RefObject<"first" | "last">
}) => {
  const [tag, setTag] = useState(0)
  useLayoutEffect(() => {
    setTag(findNodeHandle(state.triggerRef.current) ?? 0)
  }, [state.triggerRef])
  const key = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      state.isDisabled ||
      data.phase !== "down" ||
      data.cancelled ||
      data.repeat ||
      !data.nativeDefaultHandled ||
      event.defaultPrevented ||
      event.isDefaultPrevented?.()
    )
      return
    if (!["Enter", " ", "ArrowDown", "ArrowUp"].includes(data.key)) return
    strategy.current = data.key === "ArrowUp" ? "last" : "first"
    state.toggle()
    if (data.key === "ArrowDown" || data.key === "ArrowUp") event.preventDefault()
  }
  useNativeKeyPolicy({
    tokens: arrowTokens,
    targetTag: tag,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !!tag && !state.isDisabled,
    lifetimeKey: `${tag}:${state.isOpen}`,
    canAct: () => !state.isDisabled,
    onKey: key,
  })
  return render({
    ...state,
    triggerProps: {
      ...state.triggerProps,
      onKeyDown: key,
      onPress: (event) => {
        if ("kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard") return
        strategy.current = "first"
        state.triggerProps.onPress(event)
      },
    },
  })
}
export const NativeMenuTrigger = ({ trigger, ...props }: TNativeMenuTriggerProps) => {
  const strategy = useRef<"first" | "last">("first")
  return (
    <StrategyContext.Provider value={strategy}>
      <NativeDialogTrigger
        {...props}
        trigger={(state) => <TriggerBinding state={state} render={trigger} strategy={strategy} />}
      />
    </StrategyContext.Provider>
  )
}
