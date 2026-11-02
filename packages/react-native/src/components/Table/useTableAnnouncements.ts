/* Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useEffect, useLayoutEffect, useRef } from "react"
import { AccessibilityInfo, Platform } from "react-native"

import { nativeTableSelectionAnnouncement, nativeTableSortDescription } from "./announcements"
import type { TNativeTableState } from "./state/useTableState"

type TOptions = { locale: string; confirmed: boolean; target: number; windowIdentity: string; canAct: () => boolean }
export const useNativeTableAnnouncements = (state: TNativeTableState<object>, options: TOptions) => {
  const description = nativeTableSortDescription(state, options.locale)
  const selection = state.selectionManager.rawSelection,
    focused = state.selectionManager.isFocused
  const previous = useRef({
    initialized: false,
    target: options.target,
    windowIdentity: options.windowIdentity,
    selection,
    description,
  })
  const current = useRef({ state, options }),
    live = useRef(false)
  useLayoutEffect(() => {
    current.current = { state, options }
    live.current = true
    return () => {
      live.current = false
    }
  })
  useEffect(() => {
    const prior = previous.current
    const reset = () => {
      prior.selection = selection
      prior.description = description
    }
    if (
      prior.target !== options.target ||
      (options.windowIdentity && prior.windowIdentity !== options.windowIdentity)
    ) {
      prior.initialized = false
      prior.target = options.target
      prior.windowIdentity = options.windowIdentity
    }
    if (!prior.initialized) {
      reset()
      if (options.confirmed && options.canAct()) prior.initialized = true
      return
    }
    if (!options.canAct()) {
      reset()
      return
    }
    if (!options.confirmed) return
    const announce = (text: string, queue: boolean) => {
      if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue })
      else AccessibilityInfo.announceForAccessibility(text)
    }
    if (description !== prior.description) {
      prior.description = description
      if (description) announce(description, false)
    }
    const capturedTarget = options.target,
      capturedWindow = options.windowIdentity
    const announceSelection = () => {
      const latest = current.current
      if (!live.current) return
      if (
        !latest.options.canAct() ||
        !latest.options.confirmed ||
        latest.options.target !== capturedTarget ||
        latest.options.windowIdentity !== capturedWindow
      ) {
        prior.selection = latest.state.selectionManager.rawSelection
        return
      }
      const text = nativeTableSelectionAnnouncement(latest.state, prior.selection, latest.options.locale)
      prior.selection = latest.state.selectionManager.rawSelection
      if (text) announce(text, true)
    }
    if (focused) announceSelection()
    else {
      const frame = requestAnimationFrame(announceSelection)
      return () => cancelAnimationFrame(frame)
    }
  }, [
    selection,
    focused,
    description,
    options.confirmed,
    options.target,
    options.windowIdentity,
    options.canAct,
    options.locale,
  ])
  return description
}
