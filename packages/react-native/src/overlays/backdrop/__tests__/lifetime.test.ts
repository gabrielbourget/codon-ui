import { createNativeBackdropLifetime } from "../lifetime"

it("never revives asynchronous work after a loss and return in one React batch", () => {
  const lifetime = createNativeBackdropLifetime()
  lifetime.stage("active")
  const old = lifetime.issue("effect", () => true)
  lifetime.commit(old.identity)
  expect(old.isCurrent()).toBe(true)
  lifetime.observe("covered")
  lifetime.observe("active")
  expect(old.isCurrent()).toBe(false)
  const next = lifetime.issue("effect", () => true)
  lifetime.commit(next.identity)
  expect(next.generation).toBeGreaterThan(old.generation)
  expect(next.isCurrent()).toBe(true)
  expect(old.isCurrent()).toBe(false)
})

it("keeps an abandoned render from acquiring or retiring the committed owner", () => {
  const lifetime = createNativeBackdropLifetime()
  const committed = lifetime.issue("effect", () => true)
  lifetime.commit(committed.identity)
  const abandoned = lifetime.issue("effect", () => true)
  expect(committed.isCurrent()).toBe(true)
  expect(abandoned.isCurrent()).toBe(false)
  lifetime.retire()
  expect(committed.isCurrent()).toBe(false)
})

it("rejects a stale commit and checks actual target validity at publication time", () => {
  const lifetime = createNativeBackdropLifetime()
  let attached = true
  const stale = lifetime.issue("effect", () => attached)
  lifetime.observe("new native window epoch")
  lifetime.commit(stale.identity)
  expect(stale.isCurrent()).toBe(false)
  const next = lifetime.issue("effect", () => attached)
  lifetime.commit(next.identity)
  expect(next.isCurrent()).toBe(true)
  attached = false
  expect(next.isCurrent()).toBe(false)
})
