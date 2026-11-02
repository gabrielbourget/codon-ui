import type { NativeKeyData } from "../../input/specs/CUIFocusViewNativeComponent"

import type { TNativeSliderDirection, TNativeSliderState } from "./types"

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"] as const
export const SLIDER_KEY_TOKENS = KEYS.flatMap((key) => [`0000:${key}`, `1000:${key}`])

export const getSliderKeyCommand = (
  data: NativeKeyData,
  state: TNativeSliderState,
  index: number,
  direction: TNativeSliderDirection,
): (() => void) | undefined => {
  if (data.altKey || data.ctrlKey || data.metaKey) return
  const amount = data.shiftKey ? state.pageSize : state.step
  switch (data.key) {
    case "ArrowRight":
      return () => (direction === "rtl" ? state.decrementThumb(index, amount) : state.incrementThumb(index, amount))
    case "ArrowLeft":
      return () => (direction === "rtl" ? state.incrementThumb(index, amount) : state.decrementThumb(index, amount))
    case "ArrowUp":
      return () => state.incrementThumb(index, amount)
    case "ArrowDown":
      return () => state.decrementThumb(index, amount)
    case "PageUp":
      return () => state.incrementThumb(index, state.pageSize)
    case "PageDown":
      return () => state.decrementThumb(index, state.pageSize)
    case "Home":
      return () => state.setThumbValue(index, state.getThumbMinValue(index))
    case "End":
      return () => state.setThumbValue(index, state.getThumbMaxValue(index))
  }
}
