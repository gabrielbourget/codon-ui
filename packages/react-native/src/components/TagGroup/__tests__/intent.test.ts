import {
  getNativeTagGroupActionState,
  getNativeTagGroupPressIntent,
  getNativeTagGroupSelectionOperation,
} from "../intent"

const state = (options: Partial<Parameters<typeof getNativeTagGroupActionState>[0]> = {}) =>
  getNativeTagGroupActionState({
    mode: "multiple",
    behavior: "toggle",
    isEmpty: true,
    isDisabled: false,
    hasAction: false,
    isLink: false,
    ...options,
  })
const intent = (
  value: ReturnType<typeof state>,
  phase: "start" | "release" | "double" | "long",
  pointerType: "touch" | "mouse" | "keyboard" | "pen" | "virtual" | "unknown",
  key?: string,
  up = false,
) => getNativeTagGroupPressIntent(value, { phase, pointerType, key, shouldSelectOnPressUp: up })
it("distinguishes primary action in empty toggle mode and secondary replace actions", () => {
  expect(state({ hasAction: true }).hasPrimaryAction).toBe(true)
  expect(state({ hasAction: true, isEmpty: false }).hasAction).toBe(false)
  expect(state({ hasAction: true, behavior: "replace" })).toMatchObject({
    hasPrimaryAction: false,
    hasSecondaryAction: true,
  })
  expect(state({ isLink: true })).toMatchObject({ allowsSelection: false, hasPrimaryAction: true })
  expect(state({ hasAction: true, isDisabled: true })).toMatchObject({
    allowsSelection: false,
    hasAction: false,
    longPressEnabled: false,
  })
})
it("selects on keyboard down and touch/pen/virtual release without a second key-up selection", () => {
  const value = state()
  expect(intent(value, "start", "keyboard", "Enter").select).toBe(true)
  expect(intent(value, "release", "keyboard", "Enter")).toEqual({ select: false, action: false, enterToggle: false })
  for (const pointer of ["touch", "pen", "virtual"] as const) {
    expect(intent(value, "start", pointer).select).toBe(false)
    expect(intent(value, "release", pointer).select).toBe(true)
  }
})
it("Enter acts on up while Space selects on down when actions are available", () => {
  const value = state({ hasAction: true, behavior: "replace" })
  expect(intent(value, "start", "keyboard", "Enter").select).toBe(false)
  expect(intent(value, "release", "keyboard", "Enter").action).toBe(true)
  expect(intent(value, "start", "keyboard", " ").select).toBe(true)
  expect(intent(value, "release", "keyboard", " ").action).toBe(false)
})
it("does not turn an unavailable toggle action into Enter selection", () => {
  const value = state({ hasAction: true, isEmpty: false })
  expect(value.hasAction).toBe(false)
  expect(value.allowsActions).toBe(true)
  expect(intent(value, "start", "keyboard", "Enter").select).toBe(false)
  expect(intent(value, "release", "keyboard", "Enter").select).toBe(false)
})
it("uses mouse down for selection, release for primary action and double-click for secondary action", () => {
  expect(intent(state(), "start", "mouse").select).toBe(true)
  expect(intent(state(), "release", "mouse").select).toBe(false)
  const primary = state({ hasAction: true })
  expect(intent(primary, "start", "mouse").select).toBe(false)
  expect(intent(primary, "release", "mouse").action).toBe(true)
  const secondary = state({ hasAction: true, behavior: "replace" })
  expect(intent(secondary, "start", "mouse").select).toBe(true)
  expect(intent(secondary, "release", "mouse").action).toBe(false)
  expect(intent(secondary, "double", "mouse").action).toBe(true)
  expect(intent(secondary, "double", "touch").action).toBe(false)
})
it("shouldSelectOnPressUp preserves keyboard-down selection and moves pointer selection to release", () => {
  const value = state()
  expect(intent(value, "start", "mouse", undefined, true).select).toBe(false)
  expect(intent(value, "release", "mouse", undefined, true).select).toBe(true)
  expect(intent(value, "start", "keyboard", " ", true).select).toBe(true)
  expect(intent(value, "release", "keyboard", " ", true).select).toBe(false)
})
it("long touch selects and enters toggle behavior, while unknown/suppressed input does not manufacture action", () => {
  expect(intent(state({ hasAction: true, behavior: "replace" }), "long", "touch")).toEqual({
    select: true,
    action: false,
    enterToggle: true,
  })
  expect(intent(state({ hasAction: true }), "long", "mouse").enterToggle).toBe(false)
  expect(intent(state({ hasAction: true }), "release", "unknown").action).toBe(false)
  expect(
    getNativeTagGroupPressIntent(state({ hasAction: true }), {
      phase: "release",
      pointerType: "touch",
      shouldSelectOnPressUp: false,
      suppressed: true,
    }).action,
  ).toBe(false)
})
it("uses actual modifiers and modality to choose toggle/replace/range operations", () => {
  const options = {
    mode: "multiple" as const,
    behavior: "replace" as const,
    pointerType: "mouse" as const,
    isSelected: false,
    disallowEmptySelection: false,
    shiftKey: false,
    selectionModifier: false,
    nonContiguousModifier: false,
  }
  expect(getNativeTagGroupSelectionOperation(options)).toBe("replace")
  expect(getNativeTagGroupSelectionOperation({ ...options, shiftKey: true })).toBe("extend")
  expect(getNativeTagGroupSelectionOperation({ ...options, selectionModifier: true })).toBe("toggle")
  expect(getNativeTagGroupSelectionOperation({ ...options, pointerType: "touch" })).toBe("toggle")
  expect(getNativeTagGroupSelectionOperation({ ...options, pointerType: "pen" })).toBe("replace")
  expect(
    getNativeTagGroupSelectionOperation({
      ...options,
      pointerType: "keyboard",
      shiftKey: true,
      nonContiguousModifier: true,
    }),
  ).toBe("toggle")
  expect(getNativeTagGroupSelectionOperation({ ...options, mode: "single", isSelected: true })).toBe("toggle")
  expect(
    getNativeTagGroupSelectionOperation({ ...options, mode: "single", isSelected: true, disallowEmptySelection: true }),
  ).toBe("replace")
})
