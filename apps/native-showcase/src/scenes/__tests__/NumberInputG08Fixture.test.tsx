import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { NativeThemeProvider, NumberInput } from "@codon-ui/react-native"

import { NumberInputG08Fixture, snapshotNumberEvent } from "../NumberInputG08Fixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("number-native-state").props.accessibilityLabel)
const editor = () => screen.getByTestId("number-native-control-input")
const press = (label: string) => fireEvent.press(screen.getByRole("button", { name: label }))
const enter = () =>
  render(
    <NativeThemeProvider>
      <NumberInputG08Fixture />
    </NativeThemeProvider>,
  )
const ownEditor = async () => {
  let component = editor().unstable_fiber
  while (component && component.type !== NumberInput) component = component.return
  if (!component) throw new Error("Missing public NumberInput source target")
  const publicComponent = component
  const native = { _nativeTag: 17, focus: jest.fn(), blur: jest.fn(), setSelection: jest.fn() }
  await act(() => publicComponent.memoizedProps.ref(native))
  let root = screen.getByTestId("number-native-control").unstable_fiber
  while (root && root.type?.name !== "RootProbe") root = root.return
  if (!root) throw new Error("Missing original NumberInput root probe")
  const originalRoot = root
  await act(() => originalRoot.memoizedProps.bind({ _nativeTag: 23 }))
  expect(state()).toMatchObject({ inputTag: 17, rootTag: 23 })
  return native
}
const event = (text: string, count = 1) => ({
  target: 17,
  currentTarget: 17,
  nativeEvent: { text, eventCount: count, target: 17 },
})
const commit = (text: string) => fireEvent(editor(), "submitEditing", event(text))

it("preflights NumberInput original public editor and distinct root with synchronous event snapshots", async () => {
  await enter()
  await ownEditor()
  expect(editor().props).toMatchObject({ multiline: false, value: "", accessibilityLabel: "Public Number editor" })
  const payload = {
    ...event("001.25"),
    nativeEvent: { ...event("001.25").nativeEvent, selection: { start: 6, end: 6 } },
  }
  const frozen = snapshotNumberEvent("change", 0, payload)
  payload.currentTarget = 0
  payload.nativeEvent.selection.start = 0
  expect(frozen).toMatchObject({ target: 17, currentTarget: 17, nativeEvent: { selection: { start: 6, end: 6 } } })
  await fireEvent(editor(), "focus", event(""))
  await fireEvent.changeText(editor(), "001.25")
  expect(state().rendered).toMatchObject({ value: null, inputValue: "001.25" })
  expect(state().tick).toBe(1)
  expect(editor().props.value).toBe("001.25")
  await commit("001.25")
  await fireEvent(editor(), "endEditing", event("001.25"))
  expect(state().ownerValue).toBe(1.25)
  expect(editor().props.value).toBe("1.25")
  expect(state().requests.map((row: { value: number }) => row.value)).toEqual([1.25])
  expect(
    state()
      .events.filter((row: { phase: string }) => ["submit", "end"].includes(row.phase))
      .map((row: { nativeEvent: { text: string } }) => row.nativeEvent.text),
  ).toEqual(["001.25", "001.25"])
})

it("preflights NumberInput veto, keyed ownership modes, default once, bounds and locale", async () => {
  await enter()
  await press("Next Number check")
  await fireEvent.changeText(editor(), "-")
  await commit("-")
  expect(editor().props.value).toBe("5")
  expect(state().requests).toEqual([])
  await press("Next Number check")
  await fireEvent(editor(), "focus", event("5"))
  await fireEvent.changeText(editor(), "8")
  await commit("8")
  await press("Increase Number")
  await press("Increase Number")
  expect(state().requests.map((row: { value: number }) => row.value)).toEqual([8, 6, 6])
  expect(editor().props.value).toBe("5")
  await press("Next Number check")
  expect(state()).toMatchObject({ case: "default", generation: 1, uncontrolled: true })
  expect(editor().props.value).toBe("0")
  await fireEvent(editor(), "focus", event("0"))
  await fireEvent.changeText(editor(), "")
  await commit("")
  await press("Update Number default")
  expect(editor().props.value).toBe("")
  await press("Increase Number")
  expect(editor().props.value).toBe("0")
  await press("Next Number check")
  expect(state()).toMatchObject({ case: "bound", generation: 2, uncontrolled: false })
  await press("Increase Number")
  expect(editor().props.value).toBe("1")
  expect(screen.getByRole("button", { name: "Increase Number" })).toBeDisabled()
  await press("Decrease Number")
  expect(editor().props.value).toBe("0.75")
  await press("Next Number check")
  expect(editor().props.value).toBe("12,5")
  await fireEvent(editor(), "focus", event("12,5"))
  await fireEvent.changeText(editor(), "7,5")
  await commit("7,5")
  expect(state().ownerValue).toBe(7.5)
  expect(editor().props.value).toBe("7,5")
})

it("preflights NumberInput focus acknowledged selection, guards, retirement and authored root paint", async () => {
  await enter()
  for (let count = 0; count < 6; count++) await press("Next Number check")
  const native = await ownEditor()
  const original = editor()
  await fireEvent.changeText(editor(), "001.25")
  expect(editor().props.selection).toBeUndefined()
  await fireEvent(editor(), "focus", event("001.25"))
  await fireEvent.changeText(editor(), "001.25")
  expect(editor().props.selection).toEqual({ start: 0, end: 3 })
  expect(native.setSelection).not.toHaveBeenCalled()
  await fireEvent.changeText(editor(), "7.25")
  expect(editor().props.selection).toBeUndefined()
  await press("Next Number check")
  const beforeGuard = state().requests.length
  await fireEvent(editor(), "focus", event("5"))
  await fireEvent.changeText(editor(), "8")
  expect(state().disabled).toBe(true)
  expect(editor().props.value).toBe("5")
  expect(state().requests).toHaveLength(beforeGuard)
  for (const phase of ["disabled", "readonly", "restored"]) {
    await press("Next Number check")
    expect(state().case).toBe(phase)
    expect(editor()).toBe(original)
    expect(editor().props.editable).toBe(phase === "restored")
    const count = state().requests.length
    await fireEvent.changeText(editor(), "8")
    if (phase !== "restored") {
      await press("Increase Number")
      expect(state().requests).toHaveLength(count)
    }
    if (phase === "readonly") expect(screen.getByRole("button", { name: "Increase Number" })).not.toBeDisabled()
  }
  await press("Next Number check")
  expect(screen.queryByTestId("number-native-control-input")).toBeNull()
  await press("Next Number check")
  expect(editor()).not.toBe(original)
  await press("Number styles checks")
  expect(state().rendered).toMatchObject({ value: 5, isDisabled: false })
  await press("Next Number check")
  expect(state().expectedBorder).toBe("#b73434")
  expect(JSON.parse(screen.getByTestId("number-native-painted").props.accessibilityLabel).isInvalid).toBe(true)
})

it("delivers repeated whole-value focus ranges through the original NumberInput public ref after restoration", async () => {
  await enter()
  const native = await ownEditor()
  let nativeRange = [0, 1]
  native.setSelection.mockImplementation((start: number, end: number) => {
    nativeRange = [start, end]
  })
  await press("Next Number check")
  await fireEvent(editor(), "focus", {
    target: 23,
    currentTarget: 23,
    nativeEvent: { target: 23, text: "5", eventCount: 6 },
  })
  expect(native.setSelection).not.toHaveBeenCalled()
  await fireEvent(editor(), "blur", event("5", 6))
  await fireEvent(editor(), "focus", event("5", 6))
  await fireEvent.changeText(editor(), "-")
  await commit("-")
  await fireEvent(editor(), "blur", event("-", 7))
  expect(editor().props.value).toBe("5")
  await press("Next Number check")
  nativeRange = [1, 1]
  await fireEvent(editor(), "focus", event("5", 7))
  const replacement = "5".slice(0, nativeRange[0]) + "8" + "5".slice(nativeRange[1])
  expect(replacement).toBe("8")
  expect(native.setSelection.mock.calls).toEqual([
    [0, 1],
    [0, 1],
  ])
  expect(editor().props.selection).toBeUndefined()
  await fireEvent.changeText(editor(), replacement)
  expect(state()).toMatchObject({ ownerValue: 5, inputTag: 17, rootTag: 23, rendered: { inputValue: "8" } })
})
