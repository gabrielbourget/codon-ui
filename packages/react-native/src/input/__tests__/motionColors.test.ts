import { PlatformColor, processColor, type ColorValue, type View } from "react-native"

import { NativeMotionColorSampler, registerNativeMotionColorSampler, sampleNativeMotionColors } from "../motionColors"
import type { NativeMotionColors } from "../specs/CUIFocusViewNativeComponent"

const packet = (extra: Partial<NativeMotionColors> = {}): NativeMotionColors => ({
  ownerId: "owner",
  target: 71,
  kind: "environment",
  requestId: "",
  windowId: "window",
  scopeOwnerId: "scope",
  epoch: 2,
  environmentRevision: 3,
  attached: true,
  colors: "[]",
  error: "",
  observedAt: 100,
  ...extra,
})
const harness = () => {
  let scope = { ownerId: "scope", windowId: "window", epoch: 2 }
  const dispatch = jest.fn()
  const sampler = new NativeMotionColorSampler({ ownerId: "owner", target: () => 71, scope: () => scope, dispatch })
  return {
    sampler,
    dispatch,
    scope: (next: typeof scope) => {
      scope = next
    },
    environment: (extra: Partial<NativeMotionColors> = {}) => sampler.receive(packet(extra)),
    reply: (id: string, colors: unknown, extra: Partial<NativeMotionColors> = {}) =>
      sampler.receive(packet({ kind: "sample", requestId: id, colors: JSON.stringify(colors), ...extra })),
  }
}
afterEach(() => jest.useRealTimers())

it("waits for actual environment identity and sends processed colors without mutating input", async () => {
  const h = harness(),
    opaque = PlatformColor("labelColor"),
    colors = Object.freeze(["red", opaque])
  const encoded = colors.map((color) => processColor(color))
  const pending = h.sampler.sample(colors)
  expect(JSON.parse(h.dispatch.mock.calls[0][1])).toEqual({ kind: "environment" })
  h.environment({ requestId: h.dispatch.mock.calls[0][0] })
  const [id, request] = h.dispatch.mock.calls[1]
  expect(JSON.parse(request)).toEqual({
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    environmentRevision: 3,
    colors: encoded,
  })
  h.reply(id, [
    [1, 0, 0, 1],
    [0.25, 0.5, 0.75, 0],
  ])
  await expect(pending).resolves.toEqual({
    environment: { windowId: "window", scopeOwnerId: "scope", epoch: 2, environmentRevision: 3 },
    colors: [
      { red: 1, green: 0, blue: 0, alpha: 1 },
      { red: 0.25, green: 0.5, blue: 0.75, alpha: 0 },
    ],
  })
  expect(colors[1]).toBe(opaque)
  h.sampler.dispose()
})
it("keeps concurrent requests independent and does not duplicate the environment query", async () => {
  const h = harness(),
    first = h.sampler.sample(["red"]),
    second = h.sampler.sample(["blue"])
  expect(h.dispatch).toHaveBeenCalledTimes(1)
  h.environment()
  expect(h.dispatch).toHaveBeenCalledTimes(3)
  const firstId = h.dispatch.mock.calls[1][0],
    secondId = h.dispatch.mock.calls[2][0]
  expect(firstId).not.toBe(secondId)
  h.reply(secondId, [[0, 0, 1, 1]])
  h.reply(firstId, [[1, 0, 0, 1]])
  await expect(first).resolves.toMatchObject({ colors: [{ red: 1 }] })
  await expect(second).resolves.toMatchObject({ colors: [{ blue: 1 }] })
  h.sampler.dispose()
})
it("snapshots processed opaque descriptors before waiting for native context", async () => {
  const h = harness(),
    opaque = PlatformColor("labelColor")
  const before = JSON.stringify(processColor(opaque))
  const pending = h.sampler.sample([opaque])
  const raw = opaque as unknown as { semantic?: string[]; resource_paths?: string[] }
  const paths = raw.semantic ?? raw.resource_paths
  paths?.push("changed-after-request")
  h.environment()
  expect(JSON.stringify(JSON.parse(h.dispatch.mock.calls[1][1]).colors[0])).toBe(before)
  h.reply(h.dispatch.mock.calls[1][0], [[0, 0, 0, 1]])
  await pending
  h.sampler.dispose()
})
it("ignores foreign owners/targets/request IDs before accepting the matching result", async () => {
  const h = harness(),
    pending = h.sampler.sample(["red"])
  h.environment({ ownerId: "other" })
  h.environment({ target: 72 })
  expect(h.dispatch).toHaveBeenCalledTimes(1)
  h.environment()
  const id = h.dispatch.mock.calls[1][0]
  h.reply("foreign", [[0, 1, 0, 1]])
  h.reply(id, [[0, 1, 0, 1]], { ownerId: "other" })
  h.reply(id, [[1, 0, 0, 1]])
  await expect(pending).resolves.toMatchObject({ colors: [{ red: 1, green: 0 }] })
  h.sampler.dispose()
})
it("retires requests when the acknowledged window/epoch scope changes", async () => {
  const h = harness(),
    pending = h.sampler.sample(["red"])
  const failure = expect(pending).rejects.toThrow(/scope changed/)
  h.environment()
  const id = h.dispatch.mock.calls[1][0]
  h.scope({ ownerId: "scope", windowId: "new-window", epoch: 3 })
  h.sampler.refreshScope()
  h.reply(id, [[1, 0, 0, 1]])
  await failure
  expect(h.sampler.environment()).toBeUndefined()
  h.sampler.dispose()
})
it("invalidates pending batches and exposes the new environment to current listeners", async () => {
  const h = harness()
  h.environment()
  const observed: number[] = []
  h.sampler.subscribe(() => {
    const context = h.sampler.environment()
    if (context) observed.push(context.environmentRevision)
  })
  const pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/environment changed/)
  h.environment({ environmentRevision: 4 })
  await failure
  expect(observed).toEqual([4])
  const next = h.sampler.sample(["red"]),
    id = h.dispatch.mock.calls.at(-1)![0]
  h.reply(id, [[0, 0, 0, 1]], { environmentRevision: 4 })
  await next
  h.sampler.dispose()
})
it("ignores older environment records and rejects an out-of-revision sample", async () => {
  const h = harness()
  h.environment({ environmentRevision: 4 })
  h.environment({ environmentRevision: 3 })
  expect(h.sampler.environment()?.environmentRevision).toBe(4)
  const pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/stale native color sample/)
  h.reply(h.dispatch.mock.calls[0][0], [[1, 0, 0, 1]], { environmentRevision: 3 })
  await failure
  h.sampler.dispose()
})
it.each([
  null,
  [],
  [[1, 0, 0]],
  [
    [1, 0, 0, 1],
    [0, 0, 0, 1],
  ],
  [[2, 0, 0, 1]],
  [[null, 0, 0, 1]],
])("rejects incomplete/invalid native component data %p", async (colors) => {
  const h = harness()
  h.environment()
  const pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/native color/)
  h.reply(h.dispatch.mock.calls[0][0], colors)
  await failure
  h.sampler.dispose()
})
it("rejects unsupported native spaces and malformed JSON instead of returning a static fallback", async () => {
  const h = harness()
  h.environment()
  const first = h.sampler.sample(["red"]),
    firstFailure = expect(first).rejects.toThrow(/unsupported-native-color-space/)
  h.reply(h.dispatch.mock.calls[0][0], [], { error: "unsupported-native-color-space" })
  await firstFailure
  const second = h.sampler.sample(["red"]),
    secondFailure = expect(second).rejects.toThrow()
  h.sampler.receive(packet({ kind: "sample", requestId: h.dispatch.mock.calls[1][0], colors: "{invalid" }))
  await secondFailure
  h.sampler.dispose()
})
it("rejects unsupported CSS input before sending a native query", async () => {
  const h = harness()
  await expect(h.sampler.sample(["var(--color)" as ColorValue])).rejects.toThrow(/unsupported native color/)
  expect(h.dispatch).not.toHaveBeenCalled()
  h.sampler.dispose()
})
it("enforces the fixed query timeout and permits a later explicit request without replay", async () => {
  jest.useFakeTimers()
  const h = harness(),
    pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/5000ms/)
  jest.advanceTimersByTime(5000)
  await failure
  expect(h.dispatch).toHaveBeenCalledTimes(1)
  const next = h.sampler.sample(["blue"]),
    nextFailure = expect(next).rejects.toThrow(/retired/)
  expect(h.dispatch).toHaveBeenCalledTimes(2)
  expect(h.dispatch.mock.calls[0][0]).not.toBe(h.dispatch.mock.calls[1][0])
  h.sampler.dispose()
  await nextFailure
})
it("rejects command failures and clears failed environment requests", async () => {
  const h = harness()
  h.dispatch.mockImplementation(() => {
    throw new Error("command unavailable")
  })
  await expect(h.sampler.sample(["red"])).rejects.toThrow(/command unavailable/)
  await expect(h.sampler.sample(["blue"])).rejects.toThrow(/command unavailable/)
  expect(h.dispatch).toHaveBeenCalledTimes(2)
  h.sampler.dispose()
})
it("rejects a sample-command failure without throwing from the event receiver", async () => {
  const h = harness(),
    pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/sample command unavailable/)
  h.dispatch.mockImplementation(() => {
    throw new Error("sample command unavailable")
  })
  expect(() => h.environment()).not.toThrow()
  await failure
  h.sampler.dispose()
})
it("retires old registrations without removing a replacement sampler on the same view", async () => {
  const target = {} as View,
    first = harness(),
    second = harness()
  const oldRelease = registerNativeMotionColorSampler(target, first.sampler)
  const pending = sampleNativeMotionColors(target, ["red"]),
    failure = expect(pending).rejects.toThrow(/retired/)
  const release = registerNativeMotionColorSampler(target, second.sampler)
  oldRelease()
  await failure
  const next = sampleNativeMotionColors(target, ["red"])
  second.environment()
  second.reply(second.dispatch.mock.calls[1][0], [[1, 0, 0, 1]])
  await expect(next).resolves.toMatchObject({ colors: [{ red: 1 }] })
  release()
  await expect(sampleNativeMotionColors(target, ["red"])).rejects.toThrow(/no sampler/)
})
it("rejects detached or mismatched native scopes without accepting their colors", async () => {
  const h = harness(),
    pending = h.sampler.sample(["red"]),
    failure = expect(pending).rejects.toThrow(/different window/)
  h.environment()
  h.reply(h.dispatch.mock.calls[1][0], [[1, 0, 0, 1]], { windowId: "foreign" })
  await failure
  const next = h.sampler.sample(["red"]),
    nextFailure = expect(next).rejects.toThrow(/detached/)
  h.environment({ attached: false, windowId: "" })
  await nextFailure
  h.sampler.dispose()
})

it("does not let an older scope environment cancel a query waiting for the current acknowledged scope", async () => {
  const h = harness()
  h.environment()
  h.scope({ ownerId: "scope", windowId: "new-window", epoch: 3 })
  h.sampler.refreshScope()
  const pending = h.sampler.sample(["red"])
  h.environment({ windowId: "window", epoch: 2 })
  h.environment({ windowId: "new-window", epoch: 3, environmentRevision: 4 })
  const id = h.dispatch.mock.calls.at(-1)![0]
  h.reply(id, [[1, 0, 0, 1]], { windowId: "new-window", epoch: 3, environmentRevision: 4 })
  await expect(pending).resolves.toMatchObject({ environment: { windowId: "new-window", epoch: 3 } })
  h.sampler.dispose()
})
