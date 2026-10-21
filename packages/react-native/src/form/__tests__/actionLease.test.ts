import type { NativeFormActionStatus } from "../../input/specs/CUIFocusViewNativeComponent"
import { NativeFormActionLease } from "../actionLease"

const packet = (updates: Partial<NativeFormActionStatus> = {}): NativeFormActionStatus => ({
  ownerId: "action",
  descriptorRevision: "1",
  viewOwnerId: "original-native-owner",
  target: 2,
  surfaceId: 11,
  windowId: "window",
  epoch: 1,
  sequence: 1,
  scopeOwnerId: "",
  scopeEpoch: 0,
  attached: true,
  active: true,
  enabled: true,
  ...updates,
})
const setup = () => {
  let original: object | null = {}
  const lease = new NativeFormActionLease(
    { ownerId: "action", descriptorRevision: "1", target: 2 },
    original,
    () => original,
  )
  return {
    lease,
    replace: () => {
      original = {}
    },
    detach: () => {
      original = null
    },
  }
}

it("retains an owned immutable native acknowledgment for the original button", () => {
  const value = setup(),
    native = packet()
  expect(value.lease.receive(native)).toBe(true)
  const current = value.lease.getSnapshot()
  expect(current).toEqual(native)
  expect(current).not.toBe(native)
  expect(Object.isFrozen(current)).toBe(true)
  Object.assign(native, { windowId: "changed" })
  expect(value.lease.getSnapshot()?.windowId).toBe("window")
})

it.each([
  { ownerId: "other" },
  { descriptorRevision: "other" },
  { target: 3 },
  { viewOwnerId: "" },
  { epoch: 0 },
  { sequence: NaN },
  { surfaceId: 0 },
  { windowId: "" },
  { attached: false },
  { scopeOwnerId: "scope", scopeEpoch: 0 },
  { scopeEpoch: 1 },
])("rejects a malformed or foreign original native acknowledgment %j", (updates) => {
  const value = setup()
  expect(value.lease.receive(packet(updates))).toBe(false)
  expect(value.lease.getSnapshot()).toBeNull()
})

it.each(["active", "enabled"] as const)(
  "retires %s authority and rejects replay across a restored native epoch",
  (key) => {
    const value = setup()
    const first = packet()
    expect(value.lease.receive(first)).toBe(true)
    const original = value.lease.getSnapshot()
    expect(value.lease.receive(packet({ [key]: false, epoch: 2, sequence: 2 }))).toBe(true)
    expect(value.lease.getSnapshot()).toBeNull()
    expect(value.lease.receive(first)).toBe(false)
    expect(value.lease.receive(packet({ epoch: 3, sequence: 3 }))).toBe(true)
    expect(value.lease.getSnapshot()).not.toBe(original)
  },
)

it("rejects changed native object/window/surface identities without a new epoch", () => {
  for (const updates of [
    { windowId: "other" },
    { viewOwnerId: "other" },
    { surfaceId: 12 },
    { scopeOwnerId: "scope", scopeEpoch: 2 },
  ]) {
    const value = setup()
    value.lease.receive(packet())
    expect(value.lease.receive(packet({ ...updates, sequence: 2 }))).toBe(false)
  }
})

it.each(["replace", "detach"] as const)("retires when the original JS button ref is %s", (operation) => {
  const value = setup()
  value.lease.receive(packet())
  value[operation]()
  expect(value.lease.getSnapshot()).toBeNull()
  expect(value.lease.receive(packet({ epoch: 2, sequence: 2 }))).toBe(false)
})

it("never consults a disposed owner after explicit retirement", () => {
  const original = {},
    current = jest.fn(() => original)
  const lease = new NativeFormActionLease({ ownerId: "action", descriptorRevision: "1", target: 2 }, original, current)
  lease.retire()
  expect(lease.getSnapshot()).toBeNull()
  expect(current).not.toHaveBeenCalled()
})
