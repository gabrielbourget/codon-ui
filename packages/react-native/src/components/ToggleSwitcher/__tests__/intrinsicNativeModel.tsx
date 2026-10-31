import { act, screen } from "@testing-library/react-native"
import type { Ref } from "react"
import { findNodeHandle, Platform, StyleSheet, TurboModuleRegistry, type View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../../input/__tests__/motionGeometry.fixture"
import type { NativeMotionGeometry } from "../../../input/specs/CUIFocusViewNativeComponent"

const mockActors = new Map<
  string,
  { nativeTag: number; isConnected: boolean; focus: () => void; setNativeProps: () => void }
>()
let mockTag = 12000
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({
      nativeTag: ++mockTag,
      isConnected: true,
      focus: jest.fn(),
      setNativeProps: jest.fn(),
      measure: jest.fn(),
    }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    mockActors.set(String(props.ownerId), original)
    return React.createElement(jest.requireActual("react-native").View, props)
  }),
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
    sampleMotionColors: jest.fn(),
    queryMotionGeometry: jest.fn(
      (target: { nativeTag: number }, _owner: string, _binding: string, requestId: string) => {
        const node = mockFindHost(target.nativeTag)
        if (node) mockReceive(node.props, "sample", requestId)
      },
    ),
  },
}))
const mockFindHost = (target: number) =>
  screen.container.queryAll(
    (node) =>
      mockActors.get(node.props.ownerId)?.nativeTag === target &&
      typeof node.props.onNativeMotionGeometry === "function",
  )[0]
let physical = geometrySnapshot()
let mockSequence = 0
type TGeometryHost = {
  ownerId: string
  nativeMotionGeometryBinding: string
  nativeMotionGeometryRevision?: string
  onNativeMotionGeometry: (event: { nativeEvent: NativeMotionGeometry }) => void
}
const mockReceive = (
  raw: Record<string, unknown>,
  kind: NativeMotionGeometry["kind"] = "mount-after",
  requestId = "",
) => {
  const props = raw as TGeometryHost
  const original = mockActors.get(props.ownerId)!
  props.onNativeMotionGeometry({
    nativeEvent: geometryPacket({
      ownerId: props.ownerId,
      bindingId: props.nativeMotionGeometryBinding,
      target: original.nativeTag,
      commitRevision: props.nativeMotionGeometryRevision ?? "",
      geometryRevision: ++mockSequence,
      windowId: "switcher-window",
      scopeOwnerId: "",
      epoch: 0,
      attachmentRevision: 1,
      kind,
      requestId,
      transactionId: kind === "mount-after" ? `switcher-mount:${mockSequence}` : "",
      snapshot: JSON.stringify({ ...physical, ancestors: [{ ...physical.ancestors[0], tag: original.nativeTag }] }),
    }),
  })
}
export const intrinsicWidths = new Map<string, number>()
export const intrinsicEvaluationResult = (encoded: string, replacement?: number) => {
  const request = JSON.parse(encoded)
  const node = screen.container.queryAll(
    (node) =>
      mockActors.get(node.props.ownerId)?.nativeTag === request.target &&
      typeof node.props.onNativeMotionGeometry === "function",
  )[0]
  if (!node) throw new Error("Original switcher intrinsic target missing")
  const natural = intrinsicWidths.get(node.props.accessibilityLabel)
  if (natural === undefined) throw new Error("No native intrinsic fixture metric for " + node.props.accessibilityLabel)
  return JSON.stringify({
    ...request,
    kind: "evaluated-layout",
    surfaceId: 11,
    fabricRevision: String(mockSequence),
    results: request.stages.map((stage: { index: number; nativeView: Record<string, unknown> }) => {
      const style = StyleSheet.flatten(node.props.style)
      const proposal =
        replacement ??
        (stage.nativeView.width === "max-content" && stage.nativeView.flexShrink === 0
          ? natural
          : typeof style.width === "number"
            ? style.width
            : 88)
      const minimum =
        typeof stage.nativeView.minWidth === "number"
          ? stage.nativeView.minWidth
          : typeof style.minWidth === "number"
            ? style.minWidth
            : 0
      const maximum = typeof style.maxWidth === "number" ? style.maxWidth : Infinity
      const width = Math.max(minimum, Math.min(maximum, proposal))
      return {
        index: stage.index,
        metrics: Object.fromEntries(
          request.properties.map((property: string) => [property, property === "width" ? width : 44]),
        ),
      }
    }),
  })
}
export const nativeEvaluations = jest.fn(async (encoded: string) => intrinsicEvaluationResult(encoded))
beforeEach(() => {
  physical = geometrySnapshot(Platform.OS === "ios" ? "ios" : "android")
  mockActors.clear()
  intrinsicWidths.clear()
  nativeEvaluations.mockReset()
  nativeEvaluations.mockImplementation(async (encoded: string) => intrinsicEvaluationResult(encoded))
  const ordinary = new WeakMap<object, number>()
  let next = 100000
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((target: unknown) => {
    const owned = (target as { nativeTag?: number } | null)?.nativeTag
    if (owned) return owned
    if (!target || typeof target !== "object") return null
    if (!ordinary.has(target)) ordinary.set(target, ++next)
    return ordinary.get(target)!
  })
  const get = TurboModuleRegistry.get
  jest
    .spyOn(TurboModuleRegistry, "get")
    .mockImplementation((name) =>
      name === "CUIMotionSnapshot" ? ({ evaluateLayout: nativeEvaluations } as never) : get(name),
    )
})
afterEach(() => jest.restoreAllMocks())
export const commitIntrinsicNativeTree = async () => {
  for (const node of screen.container.queryAll(
    (node) => !!node.props.nativeMotionGeometryBinding && typeof node.props.onNativeMotionGeometry === "function",
  ))
    await act(() => mockReceive(node.props))
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve()
  })
}
export const intrinsicOriginal = (name: string) => {
  const node = screen.getByRole("button", { name })
  return mockActors.get(node.props.ownerId) ?? findNodeHandle(node as unknown as View)
}
