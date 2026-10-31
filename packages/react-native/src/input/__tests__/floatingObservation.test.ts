import { createNativeFloatingObservations } from "../floatingObservation"

it("retains independent actual tags, never reuses a retired lease and rejects invalid native bounds", () => {
  const observations = createNativeFloatingObservations(),
    first = jest.fn(),
    second = jest.fn()
  const release = observations.register(17, first)!
  const target = observations.targets()[0]!
  const data = {
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    ...target,
    x: 0,
    y: 0,
    width: 100,
    height: 0,
    scrollRevision: 0,
    revision: 1,
  }
  expect(observations.dispatch(data)).toBe(true)
  expect(first).toHaveBeenCalledWith(data)
  release()
  observations.register(17, second)
  expect(observations.dispatch(data)).toBe(false)
  const current = { ...data, ...observations.targets()[0]! }
  expect(observations.dispatch({ ...current, targetTag: 18 })).toBe(false)
  expect(observations.dispatch({ ...current, height: NaN })).toBe(false)
  expect(observations.dispatch({ ...current, scrollRevision: -1 })).toBe(false)
  expect(second).not.toHaveBeenCalled()
  expect(observations.dispatch(current)).toBe(true)
  observations.dispose()
  expect(observations.dispatch(current)).toBe(false)
  expect(observations.register(17, first)).toBeUndefined()
})
