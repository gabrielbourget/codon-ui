import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { NativeMotionMeasurementState } from "../measurement"
import type { TNativeMotionAtomicLayoutProvider } from "../measurement"
import type { TNativeMotionResolutionToken } from "../value"

// Source-only native/atomic-session model. It does not prove an installed
// native hold, geometry metric, coordinate or presentation implementation.
export const measurementHarness = (
  options: { ack?: boolean; provider?: TNativeMotionAtomicLayoutProvider; omitProvider?: boolean } = {},
) => {
  const target = {} as View,
    trace: unknown[] = []
  let scope = { ownerId: "scope", windowId: "window", epoch: 2 }
  let held = false,
    sequence = 0,
    ack = options.ack ?? true
  const provider = options.provider ?? {
    begin: jest.fn(async () => {
      trace.push(["begin"])
      held = true
      return {
        target,
        release: jest.fn(async () => {
          trace.push(["release"])
          held = false
        }),
        abort: jest.fn(async () => {
          trace.push(["abort"])
          held = false
        }),
      }
    }),
  }
  const snapshot = () => {
    const values = state.getSnapshot().values ?? {}
    const size = (value: unknown, initial: number) =>
      value === "auto"
        ? 200
        : typeof value === "string" && value.endsWith("%")
          ? (400 * parseFloat(value)) / 100
          : typeof value === "number"
            ? value
            : initial
    const width = size(values.width, 120),
      height = size(values.height, 40)
    const box = { box: [0, 0, width, height], quad: [0, 0, width, 0, width, height, 0, height] }
    return {
      ...geometrySnapshot(),
      layout: [0, 0, width, height],
      model: box,
      untransformed: box,
      ancestors: [{ ...geometrySnapshot().ancestors[0], layout: [0, 0, width, height] }],
    }
  }
  const observer = new NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => scope,
    dispatch: (requestId) => {
      observer.receive(
        geometryPacket({
          geometryRevision: ++sequence,
          requestId,
          windowId: scope.windowId,
          epoch: scope.epoch,
          snapshot: JSON.stringify(snapshot()),
        }),
      )
    },
  })
  const release = registerNativeMotionGeometryObserver(target, observer)
  const state = new NativeMotionMeasurementState(options.omitProvider ? undefined : provider)
  const retire = state.attach(target)
  const acknowledge = (extra: Parameters<typeof geometryPacket>[0] = {}) =>
    observer.receive(
      geometryPacket({
        geometryRevision: ++sequence,
        windowId: scope.windowId,
        epoch: scope.epoch,
        kind: "mount-after",
        commitRevision: state.getSnapshot().revision ?? "",
        transactionId: `fixture:${sequence}`,
        snapshot: JSON.stringify(snapshot()),
        ...extra,
      }),
    )
  state.subscribe(() => {
    const current = state.getSnapshot()
    trace.push(["render", current.values, current.revision, held])
    if (current.revision && ack) acknowledge()
  })
  return {
    state,
    moveScope: () => {
      scope = { ...scope, windowId: "replacement-window", epoch: 3 }
      observer.refreshScope()
    },
    target,
    observer,
    provider,
    trace,
    acknowledge,
    setAck: (value: boolean) => {
      ack = value
    },
    held: () => held,
    dispose: () => {
      retire()
      release()
    },
  }
}
export const measurementToken = () => {
  let active = true
  const listeners = new Set<() => void>()
  const token: TNativeMotionResolutionToken = {
    isCurrent: () => active,
    onCancel: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    ...token,
    cancel: () => {
      active = false
      ;[...listeners].forEach((listener) => listener())
    },
    size: () => listeners.size,
  }
}
export const measurementTurn = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve()
}
