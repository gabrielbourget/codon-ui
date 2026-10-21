import * as PublicNative from "../../index"
import type { TNativeKeyScope } from "../keyScope"
import {
  createNativeMenuPointers,
  type TNativeMenuPointerEvent,
  type TNativeMenuPointerPolicy,
} from "../nativeMenuPointers"

export const menuPointerContracts = (
  scope: TNativeKeyScope,
  policy: TNativeMenuPointerPolicy,
  event: TNativeMenuPointerEvent,
) => {
  const registry = createNativeMenuPointers(scope)
  const lease = registry.register("current", policy)
  registry.dispatch(event)
  lease.update({ ...policy, observe: (original) => original.nativeEvent.observationId })
  // @ts-expect-error A policy retains actual original native targets, rather than refs or adapters.
  lease.update({ ...policy, triggerTarget: { current: 10 } })
  // @ts-expect-error The private policy transports the exact native collection binding.
  lease.update({ ...policy, parentBinding: { target: 10 } })
  // @ts-expect-error Menu policy registration is private.
  const publicRegistry = PublicNative.createNativeMenuPointers
  // @ts-expect-error Native policy receipts preserve their native hit path immutably.
  event.nativeEvent.hitPath.push(1)
  return publicRegistry
}
