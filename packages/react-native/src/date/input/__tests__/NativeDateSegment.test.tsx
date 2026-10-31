import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { Text, TextInput } from "react-native"

import { focusNativeTarget, getNativeFocusedTarget } from "../../../input/focus"
import { Commands } from "../../../input/specs/CUIDateSegmentNativeComponent"
import { NativeDateSegment, type TNativeDateSegmentRef, type TNativeDateSegmentInput } from "../NativeDateSegment"

import { packet } from "./packet"

jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockReturnValue(71)
})
afterEach(() => jest.restoreAllMocks())
const props = {
  ownerId: "owner",
  segmentId: "hour",
  bindingRevision: "binding",
  displayText: "13",
  locale: "en-GB",
  segmentDisabled: false,
  segmentReadOnly: false,
  segmentEditable: true,
}
const send = async (extra: Parameters<typeof packet>[0] = {}) => {
  const event = {
    nativeEvent: packet({ bindingRevision: screen.getByTestId("segment").props.bindingRevision, ...extra }),
  } as TNativeDateSegmentInput
  await act(() => screen.getByTestId("segment").props.onNativeSegmentInput(event))
  return event
}
it("keeps actual owned host/core editor refs and source events, using native focus callbacks as completion", async () => {
  const ref = createRef<TNativeDateSegmentRef>(),
    editor = createRef<TextInput>(),
    callback = jest.fn()
  await render(
    <>
      <NativeDateSegment {...props} ref={ref} testID="segment" onNativeSegmentInput={callback}>
        <Text>13</Text>
      </NativeDateSegment>
      <TextInput ref={editor} testID="existing" value="" selection={{ start: 0, end: 0 }} />
    </>,
  )
  const original = ref.current!,
    originalEditor = editor.current!,
    originalFocus = originalEditor.focus
  const write = jest.spyOn(originalEditor, "setNativeProps")
  expect(focusNativeTarget(original)).toBe(false)
  await send()
  expect(focusNativeTarget(original)).toBe(true)
  expect(Commands.requestSegmentFocus).toHaveBeenCalledWith(
    original,
    "owner",
    "hour",
    screen.getByTestId("segment").props.bindingRevision,
    "window",
    4,
  )
  expect(getNativeFocusedTarget()).not.toBe(original)
  const focused = await send({ kind: "focus", focused: true, sequence: 2 })
  expect(callback).toHaveBeenLastCalledWith(focused)
  expect(getNativeFocusedTarget()).toBe(original)
  const edit = await send({
    kind: "insert",
    focused: true,
    text: "2",
    document: "2",
    selectionStart: 1,
    selectionEnd: 1,
    sequence: 3,
  })
  expect(callback).toHaveBeenLastCalledWith(edit)
  expect(ref.current).toBe(original)
  expect(editor.current).toBe(originalEditor)
  expect(originalEditor.focus).toBe(originalFocus)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("existing").props).toMatchObject({ value: "", selection: { start: 0, end: 0 } })
})

it("retains the original SDK selection method and argument packet without rewriting its event", async () => {
  const callback = jest.fn()
  await render(<NativeDateSegment {...props} testID="segment" onNativeSegmentInput={callback} />)
  await send()
  const nativeData = JSON.stringify({
    method: "setSelectedTextRange",
    start: 0,
    end: 0,
    startGeneration: 4,
    endGeneration: 4,
  })
  const original = await send({ kind: "selection", sequence: 2, nativeData })
  expect(callback).toHaveBeenLastCalledWith(original)
  expect(callback.mock.calls.at(-1)![0]).toBe(original)
  expect(callback.mock.calls.at(-1)![0].nativeEvent.nativeData).toBe(nativeData)
})
it("retires old queued edits on readonly/disabled transitions and requires fresh native status", async () => {
  const ref = createRef<TNativeDateSegmentRef>(),
    callback = jest.fn()
  const view = await render(<NativeDateSegment {...props} ref={ref} testID="segment" onNativeSegmentInput={callback} />)
  const original = ref.current!
  await send()
  await send({ kind: "focus", focused: true, sequence: 2 })
  await view.rerender(
    <NativeDateSegment {...props} ref={ref} testID="segment" segmentReadOnly onNativeSegmentInput={callback} />,
  )
  callback.mockClear()
  await send({
    kind: "insert",
    focused: true,
    text: "3",
    document: "3",
    selectionStart: 1,
    selectionEnd: 1,
    sequence: 3,
  })
  expect(callback).not.toHaveBeenCalled()
  expect(focusNativeTarget(original)).toBe(false)
  await send({ epoch: 5, sequence: 4, focused: true })
  expect(getNativeFocusedTarget()).toBe(original)
  expect(focusNativeTarget(original)).toBe(true)
  expect(ref.current).toBe(original)
  await view.rerender(
    <NativeDateSegment {...props} ref={ref} testID="segment" segmentDisabled onNativeSegmentInput={callback} />,
  )
  await send({ epoch: 6, sequence: 5 })
  expect(focusNativeTarget(original)).toBe(false)
})
it("updates callbacks/ref recipients without losing the original native lease and cleans each recipient once", async () => {
  const first = jest.fn(),
    second = jest.fn(),
    callback = jest.fn(),
    current = jest.fn()
  const view = await render(
    <NativeDateSegment {...props} ref={first} testID="segment" onNativeSegmentInput={callback} />,
  )
  const original = first.mock.calls[0][0]
  await send()
  await view.rerender(<NativeDateSegment {...props} ref={second} testID="segment" onNativeSegmentInput={current} />)
  expect(first.mock.calls).toEqual([[original], [null]])
  expect(second).toHaveBeenCalledWith(original)
  expect(focusNativeTarget(original)).toBe(true)
  await send({ kind: "focus", focused: true, sequence: 2 })
  expect(current).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(second.mock.calls).toEqual([[original], [null]])
  expect(focusNativeTarget(original)).toBe(false)
})
it("honors React callback-ref cleanup and never routes a retired owner command", async () => {
  const cleanup = jest.fn(),
    ref = jest.fn((_target: TNativeDateSegmentRef | null) => cleanup)
  const view = await render(<NativeDateSegment {...props} ref={ref} testID="segment" />)
  const original = ref.mock.calls[0][0]!
  await send()
  await view.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(ref).toHaveBeenCalledTimes(1)
  expect(focusNativeTarget(original)).toBe(false)
})

it("rejects a queued guard generation after a quick readonly round trip without requiring native epoch increments for each JS commit", async () => {
  const ref = createRef<TNativeDateSegmentRef>(),
    callback = jest.fn()
  const view = await render(<NativeDateSegment {...props} ref={ref} testID="segment" onNativeSegmentInput={callback} />)
  const original = ref.current!
  const firstRevision = screen.getByTestId("segment").props.bindingRevision
  await send()
  await view.rerender(
    <NativeDateSegment {...props} ref={ref} testID="segment" segmentReadOnly onNativeSegmentInput={callback} />,
  )
  await view.rerender(<NativeDateSegment {...props} ref={ref} testID="segment" onNativeSegmentInput={callback} />)
  const finalRevision = screen.getByTestId("segment").props.bindingRevision
  expect(finalRevision).not.toBe(firstRevision)
  callback.mockClear()
  await send({ bindingRevision: firstRevision, kind: "insert", focused: true, sequence: 2 })
  expect(callback).not.toHaveBeenCalled()
  expect(focusNativeTarget(original)).toBe(false)
  await send({ epoch: 5, sequence: 3 })
  expect(focusNativeTarget(original)).toBe(true)
  expect(Commands.requestSegmentFocus).toHaveBeenLastCalledWith(original, "owner", "hour", finalRevision, "window", 5)
  expect(ref.current).toBe(original)
})

it("retires queued input when numeric/text keyboard traits change while retaining the original host", async () => {
  const ref = createRef<TNativeDateSegmentRef>(),
    callback = jest.fn()
  const view = await render(
    <NativeDateSegment {...props} ref={ref} testID="segment" keyboardMode="numeric" onNativeSegmentInput={callback} />,
  )
  const original = ref.current!
  const previous = screen.getByTestId("segment").props.bindingRevision
  await send()
  await view.rerender(
    <NativeDateSegment {...props} ref={ref} testID="segment" keyboardMode="text" onNativeSegmentInput={callback} />,
  )
  callback.mockClear()
  await send({ kind: "insert", bindingRevision: previous, sequence: 2, focused: true })
  expect(callback).not.toHaveBeenCalled()
  expect(focusNativeTarget(original)).toBe(false)
  await send({ epoch: 5, sequence: 3 })
  expect(focusNativeTarget(original)).toBe(true)
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("segment").props.keyboardMode).toBe("text")
})

it.each(["segmentDisabled", "segmentReadOnly"] as const)(
  "retains original observed focus after native acknowledgement of %s while preserving request/edit admission",
  async (guard) => {
    const ref = createRef<TNativeDateSegmentRef>(),
      callback = jest.fn()
    const view = await render(
      <NativeDateSegment {...props} ref={ref} testID="segment" onNativeSegmentInput={callback} />,
    )
    const original = ref.current!
    await send()
    await send({ kind: "focus", focused: true, sequence: 2 })
    expect(getNativeFocusedTarget()).toBe(original)
    await view.rerender(
      <NativeDateSegment
        {...props}
        ref={ref}
        testID="segment"
        onNativeSegmentInput={callback}
        {...{ [guard]: true }}
      />,
    )
    // A new guard generation alone cannot grant a native focus observation.
    expect(getNativeFocusedTarget()).toBeNull()
    await send({ kind: "status", focused: true, epoch: 5, sequence: 3 })
    expect(getNativeFocusedTarget()).toBe(original)
    expect(focusNativeTarget(original)).toBe(guard === "segmentReadOnly")
    callback.mockClear()
    await send({
      kind: "insert",
      focused: true,
      epoch: 5,
      sequence: 4,
      text: "2",
      document: "2",
      selectionStart: 1,
      selectionEnd: 1,
    })
    expect(callback).not.toHaveBeenCalled()
    await send({ kind: "blur", focused: false, epoch: 5, sequence: 5 })
    expect(getNativeFocusedTarget()).toBeNull()
    expect(ref.current).toBe(original)
  },
)

it("drops an admitted private input after its field context is removed, preserving ordinary standalone input", async () => {
  const callback = jest.fn()
  await render(<NativeDateSegment {...props} testID="segment" onNativeSegmentInput={callback} />)
  await send()
  callback.mockClear()
  const original = {
    nativeEvent: {
      ...packet({
        bindingRevision: screen.getByTestId("segment").props.bindingRevision,
        kind: "insert",
        focused: true,
        sequence: 2,
      }),
      fieldDispatch: "retired-private-packet",
    },
  } as unknown as TNativeDateSegmentInput
  await act(() => screen.getByTestId("segment").props.onNativeSegmentInput(original))
  expect(callback).not.toHaveBeenCalled()
  const ordinary = await send({ kind: "insert", focused: true, sequence: 3 })
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(ordinary)
})
