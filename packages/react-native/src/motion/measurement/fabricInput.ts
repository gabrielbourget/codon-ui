import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { observeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"
import type { TNativeMotionResolutionToken } from "../value"

export type TNativeMotionFabricInput = Readonly<{
  kind: "fabric-input"
  requestId: string
  ownerId: string
  bindingId: string
  target: number
  windowId: string
  scopeOwnerId: string
  epoch: number
  attachmentRevision: number
  nativeViewRevision: string
  surfaceId: number
  fabricRevision: string
  // Fabric-parent layout coordinates, separate from mounted/window geometry.
  fabricTargetFrame: readonly [number, number, number, number]
}>

const failure = (message: string) => new Error(`Native motion Fabric input: ${message}`)
const identity = (record: TNativeMotionGeometryRecord) => ({
  ownerId: record.ownerId,
  bindingId: record.bindingId,
  target: record.target,
  windowId: record.windowId,
  scopeOwnerId: record.scopeOwnerId,
  epoch: record.epoch,
  attachmentRevision: record.attachmentRevision,
  nativeViewRevision: record.commitRevision,
})
let requests = 0

export const captureNativeMotionFabricInput = (
  target: View,
  token: TNativeMotionResolutionToken,
): Promise<TNativeMotionFabricInput> =>
  new Promise((resolve, reject) => {
    let settled = false,
      expected: ReturnType<typeof identity> | undefined,
      latest: TNativeMotionGeometryRecord | undefined
    let stopGeometry = () => {},
      stopCancellation = () => {}
    const cancellations = new Set<() => void>()
    const localToken: TNativeMotionResolutionToken = {
      isCurrent: () => !settled && token.isCurrent(),
      onCancel: (listener) => {
        if (!localToken.isCurrent()) {
          listener()
          return () => {}
        }
        cancellations.add(listener)
        return () => {
          cancellations.delete(listener)
        }
      },
    }
    const finish = (error?: unknown, result?: TNativeMotionFabricInput) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopGeometry()
      stopCancellation()
      for (const cancel of [...cancellations]) cancel()
      cancellations.clear()
      if (error) reject(error)
      else if (result) resolve(result)
      else reject(failure("input unavailable"))
    }
    const timer = setTimeout(() => finish(failure("query exceeded its 5000ms limit")), 5000)
    const cancel = token.onCancel(() => finish(failure("owner cancelled")))
    if (settled) cancel()
    else stopCancellation = cancel
    if (!localToken.isCurrent()) {
      finish(failure("owner unavailable"))
      return
    }
    const unsubscribe = observeNativeMotionGeometry(target, (record) => {
      latest = record
      if (!record || (expected && JSON.stringify(identity(record)) !== JSON.stringify(expected)))
        finish(failure("actual native lease changed"))
    })
    if (settled) unsubscribe()
    else stopGeometry = unsubscribe
    if (settled) return
    void readNativeMotionGeometry(target, localToken).then(
      async (baseline) => {
        if (settled) return
        expected = identity(baseline)
        if (
          !localToken.isCurrent() ||
          !expected.ownerId ||
          !expected.bindingId ||
          (latest && JSON.stringify(identity(latest)) !== JSON.stringify(expected))
        ) {
          finish(failure("actual native owner retired"))
          return
        }
        try {
          const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
          if (!backend) throw failure("native snapshot module unavailable")
          const requestId = `native-fabric-input:${++requests}`
          const encoded = await backend.getSnapshot(JSON.stringify({ ...expected, requestId }))
          if (settled) return
          if (!localToken.isCurrent()) throw failure("owner retired")
          if (typeof encoded !== "string") throw failure("invalid native response")
          const data: unknown = JSON.parse(encoded)
          if (!data || typeof data !== "object" || Array.isArray(data)) throw failure("invalid native input")
          const result = data as Record<string, unknown>
          if (
            result.kind !== "fabric-input" ||
            result.requestId !== requestId ||
            Object.entries(expected).some(([key, value]) => result[key] !== value) ||
            !Number.isSafeInteger(result.surfaceId) ||
            (result.surfaceId as number) <= 0 ||
            typeof result.fabricRevision !== "string" ||
            !/^(0|[1-9]\d*)$/.test(result.fabricRevision)
          )
            throw failure("native snapshot identity mismatch")
          const frame = result.fabricTargetFrame
          if (
            !Array.isArray(frame) ||
            frame.length !== 4 ||
            frame.some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
            frame[2] < 0 ||
            frame[3] < 0
          )
            throw failure("invalid Fabric frame")
          finish(
            undefined,
            Object.freeze({
              ...expected,
              kind: "fabric-input",
              requestId,
              surfaceId: result.surfaceId as number,
              fabricRevision: result.fabricRevision,
              fabricTargetFrame: Object.freeze([frame[0], frame[1], frame[2], frame[3]] as const),
            }),
          )
        } catch (error) {
          finish(error)
        }
      },
      (error) => finish(error),
    )
  })
