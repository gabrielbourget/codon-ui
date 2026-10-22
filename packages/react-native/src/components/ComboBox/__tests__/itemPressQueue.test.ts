import { NativeComboBoxItemPressQueue } from "../itemPressQueue"

it("retains original callbacks in observed order while native admission is pending", () => {
  const events: unknown[] = [],
    original = { event: "original" }
  const queue = new NativeComboBoxItemPressQueue(() => true)
  let admitted!: () => void
  queue.push((complete) => {
    admitted = complete
  })
  queue.emit(() => events.push(original))
  queue.emit(() => events.push("end"))
  expect(events).toEqual([])
  admitted()
  expect(events).toEqual([original, "end"])
  expect(events[0]).toBe(original)
})

it("serializes repeated requests and ignores a duplicate completion of the earlier request", () => {
  const queue = new NativeComboBoxItemPressQueue(() => true),
    events: string[] = []
  let first!: () => void, second!: () => void
  queue.push((complete) => {
    first = complete
    events.push("first")
  })
  queue.push((complete) => {
    second = complete
    events.push("second")
  })
  queue.emit(() => events.push("press"))
  expect(events).toEqual(["first"])
  first()
  first()
  expect(events).toEqual(["first", "second"])
  second()
  expect(events).toEqual(["first", "second", "press"])
})

it.each(["explicit", "ownership"])("drops queued work when original ownership retires: %s", (kind) => {
  let current = true,
    complete!: () => void
  const queue = new NativeComboBoxItemPressQueue(() => current),
    callback = jest.fn()
  queue.push((done) => {
    complete = done
  })
  queue.emit(callback)
  if (kind === "explicit") queue.retire()
  else current = false
  complete()
  current = true
  queue.emit(callback)
  expect(callback).not.toHaveBeenCalled()
})

it("preserves a caller exception and retires later callbacks", () => {
  const queue = new NativeComboBoxItemPressQueue(() => true),
    later = jest.fn(),
    error = new Error("caller")
  expect(() =>
    queue.emit(() => {
      throw error
    }),
  ).toThrow(error)
  queue.emit(later)
  expect(later).not.toHaveBeenCalled()
})
