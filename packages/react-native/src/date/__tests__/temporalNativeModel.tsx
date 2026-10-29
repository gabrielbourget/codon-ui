import "../../collection/__tests__/nativeReceipts"

import { act, screen, userEvent } from "@testing-library/react-native"
import type { Ref } from "react"
import type { View } from "react-native"

import { confirmNativeCollections, flushNativeCollectionActions } from "../../collection/__tests__/nativeReceipts"
import type { TNativeFieldInputPacket, TNativeFieldKeyEvent } from "../../input/fieldInput"
import { packet } from "../input/__tests__/packet"

const mockTargets = new Map<string, { nativeTag: number; focus: () => void; setNativeProps: () => void }>()
const mockActors = new Map<string, { nativeTag: number; focus: () => void; setNativeProps: () => void }>()
const mockActionStatuses = new Map<number, Record<string, unknown>>()
const mockBindingStatuses = new Map<number, Record<string, unknown>>()
let mockTags = 100
jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({
      nativeTag: ++mockTags,
      focus: jest.fn(),
      setNativeProps: jest.fn(),
      measureInWindow: jest.fn((receive: (x: number, y: number, width: number, height: number) => void) =>
        receive(20, 80, 340, String(props.testID).includes("popover") ? 400 : 44),
      ),
    }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    if (props.testID) mockTargets.set(String(props.testID), original)
    if (props.ownerId) mockActors.set(String(props.ownerId), original)
    return React.createElement(jest.requireActual("react-native").View, props)
  }),
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
jest.mock("../../input/specs/CUIDateSegmentNativeComponent", () => ({
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
jest.mock("../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react"),
      testID = `metadata:${props.ownerId}`
    const [original] = React.useState(() => ({ nativeTag: ++mockTags, focus: jest.fn(), setNativeProps: jest.fn() }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    mockTargets.set(testID, original)
    React.useLayoutEffect(() => {
      const previous = mockBindingStatuses.get(original.nativeTag)
      if (!previous || !props.fieldGroupBinding) return
      const declaration = JSON.parse(String(props.fieldGroupBinding))
      const status = {
        ...previous,
        bindingRevision: declaration.bindingRevision,
        generation: Number(previous.generation) + 1,
        ready: true,
        error: "",
      }
      mockBindingStatuses.set(original.nativeTag, status)
      const receive = props.onNativeFieldInputRecord as
        | undefined
        | ((mockEvent: { nativeEvent: { record: string } }) => void)
      receive?.({ nativeEvent: { record: JSON.stringify(status) } })
    }, [props.fieldGroupBinding, original])
    return React.createElement(jest.requireActual("react-native").View, { ...props, testID })
  }),
}))
jest.mock("../../input/specs/CUIKeyboardScopeNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../input/specs/NativeCUIEditorKeyboardDefaults", () => ({
  __esModule: true,
  default: {
    getLease: () => "module:1",
    acceptsField: jest.fn(() => true),
    settleField: jest.fn(() => true),
    moveFieldFocus: jest.fn(),
    takeFieldRecords: jest.fn(() => JSON.stringify({ records: [], dropped: 0 })),
  },
}))
jest.mock("../../input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: {
    getSnapshot: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded)
      const registry =
        jest.requireActual<typeof import("../../form/registry")>("../../form/registry").nativeFormRegistry
      const form = [...registry.forms.values()][0]
      if (!form) throw new Error("Missing actual temporal form")
      const nodes: { target: number; parent: number; component: string; dateSegmentOwner?: string }[] = [
        { target: 9000000, parent: 0, component: "RootView" },
        { target: form.descriptor.target, parent: 9000000, component: "View" },
        { target: form.descriptor.metadataTarget, parent: form.descriptor.target, component: "CUIFormRoot" },
        { target: request.target, parent: form.descriptor.target, component: "CUIFocusView" },
      ]
      const fields = [...registry.fields.values()].map(({ descriptor }) => {
        if (descriptor.ownedEditorBinding) {
          const binding = jest
            .requireActual<typeof import("../../form/dateSegments")>("../../form/dateSegments")
            .decodeNativeDateFieldBinding(descriptor.ownedEditorBinding)
          nodes.push({ target: binding.rootTarget, parent: form.descriptor.target, component: "CUIFocusView" })
          for (const group of binding.groups ?? []) {
            nodes.push({ target: group.target, parent: binding.rootTarget, component: "CUIFocusView" })
            for (const segmentId of group.segmentIds) {
              const segment = binding.segments.find((item) => item.segmentId === segmentId)!
              nodes.push({
                target: segment.target,
                parent: group.target,
                component: "CUIDateSegment",
                dateSegmentOwner: segment.ownerId,
              })
            }
          }
          nodes.push({ target: descriptor.metadataTarget, parent: binding.rootTarget, component: "CUIFieldBinding" })
        } else {
          nodes.push({ target: descriptor.target, parent: form.descriptor.target, component: "TextInput" })
          nodes.push({
            target: descriptor.metadataTarget,
            parent: form.descriptor.target,
            component: "CUIFieldBinding",
          })
        }
        return { ...descriptor, position: nodes.length - 1 }
      })
      const documentId = "temporal-source-model",
        revision = "1"
      return JSON.stringify({
        ...request,
        documentId,
        revision,
        rootTarget: 9000000,
        surfaceId: 11,
        nodes: nodes.map((node) => ({ ...node, hidden: false, displayNone: false })),
        forms: [{ ...form.descriptor, position: 2 }],
        fields,
        ...(request.actionAdmission
          ? {
              actionAdmission: {
                accepted: true,
                lease: mockActionStatuses.get(request.target),
                documentId,
                revision,
                formDescriptorId: form.descriptor.descriptorId,
                formDescriptorRevision: form.descriptor.descriptorRevision,
              },
            }
          : {}),
      })
    }),
    bindFieldInput: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded),
        declaration = JSON.parse(request.fieldGroupBinding)
      const status = {
        kind: "binding-status",
        requestId: request.requestId,
        ownerToken: `owner:${request.requestId}`,
        metadataTarget: request.mount.target,
        ownerId: request.mount.ownerId,
        moduleLease: declaration.moduleLease,
        bindingId: declaration.bindingId,
        bindingRevision: declaration.bindingRevision,
        generation: 1,
        ready: true,
        error: "",
      }
      mockBindingStatuses.set(request.mount.target, status)
      return JSON.stringify({
        requestId: request.requestId,
        ownerToken: status.ownerToken,
        metadataTarget: request.mount.target,
        status,
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
  mockBindingStatuses.clear()
  mockActors.clear()
  mockTargets.clear()
  mockActionStatuses.clear()
  const otherTags = new WeakMap<object, number>()
  let nextOtherTag = 70000000
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const prior = jest.spyOn(native, "findNodeHandle").getMockImplementation()
  jest.spyOn(native, "findNodeHandle").mockImplementation((target: unknown) => {
    const owned = (target as { nativeTag?: number } | null)?.nativeTag
    if (owned) return owned
    if (!target || typeof target !== "object") return null
    const reserved = prior?.(target as View)
    if (typeof reserved === "number" && reserved >= 1000000 && reserved < 70000000) return reserved
    if (!otherTags.has(target)) otherTags.set(target, ++nextOtherTag)
    return otherTags.get(target)!
  })
})
afterEach(() => jest.restoreAllMocks())

export const temporalTarget = (name: string) => {
  const value = mockTargets.get(name)
  if (!value) throw new Error("Missing original temporal native model ref: " + name)
  return value
}
const hidden = { includeHiddenElements: true }
const nativeSequences = new Map<string, number>()
let commitSequence = 0
let nextInput = 1000
export const admitTemporal = async () => {
  await confirmNativeCollections()
  await flushNativeCollectionActions()
  for (const scope of screen.container.queryAll((node) => typeof node.props.onNativeScopeStatus === "function")) {
    for (let turn = 0; turn < 8; turn++) {
      const host = scope.props,
        revision = host.policyRevision
      await act(() =>
        host.onNativeScopeStatus({
          nativeEvent: {
            ownerId: host.ownerId,
            windowId: "window:1",
            epoch: 1,
            policyRevision: revision,
            ready: true,
            windowActive: true,
          },
        }),
      )
      if (scope.props.policyRevision === revision) break
      if (turn === 7) throw new Error("Temporal native policy did not settle")
    }
  }
  for (const host of screen.container.queryAll(
    (node) => typeof node.props.segmentId === "string" && typeof node.props.onNativeSegmentInput === "function",
  )) {
    const props = host.props,
      key = `${props.ownerId}:${props.bindingRevision}`
    const sequence = (nativeSequences.get(key) ?? 0) + 1
    nativeSequences.set(key, sequence)
    await act(() =>
      props.onNativeSegmentInput({
        nativeEvent: packet({
          ownerId: props.ownerId,
          segmentId: props.segmentId,
          bindingRevision: props.bindingRevision,
          target: temporalTarget(props.testID).nativeTag,
          nativeInstance: `segment:${props.testID}`,
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence,
        }),
      }),
    )
  }
  for (const metadata of screen.queryAllByTestId(/^metadata:/, hidden)) {
    const props = metadata.props
    if (!props.fieldGroupBinding || !props.onNativeFormCommit) continue
    await act(async () => {
      props.onNativeFormCommit({
        nativeEvent: {
          ownerId: props.ownerId,
          descriptorId: props.descriptorId,
          descriptorRevision: props.descriptorRevision,
          target: temporalTarget(props.testID).nativeTag,
          originalTarget: props.editorTarget,
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence: ++commitSequence,
          mountRevision: "mount:1",
          active: true,
          attached: true,
          complete: true,
          metadataOnly: true,
          originalClass: "CUIDateSegment",
          error: "",
          timeStamp: 123.5,
        },
      })
      await Promise.resolve()
    })
  }
}
export const temporalKey = async (fieldID: string, part: string, key = "ArrowUp", dispatch = true) => {
  const segment = screen
    .getAllByTestId(new RegExp(`^${fieldID}-segment-`), hidden)
    .find((node) => typeof node.props.segmentId === "string" && node.props.segmentId.endsWith(":" + part))
  if (!segment) throw new Error("Missing actual temporal segment " + fieldID + ":" + part)
  const target = temporalTarget(segment.props.testID).nativeTag
  const ancestorTargets = new Set<number>()
  let ancestor = segment.parent
  while (ancestor) {
    const original = mockTargets.get(ancestor.props.testID) ?? mockActors.get(ancestor.props.ownerId)
    if (original) ancestorTargets.add(original.nativeTag)
    ancestor = ancestor.parent
  }
  const metadata = screen.getAllByTestId(/^metadata:/, hidden).find((node) => {
    if (!node.props.fieldGroupBinding) return false
    const declaration = JSON.parse(node.props.fieldGroupBinding)
    return node.props.editorTarget === target || ancestorTargets.has(declaration.inputTarget)
  })
  if (!metadata) throw new Error("Missing actual temporal field metadata")
  const binding = JSON.parse(metadata.props.fieldGroupBinding)
  const token = ++nextInput
  const data: TNativeFieldInputPacket = {
    moduleLease: "module:1",
    token,
    eventId: token,
    phase: "down",
    groups: [binding.inputTarget, binding.outerTarget].map((tag: number) => ({
      target: tag,
      bindingId: binding.bindingId,
      bindingRevision: binding.bindingRevision,
      scopeTarget: binding.outerTarget,
      containsTarget: true,
    })),
    identity: {
      ownerId: metadata.props.ownerId,
      bindingId: binding.bindingId,
      bindingRevision: binding.bindingRevision,
      metadataTarget: temporalTarget(metadata.props.testID).nativeTag,
      outerTarget: binding.outerTarget,
      inputTarget: binding.inputTarget,
      surfaceId: 11,
      target,
      documentId: "document:1",
      documentRevision: "7",
      windowId: "window:1",
      mountRevision: "mount:1",
      outerInstance: fieldID + ":outer",
      inputInstance: fieldID + ":input",
      nativeInstance: segment.props.testID,
      editorInstance: segment.props.testID,
      epoch: 1,
    },
  }
  let prevented = false,
    stopped = false
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: "original",
      target,
      key,
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
      timestamp: token,
      fieldDispatch: JSON.stringify(data),
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
  } as unknown as TNativeFieldKeyEvent
  if (dispatch) await deliverTemporalKey(event)
  return event
}

export const deliverTemporalKey = async (event: TNativeFieldKeyEvent) => {
  const data = JSON.parse(event.nativeEvent.fieldDispatch) as TNativeFieldInputPacket
  const entry = [...mockTargets].find(([, original]) => original.nativeTag === data.identity.target)
  if (!entry) throw new Error("Missing original temporal segment")
  const segment = screen.getByTestId(entry[0], hidden)
  await act(() => segment.props.onNativeFieldKey(event))
  for (const group of data.groups) {
    const entry = [...mockTargets].find(([, original]) => original.nativeTag === group.target)
    const actor = [...mockActors].find(([, original]) => original.nativeTag === group.target)
    const original = entry?.[1] ?? actor?.[1]
    if (!original) throw new Error("Missing original temporal ancestor")
    const host = entry
      ? screen.getByTestId(entry[0], hidden)
      : screen.container.queryAll(
          (node) => node.props.ownerId === actor![0] && typeof node.props.onNativeFieldKey === "function",
        )[0]
    if (!host) throw new Error("Missing actual temporal ancestor receiver")
    Object.assign(event, { currentTarget: original })
    await act(() => host.props.onNativeFieldKey(event))
  }
}

export const temporalPress = async (name: string) => {
  const node = screen.getByRole("button", { name, ...hidden })
  if (typeof node.props.onNativeActivation !== "function") return userEvent.setup().press(node)
  let scope = node.parent
  while (scope && !scope.props.onNativeScopeStatus) scope = scope.parent
  if (!scope) throw new Error("Actual temporal action scope missing")
  for (let turn = 0; turn < 8; turn++) {
    const host = scope.props,
      revision = host.policyRevision
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "window:1",
          epoch: 1,
          policyRevision: revision,
          ready: true,
          windowActive: true,
        },
      }),
    )
    if (scope.props.policyRevision === revision) break
  }
  const original = mockActors.get(node.props.ownerId)
  if (!original) throw new Error("Original temporal action ref missing")
  const host = scope.props
  if (node.props.nativeFormActionBinding) {
    const status = {
      ...JSON.parse(node.props.nativeFormActionBinding),
      viewOwnerId: node.props.ownerId,
      target: original.nativeTag,
      surfaceId: 11,
      windowId: "window:1",
      epoch: 1,
      sequence: ++commitSequence,
      scopeOwnerId: host.ownerId,
      scopeEpoch: 1,
      attached: true,
      active: true,
      enabled: true,
    }
    mockActionStatuses.set(original.nativeTag, status)
    await act(() => node.props.onNativeFormActionStatus({ nativeEvent: status }))
  }
  await act(() =>
    node.props.onNativeActivation({
      nativeEvent: {
        kind: "activation",
        source: "ios-accessibility-activate",
        ownerId: node.props.ownerId,
        target: original.nativeTag,
        observedAt: 0,
        activationId: ++nextInput,
        scopeOwnerId: host.ownerId,
        windowId: "window:1",
        epoch: 1,
      },
    }),
  )
}
