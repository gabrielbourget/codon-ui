import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import {
  decodeNativeMotionGeometry,
  observeNativeMotionGeometry,
  readNativeMotionGeometry,
} from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord, TNativeMotionGeometrySnapshot } from "../../input/motionGeometry"
import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"
import type { TNativeMotionResolutionToken } from "../value"

export type TNativeMotionTargetGeometry = Readonly<{
  kind: "native-target-geometry"
  requestId: string
  ownerSnapshot: TNativeMotionGeometrySnapshot
  targetSnapshot: TNativeMotionGeometrySnapshot
  sampleTarget: number
  nativeOwnerIdentity: string
  observedAt: number
  ownerId: string
  bindingId: string
  target: number
  windowId: string
  scopeOwnerId: string
  epoch: number
  attachmentRevision: number
  nativeViewRevision: string
}>
const failure = (message: string) => new Error(`Native motion target geometry: ${message}`)
const identity = (record: TNativeMotionGeometryRecord) => ({
  ownerId: record.ownerId,
  bindingId: record.bindingId,
  target: record.target,
  windowId: record.windowId,
  scopeOwnerId: record.scopeOwnerId,
  epoch: record.epoch,
  attachmentRevision: record.attachmentRevision,
  nativeViewRevision: record.commitRevision,
  nativeOwnerIdentity: record.snapshot?.ancestors[0].identity,
})
const connected = (view: View) => (view as View & { readonly isConnected?: boolean }).isConnected === true
let sequence = 0

// Native peer managers resolve both actual views in one UI-thread query; no caller rectangle is accepted.
export const readNativeMotionTargetGeometry = (
  owner: View,
  target: View,
  token: TNativeMotionResolutionToken,
): Promise<TNativeMotionTargetGeometry> =>
  new Promise((resolve, reject) => {
    let settled = false,
      expected: ReturnType<typeof identity> | undefined,
      latest: TNativeMotionGeometryRecord | undefined
    let stopGeometry = () => {},
      stopCancellation = () => {}
    const cancellations = new Set<() => void>()
    const local: TNativeMotionResolutionToken = {
      isCurrent: () => !settled && token.isCurrent(),
      onCancel: (callback) => {
        if (!local.isCurrent()) {
          callback()
          return () => {}
        }
        cancellations.add(callback)
        return () => {
          cancellations.delete(callback)
        }
      },
    }
    const finish = (error?: unknown, value?: TNativeMotionTargetGeometry) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopGeometry()
      stopCancellation()
      for (const cancel of [...cancellations]) cancel()
      cancellations.clear()
      if (error) reject(error)
      else if (value) resolve(value)
      else reject(failure("geometry unavailable"))
    }
    const timer = setTimeout(() => finish(failure("query exceeded its 5000ms limit")), 5000)
    const cancel = token.onCancel(() => finish(failure("owner cancelled")))
    if (settled) cancel()
    else stopCancellation = cancel
    let sampleTarget: number | null = null
    try {
      sampleTarget = findNodeHandle(target)
      if (
        !local.isCurrent() ||
        !connected(owner) ||
        !connected(target) ||
        !Number.isSafeInteger(sampleTarget) ||
        sampleTarget === null ||
        sampleTarget <= 0
      )
        throw failure("actual connected refs unavailable")
    } catch (error) {
      finish(error)
      return
    }
    const unsubscribe = observeNativeMotionGeometry(owner, (record) => {
      latest = record
      if (
        !record ||
        !connected(owner) ||
        !connected(target) ||
        (expected && JSON.stringify(identity(record)) !== JSON.stringify(expected))
      )
        finish(failure("actual native lease changed"))
    })
    if (settled) unsubscribe()
    else stopGeometry = unsubscribe
    if (settled) return
    void readNativeMotionGeometry(owner, local).then(
      async (baseline) => {
        if (settled) return
        expected = identity(baseline)
        try {
          if (
            !local.isCurrent() ||
            !expected.ownerId ||
            !expected.bindingId ||
            !expected.nativeOwnerIdentity ||
            !connected(owner) ||
            !connected(target) ||
            findNodeHandle(target) !== sampleTarget ||
            (latest && JSON.stringify(identity(latest)) !== JSON.stringify(expected))
          )
            throw failure("actual owner/target retired")
          const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
          if (!backend || typeof backend.getTargetGeometry !== "function")
            throw failure("native target module unavailable")
          const requestId = `native-target-geometry:${++sequence}`
          const encoded = await backend.getTargetGeometry(JSON.stringify({ ...expected, requestId, sampleTarget }))
          if (settled) return
          if (!local.isCurrent() || !connected(owner) || !connected(target) || findNodeHandle(target) !== sampleTarget)
            throw failure("owner/target retired")
          if (typeof encoded !== "string") throw failure("invalid native response")
          const raw: unknown = JSON.parse(encoded)
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw failure("invalid native response")
          const data = raw as Record<string, unknown>
          if (
            data.kind !== "native-target-geometry" ||
            data.requestId !== requestId ||
            data.sampleTarget !== sampleTarget ||
            typeof data.observedAt !== "number" ||
            !Number.isFinite(data.observedAt) ||
            data.observedAt < 0 ||
            Object.entries(expected).some(([key, value]) => data[key] !== value)
          )
            throw failure("native identity mismatch")
          const ownerSnapshot = decodeNativeMotionGeometry(JSON.stringify(data.ownerSnapshot)),
            targetSnapshot = decodeNativeMotionGeometry(JSON.stringify(data.targetSnapshot))
          if (
            ownerSnapshot.ancestors[0].tag !== expected.target ||
            ownerSnapshot.ancestors[0].identity !== expected.nativeOwnerIdentity ||
            targetSnapshot.ancestors[0].tag !== sampleTarget ||
            ownerSnapshot.rootIdentity !== targetSnapshot.rootIdentity ||
            ownerSnapshot.platform !== targetSnapshot.platform ||
            ownerSnapshot.units !== targetSnapshot.units ||
            ownerSnapshot.density !== targetSnapshot.density
          )
            throw failure("native target/window coordinates mismatch")
          finish(
            undefined,
            Object.freeze({
              ...expected,
              nativeOwnerIdentity: expected.nativeOwnerIdentity,
              kind: "native-target-geometry",
              requestId,
              sampleTarget: sampleTarget as number,
              observedAt: data.observedAt,
              ownerSnapshot,
              targetSnapshot,
            }),
          )
        } catch (error) {
          finish(error)
        }
      },
      (error: unknown) => finish(error),
    )
  })
