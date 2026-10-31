import { render } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../.."
import { createNativeKeyScope } from "../../../input/keyScope"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { createNativeFloatingFocusReturns } from "../focusReturn"
import { createNativeFloatingLayerRegistry } from "../registry"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let serial = 0
beforeEach(() => {
  frames.clear()
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++serial
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())
const tick = () => {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(0))
}
const setup = async () => {
  const first = createRef<View>(),
    second = createRef<View>()
  await render(
    <>
      <NativeFocusView ref={first} />
      <NativeFocusView ref={second} />
    </>,
  )
  const layers = createNativeFloatingLayerRegistry(),
    input = createNativeKeyScope("input")
  const acknowledge = (ready = true, epoch = 1) =>
    input.acceptNativeStatus({
      ownerId: "input",
      windowId: "window",
      epoch,
      policyRevision: input.policyRevision(),
      ready,
      windowActive: true,
    })
  acknowledge(false)
  acknowledge()
  let live = true
  const returns = createNativeFloatingFocusReturns({ layers, live: () => live, windowActive: () => true })
  const register = (id: string, capturesOutside = true) => {
    const lease = layers.register(id, {
      parent: null,
      isOpen: true,
      isModal: false,
      capturesOutside,
      isKeyboardDismissDisabled: false,
      onDismiss: () => {},
    })
    lease.entered(lease.state().generation)
    return lease
  }
  return {
    first,
    second,
    input,
    layers,
    returns,
    acknowledge,
    register,
    retire: () => {
      live = false
      returns.dispose()
    },
  }
}

it("waits for native policy readiness even when readiness changes after a frame was queued", async () => {
  const f = await setup()
  f.returns.request("closed", null, f.input, f.first)
  f.acknowledge(false)
  tick()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  f.acknowledge()
  tick()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(f.first.current, expect.any(String))
  f.retire()
})

it("uses the current target ref and retires duplicate retained callbacks", async () => {
  const f = await setup()
  const lease = f.returns.request("closed", null, f.input, f.first)
  const stale = [...frames.values()]
  lease?.updateTarget(f.second)
  tick()
  stale.forEach((callback) => callback(0))
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(f.second.current, expect.any(String))
  f.retire()
})

it("cancels a return after a new layer opens even when it retires before the frame", async () => {
  const f = await setup()
  f.returns.request("closed", null, f.input, f.first)
  const stale = [...frames.values()]
  const takeover = f.register("new-owner")
  takeover.unregister()
  tick()
  stale.forEach((callback) => callback(0))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  f.retire()
})

it.each(["epoch", "dispose", "reopen"])("retires pending returns on %s", async (reason) => {
  const f = await setup()
  f.returns.request("closed", null, f.input, f.first)
  const stale = [...frames.values()]
  if (reason === "epoch") {
    f.acknowledge(false, 2)
    f.acknowledge(true, 2)
  } else if (reason === "dispose") f.retire()
  else f.returns.cancel("closed")
  tick()
  stale.forEach((callback) => callback(0))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  f.retire()
})

it.each(["existing", "new"])("allows return past an %s passive tooltip", async (timing) => {
  const f = await setup()
  const tooltip = timing === "existing" ? f.register("description", false) : undefined
  f.returns.request("closed", null, f.input, f.first)
  if (timing === "new") f.register("description", false)
  tick()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  tooltip?.unregister()
  f.retire()
})
