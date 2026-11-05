import { render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Stepper scene")
  return press
}
const editor = () => screen.getByTestId("stepper-example-input")
const read = (id: string) => JSON.parse(screen.getByTestId(id).children.join(""))
const config = () => read("stepper-config")
const refs = () => read("stepper-refs")
const callbacks = (): { generation: number; kind: string; data: unknown }[] => read("stepper-callbacks")
const owner = (value: string, requested: string, count: number) =>
  expect(
    screen
      .getByTestId("stepper-state")
      .children.join("")
      .startsWith(`Value: ${value}. Request: ${requested}. Requests: ${count}. Raw: empty.`),
  ).toBe(true)

it.each([
  ["zero", "Set stepper zero", "0", "0", "0"],
  ["null", "Set stepper empty", "empty", "", "Empty"],
  ["minimum", "Set stepper minimum", "-1", "-1", "\u22121"],
  ["maximum", "Set stepper maximum", "1", "1", "1"],
] as const)(
  "S01.owner-%s preserves original identity and emits no numeric/native edits",
  async (_name, action, value, raw, ax) => {
    const press = await enter()
    const original = editor()
    const originalConfig = config()
    const originalRefs = refs()
    expect(originalRefs).toEqual({ attached: true, attachments: 1, detachments: 0 })
    await press(action)
    owner(value, "none", 0)
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe(raw)
    expect(editor().props.accessibilityValue.text).toBe(ax)
    expect(config()).toEqual(originalConfig)
    expect(refs()).toEqual(originalRefs)
    expect(callbacks()).toEqual([])
  },
)

it.each([
  ["undefined", 0, "undefined", "", "Empty", 0, "0", "0"],
  ["zero", 1, 0, "0", "0", 0.4, "0.4", "0.4"],
  ["fraction", 2, 0.4, "0.4", "0.4", null, "", "Empty"],
  ["null", 3, null, "", "Empty", "undefined", "", "Empty"],
] as const)(
  "S01.default-%s distinguishes initial defaults, ignores prop updates and applies them only on remount",
  async (_name, index, initialDefault, initialRaw, initialAX, nextDefault, remountedRaw, remountedAX) => {
    const press = await enter()
    for (let turn = 0; turn < index; turn++) await press("Next stepper default")
    expect(editor().props.value).toBe("0")
    expect(config()).toMatchObject({ generation: 0, ownership: "controlled", defaultValue: initialDefault })
    expect(callbacks()).toEqual([])
    await press("Toggle stepper controlled mode and remount")
    const original = editor()
    const initialConfig = config()
    const originalRefs = refs()
    owner("uncontrolled", "none", 0)
    expect(initialConfig).toMatchObject({ generation: 1, ownership: "uncontrolled", defaultValue: initialDefault })
    expect(editor().props.value).toBe(initialRaw)
    expect(editor().props.accessibilityValue.text).toBe(initialAX)
    expect(originalRefs).toEqual({ attached: true, attachments: 2, detachments: 1 })
    expect(callbacks()).toEqual([])
    await press("Next stepper default")
    owner("uncontrolled", "none", 0)
    expect(config()).toEqual({ ...initialConfig, defaultValue: nextDefault })
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe(initialRaw)
    expect(editor().props.accessibilityValue.text).toBe(initialAX)
    expect(refs()).toEqual(originalRefs)
    expect(callbacks()).toEqual([])
    await press("Remount stepper editor")
    owner("uncontrolled", "none", 0)
    expect(config()).toEqual({ ...initialConfig, defaultValue: nextDefault, generation: 2 })
    expect(editor()).not.toBe(original)
    expect(editor().props.value).toBe(remountedRaw)
    expect(editor().props.accessibilityValue.text).toBe(remountedAX)
    expect(refs()).toEqual({ attached: true, attachments: 3, detachments: 2 })
    expect(callbacks()).toEqual([])
  },
)

it.each([
  ["echo", false],
  ["veto", true],
] as const)(
  "S01.controlled-%s retains two separate fresh releases without raw events or duplicate requests",
  async (_name, veto) => {
    const press = await enter()
    if (veto) await press("Toggle stepper owner veto")
    const original = editor()
    const originalConfig = config()
    const originalRefs = refs()
    owner("0", "none", 0)
    expect(callbacks()).toEqual([])
    await press("Increase controlled quantity")
    owner(veto ? "0" : "0.1", "0.1", 1)
    expect(editor().props.value).toBe(veto ? "0" : "0.1")
    expect(callbacks()).toEqual([{ generation: 0, kind: "request", data: 0.1 }])
    expect(editor()).toBe(original)
    expect(refs()).toEqual(originalRefs)
    await press("Increase controlled quantity")
    owner(veto ? "0" : "0.2", veto ? "0.1" : "0.2", 2)
    expect(editor().props.value).toBe(veto ? "0" : "0.2")
    expect(callbacks()).toEqual([
      { generation: 0, kind: "request", data: 0.1 },
      { generation: 0, kind: "request", data: veto ? 0.1 : 0.2 },
    ])
    expect(editor()).toBe(original)
    expect(config()).toEqual(originalConfig)
    expect(refs()).toEqual(originalRefs)
  },
)
