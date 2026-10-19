import { writeFileSync } from "node:fs"

import { act, cleanup, render, screen } from "@testing-library/react"
import { afterAll, afterEach, expect, it } from "vitest"

import { isHotkeyPressed } from "../../../../packages/react/src/components/Toaster/helpers"
import { ToasterObserver } from "../../../../packages/react/src/components/Toaster/stateManagement"
import Toaster, { toast } from "../../../../packages/react/src/components/Toaster/Toaster"
import { matchesNativeToastObservedHotkey } from "../../../../packages/react-native/src/components/Toaster/keyboard"
import type { TNativeObservedKeyData } from "../../../../packages/react-native/src/input/keyboardObservation"

const cases: Array<{ name: string; hotkey: string[]; init: KeyboardEventInit; expected: boolean; prevent?: boolean }> =
  [
    {
      name: "physical key despite different logical character",
      hotkey: ["altKey", "KeyE"],
      init: { code: "KeyE", key: "q", altKey: true },
      expected: true,
    },
    {
      name: "logical character does not substitute physical code",
      hotkey: ["altKey", "KeyE"],
      init: { code: "KeyQ", key: "e", altKey: true },
      expected: false,
    },
    { name: "empty predicate matches", hotkey: [], init: { code: "KeyA", key: "a" }, expected: true },
    {
      name: "modifier-only matches",
      hotkey: ["altKey"],
      init: { code: "KeyA", key: "a", altKey: true },
      expected: true,
    },
    { name: "missing modifier rejects", hotkey: ["altKey"], init: { code: "KeyA", key: "a" }, expected: false },
    {
      name: "incompatible physical keys reject",
      hotkey: ["KeyE", "KeyQ"],
      init: { code: "KeyE", key: "e" },
      expected: false,
    },
    { name: "truthy key property matches", hotkey: ["key"], init: { code: "KeyA", key: "a" }, expected: true },
    {
      name: "repeat property matches",
      hotkey: ["repeat"],
      init: { code: "KeyA", key: "a", repeat: true },
      expected: true,
    },
    { name: "false repeat property rejects", hotkey: ["repeat"], init: { code: "KeyA", key: "a" }, expected: false },
    {
      name: "keypad location matches",
      hotkey: ["location"],
      init: { code: "Numpad1", key: "1", location: 3 },
      expected: true,
    },
    {
      name: "standard zero location rejects",
      hotkey: ["location"],
      init: { code: "KeyA", key: "a", location: 0 },
      expected: false,
    },
    {
      name: "composing event matches",
      hotkey: ["isComposing"],
      init: { code: "KeyA", key: "a", isComposing: true },
      expected: true,
    },
    { name: "method truthiness matches", hotkey: ["preventDefault"], init: { code: "KeyA", key: "a" }, expected: true },
    { name: "prototype truthiness matches", hotkey: ["constructor"], init: { code: "KeyA", key: "a" }, expected: true },
    {
      name: "unknown property rejects",
      hotkey: ["notAKeyboardProperty"],
      init: { code: "KeyA", key: "a" },
      expected: false,
    },
    { name: "nonempty code property matches", hotkey: ["code"], init: { code: "KeyA", key: "a" }, expected: true },
    { name: "empty code property rejects", hotkey: ["code"], init: { code: "", key: "a" }, expected: false },
    {
      name: "default-prevented flag matches",
      hotkey: ["defaultPrevented"],
      init: { code: "KeyA", key: "a", cancelable: true },
      prevent: true,
      expected: true,
    },
    {
      name: "unprevented flag rejects",
      hotkey: ["defaultPrevented"],
      init: { code: "KeyA", key: "a", cancelable: true },
      expected: false,
    },
    {
      name: "bubbling flag matches",
      hotkey: ["bubbles"],
      init: { code: "KeyA", key: "a", bubbles: true },
      expected: true,
    },
  ]
const observations: unknown[] = []
afterEach(() => {
  cleanup()
  ToasterObserver.subscribers = []
  ToasterObserver.toasts = []
})
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-toaster-hotkey-oracle.json", JSON.stringify(observations, null, 2) + "\n"),
)
it.each(cases)("executes canonical isHotkeyPressed: $name", ({ name, hotkey, init, expected, prevent }) => {
  const event = new KeyboardEvent("keydown", init)
  if (prevent) event.preventDefault()
  const before = event.defaultPrevented
  expect(isHotkeyPressed(event, hotkey)).toBe(expected)
  const observed = {
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    isComposing: event.isComposing,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    defaultCaptured: event.defaultPrevented,
  } as TNativeObservedKeyData
  expect(matchesNativeToastObservedHotkey(observed, hotkey)).toBe(expected)
  expect(event.defaultPrevented).toBe(before)
  observations.push({ name, hotkey, init, expected, prevent: prevent ?? false, defaultPreserved: true })
})
it("executes actual Toaster document observation for physical identity, repeats and unchanged key default", async () => {
  render(<Toaster duration="persistent" />)
  await act(() => {
    toast({ id: "native-oracle-a", duration: "persistent", titleText: "A" })
    toast({ id: "native-oracle-b", duration: "persistent", titleText: "B" })
  })
  const stack = await screen.findByRole("list")
  const send = async (repeat: boolean) => {
    const event = new KeyboardEvent("keydown", {
      code: "KeyE",
      key: "q",
      altKey: true,
      repeat,
      bubbles: true,
      cancelable: true,
    })
    let delivered = false
    await act(() => {
      delivered = document.dispatchEvent(event)
    })
    expect(delivered).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  }
  await send(false)
  expect(stack).toHaveAttribute("data-expanded", "true")
  await send(true)
  expect(stack).toHaveAttribute("data-expanded", "false")
  observations.push({
    name: "actual document handler physical/repeat/default",
    expandedThenCollapsed: true,
    defaultPreserved: true,
  })
})
it.each([{ expandToggleHotkey: [] }, { expandToggleHotkey: ["altKey"] }, { expandToggleHotkey: ["constructor"] }])(
  "observes the mounted canonical empty queue hotkey %j before normal publication",
  async ({ expandToggleHotkey }) => {
    render(<Toaster duration="persistent" expandToggleHotkey={expandToggleHotkey} />)
    await act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", key: "q", altKey: true, bubbles: true }))
    })
    await act(() => {
      toast({ id: "empty-oracle-a", duration: "persistent" })
      toast({ id: "empty-oracle-b", duration: "persistent" })
    })
    const stack = await screen.findByRole("list")
    expect(stack).toHaveAttribute("data-expanded", "false")
    observations.push({
      name: "empty queue publication after hotkey",
      expandToggleHotkey,
      expanded: stack.getAttribute("data-expanded"),
    })
  },
)
