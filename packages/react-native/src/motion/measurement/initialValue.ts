import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { subscribeNativeMotionColorEnvironment } from "../../input/motionColors"
import { observeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"
import type { TNativeMotionResolutionToken } from "../value/types"

const failure = (message: string) => new Error(`Native motion initial value: ${message}`)
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
const connected = (target: View) => (target as View & { readonly isConnected?: boolean }).isConnected === true
const ANGLE_FIELDS = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "rotation",
  "skew",
  "skewX",
  "skewY",
  "pathRotation",
])
const compatibleValue = (name: string, value: unknown, endpoint: unknown) => {
  if (!ANGLE_FIELDS.has(name) || typeof value !== "number" || typeof endpoint !== "string") return value
  if (endpoint.endsWith("deg")) return `${value}deg`
  if (endpoint.endsWith("rad")) return `${(value * Math.PI) / 180}rad`
  return value
}
const validateValue = (value: unknown, depth = 0): void => {
  if (depth > 32) throw failure("native value nesting exceeded its limit")
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw failure("non-finite native value")
  } else if (typeof value === "string" || typeof value === "boolean") return
  else if (Array.isArray(value)) value.forEach((item) => validateValue(item, depth + 1))
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype")
        throw failure("invalid native value field")
      validateValue(item, depth + 1)
    }
  } else throw failure("native value unavailable")
}
let sequence = 0

// Reads the committed actual host. It never publishes a style or touches an editor.
export const readNativeMotionInitialValue = (
  target: View,
  name: string,
  endpoint: unknown,
  token: TNativeMotionResolutionToken,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let settled = false,
      expected: ReturnType<typeof identity> | undefined,
      latest: TNativeMotionGeometryRecord | undefined
    let stopGeometry = () => {},
      stopCancellation = () => {},
      stopColors = () => {}
    const cancellations = new Set<() => void>()
    const local: TNativeMotionResolutionToken = {
      isCurrent: () => !settled && token.isCurrent(),
      onCancel: (listener) => {
        if (!local.isCurrent()) {
          listener()
          return () => {}
        }
        cancellations.add(listener)
        return () => {
          cancellations.delete(listener)
        }
      },
    }
    const finish = (error?: unknown, value?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopGeometry()
      stopCancellation()
      stopColors()
      for (const cancel of [...cancellations]) cancel()
      cancellations.clear()
      if (error) reject(error)
      else resolve(value)
    }
    const timer = setTimeout(() => finish(failure("query exceeded its 5000ms limit")), 5000)
    const cancel = token.onCancel(() => finish(failure("owner cancelled")))
    if (settled) cancel()
    else stopCancellation = cancel
    let nativeTarget: number | null = null
    const sameRef = () => connected(target) && findNodeHandle(target) === nativeTarget
    try {
      nativeTarget = findNodeHandle(target)
      if (!name || name.length > 128 || !local.isCurrent() || !sameRef() || !nativeTarget || nativeTarget <= 0)
        throw failure("actual connected native owner and field required")
    } catch (error) {
      finish(error)
      return
    }
    const unsubscribe = observeNativeMotionGeometry(target, (record) => {
      latest = record
      if (!record || !sameRef() || (expected && JSON.stringify(identity(record)) !== JSON.stringify(expected)))
        finish(failure("actual native lease changed"))
    })
    if (settled) unsubscribe()
    else stopGeometry = unsubscribe
    if (settled) return
    const unsubscribeColors = subscribeNativeMotionColorEnvironment(target, () =>
      finish(failure("native color environment changed")),
    )
    if (settled) unsubscribeColors()
    else stopColors = unsubscribeColors
    if (settled) return
    void readNativeMotionGeometry(target, local).then(
      async (baseline) => {
        if (settled) return
        expected = identity(baseline)
        try {
          if (
            !local.isCurrent() ||
            !sameRef() ||
            expected.target !== nativeTarget ||
            !expected.ownerId ||
            !expected.bindingId ||
            (latest && JSON.stringify(identity(latest)) !== JSON.stringify(expected))
          )
            throw failure("actual native owner retired")
          const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
          if (!backend || typeof backend.getInitialValue !== "function")
            throw failure("native initial-value module unavailable")
          const requestId = `native-initial-value:${++sequence}`
          const encoded = await backend.getInitialValue(JSON.stringify({ ...expected, requestId, name }))
          if (settled) return
          if (!local.isCurrent() || !sameRef()) throw failure("actual native owner retired")
          if (typeof encoded !== "string") throw failure("invalid native response")
          const raw: unknown = JSON.parse(encoded)
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw failure("invalid native response")
          const result = raw as Record<string, unknown>
          if (
            result.kind !== "native-initial-value" ||
            result.requestId !== requestId ||
            result.name !== name ||
            Object.entries(expected).some(([key, value]) => result[key] !== value) ||
            !Number.isSafeInteger(result.surfaceId) ||
            (result.surfaceId as number) <= 0 ||
            typeof result.fabricRevision !== "string" ||
            !/^(0|[1-9]\d*)$/.test(result.fabricRevision)
          )
            throw failure("native initial-value identity mismatch")
          validateValue(result.value)
          finish(undefined, compatibleValue(name, result.value, endpoint))
        } catch (error) {
          finish(error)
        }
      },
      (error: unknown) => finish(error),
    )
  })
