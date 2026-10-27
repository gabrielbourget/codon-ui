import type { View } from "react-native"

import { createNativeBackdropRenderer } from "../renderer"

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}
const setup = () => {
  const frames = new Map<number, () => void>()
  let next = 0
  let capture: ((response: Record<string, unknown>) => void) | undefined
  let live = true
  const calls: Record<string, unknown>[] = []
  const failed = jest.fn()
  const request = jest.fn((encoded: string) => {
    const command = JSON.parse(encoded) as Record<string, unknown>
    calls.push(command)
    if (command.action === "capture")
      return new Promise<string>((resolve) => {
        capture = (response) => resolve(JSON.stringify({ ...command, staged: true, ...response }))
      })
    return Promise.resolve(JSON.stringify({ ...command, published: true }))
  })
  const renderer = createNativeBackdropRenderer("effect", {
    request,
    frame: (callback) => {
      frames.set(++next, callback)
      return next
    },
    cancel: (handle) => {
      frames.delete(handle)
    },
    failed,
  })
  const owner = {
    lease: { ownerId: "effect", generation: 1, isCurrent: () => live },
    target: {} as View,
    receiver: {} as View,
    targetTag: 11,
    receiverTag: 22,
    radius: 10,
    scopeOwnerId: "scope",
    windowId: "window",
    epoch: 3,
  }
  return {
    renderer,
    owner,
    frames,
    calls,
    failed,
    setLive: (value: boolean) => {
      live = value
    },
    complete: async (response: Record<string, unknown> = {}) => {
      capture?.(response)
      await flush()
    },
    tick: () => {
      const entry = frames.entries().next().value
      if (!entry) throw new Error("No scheduled backdrop frame")
      frames.delete(entry[0])
      entry[1]()
    },
  }
}

it("captures one frame at a time and publishes only the exact staged native frame", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  expect(f.calls).toEqual([
    expect.objectContaining({
      action: "capture",
      target: 11,
      receiver: 22,
      radius: 10,
      generation: 1,
      scopeOwnerId: "scope",
      windowId: "window",
      epoch: 3,
    }),
  ])
  expect(f.frames.size).toBe(0)
  f.renderer.update({ ...f.owner })
  expect(f.frames.size).toBe(0)
  await f.complete()
  expect(f.calls.map((call) => call.action)).toEqual(["capture", "discard"])
  expect(f.frames.size).toBe(1)
  f.tick()
  await f.complete()
  expect(f.calls.at(-1)).toMatchObject({ action: "publish", frameId: "effect:2", generation: 1 })
  expect(f.failed).not.toHaveBeenCalled()
  f.renderer.close()
})

it("never publishes after lease retirement even when the asynchronous capture succeeds", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  f.setLive(false)
  await f.complete()
  expect(f.calls.map((call) => call.action)).toEqual(["capture", "discard"])
  expect(f.frames.size).toBe(0)
  expect(f.failed).not.toHaveBeenCalled()
  f.renderer.close()
})

it("pauses native work without releasing the last output and resumes under the new generation", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  f.renderer.pause()
  await f.complete()
  expect(f.calls.map((call) => call.action)).toEqual(["capture", "pause", "discard"])
  expect(f.frames.size).toBe(0)
  f.renderer.update({ ...f.owner, lease: { ...f.owner.lease, generation: 2 } })
  f.tick()
  await f.complete()
  expect(f.calls.at(-1)).toMatchObject({ action: "publish", generation: 2 })
  f.renderer.close()
})

it("coalesces geometry supersession into the next frame without publishing incomplete output", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  await f.complete({ staged: false, superseded: true })
  expect(f.calls.map((call) => call.action)).toEqual(["capture"])
  expect(f.frames.size).toBe(1)
  expect(f.failed).not.toHaveBeenCalled()
  f.renderer.close()
})

it("waits for a new acknowledged lease after native retirement without restarting capture", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  await f.complete({ staged: false, retired: true })
  expect(f.frames.size).toBe(0)
  expect(f.calls.map((call) => call.action)).toEqual(["capture"])
  expect(f.failed).not.toHaveBeenCalled()
  f.renderer.update({ ...f.owner, lease: { ...f.owner.lease, generation: 2 } })
  f.tick()
  await f.complete()
  expect(f.calls.at(-1)).toMatchObject({ action: "publish", generation: 2 })
  f.renderer.close()
})

it.each([
  { frameId: "another-frame" },
  { generation: 9 },
  { staged: false },
  { ownerId: "another-owner" },
  { frameId: "another-frame", superseded: true },
  { generation: 9, superseded: true },
])("retains the first invalid native result and stops scheduling: %j", async (response) => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  await f.complete(response)
  expect(f.failed).toHaveBeenCalledTimes(1)
  expect(f.frames.size).toBe(0)
  f.renderer.update(f.owner)
  expect(f.frames.size).toBe(0)
  f.renderer.close()
})

it("releases once and cannot revive after unmount with a late completed capture", async () => {
  const f = setup()
  f.renderer.update(f.owner)
  f.tick()
  f.renderer.close()
  f.renderer.close()
  await f.complete()
  f.renderer.update(f.owner)
  f.renderer.pause()
  expect(f.calls.map((call) => call.action)).toEqual(["capture", "release", "discard"])
  expect(f.frames.size).toBe(0)
  expect(f.failed).not.toHaveBeenCalled()
})
