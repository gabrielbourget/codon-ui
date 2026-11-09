import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet, processColor } from "react-native"

import { Input, NativeThemeProvider } from "@codon-ui/react-native"

import { BasicControlsScene } from "../BasicControlsScene"
import { INPUT_ACTIONS, INPUT_STYLES } from "../InputG08Fixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("input-native-state").props.accessibilityLabel)
const editor = () => screen.getByTestId("input-native-editor")
const press = (label: string) => fireEvent.press(screen.getByRole("button", { name: label }))
const ownEditor = async () => {
  let component = editor().unstable_fiber
  while (component && component.type !== Input) component = component.return
  const bind = component?.memoizedProps.ref
  expect(bind).toEqual(expect.any(Function))
  await act(() => bind({ _nativeTag: 17, focus: jest.fn(), blur: jest.fn() }))
  expect(state().rootTag).toBe(17)
}
const enter = async () => {
  await render(
    <NativeThemeProvider>
      <BasicControlsScene />
    </NativeThemeProvider>,
  )
  await press("Prepare standalone Input checks")
}
it("preflights public Input original editor, frozen native events, exact owner echo and repeated veto", async () => {
  await enter()
  expect(editor().props.nativeID).toBe("input-public-editable")
  expect(editor().props.defaultValue).toBe("Seed")
  expect(editor().props.value).toBeUndefined()
  const original = editor()
  await press("Next Input check")
  expect(editor()).toBe(original)
  expect(editor().props.value).toBe("")
  const event = { target: 17, currentTarget: 17, nativeEvent: { target: 17, eventCount: 1, text: "a" } }
  await fireEvent(editor(), "change", event)
  await fireEvent.changeText(editor(), "a")
  event.nativeEvent.text = "pooled"
  expect(state().events.find((row: { phase: string }) => row.phase === "change").nativeEvent.text).toBe("a")
  expect(state().changes).toEqual([{ value: "a", generation: 0 }])
  expect(state().value).toBe("a")
  await press("Next Input check")
  for (const text of ["ownerx", "ownery"]) {
    await fireEvent(editor(), "change", {
      target: 17,
      currentTarget: 17,
      nativeEvent: { target: 17, eventCount: 2, text },
    })
    await fireEvent.changeText(editor(), text)
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe("owner")
  }
  expect(state().changes.map((row: { value: string }) => row.value)).toEqual(["a", "ownerx", "ownery"])
})
it("preflights Input guards, original selection and submit bindings, and explicit editor replacement", async () => {
  await enter()
  await ownEditor()
  for (const name of INPUT_ACTIONS) {
    expect(state().case).toBe(name)
    if (name === "disabled" || name === "readonly") {
      expect(editor().props.editable).toBe(false)
      expect(editor().props.readOnly).toBe(true)
      expect(editor().props.accessibilityState.disabled).toBe(name === "disabled")
      const before = state()
      await fireEvent.changeText(editor(), "blocked")
      await fireEvent(editor(), "change", {
        target: 17,
        currentTarget: 17,
        nativeEvent: { text: "blocked", target: 17 },
      })
      expect(state().changes).toEqual(before.changes)
      expect(state().events).toEqual(before.events)
    }
    if (name === "selection") {
      expect(editor().props.multiline).toBe(false)
      expect(editor().props.selection).toBeUndefined()
      await fireEvent(editor(), "focus", {
        target: 17,
        currentTarget: 17,
        nativeEvent: { target: 17, text: "Selectable", eventCount: 4 },
      })
      expect(editor().props.selection).toEqual({ start: 2, end: 5 })
      await fireEvent.changeText(editor(), "SeZtable")
      expect(editor().props.value).toBe("SeZtable")
      expect(editor().props.selection).toBeUndefined()
      for (const phase of ["selectionChange", "submitEditing", "blur"]) {
        await fireEvent(editor(), phase, {
          target: 17,
          currentTarget: 17,
          nativeEvent: { target: 17, text: "SeZtable", selection: { start: 3, end: 3 } },
        })
      }
      expect(state().events.map((row: { phase: string }) => row.phase)).toEqual([
        "focus",
        "selection",
        "submit",
        "blur",
      ])
    }
    if (name === "retired") expect(screen.queryByTestId("input-native-editor")).toBeNull()
    if (name === "fresh") {
      expect(state().generation).toBe(1)
      expect(editor().props.value).toBe("fresh")
    }
    if (name !== INPUT_ACTIONS.at(-1)) await press("Next Input check")
  }
})
it("preflights Input native reference, validation priority, final precedence and enlarged narrow text", async () => {
  await enter()
  await press("Input styles checks")
  for (const name of INPUT_STYLES) {
    expect(state().case).toBe(name)
    await act(() => jest.advanceTimersByTime(1000))
    const actual = StyleSheet.flatten(editor().props.style)
    const expected = StyleSheet.flatten(screen.getByTestId("input-native-reference").props.style)
    const nativeKeys = [
      "editable",
      "readOnly",
      "multiline",
      "placeholder",
      "placeholderTextColor",
      "autoCorrect",
      "autoCapitalize",
      "returnKeyType",
      "value",
    ]
    const nativeProps = Object.fromEntries(nativeKeys.map((key) => [key, editor().props[key]]))
    const referenceProps = Object.fromEntries(
      nativeKeys.map((key) => [key, screen.getByTestId("input-native-reference").props[key]]),
    )
    expect({ name, props: referenceProps }).toEqual({ name, props: nativeProps })
    for (const [key, wrong] of [
      ["editable", false],
      ["placeholder", undefined],
      ["placeholderTextColor", undefined],
    ])
      expect({ ...referenceProps, [key as string]: wrong }).not.toEqual(nativeProps)
    for (const key of [
      "width",
      "height",
      "padding",
      "paddingHorizontal",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "lineHeight",
      "borderWidth",
      "borderRadius",
    ])
      expect({ name, key, value: actual[key] }).toEqual({ name, key, value: expected[key] })
    for (const key of ["color", "borderColor", "backgroundColor"])
      expect({ name, key, value: processColor(actual[key]) }).toEqual({ name, key, value: processColor(expected[key]) })
    if (name === "error") expect(JSON.parse(editor().props.accessibilityHint).isInvalid).toBe(true)
    if (name === "long-narrow") {
      expect(actual).toMatchObject({ width: 190, fontSize: 24 })
      expect(editor().props.value).toContain("français")
    }
    if (name !== INPUT_STYLES.at(-1)) await press("Next Input check")
  }
})
it("preflights Input border retarget, real reduction listener and retired editor cleanup", async () => {
  await enter()
  await press("Input lifetime checks")
  await press("Second Input border")
  await act(() => jest.advanceTimersByTime(1000))
  expect(editor()).toHaveStyle({ borderColor: "#117733" })
  await press("Interrupt Input border")
  await act(() => jest.advanceTimersByTime(1000))
  expect(editor()).toHaveStyle({ borderColor: "#117733" })
  expect(state().motionEvents).toEqual([true])
  expect(screen.getByTestId("input-native-reference").props).toMatchObject({
    editable: true,
    placeholder: "Empty editor",
    multiline: false,
  })
  const generation = state().generation
  await press("Retire Input")
  expect(screen.queryByTestId("input-native-editor")).toBeNull()
  await press("Fresh Input")
  expect(state().generation).toBe(generation + 1)
  expect(editor().props.nativeID).toBe("input-public-editable")
})

it("preflights Input painted-border readiness separately from the logical target during normal motion", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  await enter()
  await press("Input lifetime checks")
  const paint = () => JSON.parse(screen.getByTestId("input-native-painted-state").props.accessibilityLabel)
  expect(screen.getByTestId("input-native-pair")).toHaveStyle({ height: 114 })
  expect(screen.getByTestId("input-native-parent")).toHaveStyle({ top: 22, height: 88 })
  expect(screen.getByTestId("input-native-painted-state")).toHaveStyle({ top: -22, left: 0, width: 272, height: 20 })
  const original = editor()
  await press("Second Input border")
  expect(state().expectedBorderNativeColor).toBe(processColor("#117733"))
  expect(paint().borderColor).toBe(processColor("#bb3322"))
  await act(() => jest.advanceTimersByTime(125))
  expect(paint().borderColor).not.toBe(state().expectedBorderNativeColor)
  await act(() => jest.advanceTimersByTime(150))
  expect(paint().borderColor).toBe(state().expectedBorderNativeColor)
  expect(editor()).toBe(original)
})

it("preflights Input selection request after original focus without replacing its editor", async () => {
  await enter()
  await ownEditor()
  const original = editor()
  while (state().case !== "selection") await press("Next Input check")
  expect(editor()).toBe(original)
  expect(editor().props.selection).toBeUndefined()
  expect(state().selectionArmed).toBe(false)
  const refs = state().refs
  const focus = { target: 17, currentTarget: 17, nativeEvent: { target: 17, text: "Selectable", eventCount: 4 } }
  await fireEvent(editor(), "focus", focus)
  focus.nativeEvent.text = "pooled"
  expect(state().events.at(-1).nativeEvent.text).toBe("Selectable")
  expect(state().selectionArmed).toBe(true)
  expect(editor().props.selection).toEqual({ start: 2, end: 5 })
  expect(editor()).toBe(original)
  expect(state().refs).toEqual(refs)
  await fireEvent(editor(), "change", {
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, eventCount: 5, text: "SeZtable", selection: { start: 3, end: 3 } },
  })
  await fireEvent.changeText(editor(), "SeZtable")
  expect(editor().props.value).toBe("SeZtable")
  expect(editor().props.selection).toBeUndefined()
  expect(state().selectionArmed).toBe(false)
  expect(editor()).toBe(original)
})

it("preflights Input selection request rejects foreign, stale-phase and retired-owner focus", async () => {
  await enter()
  await ownEditor()
  const wrongPhaseFocus = editor().props.onFocus
  while (state().case !== "selection") await press("Next Input check")
  const focus = { target: 17, currentTarget: 17, nativeEvent: { target: 17, text: "Selectable", eventCount: 4 } }
  const oldOwnerFocus = editor().props.onFocus
  for (const bad of [
    { ...focus, target: 99 },
    { ...focus, currentTarget: 99 },
    { ...focus, nativeEvent: { ...focus.nativeEvent, target: 99 } },
    { ...focus, nativeEvent: { ...focus.nativeEvent, text: "owner" } },
  ]) {
    await fireEvent(editor(), "focus", bad)
    expect(editor().props.selection).toBeUndefined()
    expect(state().selectionArmed).toBe(false)
  }
  await act(() => wrongPhaseFocus(focus))
  expect(state().selectionArmed).toBe(false)
  await fireEvent(editor(), "focus", focus)
  expect(state().selectionArmed).toBe(true)
  await press("Next Input check")
  expect(state().selectionArmed).toBe(false)
  await press("Next Input check")
  expect(state().generation).toBe(1)
  await act(() => oldOwnerFocus(focus))
  expect(state().selectionArmed).toBe(false)
  expect(editor().props.selection).toBeUndefined()
  await press("Input actions checks")
  expect(state().selectionArmed).toBe(false)
  await ownEditor()
  while (state().case !== "selection") await press("Next Input check")
  await fireEvent(editor(), "focus", focus)
  expect(state().selectionArmed).toBe(true)
  await act(() => oldOwnerFocus(focus))
  expect(state().selectionArmed).toBe(true)
  expect(editor().props.selection).toEqual({ start: 2, end: 5 })
})
