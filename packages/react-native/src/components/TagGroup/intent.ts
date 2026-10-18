import type {
  TNativeTagGroupSelectionBehavior,
  TNativeTagGroupSelectionMode,
  TNativeTagGroupSelectionOperation,
} from "./model"

export const NATIVE_TAG_GROUP_POINTER_TYPES = ["touch", "pen", "mouse", "keyboard", "virtual", "unknown"] as const
export type TNativeTagGroupPointerType = (typeof NATIVE_TAG_GROUP_POINTER_TYPES)[number]
export const NATIVE_TAG_GROUP_PRESS_PHASES = ["start", "release", "double", "long"] as const
export type TNativeTagGroupPressPhase = (typeof NATIVE_TAG_GROUP_PRESS_PHASES)[number]
export type TNativeTagGroupActionState = Readonly<{
  allowsSelection: boolean
  allowsActions: boolean
  hasPrimaryAction: boolean
  hasSecondaryAction: boolean
  hasAction: boolean
  longPressEnabled: boolean
}>
export const getNativeTagGroupActionState = (options: {
  mode: TNativeTagGroupSelectionMode
  behavior: TNativeTagGroupSelectionBehavior
  isEmpty: boolean
  isDisabled: boolean
  hasAction: boolean
  isLink: boolean
}): TNativeTagGroupActionState => {
  const allowsSelection = !options.isDisabled && options.mode !== "none" && !options.isLink
  const allowsAction = !options.isDisabled && (options.hasAction || options.isLink)
  const hasPrimaryAction =
    allowsAction && (options.behavior === "replace" ? !allowsSelection : !allowsSelection || options.isEmpty)
  const hasSecondaryAction = allowsAction && allowsSelection && options.behavior === "replace"
  const hasAction = hasPrimaryAction || hasSecondaryAction
  return {
    allowsSelection,
    allowsActions: allowsAction,
    hasPrimaryAction,
    hasSecondaryAction,
    hasAction,
    longPressEnabled: hasAction && allowsSelection,
  }
}
export type TNativeTagGroupPressIntent = Readonly<{
  select: boolean
  action: boolean
  enterToggle: boolean
}>
export const getNativeTagGroupPressIntent = (
  state: TNativeTagGroupActionState,
  input: {
    phase: TNativeTagGroupPressPhase
    pointerType: TNativeTagGroupPointerType
    key?: string
    shouldSelectOnPressUp: boolean
    primaryAtStart?: boolean
    suppressed?: boolean
  },
): TNativeTagGroupPressIntent => {
  const none = { select: false, action: false, enterToggle: false }
  if (input.suppressed || input.pointerType === "unknown") return none
  if (input.phase === "double") return { ...none, action: input.pointerType === "mouse" && state.hasSecondaryAction }
  if (input.phase === "long") {
    const enter = input.pointerType === "touch" && state.longPressEnabled
    return { select: enter, action: false, enterToggle: enter }
  }
  const keyboard = input.pointerType === "keyboard"
  if (input.phase === "start" && input.shouldSelectOnPressUp)
    return { ...none, select: keyboard && (!state.hasAction || input.key === " ") }
  if (input.phase === "start")
    return {
      ...none,
      select:
        state.allowsSelection &&
        (keyboard
          ? !state.allowsActions || input.key === " "
          : input.pointerType === "mouse" && !input.shouldSelectOnPressUp && !state.hasPrimaryAction),
    }
  if (input.shouldSelectOnPressUp) {
    const action = state.hasPrimaryAction || (state.hasSecondaryAction && input.pointerType !== "mouse")
    return {
      ...none,
      action: action && (!keyboard || input.key === "Enter"),
      select: !action && !keyboard && state.allowsSelection,
    }
  }
  const release =
    ["touch", "pen", "virtual"].includes(input.pointerType) ||
    (keyboard && state.hasAction && input.key === "Enter") ||
    (input.pointerType === "mouse" && (input.primaryAtStart ?? state.hasPrimaryAction))
  return { ...none, action: release && state.hasAction, select: release && !state.hasAction && state.allowsSelection }
}
export const getNativeTagGroupSelectionOperation = (options: {
  mode: TNativeTagGroupSelectionMode
  behavior: TNativeTagGroupSelectionBehavior
  pointerType: TNativeTagGroupPointerType
  isSelected: boolean
  disallowEmptySelection: boolean
  shiftKey: boolean
  selectionModifier: boolean
  nonContiguousModifier: boolean
}): TNativeTagGroupSelectionOperation => {
  if (options.pointerType === "keyboard" && options.nonContiguousModifier) return "toggle"
  if (options.mode === "single") return options.isSelected && !options.disallowEmptySelection ? "toggle" : "replace"
  if (options.shiftKey) return "extend"
  return options.behavior === "toggle" ||
    options.selectionModifier ||
    options.pointerType === "touch" ||
    options.pointerType === "virtual"
    ? "toggle"
    : "replace"
}
