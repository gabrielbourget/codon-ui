import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ComponentType, Ref } from "react"
import { findNodeHandle, type View } from "react-native"

import { packet } from "../../date/input/__tests__/packet"
import type {
  TNativeFieldInputPacket,
  TNativeFieldKeyEvent,
  TNativeFieldPointerEvent,
  TNativeFieldPointerPhase,
} from "../fieldInput"
import NativeDefaults from "../specs/NativeCUIEditorKeyboardDefaults"
import NativeDocument from "../specs/NativeCUIFormDocument"

// The fixture is outside this package; its imports must use the native peer
// rather than whichever React version the repository happens to hoist.
const fixtureReactPeers = {
  react: jest.requireActual<typeof import("react")>("react"),
  "react/jsx-runtime": jest.requireActual("react/jsx-runtime"),
  "react/jsx-dev-runtime": jest.requireActual("react/jsx-dev-runtime"),
}
for (const [name, peer] of Object.entries(fixtureReactPeers)) {
  jest.doMock(name, () => peer, { virtual: true })
}

const { FieldInputSDKScene } = jest.requireActual<{
  FieldInputSDKScene: ComponentType<{ record: (row: Record<string, unknown>) => void }>
}>("../../../../../planning/component-library/fixtures/native-time-picker/FieldInputSDKApp")

const mockTargets = new Map<string, { nativeTag: number; focus: () => void; setNativeProps: () => void }>()
let mockTags = 100
jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({ nativeTag: ++mockTags, focus: jest.fn(), setNativeProps: jest.fn() }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    if (props.testID) mockTargets.set(String(props.testID), original)
    return React.createElement(jest.requireActual("react-native").View, props)
  }),
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
jest.mock("../specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({ nativeTag: ++mockTags, focus: jest.fn(), setNativeProps: jest.fn() }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    mockTargets.set(String(props.testID), original)
    return React.createElement(jest.requireActual("react-native").View, props)
  }),
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react"),
      testID = `metadata:${props.ownerId}`
    const [original] = React.useState(() => ({ nativeTag: ++mockTags, focus: jest.fn(), setNativeProps: jest.fn() }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    mockTargets.set(testID, original)
    return React.createElement(jest.requireActual("react-native").View, { ...props, testID })
  }),
}))
jest.mock("../specs/CUIKeyboardScopeNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../specs/NativeCUIEditorKeyboardDefaults", () => ({
  __esModule: true,
  default: {
    getLease: () => "module:1",
    acceptsField: jest.fn(() => true),
    settleField: jest.fn(() => true),
    moveFieldFocus: jest.fn(),
    takeFieldRecords: jest.fn(() => JSON.stringify({ records: [], dropped: 0 })),
  },
}))
jest.mock("../specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: {
    bindFieldInput: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded)
      return JSON.stringify({
        requestId: request.requestId,
        ownerToken: `owner:${request.requestId}`,
        metadataTarget: request.mount.target,
      })
    }),
    unbindFieldInput: jest.fn(async () => true),
    bindField: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded)
      return JSON.stringify({
        requestId: request.requestId,
        ownerToken: `semantic:${request.requestId}`,
        metadataTarget: request.mount.target,
      })
    }),
    unbindField: jest.fn(async () => true),
  },
}))
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .spyOn(jest.requireActual("react-native"), "findNodeHandle")
    .mockImplementation((target: unknown) => (target as { nativeTag?: number })?.nativeTag ?? 999)
})
afterEach(() => jest.restoreAllMocks())

const admitCurrentOriginals = async () => {
  const currentSegments = screen
    .getAllByTestId(/^(outer|inner)-(hour|minute)$|^candidate-time-segment-/)
    .filter((host) => host.props.ownerId)
  for (const host of currentSegments) {
    const props = host.props,
      name = props.testID
    await act(() =>
      props.onNativeSegmentInput({
        nativeEvent: packet({
          ownerId: props.ownerId,
          segmentId: props.segmentId,
          bindingRevision: props.bindingRevision,
          target: mockTargets.get(name)!.nativeTag,
          nativeInstance: `segment:${name}`,
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence: 1,
        }),
      }),
    )
  }
  for (const metadata of screen.getAllByTestId(/^metadata:/, { includeHiddenElements: true })) {
    const props = metadata.props
    await act(async () => {
      props.onNativeFormCommit({
        nativeEvent: {
          ownerId: props.ownerId,
          descriptorId: props.descriptorId,
          descriptorRevision: props.descriptorRevision,
          target: mockTargets.get(metadata.props.testID)!.nativeTag,
          originalTarget: props.editorTarget,
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence: 1,
          mountRevision: "mount:1",
          active: true,
          attached: true,
          complete: true,
          metadataOnly: true,
          originalClass: "CUIDateSegment",
          error: "",
        },
      })
      await Promise.resolve()
    })
  }
}

const renderAdmittedScene = async (record: (row: Record<string, unknown>) => void) => {
  await render(<FieldInputSDKScene record={record} />)
  await admitCurrentOriginals()
}

const originalFieldEvent = <T extends object>(nativeEvent: T) => {
  let stopped = false,
    prevented = false
  return {
    nativeEvent,
    persist: jest.fn(),
    stopPropagation: () => {
      stopped = true
    },
    preventDefault: () => {
      prevented = true
    },
    isPropagationStopped: () => stopped,
    isDefaultPrevented: () => prevented,
    get defaultPrevented() {
      return prevented
    },
  }
}

const scenePacket = (
  name: "outer" | "inner" | "candidate",
  hit: string,
  phase: TNativeFieldInputPacket["phase"],
  token: number,
  insideInput = true,
): TNativeFieldInputPacket => {
  const metadata = screen
    .getAllByTestId(/^metadata:/, { includeHiddenElements: true })
    .find(
      (item) =>
        item.props.editorTarget ===
        mockTargets.get(
          name === "candidate"
            ? screen
                .getAllByTestId(/^candidate-time-segment-/)
                .find((node) => typeof node.props.segmentId === "string" && node.props.segmentId.endsWith(":hour"))!
                .props.testID
            : `${name}-hour`,
        )!.nativeTag,
    )!
  const binding = JSON.parse(metadata.props.fieldGroupBinding)
  const group = (target: number) => ({
    target,
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    scopeTarget: binding.outerTarget,
    containsTarget: true,
  })
  const groups = (insideInput ? [binding.inputTarget, binding.outerTarget] : [binding.outerTarget]).map(group)
  if (name === "inner") {
    const parent = scenePacket("outer", "outer-hour", phase, token).groups.at(-1)!
    groups.push(parent)
  }
  return {
    moduleLease: "module:1",
    token,
    eventId: token,
    phase,
    groups,
    identity: {
      ownerId: metadata.props.ownerId,
      bindingId: binding.bindingId,
      bindingRevision: binding.bindingRevision,
      metadataTarget: mockTargets.get(metadata.props.testID)!.nativeTag,
      outerTarget: binding.outerTarget,
      inputTarget: binding.inputTarget,
      surfaceId: 11,
      target: mockTargets.get(hit)!.nativeTag,
      documentId: "document:1",
      documentRevision: "7",
      windowId: "window:1",
      mountRevision: "mount:1",
      outerInstance: `${name}:outer`,
      inputInstance: `${name}:input`,
      nativeInstance: hit,
      editorInstance: hit,
      epoch: 1,
    },
  }
}

it("keeps nested navigation local and bubbles its held-owner edit through the actual ancestor path", async () => {
  const record = jest.fn()
  await renderAdmittedScene(record)
  await fireEvent.press(screen.getByTestId("field-sdk-echo"))
  await fireEvent.press(screen.getByTestId("field-sdk-empty"))
  const originalInner = mockTargets.get("inner-minute")!
  const dispatch = scenePacket("inner", "inner-hour", "down", 90)
  const navigation = originalFieldEvent({
    kind: "keyboard",
    ownerId: dispatch.identity.ownerId,
    target: dispatch.identity.target,
    key: "ArrowRight",
    phase: "down",
    cancelled: false,
    nativeDefaultHandled: false,
    fieldDispatch: JSON.stringify(dispatch),
  }) as unknown as TNativeFieldKeyEvent
  jest.mocked(NativeDefaults!.moveFieldFocus).mockReturnValue(
    JSON.stringify({
      requested: true,
      observed: true,
      current: true,
      target: originalInner.nativeTag,
      nativeInstance: "inner-minute",
      editorInstance: "inner-minute",
      error: "",
    }),
  )
  record.mockClear()
  const focusCount = jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.length
  for (const id of ["inner-hour", "inner-input", "inner-outer", "outer-outer"])
    await act(() => screen.getByTestId(id).props.onNativeFieldKey(navigation))
  expect(record.mock.calls.map(([row]) => [row.kind, row.field])).toEqual([
    ["segment-key", "inner"],
    ["field-key", "inner"],
  ])
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusCount + 1)
  expect(JSON.parse(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.at(-1)![0]).action).toEqual({
    groupTarget: dispatch.identity.outerTarget,
    kind: "next",
  })
  const editPacket = scenePacket("inner", "inner-minute", "down", 91)
  const edit = originalFieldEvent({
    ...navigation.nativeEvent,
    key: "ArrowUp",
    target: editPacket.identity.target,
    fieldDispatch: JSON.stringify(editPacket),
  }) as unknown as TNativeFieldKeyEvent
  record.mockClear()
  const acknowledgements = jest.mocked(NativeDefaults!.settleField).mock.calls.length
  for (const id of ["inner-minute", "inner-input", "inner-outer", "outer-outer"])
    await act(() => screen.getByTestId(id).props.onNativeFieldKey(edit))
  const rows = record.mock.calls.map(([row]) => row).filter((row) => row.kind !== "field-state")
  expect(rows.map((row) => [row.kind, row.field])).toEqual([
    ["segment-key", "inner"],
    ["value-request", "inner"],
    ["field-key", "inner"],
    ["field-key", "inner"],
    ["field-key", "outer"],
  ])
  expect(rows[1]).toMatchObject({
    held: "08:15:00",
    heldClass: "Time",
    value: "08:16:00",
    valueClass: "Time",
    echo: false,
  })
  expect(rows.filter((row) => row.kind === "field-key").map((row) => row.receiverTarget)).toEqual(
    editPacket.groups.map((row) => row.target),
  )
  expect(rows.filter((row) => row.data).every((row) => row.data === edit.nativeEvent)).toBe(true)
  expect(jest.mocked(NativeDefaults!.settleField).mock.calls).toHaveLength(acknowledgements + 1)
  expect(JSON.parse(screen.getByTestId("outer-value").props.accessibilityLabel)).toMatchObject({
    value: null,
    valueClass: null,
  })
  expect(JSON.parse(screen.getByTestId("inner-value").props.accessibilityLabel)).toMatchObject({
    value: "08:15:00",
    valueClass: "Time",
  })
  expect(mockTargets.get("inner-minute")).toBe(originalInner)
  expect(originalInner.setNativeProps).not.toHaveBeenCalled()
})

it("records the original authored pointer stop before any group press contact", async () => {
  const record = jest.fn()
  await renderAdmittedScene(record)
  await fireEvent.press(screen.getByTestId("field-sdk-stop"))
  const dispatch = scenePacket("outer", "outer-button", "pointer-start", 95, false)
  const down = originalFieldEvent({
    target: dispatch.identity.target,
    pointerId: 8,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    fieldDispatch: JSON.stringify(dispatch),
  }) as unknown as TNativeFieldPointerEvent
  record.mockClear()
  const focusCount = jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.length
  await act(() => {
    screen.getByTestId("outer-button").props.onPointerDown(down)
    screen.getByTestId("outer-outer").props.onPointerDown(down)
  })
  expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["child-pointer"])
  expect(record.mock.calls[0][0]).toMatchObject({ data: down.nativeEvent, stopped: true })
  for (const [index, phase, handler] of [
    [1, "pointer-end", "onPointerUp"],
    [2, "pointer-click", "onClick"],
  ] as const) {
    const packet = { ...dispatch, token: 95 + index, eventId: 95 + index, phase }
    const event = originalFieldEvent({
      ...down.nativeEvent,
      fieldDispatch: JSON.stringify(packet),
    }) as unknown as TNativeFieldPointerEvent
    await act(() => screen.getByTestId("outer-outer").props[handler](event))
  }
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusCount)
  await fireEvent.press(screen.getByTestId("field-sdk-checkpoint"))
  const snapshot = JSON.parse(screen.getByTestId("field-sdk-receipt-snapshot").props.accessibilityLabel)
  expect(snapshot.callbacks.filter((row: { token: number }) => row.token === 95)).toMatchObject([
    { kind: "child-pointer", stopped: true },
  ])
  expect(
    snapshot.callbacks
      .filter((row: { kind: string }) => row.kind === "group-pointer")
      .every((row: { receiverTarget: number }) => row.receiverTarget === dispatch.identity.outerTarget),
  ).toBe(true)
})

it("calls the original core focus ref without substituting field focus and commits only the mixed transaction", async () => {
  const record = jest.fn()
  await renderAdmittedScene(record)
  const focusRequests = jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.length
  for (const [index, mode] of ["command-only", "command-mixed"].entries()) {
    await fireEvent.press(screen.getByTestId(`field-sdk-${mode}`))
    const dispatch = scenePacket("outer", "outer-button", "down", 110 + index, false)
    const event = originalFieldEvent({
      kind: "keyboard",
      ownerId: dispatch.identity.ownerId,
      target: dispatch.identity.target,
      key: "f",
      phase: "down",
      cancelled: false,
      nativeDefaultHandled: false,
      fieldDispatch: JSON.stringify(dispatch),
    }) as unknown as TNativeFieldKeyEvent
    record.mockClear()
    await act(() => {
      screen.getByTestId("outer-button").props.onNativeFieldKey(event)
      screen.getByTestId("outer-outer").props.onNativeFieldKey(event)
    })
    const calls = record.mock.calls
      .map(([row]) => row)
      .filter((row) => ["original-command-call", "original-command-return"].includes(String(row.kind)))
    expect(calls.map((row) => row.kind)).toEqual(["original-command-call", "original-command-return"])
    expect(calls.every((row) => row.data === event.nativeEvent)).toBe(true)
    expect(calls[1]).toMatchObject({
      sameRef: true,
      sameMethod: true,
      command: "focus",
      mode: index === 0 ? "original-only" : "mixed",
    })
    expect(event.isDefaultPrevented()).toBe(true)
    const state = JSON.parse(screen.getByTestId("outer-value").props.accessibilityLabel)
    expect(state.commandTransactions).toBe(index)
    expect(calls[0].target).toBe(state.coreTarget)
    expect(calls[0].target).not.toBe(dispatch.identity.target)
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "value-request" }))
  }
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusRequests)
})

it.each(["callback", "disabled", "readonly", "layout", "unmount"])(
  "applies %s in the original callback and admits only the current follow-up scope",
  async (mutation) => {
    const record = jest.fn()
    await renderAdmittedScene(record)
    for (let step = 0; step <= ["callback", "disabled", "readonly", "layout", "unmount"].indexOf(mutation); step++)
      await fireEvent.press(screen.getByTestId("field-sdk-mutation"))
    const dispatch = scenePacket("outer", "outer-button", "down", 130, false)
    const retained = screen.getByTestId("outer-outer").props.onNativeFieldKey
    const original = mockTargets.get("outer-button")!
    const event = originalFieldEvent({
      kind: "keyboard",
      ownerId: dispatch.identity.ownerId,
      target: dispatch.identity.target,
      key: "m",
      phase: "down",
      cancelled: false,
      nativeDefaultHandled: false,
      fieldDispatch: JSON.stringify(dispatch),
    }) as unknown as TNativeFieldKeyEvent
    record.mockClear()
    await act(() => {
      screen.getByTestId("outer-button").props.onNativeFieldKey(event)
      retained(event)
    })
    expect(
      record.mock.calls
        .map(([row]) => row)
        .filter((row) => row.data?.fieldDispatch)
        .map((row) => row.kind),
    ).toEqual(["child-key", "field-key", "mutation-call", "mutation-return"])
    expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "value-request" }))
    const scene = JSON.parse(screen.getByTestId("field-sdk-scene-state").props.accessibilityLabel)
    expect(scene.revision).toBe(mutation === "callback" ? 1 : 0)
    expect(scene.layoutRevision).toBe(mutation === "layout" ? 1 : 0)
    expect(scene.visible).toBe(mutation !== "unmount")
    expect(scene.disabled).toBe(mutation === "disabled")
    expect(scene.readonly).toBe(mutation === "readonly")
    record.mockClear()
    const late = originalFieldEvent({
      ...event.nativeEvent,
      key: "j",
      fieldDispatch: JSON.stringify({ ...dispatch, token: 131, eventId: 131 }),
    }) as unknown as TNativeFieldKeyEvent
    const acknowledgements = jest.mocked(NativeDefaults!.settleField).mock.calls.length
    await act(() => retained(late))
    if (mutation === "layout") {
      expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["field-key"])
      expect(jest.mocked(NativeDefaults!.settleField).mock.calls).toHaveLength(acknowledgements + 1)
    } else {
      expect(record).not.toHaveBeenCalled()
      expect(jest.mocked(NativeDefaults!.settleField).mock.calls).toHaveLength(acknowledgements)
    }
    if (mutation === "disabled" || mutation === "readonly")
      await fireEvent.press(screen.getByTestId(`field-sdk-${mutation}`))
    if (mutation === "unmount") await fireEvent.press(screen.getByTestId("field-sdk-show"))
    await admitCurrentOriginals()
    const probe = scenePacket("outer", "outer-button", "down", 132, false)
    const next = originalFieldEvent({
      ...event.nativeEvent,
      key: "j",
      ownerId: probe.identity.ownerId,
      target: probe.identity.target,
      fieldDispatch: JSON.stringify(probe),
    }) as unknown as TNativeFieldKeyEvent
    record.mockClear()
    await act(() => {
      screen.getByTestId("outer-button").props.onNativeFieldKey(next)
      screen.getByTestId("outer-outer").props.onNativeFieldKey(next)
    })
    expect(record.mock.calls.filter(([row]) => row.kind === "field-key").map(([row]) => row.revision)).toEqual([
      scene.revision,
    ])
    expect(mockTargets.get("outer-button") === original).toBe(mutation !== "unmount")
  },
)

it("connects original segment entry, group callers and native binding lifetime without replacing roots on a valid value echo", async () => {
  const observations = jest.spyOn(
    jest.requireActual<typeof import("../NativeKeyboardScope")>("../NativeKeyboardScope"),
    "useNativeKeyboardObservation",
  )
  const error = jest.spyOn(console, "error"),
    record = jest.fn()
  await renderAdmittedScene(record)
  expect(JSON.parse(screen.getByTestId("outer-binding").props.accessibilityLabel)).toMatchObject({
    ready: true,
    error: "",
  })
  expect(screen.getByTestId("outer-negative-tab").props.focusable).toBe(true)
  expect(screen.getByTestId("outer-negative-tab").props.nativeTabStop).toBe(false)
  const target = mockTargets.get("outer-hour")!,
    originalFocus = target.focus
  const observe = observations.mock.calls.filter(([spec]) => spec.targetTag === target.nativeTag).at(-1)![0]
  const acknowledgements = jest.mocked(NativeDefaults!.settleField).mock.calls.length
  const passive = { nativeEvent: { focusedTarget: target.nativeTag, key: "9", phase: "down" } }
  await act(() => observe.onKeyDown(passive as unknown as Parameters<typeof observe.onKeyDown>[0]))
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "field-observed-key", data: passive.nativeEvent }),
  )
  expect(JSON.parse(screen.getByTestId("field-sdk-observation-snapshot").props.accessibilityLabel)).toMatchObject({
    field: "outer",
    data: passive.nativeEvent,
  })
  expect(jest.mocked(NativeDefaults!.settleField).mock.calls).toHaveLength(acknowledgements)
  const metadata = screen
    .getAllByTestId(/^metadata:/, { includeHiddenElements: true })
    .find((item) => item.props.editorTarget === target.nativeTag)!
  const binding = JSON.parse(metadata.props.fieldGroupBinding),
    identity = {
      ownerId: metadata.props.ownerId,
      bindingId: binding.bindingId,
      bindingRevision: binding.bindingRevision,
      metadataTarget: mockTargets.get(metadata.props.testID)!.nativeTag,
      outerTarget: binding.outerTarget,
      inputTarget: binding.inputTarget,
      surfaceId: 11,
      target: target.nativeTag,
      documentId: "document:1",
      documentRevision: "7",
      windowId: "window:1",
      mountRevision: "mount:1",
      outerInstance: "outer:1",
      inputInstance: "input:1",
      nativeInstance: "component:1",
      editorInstance: "editor:1",
      epoch: 1,
    }
  let prevented = false,
    stopped = false
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: screen.getByTestId("outer-hour").props.ownerId,
      target: target.nativeTag,
      key: "ArrowUp",
      phase: "down",
      cancelled: false,
      nativeDefaultHandled: false,
      fieldDispatch: JSON.stringify({
        moduleLease: "module:1",
        token: 1,
        eventId: 1,
        phase: "down",
        identity,
        groups: [binding.inputTarget, binding.outerTarget].map((group) => ({
          target: group,
          bindingId: binding.bindingId,
          bindingRevision: binding.bindingRevision,
          scopeTarget: binding.outerTarget,
          containsTarget: true,
        })),
      }),
    },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    stopPropagation: () => {
      stopped = true
    },
    isDefaultPrevented: () => prevented,
    isPropagationStopped: () => stopped,
    get defaultPrevented() {
      return prevented
    },
  } as unknown as TNativeFieldKeyEvent
  record.mockClear()
  const installed = jest.mocked(NativeDocument!.bindFieldInput).mock.calls.length
  await act(() => screen.getByTestId("outer-hour").props.onNativeFieldKey(event))
  await act(() => screen.getByTestId("outer-input").props.onNativeFieldKey(event))
  await act(() => screen.getByTestId("outer-outer").props.onNativeFieldKey(event))
  const callbacks = record.mock.calls.map(([row]) => row).filter((row) => row.kind !== "field-state")
  expect(callbacks.map((row) => row.kind)).toEqual(["segment-key", "value-request", "field-key", "field-key"])
  expect(callbacks[1]).toMatchObject({ held: "13:45:00", heldClass: "Time", value: "14:45:00", valueClass: "Time" })
  expect(callbacks[2].data).toBe(event.nativeEvent)
  expect(callbacks[3].data).toBe(event.nativeEvent)
  expect(callbacks[2].receiverTarget).toBe(binding.inputTarget)
  expect(callbacks[3].receiverTarget).toBe(binding.outerTarget)
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "field-state", field: "outer", value: "14:45:00", valueClass: "Time" }),
  )
  expect(jest.mocked(NativeDocument!.bindFieldInput).mock.calls).toHaveLength(installed)
  expect(mockTargets.get("outer-hour")).toBe(target)
  expect(target.focus).toBe(originalFocus)
  expect(target.setNativeProps).not.toHaveBeenCalled()
  expect(screen.getByTestId("outer-hour").props.displayText).toBe("14")
  expect(NativeDefaults!.settleField).toHaveBeenCalledTimes(1)
  expect(JSON.parse(jest.mocked(NativeDefaults!.settleField).mock.calls[0][0])).toMatchObject({
    current: true,
    preventDefault: true,
  })
  const authored = mockTargets.get("outer-negative-tab")!
  jest.mocked(NativeDefaults!.moveFieldFocus).mockReturnValue(
    JSON.stringify({
      requested: true,
      observed: true,
      current: true,
      target: authored.nativeTag,
      nativeInstance: "authored:1",
      editorInstance: "authored:1",
      error: "",
    }),
  )
  const inputPacket = JSON.parse(event.nativeEvent.fieldDispatch)
  const pointer = (phase: TNativeFieldPointerPhase, pointerType: string, token: number) => {
    let stopped = false,
      prevented = false
    return {
      currentTarget: mockTargets.get("outer-input"),
      nativeEvent: {
        target: binding.inputTarget,
        pointerId: 9,
        pointerType,
        isPrimary: true,
        button: 0,
        fieldDispatch: JSON.stringify({
          ...inputPacket,
          phase,
          token,
          eventId: token,
          identity: { ...identity, target: binding.inputTarget },
        }),
      },
      persist: jest.fn(),
      stopPropagation: () => {
        stopped = true
      },
      preventDefault: () => {
        prevented = true
      },
      isPropagationStopped: () => stopped,
      isDefaultPrevented: () => prevented,
      get defaultPrevented() {
        return prevented
      },
    } as unknown as TNativeFieldPointerEvent
  }
  const focusCalls = jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.length
  record.mockClear()
  const down = pointer("pointer-start", "touch", 40)
  await act(() => screen.getByTestId("outer-input").props.onPointerDown(down))
  expect(down.isPropagationStopped()).toBe(true)
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusCalls)
  expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["group-pointer"])
  record.mockClear()
  const up = pointer("pointer-end", "touch", 41)
  await act(() => {
    screen.getByTestId("outer-input").props.onPointerUp(up)
    Object.assign(up, { currentTarget: mockTargets.get("outer-outer") })
    screen.getByTestId("outer-outer").props.onPointerUp(up)
    screen.getByTestId("outer-root").props.onPointerUp(up)
  })
  expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["group-pointer", "group-pointer", "field-pointer"])
  expect(record.mock.calls.every(([row]) => row.data === up.nativeEvent)).toBe(true)
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusCalls)
  record.mockClear()
  const click = pointer("pointer-click", "touch", 42)
  await act(() => screen.getByTestId("outer-input").props.onClick(click))
  expect(click.isPropagationStopped()).toBe(true)
  expect(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls).toHaveLength(focusCalls + 1)
  expect(JSON.parse(jest.mocked(NativeDefaults!.moveFieldFocus).mock.calls.at(-1)![0]).action).toEqual({
    groupTarget: binding.outerTarget,
    kind: "press",
  })
  expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["group-pointer"])
  for (const [index, kind] of ["marked", "unmark", "insert", "delete"].entries()) {
    const host = screen.getByTestId("outer-hour")
    const originalInput = {
      ...event,
      nativeEvent: {
        ...packet({
          ownerId: host.props.ownerId,
          segmentId: host.props.segmentId,
          bindingRevision: host.props.bindingRevision,
          target: target.nativeTag,
          nativeInstance: "segment:outer-hour",
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence: index + 2,
          kind,
          focused: true,
          text: "9",
          document: "9",
          selectionStart: 1,
          selectionEnd: 1,
          nativeData: JSON.stringify({ method: kind, originalArguments: ["9"] }),
        }),
        fieldDispatch: JSON.stringify({ ...inputPacket, phase: "input", token: index + 10, eventId: index + 10 }),
      },
    }
    record.mockClear()
    await act(() => host.props.onNativeSegmentInput(originalInput))
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "segment-input", data: originalInput.nativeEvent }),
    )
    const settle = JSON.parse(jest.mocked(NativeDefaults!.settleField).mock.calls.at(-1)![0])
    expect(settle).toMatchObject({ token: index + 10, phase: "input", current: true, preventDefault: false })
    if (kind === "insert" || kind === "unmark") {
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "entry-focus",
          result: expect.objectContaining({ observed: true, target: authored.nativeTag }),
        }),
      )
    }
    expect(jest.mocked(NativeDocument!.bindFieldInput).mock.calls).toHaveLength(installed)
  }
  expect(target.focus).toBe(originalFocus)
  expect(target.setNativeProps).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId("field-sdk-callback"))
  expect(JSON.parse(screen.getByTestId("outer-binding").props.accessibilityLabel)).toMatchObject({
    ready: true,
    error: "",
  })
  expect(jest.mocked(NativeDocument!.bindFieldInput).mock.calls).toHaveLength(installed)
  const changed = screen
    .getAllByTestId(/^metadata:/, { includeHiddenElements: true })
    .find((item) => item.props.editorTarget === target.nativeTag)!
  const newBinding = JSON.parse(changed.props.fieldGroupBinding)
  expect(newBinding.bindingRevision).not.toBe(binding.bindingRevision)
  record.mockClear()
  const stale = { ...event, nativeEvent: { ...event.nativeEvent } }
  await act(() => screen.getByTestId("outer-hour").props.onNativeFieldKey(stale))
  expect(record).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByTestId("field-sdk-receipts"))
  expect(record).toHaveBeenCalledWith({ kind: "native-receipts", batch: 1, records: [], dropped: 0 })
  await fireEvent.press(screen.getByTestId("field-sdk-unmount"))
  const removingMetadata = screen
    .getAllByTestId(/^metadata:/, { includeHiddenElements: true })
    .find((item) => item.props.editorTarget === target.nativeTag)!
  const removingBinding = JSON.parse(removingMetadata.props.fieldGroupBinding)
  const originalPacket = JSON.parse(event.nativeEvent.fieldDispatch)
  const removing = {
    ...event,
    nativeEvent: {
      ...event.nativeEvent,
      fieldDispatch: JSON.stringify({
        ...originalPacket,
        token: 3,
        eventId: 3,
        identity: { ...identity, bindingRevision: removingBinding.bindingRevision },
        groups: originalPacket.groups.map((group: Record<string, unknown>) => ({
          ...group,
          bindingRevision: removingBinding.bindingRevision,
        })),
      }),
    },
  }
  const handlers = ["outer-hour", "outer-input", "outer-outer"].map(
    (id) => screen.getByTestId(id).props.onNativeFieldKey,
  )
  await act(() => {
    for (const handler of handlers) handler(removing)
  })
  expect(screen.queryByTestId("outer-hour")).toBeNull()
  jest.mocked(NativeDefaults!.takeFieldRecords).mockReturnValueOnce(
    JSON.stringify({
      records: [
        JSON.stringify({
          kind: "key",
          scopeCurrent: false,
          originalDefaultPrevented: true,
          renderPhasesComplete: true,
          after: null,
        }),
      ],
      dropped: 0,
    }),
  )
  record.mockClear()
  await fireEvent.press(screen.getByTestId("field-sdk-receipts"))
  expect(record).toHaveBeenCalledWith({
    kind: "native-receipts",
    batch: 2,
    records: [
      { kind: "key", scopeCurrent: false, originalDefaultPrevented: true, renderPhasesComplete: true, after: null },
    ],
    dropped: 0,
  })
  const receiptSnapshot = JSON.parse(screen.getByTestId("field-sdk-receipt-snapshot").props.accessibilityLabel)
  expect(receiptSnapshot.frames[0]).toMatchObject({
    token: null,
    phase: null,
    scopeCurrent: false,
    error: "missing-native-frame-error",
  })
  expect(findNodeHandle).toHaveBeenCalled()
  await screen.unmount()
  await act(async () => {
    await Promise.resolve()
  })
  expect(error).not.toHaveBeenCalled()
})

it("keeps the original combined scene hosts across all TimeValue owners and an Arabic locale change", async () => {
  const record = jest.fn()
  await render(<FieldInputSDKScene record={record} />)
  const originalHour = mockTargets.get("outer-hour")!,
    originalMinute = mockTargets.get("outer-minute")!,
    originalInner = mockTargets.get("inner-hour")!
  const value = (name = "outer") => JSON.parse(screen.getByTestId(`${name}-value`).props.accessibilityLabel)
  expect(value()).toMatchObject({ value: "13:45:00", valueClass: "Time", locale: "en-GB", direction: "ltr" })
  for (const [control, expectedValue, valueClass] of [
    ["calendar", "2024-10-01T13:45:07", "CalendarDateTime"],
    ["zoned", "2024-10-01T13:45:07-04:00[America/New_York]", "ZonedDateTime"],
    ["time", "13:45:07", "Time"],
  ]) {
    await fireEvent.press(screen.getByTestId(`field-sdk-${control}`))
    expect(value()).toMatchObject({ value: expectedValue, valueClass })
    expect(screen.getByTestId("outer-hour").props.displayText).toBe("13")
    expect(mockTargets.get("outer-hour")).toBe(originalHour)
    expect(mockTargets.get("outer-minute")).toBe(originalMinute)
    expect(value("inner")).toMatchObject({ value: "08:15:00", valueClass: "Time" })
    expect(mockTargets.get("inner-hour")).toBe(originalInner)
    await fireEvent.press(screen.getByTestId("field-sdk-locale"))
    expect(value()).toMatchObject({ value: expectedValue, valueClass, locale: "ar-EG", direction: "rtl" })
    expect(screen.getByTestId("outer-hour").props.displayText).toBe("١٣")
    expect(mockTargets.get("outer-hour")).toBe(originalHour)
    expect(mockTargets.get("outer-minute")).toBe(originalMinute)
    await fireEvent.press(screen.getByTestId("field-sdk-locale"))
  }
  await fireEvent.press(screen.getByTestId("field-sdk-empty"))
  expect(value()).toMatchObject({ value: null, valueClass: null })
  for (const id of ["outer-hour", "outer-minute"]) expect(screen.getByTestId(id).props.segmentPlaceholder).toBe(true)
  expect(screen.getByTestId("outer-press-tail").props.focusable).toBe(false)
  expect(mockTargets.get("outer-hour")).toBe(originalHour)
  expect(mockTargets.get("outer-minute")).toBe(originalMinute)
  expect(mockTargets.get("inner-hour")).toBe(originalInner)
  expect(value("inner")).toMatchObject({ value: "08:15:00", valueClass: "Time" })
  expect(record).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "value-request" }))
  expect(originalHour.setNativeProps).not.toHaveBeenCalled()
  expect(originalMinute.setNativeProps).not.toHaveBeenCalled()
})

it("retains ordinary core-editor callback signatures without using field acknowledgements", async () => {
  const record = jest.fn()
  await render(<FieldInputSDKScene record={record} />)
  const core = screen.getByTestId("outer-core-editor")
  const acknowledgements = jest.mocked(NativeDefaults!.settleField).mock.calls.length
  const key = { nativeEvent: { key: "7", target: 77 } }
  const focus = { nativeEvent: { target: 77 } }
  const change = { nativeEvent: { text: "7", target: 77, eventCount: 1 } }
  const selection = { nativeEvent: { target: 77, selection: { start: 1, end: 1 } } }
  await fireEvent(core, "keyPress", key)
  await fireEvent(core, "focus", focus)
  await fireEvent(core, "change", change)
  await fireEvent.changeText(core, "7")
  await fireEvent(core, "selectionChange", selection)
  expect(record).toHaveBeenCalledWith({ kind: "core-key", field: "outer", data: key.nativeEvent })
  expect(record).toHaveBeenCalledWith({ kind: "core-focus", field: "outer", data: focus.nativeEvent })
  expect(record).toHaveBeenCalledWith({ kind: "core-native-change", field: "outer", data: change.nativeEvent })
  expect(record).toHaveBeenCalledWith({ kind: "core-change", field: "outer", text: "7" })
  expect(record).toHaveBeenCalledWith({ kind: "core-selection", field: "outer", data: selection.nativeEvent })
  expect(jest.mocked(NativeDefaults!.settleField).mock.calls).toHaveLength(acknowledgements)
  await fireEvent.press(screen.getByTestId("field-sdk-checkpoint"))
  const receipt = record.mock.calls
    .map(([row]) => row)
    .filter((row) => row.kind === "native-receipts")
    .at(-1)!
  const summary = JSON.parse(screen.getByTestId("field-sdk-receipt-snapshot").props.accessibilityLabel)
  expect(summary.batch).toBe(receipt.batch)
  expect(summary.callbacks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "core-key", key: "7", token: null }),
      expect.objectContaining({ kind: "core-native-change", text: "7", token: null }),
      expect.objectContaining({ kind: "core-selection", selection: { start: 1, end: 1 }, token: null }),
    ]),
  )
})

it("connects the actual private TimePicker candidate to original segment and group phases", async () => {
  const rows: Record<string, unknown>[] = []
  await renderAdmittedScene((row) => rows.push(row))
  await act(() => fireEvent.press(screen.getByTestId("field-sdk-candidate")))
  await admitCurrentOriginals()
  const hour = screen
    .getAllByTestId(/^candidate-time-segment-/)
    .find((host) => typeof host.props.segmentId === "string" && host.props.segmentId.endsWith(":hour"))!
  const data = scenePacket("candidate", hour.props.testID, "down", 900)
  const down = originalFieldEvent({
    kind: "keyboard",
    ownerId: "original",
    target: data.identity.target,
    key: "ArrowUp",
    nativeCode: 82,
    characters: "",
    phase: "down",
    repeat: false,
    cancelled: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "0",
    nativeDefaultHandled: true,
    timestamp: 90,
    fieldDispatch: JSON.stringify(data),
  })
  await act(() => hour.props.onNativeFieldKey(down))
  for (const id of ["candidate-time-input", "candidate-time-group"]) {
    Object.assign(down, { currentTarget: mockTargets.get(id) })
    await act(() => screen.getByTestId(id).props.onNativeFieldKey(down))
  }
  const changes = rows.filter((row) => row.kind === "value-request" && row.field === "candidate")
  expect(changes).toHaveLength(1)
  expect(changes[0]).toMatchObject({ value: "14:45:07", held: "13:45:07", valueClass: "Time" })
  const callers = rows.filter((row) => row.kind === "field-key" && row.field === "candidate")
  expect(callers.map((row) => row.receiverTarget)).toEqual(data.groups.map((group) => group.target))
  expect(callers.every((row) => row.data === down.nativeEvent)).toBe(true)
  expect(JSON.parse(jest.mocked(NativeDefaults!.settleField).mock.calls.at(-1)![0])).toMatchObject({ current: true })
  const pointer = scenePacket("candidate", hour.props.testID, "pointer-end", 901)
  const up = originalFieldEvent({
    target: pointer.identity.target,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    fieldDispatch: JSON.stringify(pointer),
  })
  for (const id of ["candidate-time-input", "candidate-time-group", "candidate-time"]) {
    Object.assign(up, { currentTarget: mockTargets.get(id) })
    await act(() => screen.getByTestId(id).props.onPointerUp(up))
  }
  const rootCalls = rows.filter((row) => row.kind === "field-pointer" && row.field === "candidate")
  expect(rootCalls).toHaveLength(1)
  expect(rootCalls[0].data).toBe(up.nativeEvent)
})
