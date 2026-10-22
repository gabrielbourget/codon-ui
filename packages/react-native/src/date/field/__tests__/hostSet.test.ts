import type { View } from "react-native"

import { packet } from "../../input/__tests__/packet"
import type { DateSegment } from "../../state/useDateFieldState"
import { NativeDateFieldHostSet } from "../hostSet"

const parts = [
  { type: "hour", isEditable: true, isPlaceholder: true },
  { type: "literal", isEditable: false, isPlaceholder: false },
  { type: "minute", isEditable: true, isPlaceholder: false },
] as DateSegment[]
const setup = () => {
  const hosts = new NativeDateFieldHostSet(),
    root = {} as View,
    hour = {} as View,
    minute = {} as View
  hosts.root(root, 4)
  hosts.attach("0:hour", hour)
  hosts.attach("2:minute", minute)
  const acknowledge = (id: string, original: View, target: number, extra: Parameters<typeof packet>[0] = {}) =>
    hosts.receive(id, original, packet({ segmentId: id, target, nativeInstance: `native:${target}`, ...extra }))
  return { hosts, root, hour, minute, acknowledge }
}

it("requires the whole ordered original set and actual active acknowledgements", () => {
  const { hosts, hour, minute, acknowledge } = setup()
  expect(hosts.snapshot(parts)).toBeNull()
  acknowledge("0:hour", hour, 5)
  expect(hosts.snapshot(parts)).toBeNull()
  acknowledge("2:minute", minute, 6)
  const result = hosts.snapshot(parts)!
  expect(result.rows.map((row) => row.original)).toEqual([hour, minute])
  expect(result.rows.map((row) => row.isPlaceholder)).toEqual([true, false])
  expect(result.rows.map((row) => row.identity.target)).toEqual([5, 6])
})

it.each([{ active: false }, { windowId: "another-window" }, { surfaceId: 2 }, { ownerId: "another-owner" }])(
  "withholds a mixed or inactive original set: %j",
  (override) => {
    const { hosts, hour, minute, acknowledge } = setup()
    acknowledge("0:hour", hour, 5)
    acknowledge("2:minute", minute, 6, override)
    expect(hosts.snapshot(parts)).toBeNull()
  },
)

it("retires detached roots and rejects late packets and cleanup for replaced original refs", () => {
  const { hosts, hour, minute, acknowledge } = setup()
  acknowledge("0:hour", hour, 5)
  acknowledge("2:minute", minute, 6)
  const replacement = {} as View
  hosts.attach("0:hour", replacement)
  acknowledge("0:hour", hour, 5)
  hosts.detach("0:hour", hour)
  expect(hosts.snapshot(parts)).toBeNull()
  acknowledge("0:hour", replacement, 7)
  expect(hosts.snapshot(parts)!.rows[0].original).toBe(replacement)
  hosts.root(null, 0)
  expect(hosts.snapshot(parts)).toBeNull()
})

it("publishes identity changes, retaining prior immutable frames without rerendering for each edit", () => {
  const { hosts, hour, minute, acknowledge } = setup()
  acknowledge("0:hour", hour, 5)
  acknowledge("2:minute", minute, 6)
  const previous = hosts.snapshot(parts)!,
    listener = jest.fn(),
    release = hosts.subscribe(listener)
  acknowledge("0:hour", hour, 5, { kind: "insert", focused: true, sequence: 2, text: "3" })
  expect(listener).not.toHaveBeenCalled()
  acknowledge("0:hour", hour, 5, { epoch: 5, sequence: 3 })
  expect(listener).toHaveBeenCalledTimes(1)
  expect(previous.rows[0].identity.epoch).toBe(4)
  expect(hosts.snapshot(parts)!.rows[0].identity.epoch).toBe(5)
  release()
  hosts.detach("0:hour", hour)
  expect(listener).toHaveBeenCalledTimes(1)
})
