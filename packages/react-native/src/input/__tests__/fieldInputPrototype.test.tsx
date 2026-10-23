import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ComponentType, Ref } from "react"
import { findNodeHandle, type View } from "react-native"

import { packet } from "../../date/input/__tests__/packet"
import type { TNativeFieldKeyEvent } from "../fieldInput"
import NativeDefaults from "../specs/NativeCUIEditorKeyboardDefaults"
import NativeDocument from "../specs/NativeCUIFormDocument"

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
  },
}))
afterEach(() => jest.restoreAllMocks())

it("connects original segment entry, group callers and native binding lifetime without replacing roots on a valid value echo", async () => {
  jest
    .spyOn(jest.requireActual("react-native"), "findNodeHandle")
    .mockImplementation((target: unknown) => (target as { nativeTag?: number })?.nativeTag ?? 999)
  const error = jest.spyOn(console, "error"),
    record = jest.fn()
  await render(<FieldInputSDKScene record={record} />)
  for (const name of ["outer-hour", "outer-minute", "inner-hour", "inner-minute"]) {
    const host = screen.getByTestId(name),
      props = host.props
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
  expect(JSON.parse(screen.getByTestId("outer-binding").props.accessibilityLabel)).toMatchObject({
    ready: true,
    error: "",
  })
  const target = mockTargets.get("outer-hour")!,
    originalFocus = target.focus
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
  expect(record.mock.calls.map(([row]) => row.kind)).toEqual(["segment-key", "value-request", "field-key", "field-key"])
  expect(record.mock.calls[1][0]).toMatchObject({ held: "13:45:00", value: "14:45:00" })
  expect(record.mock.calls[2][0].data).toBe(event.nativeEvent)
  expect(record.mock.calls[3][0].data).toBe(event.nativeEvent)
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
  expect(record).toHaveBeenCalledWith({ kind: "native-receipts", records: [], dropped: 0 })
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
    records: [
      { kind: "key", scopeCurrent: false, originalDefaultPrevented: true, renderPhasesComplete: true, after: null },
    ],
    dropped: 0,
  })
  expect(findNodeHandle).toHaveBeenCalled()
  await screen.unmount()
  await act(async () => {
    await Promise.resolve()
  })
  expect(error).not.toHaveBeenCalled()
})
