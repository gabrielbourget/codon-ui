import "../../collection/__tests__/nativeReceipts"

import { act, screen, userEvent } from "@testing-library/react-native"
import type { Ref } from "react"
import type { View } from "react-native"

import { confirmNativeCollections, flushNativeCollectionActions } from "../../collection/__tests__/nativeReceipts"
import { packet, keyPacket } from "../input/__tests__/packet"
import type { TNativeDateSegmentKeyEvent } from "../input/NativeDateSegment"

const mockTargets = new Map<string, { nativeTag: number; focus: () => void; setNativeProps: () => void }>()
const mockActors = new Map<string, { nativeTag: number; focus: () => void; setNativeProps: () => void }>()
const mockActionStatuses = new Map<number, Record<string, unknown>>()
let mockTags = 100
jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({
      _nativeTag: ++mockTags,
      get nativeTag(): number {
        return this._nativeTag
      },
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
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestCollectionFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
jest.mock("../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react").forwardRef((props: Record<string, unknown>, ref: Ref<View>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const [original] = React.useState(() => ({
      _nativeTag: ++mockTags,
      get nativeTag(): number {
        return this._nativeTag
      },
      focus: jest.fn(),
      setNativeProps: jest.fn(),
    }))
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
    const [original] = React.useState(() => ({
      _nativeTag: ++mockTags,
      get nativeTag(): number {
        return this._nativeTag
      },
      focus: jest.fn(),
      setNativeProps: jest.fn(),
    }))
    React.useImperativeHandle(ref, () => original as unknown as View, [original])
    mockTargets.set(testID, original)
    return React.createElement(jest.requireActual("react-native").View, { ...props, testID })
  }),
}))
jest.mock("../../input/specs/CUIKeyboardScopeNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

jest.mock("../../input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: {
    admitForm: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded)
      const registry =
        jest.requireActual<typeof import("../../form/registry")>("../../form/registry").nativeFormRegistry
      const form = registry.forms.get(request.form?.descriptorId)
      const fields = form ? registry.fieldsFor(form) : []
      const lease = mockActionStatuses.get(request.actionLease?.target)
      const keys =
        jest.requireActual<typeof import("../../form/actionLease")>(
          "../../form/actionLease",
        ).NATIVE_FORM_ACTION_LEASE_KEYS
      const accepted = !!(
        form &&
        form.current() === form.original &&
        JSON.stringify(request.form) === JSON.stringify(form.descriptor) &&
        request.formMount?.active &&
        JSON.stringify(request.formMount) === JSON.stringify(form.mount()?.getSnapshot()) &&
        lease &&
        keys.every((key) => request.actionLease[key] === lease[key]) &&
        request.actionLease.windowId === request.formMount.windowId &&
        request.actionLease.surfaceId === request.formMount.surfaceId &&
        Array.isArray(request.fields) &&
        request.fields.length === fields.length &&
        request.fields.every(
          (
            entry: { field: unknown; mount?: { active: boolean; windowId: string; surfaceId: number } },
            index: number,
          ) =>
            entry.mount?.active &&
            JSON.stringify(entry.field) === JSON.stringify(fields[index].descriptor) &&
            JSON.stringify(entry.mount) === JSON.stringify(fields[index].mount()?.getSnapshot()) &&
            entry.mount.windowId === request.formMount.windowId &&
            entry.mount.surfaceId === request.formMount.surfaceId,
        )
      )
      return JSON.stringify({
        accepted,
        requestId: request.requestId,
        formRevision: request.form?.descriptorRevision,
      })
    }),
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
  mockActors.clear()
  mockTargets.clear()
  mockActionStatuses.clear()
  const otherTags = new WeakMap<object, number>()
  let nextOtherTag = 70000000
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const prior = jest.spyOn(native, "findNodeHandle").getMockImplementation()
  jest.spyOn(native, "findNodeHandle").mockImplementation((target: unknown) => {
    const owned = (target as { nativeTag?: number } | null)?.nativeTag
    if (!target || typeof target !== "object") return null
    const reserved = prior?.(target as View)
    if (owned) {
      if (reserved !== owned) throw new Error("Temporal original ref was not registered at its RN native tag")
      return owned
    }
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
let nextActivation = 1000
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
    if (!props.ownedEditorBinding || !props.onNativeFormCommit) continue
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
  const registry = jest.requireActual<typeof import("../../form/registry")>("../../form/registry").nativeFormRegistry
  for (const form of registry.forms.values()) {
    const descriptor = form.descriptor
    const metadata = screen.container.queryAll(
      (node) =>
        node.props.descriptorId === descriptor.descriptorId && typeof node.props.onNativeFormCommit === "function",
    )[0]
    if (!metadata) throw new Error("Original temporal form metadata missing")
    await act(() =>
      metadata.props.onNativeFormCommit({
        nativeEvent: {
          ...descriptor,
          target: descriptor.metadataTarget,
          originalTarget: descriptor.target,
          surfaceId: 11,
          windowId: "window:1",
          epoch: 1,
          sequence: ++commitSequence,
          mountRevision: descriptor.descriptorRevision,
          attached: true,
          active: true,
          complete: true,
          metadataOnly: true,
          originalClass: "View",
          error: "",
        },
      }),
    )
  }
}
export const temporalKey = async (fieldID: string, part: string, key = "ArrowUp", dispatch = true) => {
  const segment = screen
    .getAllByTestId(new RegExp(`^${fieldID}-segment-`), hidden)
    .find((node) => typeof node.props.segmentId === "string" && node.props.segmentId.endsWith(":" + part))
  if (!segment) throw new Error("Missing actual temporal segment " + fieldID + ":" + part)
  const props = segment.props
  const original = temporalTarget(props.testID)
  const identity = `${props.ownerId}:${props.bindingRevision}`
  const sequence = (nativeSequences.get(identity) ?? 0) + 1
  nativeSequences.set(identity, sequence)
  let prevented = false,
    stopped = false
  const event = {
    target: original,
    currentTarget: original,
    nativeEvent: keyPacket({
      ownerId: props.ownerId,
      segmentId: props.segmentId,
      bindingRevision: props.bindingRevision,
      target: original.nativeTag,
      nativeInstance: `segment:${props.testID}`,
      surfaceId: 11,
      windowId: "window:1",
      epoch: 1,
      sequence,
      key,
    }),
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
  } as unknown as TNativeDateSegmentKeyEvent
  if (dispatch) await deliverTemporalKey(event)
  return event
}

export const deliverTemporalKey = async (event: TNativeDateSegmentKeyEvent) => {
  const entry = [...mockTargets].find(([, original]) => original.nativeTag === event.nativeEvent.target)
  if (!entry) return
  const segment = screen.getByTestId(entry[0], hidden)
  await act(() => segment.props.onNativeDateKey(event))
  let ancestor = segment.parent
  while (ancestor && !event.isPropagationStopped()) {
    const original = mockTargets.get(ancestor.props.testID) ?? mockActors.get(ancestor.props.ownerId)
    if (ancestor.type === "View" && original && typeof ancestor.props.onNativeDateKey === "function") {
      Object.assign(event, { currentTarget: original })
      const receive = ancestor.props.onNativeDateKey
      await act(() => receive(event))
    }
    ancestor = ancestor.parent
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
        activationId: ++nextActivation,
        scopeOwnerId: host.ownerId,
        windowId: "window:1",
        epoch: 1,
      },
    }),
  )
}
