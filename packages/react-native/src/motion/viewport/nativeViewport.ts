import { findNodeHandle, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import type { Spec } from "../../input/specs/NativeCUIMotionSnapshot"

import type { TNativeViewportEntry, TNativeViewportMargin, TNativeViewportRect } from "./types"

const connected = (view: View) => (view as View & { readonly isConnected?: boolean }).isConnected === true
const failure = (message: string) => new Error(`Native viewport: ${message}`)
let sequence = 0
const rectangle = (value: unknown): TNativeViewportRect => {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((number) => typeof number === "number" && Number.isFinite(number)) ||
    value[2] < 0 ||
    value[3] < 0
  )
    throw failure("invalid native rectangle")
  const [x, y, width, height] = value as number[]
  const data = Object.freeze({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height })
  return Object.freeze({ ...data, toJSON: () => data })
}
export const readNativeViewport = (
  target: View,
  root: View | null | undefined,
  record: TNativeMotionGeometryRecord,
  margins: readonly TNativeViewportMargin[],
  current: () => boolean,
): TNativeViewportEntry => {
  type TDocumentView = View & { readonly ownerDocument?: object | null }
  const document = (target as TDocumentView).ownerDocument
  const valid = () =>
    current() &&
    connected(target) &&
    (!root || connected(root)) &&
    document !== null &&
    document !== undefined &&
    (target as TDocumentView).ownerDocument === document &&
    (!root || (root as TDocumentView).ownerDocument === document)
  const tag = findNodeHandle(target),
    rootTag = root ? findNodeHandle(root) : 0
  if (
    !valid() ||
    tag !== record.target ||
    !Number.isInteger(tag) ||
    tag === null ||
    tag <= 0 ||
    tag > 2147483647 ||
    rootTag === null ||
    !Number.isInteger(rootTag) ||
    rootTag < 0 ||
    rootTag > 2147483647 ||
    (root && rootTag === 0) ||
    !record.attached ||
    !record.windowId
  )
    throw failure("actual connected owner/root/window required")
  const requestId = `native-viewport:${++sequence}`
  const backend = TurboModuleRegistry.get<Spec>("CUIMotionSnapshot")
  if (!backend || typeof backend.getViewportSnapshot !== "function")
    throw failure("immutable native viewport query unavailable")
  const request = {
    requestId,
    target: tag,
    root: rootTag,
    margins,
    ownerId: record.ownerId,
    bindingId: record.bindingId,
    nativeViewRevision: record.commitRevision,
  }
  const value: unknown = JSON.parse(backend.getViewportSnapshot(JSON.stringify(request)))
  if (!value || typeof value !== "object") throw failure("invalid native response")
  const response = value as Record<string, unknown>
  for (const key of ["requestId", "target", "root", "ownerId", "bindingId", "nativeViewRevision"] as const)
    if (response[key] !== request[key]) throw failure("native response belongs to another owner")
  if (
    response.kind !== "native-viewport" ||
    typeof response.fabricRevision !== "string" ||
    !/^\d+$/.test(response.fabricRevision) ||
    !Number.isInteger(response.surfaceId) ||
    (response.surfaceId as number) <= 0 ||
    typeof response.isIntersecting !== "boolean" ||
    typeof response.intersectionRatio !== "number" ||
    !Number.isFinite(response.intersectionRatio) ||
    response.intersectionRatio < 0 ||
    response.intersectionRatio > 1 ||
    (!response.isIntersecting && response.intersectionRatio !== 0) ||
    typeof response.time !== "number" ||
    !Number.isFinite(response.time)
  )
    throw failure("invalid native identity/entry")
  const entry = Object.freeze({
    target,
    time: response.time,
    isIntersecting: response.isIntersecting,
    intersectionRatio: response.intersectionRatio,
    rootBounds: rectangle(response.rootBounds),
    boundingClientRect: rectangle(response.boundingClientRect),
    intersectionRect: rectangle(response.intersectionRect),
  })
  if (!valid() || findNodeHandle(target) !== tag || (root && findNodeHandle(root) !== rootTag))
    throw failure("owner/root retired during query")
  return entry
}
