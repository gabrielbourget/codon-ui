import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { nativeAnimationControls } from "../animation"
import { MotionGlobalConfig, frameData, motionValue, time } from "../kernel"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
  },
}))
const nativeCommands = jest.requireMock<{
  Commands: { queryMotionGeometry: jest.Mock; sampleMotionColors: jest.Mock }
}>("../../input/specs/CUIFocusViewNativeComponent").Commands
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameSequence = 0
const cleanups: Array<() => void> = []
const settle = async () => {
  await act(async () => {
    for (let index = 0; index < 20; index++) await Promise.resolve()
  })
}
const flush = async (timestamp: number) => {
  await act(async () => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
    for (let index = 0; index < 12; index++) await Promise.resolve()
  })
}
const rootStyle = () => StyleSheet.flatten(screen.getByTestId("isolated-owner").props.style)

// The window, connected refs, native observer packets and evaluated widths are
// explicit source models. Real owner/visual/focus registration and playback run;
// this fixture makes no claim about installed Yoga, drawing or frame performance.
const mount = async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn(),
    touch = jest.fn(),
    start = jest.fn(),
    complete = jest.fn(),
    width = motionValue<unknown>(120),
    height = motionValue<unknown>(40),
    controls = nativeAnimationControls()
  cleanups.push(
    controls.mount(),
    () => width.destroy(),
    () => height.destroy(),
  )
  jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(71)
  let release!: (encoded: string) => void
  const evaluate = jest.fn(
    (_encoded: string) =>
      new Promise<string>((resolve) => {
        release = resolve
      }),
  )
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ evaluateLayout: evaluate } as never)
  await render(
    <NativeMotionOwnerHost
      ref={root}
      testID="isolated-owner"
      style={{ width: 120, height: 40 }}
      values={{ width, height }}
      motion={{ animate: controls, onAnimationStart: start, onAnimationComplete: complete }}
      onTouchStart={touch}
    >
      <TextInput ref={editor} testID="isolated-editor" value="" onChangeText={change} />
    </NativeMotionOwnerHost>,
  )
  const originalRoot = root.current!,
    originalEditor = editor.current!,
    document = {}
  expect(originalRoot).not.toBe(originalEditor)
  Object.assign(originalRoot, { isConnected: true, ownerDocument: document })
  const nativeWrite = jest.spyOn(originalRoot, "setNativeProps"),
    editorWrite = jest.spyOn(originalEditor, "setNativeProps")
  let revision = 0
  const snapshot = geometrySnapshot()
  const box = { box: [0, 0, 120, 40], quad: [0, 0, 120, 0, 120, 40, 0, 40] }
  const nativeSnapshot = {
    ...snapshot,
    rootIdentity: "isolated-owner-source-root",
    root: box,
    layout: [0, 0, 120, 40],
    untransformed: box,
    model: box,
    presentation: box,
    ancestors: [{ ...snapshot.ancestors[0], bounds: [0, 0, 120, 40], layout: [0, 0, 120, 40], model: box }],
  }
  const receiveGeometry = (ownerId: string, bindingId: string, requestId = "") => {
    const props = screen.getByTestId("isolated-owner").props
    props.onNativeMotionGeometry({
      nativeEvent: geometryPacket({
        ownerId,
        bindingId,
        requestId,
        scopeOwnerId: "",
        epoch: 0,
        geometryRevision: ++revision,
        commitRevision: "actual-model-revision",
        snapshot: JSON.stringify(nativeSnapshot),
      }),
    })
  }
  nativeCommands.queryMotionGeometry.mockImplementation(
    (target: View, ownerId: string, bindingId: string, requestId: string) => {
      expect(target).toBe(originalRoot)
      receiveGeometry(ownerId, bindingId, requestId)
    },
  )
  const props = screen.getByTestId("isolated-owner").props
  await act(() => {
    receiveGeometry(props.ownerId, props.nativeMotionGeometryBinding)
    props.onNativeMotionColors({
      nativeEvent: {
        ownerId: props.ownerId,
        target: 71,
        kind: "environment",
        requestId: "",
        windowId: "window",
        scopeOwnerId: "",
        epoch: 0,
        environmentRevision: 1,
        attached: true,
        colors: "[]",
        error: "",
        observedAt: 100,
      },
    })
  })
  await flush(1000)
  nativeWrite.mockClear()
  editorWrite.mockClear()
  const response = () => ({
    ...JSON.parse(evaluate.mock.calls[0][0]),
    kind: "evaluated-layout",
    surfaceId: 1,
    fabricRevision: "2",
    results: [
      { index: 0, metrics: { width: 120 } },
      { index: 1, metrics: { width: 200 } },
    ],
  })
  const definition = Object.freeze({
    width: "auto" as const,
    height: 80,
    transition: Object.freeze({ duration: 0.1, ease: "linear" as const }),
  })
  const retained = () => {
    expect(root.current).toBe(originalRoot)
    expect(editor.current).toBe(originalEditor)
    expect((originalRoot as View & { ownerDocument: unknown }).ownerDocument).toBe(document)
    expect(screen.getByTestId("isolated-editor").props.value).toBe("")
    expect(screen.getByTestId("isolated-editor").props.onChangeText).toBe(change)
    expect(screen.getByTestId("isolated-owner").props.onTouchStart).toBe(touch)
    expect(change).not.toHaveBeenCalled()
    expect(touch).not.toHaveBeenCalled()
    // The RN preset shares its prototype spy across native host instances.
    // Attribute each write to its actual receiver before asserting editor safety.
    const editorWrites = editorWrite.mock.calls.filter(
      (_call, index) => editorWrite.mock.contexts[index] === originalEditor,
    )
    expect(editorWrites).toEqual([])
  }
  return {
    root,
    editor,
    width,
    height,
    controls,
    start,
    complete,
    evaluate,
    nativeWrite,
    definition,
    retained,
    release: () => release(JSON.stringify(response())),
  }
}

beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  nativeCommands.queryMotionGeometry.mockReset()
  nativeCommands.sampleMotionColors.mockReset()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameSequence
    frames.set(id, callback)
    return id
  })
})
afterEach(async () => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("runs isolated native layout through real owner/visual hosts while retaining the original held-empty editor", async () => {
  const h = await mount(),
    changes: Array<{ value: unknown; rendered: unknown }> = []
  const stopChanges = h.width.on("change", (value) => changes.push({ value, rendered: rootStyle().width }))
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = h.controls.start(h.definition)
  })
  await settle()
  expect(h.evaluate).toHaveBeenCalledTimes(1)
  expect(nativeCommands.queryMotionGeometry).toHaveBeenCalledTimes(1)
  const request = JSON.parse(h.evaluate.mock.calls[0][0])
  expect(request.properties).toEqual(["width"])
  expect(request.stages[0].nativeView).not.toHaveProperty("width")
  expect(request.stages[0].nativeView).not.toHaveProperty("height")
  expect(request.stages[1].nativeView).toMatchObject({ width: "auto" })
  expect(request.stages[1].nativeView).not.toHaveProperty("height")
  await flush(1050)
  expect(h.width.get()).toBe(120)
  expect(h.height.get()).toBe(40)
  expect(rootStyle()).toMatchObject({ width: 120, height: 40 })
  expect(h.nativeWrite).not.toHaveBeenCalled()
  h.retained()
  await act(() => h.release())
  await settle()
  expect(changes.slice(0, 2)).toEqual([
    { value: "auto", rendered: 120 },
    { value: 120, rendered: 120 },
  ])
  expect(h.nativeWrite).not.toHaveBeenCalled()
  expect(rootStyle()).toMatchObject({ width: 120, height: 40 })
  await flush(1100)
  expect(h.width.get()).toBeCloseTo(160)
  expect(h.height.get()).toBeCloseTo(60)
  await flush(1150)
  await flush(1166)
  await pending
  expect(rootStyle()).toMatchObject({ width: "auto", height: 80 })
  expect(h.width.get()).toBe("auto")
  expect(h.height.get()).toBe(80)
  expect(h.start).toHaveBeenCalledTimes(1)
  expect(h.start.mock.calls[0][0]).toBe(h.definition)
  expect(h.complete).toHaveBeenCalledTimes(1)
  expect(h.complete.mock.calls[0][0]).toBe(h.definition)
  h.retained()
  stopChanges()
  await screen.unmount()
})

it("cancels pending owned evaluation and ignores its late native result without replacing the editor", async () => {
  const h = await mount()
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = h.controls.start(h.definition)
  })
  void pending.catch(() => {})
  await settle()
  expect(h.evaluate).toHaveBeenCalledTimes(1)
  await act(() => h.controls.stop())
  await act(() => h.release())
  await settle()
  await flush(1200)
  expect(rootStyle()).toMatchObject({ width: 120, height: 40 })
  expect(h.width.get()).toBe(120)
  expect(h.height.get()).toBe(40)
  expect(h.nativeWrite).not.toHaveBeenCalled()
  expect(h.complete).not.toHaveBeenCalled()
  h.retained()
  await screen.unmount()
})
