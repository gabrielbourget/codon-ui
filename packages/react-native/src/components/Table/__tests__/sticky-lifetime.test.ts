import { createNativeKeyScope, type TNativeKeyPolicy } from "../../../input/keyScope"
import { subscribeNativeTableStickyLifetime } from "../stickyLifetime"

const setup = () => {
  const scope = createNativeKeyScope("table-source")
  const listener = jest.fn()
  const unsubscribe = subscribeNativeTableStickyLifetime(scope, listener)
  const status = (epoch = 1, windowActive = true, windowId = "first-window", ready = true) =>
    scope.acceptNativeStatus({
      ownerId: scope.ownerId,
      policyRevision: scope.policyRevision(),
      windowId,
      epoch,
      ready,
      windowActive,
    })
  return { scope, listener, unsubscribe, status }
}

it("ignores keyboard policy, readiness and modality publications within the same active window", () => {
  const f = setup()
  f.status()
  expect(f.listener).toHaveBeenCalledTimes(1)
  const policy: TNativeKeyPolicy = {
    tokens: ["0000:ArrowDown"],
    excludeEditable: true,
    isEnabled: true,
    lifetimeKey: "original-row",
    canAct: () => true,
    onKey: jest.fn(),
  }
  const registration = f.scope.register("row", policy)
  f.scope.flush()
  f.status()
  registration.update({ ...policy, tokens: ["0000:ArrowUp"] })
  f.scope.flush()
  f.status(1, true, "first-window", false)
  f.status()
  f.scope.recordInput({
    ownerId: f.scope.ownerId,
    windowId: "first-window",
    epoch: 1,
    origin: "keyboard",
    timestamp: 1,
  })
  registration.unregister()
  f.scope.flush()
  expect(f.listener).toHaveBeenCalledTimes(1)
  expect(f.scope.lastInput()?.origin).toBe("keyboard")
  expect(f.scope.policies()).toEqual([])
})

it("publishes initial admission, window inactivity, return, session replacement and later epochs synchronously", () => {
  const f = setup()
  const observed: unknown[] = []
  const stop = subscribeNativeTableStickyLifetime(f.scope, () =>
    observed.push({ ...f.scope.acknowledgedSession(), active: f.scope.isWindowActive() }),
  )
  f.status()
  f.status(1, false)
  f.status()
  f.status(2, true, "replacement-window")
  f.status(3, true, "replacement-window")
  expect(observed).toEqual([
    { windowId: "first-window", epoch: 1, active: true },
    { windowId: "first-window", epoch: 1, active: false },
    { windowId: "first-window", epoch: 1, active: true },
    { windowId: "replacement-window", epoch: 2, active: true },
    { windowId: "replacement-window", epoch: 3, active: true },
  ])
  expect(f.listener).toHaveBeenCalledTimes(5)
  stop()
  f.unsubscribe()
  f.status(4, false, "replacement-window")
  expect(f.listener).toHaveBeenCalledTimes(5)
  expect(observed).toHaveLength(5)
})
