import type { View } from "react-native"

import { dispatchNativeActivationPolicy, registerNativeActivationPolicy } from "../activation"
import { containsNativeView } from "../focus"
import type { TNativeActivationPacket } from "../NativeFocusView"

it("keeps the original activation and lets the most recent active owner consume it once", () => {
  const view = {} as View,
    event = {} as TNativeActivationPacket,
    first = jest.fn(() => false),
    second = jest.fn(() => true)
  const unbindFirst = registerNativeActivationPolicy(first),
    unbindSecond = registerNativeActivationPolicy(second)
  expect(dispatchNativeActivationPolicy(view, event)).toBe(true)
  expect(second).toHaveBeenCalledWith(view, event)
  expect(first).not.toHaveBeenCalled()
  unbindSecond()
  expect(dispatchNativeActivationPolicy(view, event)).toBe(false)
  expect(first).toHaveBeenCalledWith(view, event)
  unbindFirst()
  expect(dispatchNativeActivationPolicy(view, event)).toBe(false)
})
it("uses original current ReadOnlyNode hosts for containment and tolerates a retired tree cycle", () => {
  const child = {} as View,
    nested = { childNodes: [child] } as unknown as View,
    root = { childNodes: [nested] } as unknown as View
  expect(containsNativeView(root, child)).toBe(true)
  expect(containsNativeView(root, root)).toBe(true)
  expect(containsNativeView(root, {} as View)).toBe(false)
  Object.assign(child, { childNodes: [root] })
  expect(containsNativeView(root, {} as View)).toBe(false)
})
