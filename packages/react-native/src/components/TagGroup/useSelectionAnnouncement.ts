/* Copyright 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useEffect, useLayoutEffect, useRef } from "react"
import { AccessibilityInfo, Platform } from "react-native"

import type { TNativeListState } from "../../collection/state"

import { nativeTagSelectionAnnouncement } from "./selectionAnnouncement"
import type { TNativeTagGroupLabels } from "./types"

// Preserve the source's update-only announcement and one-frame focus handoff.
export const useNativeTagSelectionAnnouncement = <T extends object>(
  state: TNativeListState<T>,
  labels: TNativeTagGroupLabels,
) => {
  const selection = state.selectionManager.rawSelection
  const focused = state.selectionManager.isFocused
  const previous = useRef(selection)
  const mounted = useRef(false)
  const live = useRef(false)
  const current = useRef({ state, labels })
  useLayoutEffect(() => {
    current.current = { state, labels }
    live.current = true
    return () => {
      live.current = false
    }
  })
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const announce = () => {
      if (!live.current) return
      const { state: owner, labels: currentLabels } = current.current
      const message = nativeTagSelectionAnnouncement(owner, previous.current, currentLabels)
      previous.current = owner.selectionManager.rawSelection
      if (message) {
        if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: false })
        else AccessibilityInfo.announceForAccessibility(message)
      }
    }
    if (focused) announce()
    else {
      const frame = requestAnimationFrame(announce)
      return () => cancelAnimationFrame(frame)
    }
  }, [selection, focused])
}
