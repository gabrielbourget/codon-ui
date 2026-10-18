import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyboardData } from "../../input/types"

import type {
  TNativeTagGroupKey,
  TNativeTagGroupRow,
  TNativeTagGroupSelectionBehavior,
  TNativeTagGroupSelectionMode,
  TNativeTagGroupSelectionOperation,
} from "./model"

export const NATIVE_TAG_GROUP_NAVIGATION_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
] as const
export type TNativeTagGroupNavigationKey = (typeof NATIVE_TAG_GROUP_NAVIGATION_KEYS)[number]
export const isNativeTagGroupNavigationKey = (key: string): key is TNativeTagGroupNavigationKey =>
  NATIVE_TAG_GROUP_NAVIGATION_KEYS.includes(key as TNativeTagGroupNavigationKey)

export const getNativeTagGroupKeyTokens = (isApple: boolean) => [
  ...[...NATIVE_TAG_GROUP_NAVIGATION_KEYS, "Delete", "Backspace", "Escape"].flatMap(nativeKeyTokens),
  ...nativeKeyTokens("a").filter((token) => token[isApple ? 3 : 2] === "1"),
]

export const getNativeTagGroupNavigationKey = (
  rows: readonly TNativeTagGroupRow[],
  focusedKey: TNativeTagGroupKey | null,
  key: TNativeTagGroupNavigationKey,
  isRTL: boolean,
): TNativeTagGroupKey | null => {
  const enabled = rows.filter((row) => !row.isDisabled)
  if (!enabled.length) return null
  if (key === "Home") return enabled[0].key
  if (key === "End") return enabled[enabled.length - 1].key
  const index = rows.findIndex((row) => row.key === focusedKey)
  if (index < 0) return key === "ArrowUp" ? enabled[enabled.length - 1].key : enabled[0].key
  const forward = key === "ArrowDown" || key === (isRTL ? "ArrowLeft" : "ArrowRight")
  for (let offset = 1; offset <= rows.length; offset++) {
    const candidate = rows[(index + (forward ? offset : -offset) + rows.length) % rows.length]
    if (!candidate.isDisabled) return candidate.key
  }
  return null
}

export const getNativeTagGroupNavigationSelection = (options: {
  key: TNativeTagGroupNavigationKey
  mode: TNativeTagGroupSelectionMode
  behavior: TNativeTagGroupSelectionBehavior
  isLink: boolean
  isApple: boolean
  modifiers: Pick<TNativeKeyboardData, "shiftKey" | "ctrlKey" | "altKey" | "metaKey">
}): TNativeTagGroupSelectionOperation | null => {
  const { key, mode, behavior, isLink, isApple, modifiers } = options
  if (mode === "none") return null
  if (key === "Home" || key === "End") {
    if ((isApple ? modifiers.metaKey : modifiers.ctrlKey) && modifiers.shiftKey && mode === "multiple") return "extend"
    return behavior === "replace" ? "replace" : null
  }
  if (isLink) return null
  if (modifiers.shiftKey && mode === "multiple") return "extend"
  return behavior === "replace" && !(isApple ? modifiers.altKey : modifiers.ctrlKey) ? "replace" : null
}
