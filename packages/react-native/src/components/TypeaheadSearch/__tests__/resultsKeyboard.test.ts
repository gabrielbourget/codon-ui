import type { TNativeKeyboardData } from "../../../input/types"
import { getTypeaheadEntries } from "../collection"
import { createTypeaheadResultsKeyboard } from "../resultsKeyboard"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const setup = () => {
  const items = [
    { id: 0, name: "Alpha" },
    { id: "0", name: "Beta" },
    { id: "", name: "Beta gamma" },
  ]
  const entries = getTypeaheadEntries(items, { getItemKey: (item) => item.id })
  const state = {
    entries,
    wrap: true,
    collator: new Intl.Collator("en", { usage: "search", sensitivity: "base" }),
    live: true,
  }
  const focus = jest.fn(),
    page = jest.fn(),
    activate = jest.fn(),
    clear = jest.fn()
  const controller = createTypeaheadResultsKeyboard({ current: () => state, focus, page, activate, clear })
  const key = (
    value: string,
    index = 0,
    extra: Partial<TNativeKeyboardData> = {},
    admitted = true,
    composing = false,
  ) =>
    controller.receive(
      entries[index]!.encodedKey,
      {
        key: value,
        phase: "down",
        nativeCode: 17,
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        ownerId: "source",
        target: 1,
        characters: value,
        nativeModifierData: "",
        nativeDefaultHandled: admitted,
        timestamp: 1,
        ...extra,
      },
      admitted,
      composing,
    )
  return { state, entries, controller, key, focus, page, activate, clear }
}
it("moves real row focus with explicit wrap, endpoints and pages without selecting", () => {
  const f = setup()
  f.key("ArrowUp")
  expect(f.focus).toHaveBeenLastCalledWith(f.entries[2]!.encodedKey)
  f.state.wrap = false
  f.focus.mockClear()
  f.key("ArrowUp")
  expect(f.focus).not.toHaveBeenCalled()
  f.key("End")
  f.key("Home", 2)
  expect(f.focus.mock.calls).toEqual([[f.entries[2]!.encodedKey], [f.entries[0]!.encodedKey]])
  f.key("PageDown", 1)
  f.key("PageUp", 1)
  expect(f.page.mock.calls).toEqual([
    [f.entries[1]!.encodedKey, 1],
    [f.entries[1]!.encodedKey, -1],
  ])
  expect(f.activate).not.toHaveBeenCalled()
})
it("searches actual textValue for 1000ms, excludes Ctrl/Meta and uses Space inside the search", () => {
  const f = setup()
  f.key("b", 0, {}, false)
  expect(f.focus).toHaveBeenLastCalledWith(f.entries[1]!.encodedKey)
  f.key("e", 1, {}, false)
  jest.advanceTimersByTime(999)
  f.key("t", 1, {}, false)
  expect(f.focus).toHaveBeenLastCalledWith(f.entries[1]!.encodedKey)
  jest.advanceTimersByTime(1000)
  f.key("B", 2, {}, false)
  f.key("e", 2, {}, false)
  f.key("t", 2, {}, false)
  f.key("a", 2, {}, false)
  f.key(" ", 2)
  expect(f.focus).toHaveBeenLastCalledWith(f.entries[2]!.encodedKey)
  expect(f.activate).not.toHaveBeenCalled()
  const count = f.focus.mock.calls.length
  f.key("a", 0, { ctrlKey: true }, false)
  f.key("a", 0, { metaKey: true }, false)
  expect(f.focus).toHaveBeenCalledTimes(count)
  f.controller.dispose()
})
it("selects once per admitted Enter/Space down, clears on Escape and refuses retired or composing work", () => {
  const f = setup()
  f.key("Enter")
  f.key("Enter", 0, { repeat: true })
  expect(f.activate).toHaveBeenCalledTimes(1)
  f.key("Enter", 0, { phase: "up" })
  f.key(" ")
  expect(f.activate).toHaveBeenCalledTimes(2)
  f.key("Escape")
  expect(f.clear).toHaveBeenCalledTimes(1)
  f.key("End", 0, {}, false)
  f.key("End", 0, {}, true, true)
  f.key("End", 0, { cancelled: true })
  f.state.live = false
  f.key("End")
  expect(f.focus).not.toHaveBeenCalled()
  f.controller.dispose()
})
