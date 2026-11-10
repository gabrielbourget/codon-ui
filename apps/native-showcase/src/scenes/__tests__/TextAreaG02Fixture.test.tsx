import { act, fireEvent, render, screen } from "@testing-library/react-native"
import * as Native from "react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { MultilineRadioScene } from "../MultilineRadioScene"

const enter = () =>
  render(
    <NativeThemeProvider>
      <MultilineRadioScene />
    </NativeThemeProvider>,
  )
const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const read = (id: string) => JSON.parse(screen.getByTestId(id).children.join(""))
const owner = () => read("textarea-g02-owner")
const events = () =>
  read("textarea-g02-events") as { field: string; kind: string; data: unknown; afterUnmount: boolean }[]
const editor = () => screen.getByTestId("multiline-draft")
const text = "Bonjour Montréal\nComplete second line"
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(Native, "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("observes original change/raw payloads and programmatic empty without inventing events", async () => {
  await enter()
  const original = editor()
  const refs = read("textarea-g02-refs")
  const native = { nativeEvent: { text, target: 17, eventCount: 1 } }
  await fireEvent(original, "change", native)
  await fireEvent.changeText(original, text)
  expect(owner().draft).toBe(text)
  expect(
    events()
      .filter(({ field, kind }) => field === "draft" && kind !== "ref")
      .map(({ kind, data }) => ({ kind, data })),
  ).toEqual([
    { kind: "native:change", data: native.nativeEvent },
    { kind: "raw", data: text },
  ])
  const before = events()
  await press("G02 set multiline owner empty")
  expect(owner().draft).toBe("")
  expect(events()).toEqual(before)
  expect(read("textarea-g02-refs")).toEqual(refs)
})

it("records repeated caller veto without replacing the editor or echoing requests", async () => {
  await enter()
  await press("G02 set multiline owner text")
  const original = editor()
  const refs = read("textarea-g02-refs")
  await press("G02 toggle multiline owner veto")
  for (const request of ["X", "Y"]) {
    await fireEvent(original, "change", { nativeEvent: { text: request, target: 17, eventCount: 2 } })
    await fireEvent.changeText(original, request)
    expect(owner().draft).toBe(text)
    expect(editor()).toBe(original)
  }
  expect(read("textarea-g02-refs")).toEqual(refs)
})

it("keeps the long editor uncontrolled when its default prop changes and remounts only through the explicit action", async () => {
  await enter()
  const original = screen.getByTestId("multiline-long")
  const initialDefaultValue = original.props.defaultValue
  const refs = read("textarea-g02-refs")
  const before = events()
  await press("G02 next long default")
  expect(screen.getByTestId("multiline-long")).toBe(original)
  expect(original.props.value).toBeUndefined()
  expect(original.props.defaultValue).toBe(initialDefaultValue)
  expect(read("textarea-g02-config").defaultValue).toBe("Alternate uncontrolled notes")
  expect(events()).toEqual(before)
  expect(read("textarea-g02-refs")).toEqual(refs)
  await press("G02 remount multiline editors")
  expect(owner().generation).toBe(1)
  expect(screen.getByTestId("multiline-long")).not.toBe(original)
  expect(screen.getByTestId("multiline-long").props.defaultValue).toBe("Alternate uncontrolled notes")
  expect(events().filter(({ kind }) => kind === "raw")).toEqual([])
})

it("retains a late-callback negative control after scene unmount without mutating the next owner", async () => {
  const first = await enter()
  const oldOwner = owner().owner
  const captured = editor().props.onChangeText
  await press("G02 arm multiline retirement")
  await first.unmount()
  await act(() => captured("deliberate stale source control"))
  await enter()
  await press("G02 read multiline retirement")
  const retired = read("textarea-g02-retired")
  expect(retired.owner).toBe(oldOwner)
  expect(retired.unmounted).toBe(true)
  expect(retired.events).toContainEqual(
    expect.objectContaining({ kind: "raw", data: "deliberate stale source control", afterUnmount: true }),
  )
  expect(owner().owner).not.toBe(oldOwner)
  expect(owner().draft).toBe("")
  expect(events().filter(({ kind }) => kind === "raw")).toEqual([])
})
