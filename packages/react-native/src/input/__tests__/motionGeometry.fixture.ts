import { NativeMotionGeometryObserver } from "../motionGeometry"
import type { NativeMotionGeometry } from "../specs/CUIFocusViewNativeComponent"

// Explicit source-only packets. No native measurements are represented by this fixture.
export const geometrySnapshot = (platform: "android" | "ios" = "android") => {
  const box = { box: [10, 20, 100, 50], quad: [10, 20, 110, 20, 110, 70, 10, 70] }
  const matrix = platform === "android" ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  return {
    platform,
    coordinateSpace: "window",
    units: platform === "android" ? "dp" : "points",
    density: 2,
    matrixFormat: platform === "android" ? "android-row-major-3x3" : "core-animation-4x4",
    rootTag: 0,
    rootIdentity: "actual-fixture-root",
    root: box,
    layout: [0, 0, 100, 50],
    untransformed: box,
    model: box,
    presentation: platform === "ios" ? null : box,
    presentationSource: platform === "ios" ? "core-animation-presentation-layer" : "android-view-render-node-matrix",
    ancestors: [
      {
        tag: 71,
        identity: "fixture-native-view",
        bounds: [0, 0, 100, 50],
        layout: [0, 0, 100, 50],
        scroll: [0, 0],
        matrix,
        model: box,
        clip: { complete: true },
      },
    ],
    ...(platform === "ios"
      ? {
          layers: [
            {
              identity: "fixture-layer",
              bounds: [0, 0, 100, 50],
              position: [50, 25],
              anchor: [0.5, 0.5, 0],
              matrix,
              sublayerMatrix: matrix,
              clip: { complete: true },
            },
          ],
        }
      : {}),
    mountObservationAvailable: true,
  }
}
export const geometryPacket = (extra: Partial<NativeMotionGeometry> = {}): NativeMotionGeometry => ({
  ownerId: "owner",
  bindingId: "binding",
  target: 71,
  kind: "sample",
  requestId: "",
  windowId: "window",
  scopeOwnerId: "scope",
  epoch: 2,
  attachmentRevision: 1,
  geometryRevision: 1,
  commitRevision: "initial",
  transactionId: "",
  attached: true,
  snapshot: JSON.stringify(geometrySnapshot()),
  error: "",
  observedAt: 100,
  ...extra,
})
export const geometryHarness = () => {
  let scope = { ownerId: "scope", windowId: "window", epoch: 2 },
    revision = 0
  const dispatch = jest.fn()
  const observer = new NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => scope,
    dispatch,
  })
  return {
    observer,
    dispatch,
    receive: (extra: Partial<NativeMotionGeometry> = {}) =>
      observer.receive(geometryPacket({ geometryRevision: ++revision, ...extra })),
    scope: (value: typeof scope) => {
      scope = value
    },
  }
}
