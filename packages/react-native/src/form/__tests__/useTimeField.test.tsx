import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, render, screen } from "@testing-library/react-native"
import { Activity, type Ref } from "react"
import type * as RN from "react-native"

import { FormValidationContext } from "../../components/ComboBox/state/useFormValidationState"
import type { TimeFieldStateOptions } from "../../date/state/useTimeFieldState"
import { useTimeFieldState } from "../../date/state/useTimeFieldState"
import type { TNativeFieldInputMetadata } from "../../input/fieldInputBinding"
import FormDocument from "../../input/specs/NativeCUIFormDocument"
import { NativeFormRegistryContext } from "../context"
import type { TNativeDateSegmentFormTarget } from "../dateSegments"
import { NativeFormRegistry } from "../registry"
import { useNativeTimeFieldForm } from "../useTimeField"

jest.mock("../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual("react")
    .forwardRef((props: object, ref: Ref<RN.View>) =>
      jest
        .requireActual("react")
        .createElement(jest.requireActual("react-native").View, { ...props, ref, testID: "time-field-metadata" }),
    ),
}))
jest.mock("../../input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: {
    bindField: jest.fn(async (encoded: string) => {
      const request = JSON.parse(encoded)
      return JSON.stringify({
        requestId: request.requestId,
        metadataTarget: request.mount.target,
        ownerToken: "owned-watch",
      })
    }),
    unbindField: jest.fn(async () => true),
  },
}))
beforeEach(() => jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockReturnValue(100))
afterEach(() => jest.restoreAllMocks())

const originals = () => ({
  root: {} as RN.View,
  rootTarget: 4,
  segments: ["hour", "minute"].map(
    (segmentId, index): TNativeDateSegmentFormTarget => ({
      original: {} as RN.View,
      identity: {
        ownerId: "time-owner",
        segmentId,
        target: 6 + index,
        bindingRevision: "wire:1",
        nativeInstance: `native:${index}`,
        surfaceId: 11,
        windowId: "window:1",
        epoch: 5,
      },
    }),
  ),
})
const setup = async (
  initial: Partial<TimeFieldStateOptions> = {},
  errors = {},
  semanticBinding = "",
  fieldInput?: TNativeFieldInputMetadata,
) => {
  const registry = new NativeFormRegistry(),
    original = originals()
  let actual: ReturnType<typeof originals> | null = original
  let state!: ReturnType<typeof useTimeFieldState>
  const Field = (props: Partial<TimeFieldStateOptions>) => {
    const stateProps: TimeFieldStateOptions & { name: string } = { locale: "en-GB", ...props, name: "clock" }
    state = useTimeFieldState(stateProps)
    return useNativeTimeFieldForm(
      { name: "clock", form: "form-id" },
      state,
      original,
      () => actual,
      () => true,
      semanticBinding,
      fieldInput,
    )
  }
  const content = (props: typeof initial, mode: "hidden" | "visible" = "visible") => (
    <NativeFormRegistryContext.Provider value={registry}>
      <FormValidationContext.Provider value={errors}>
        <Activity mode={mode}>
          <Field {...props} />
        </Activity>
      </FormValidationContext.Provider>
    </NativeFormRegistryContext.Provider>
  )
  const view = await render(content(initial))
  return {
    registry,
    view,
    original,
    state: () => state,
    field: () => [...registry.fields.values()][0],
    update: (props: typeof initial, mode?: "hidden" | "visible") => view.rerender(content(props, mode)),
    replace: (value: typeof actual) => {
      actual = value
    },
  }
}

it("starts and retires a semantic watch only after an original complete-field mount acknowledgement", async () => {
  const bind = jest.mocked(FormDocument!.bindField),
    unbind = jest.mocked(FormDocument!.unbindField)
  bind.mockClear()
  unbind.mockClear()
  const value = await setup({}, {}, "date-semantic-frame")
  expect(bind).not.toHaveBeenCalled()
  const metadata = screen.getByTestId("time-field-metadata", { includeHiddenElements: true })
  const packet = {
    ownerId: metadata.props.ownerId,
    descriptorId: metadata.props.descriptorId,
    descriptorRevision: metadata.props.descriptorRevision,
    target: 100,
    originalTarget: 6,
    surfaceId: 11,
    windowId: "window:1",
    epoch: 5,
    sequence: 1,
    mountRevision: "mount:1",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "CUIDateSegment",
    error: "",
  }
  await act(async () => {
    metadata.props.onNativeFormCommit({ nativeEvent: packet })
    await Promise.resolve()
  })
  expect(bind).toHaveBeenCalledTimes(1)
  expect(JSON.parse(bind.mock.calls[0][0])).toMatchObject({ semanticBinding: "date-semantic-frame", mount: packet })
  await value.view.unmount()
  await act(async () => {
    await Promise.resolve()
  })
  expect(unbind).toHaveBeenCalledWith(JSON.stringify({ metadataTarget: 100, ownerToken: "owned-watch" }))
})

it("rejects semantic binding when a non-primary original changes before the mount receipt", async () => {
  const bind = jest.mocked(FormDocument!.bindField)
  bind.mockClear()
  const value = await setup({}, {}, "date-semantic-frame")
  value.replace({
    ...value.original,
    segments: [value.original.segments[0], { ...value.original.segments[1], original: {} as RN.View }],
  })
  const metadata = screen.getByTestId("time-field-metadata", { includeHiddenElements: true })
  await act(async () => {
    metadata.props.onNativeFormCommit({
      nativeEvent: {
        ownerId: metadata.props.ownerId,
        descriptorId: metadata.props.descriptorId,
        descriptorRevision: metadata.props.descriptorRevision,
        target: 100,
        originalTarget: 6,
        surfaceId: 11,
        windowId: "window:1",
        epoch: 5,
        sequence: 1,
        mountRevision: "mount:1",
        attached: true,
        active: true,
        complete: true,
        metadataOnly: true,
        originalClass: "CUIDateSegment",
        error: "",
      },
    })
    await Promise.resolve()
  })
  expect(bind).not.toHaveBeenCalled()
  await value.view.unmount()
})
it.each([
  new Time(13, 45),
  new CalendarDateTime(2024, 10, 1, 13, 45),
  parseZonedDateTime("2024-10-01T13:45[America/New_York]"),
])("registers one field and preserves source time-only serialization for %s", async (owner) => {
  const value = await setup({ value: owner })
  expect(value.registry.fields.size).toBe(1)
  expect(value.field().data.entries).toEqual([["clock", "13:45:00"]])
  expect(value.field().editor()).toBe(value.original.segments[0].original)
  expect(JSON.parse(value.field().descriptor.ownedEditorBinding!)).toMatchObject({
    rootTarget: 4,
    segments: value.original.segments.map((row) => row.identity),
  })
  await value.view.unmount()
  expect(value.registry.fields.size).toBe(0)
})
it("requests class-preserving controlled reset through the latest callback without changing the owner", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const initial = new CalendarDateTime(2024, 10, 1, 13, 45),
    held = new CalendarDateTime(2025, 2, 2, 18, 20)
  const props = { value: held, defaultValue: initial }
  const value = await setup({ ...props, onChange: first })
  const binding = value.field()
  await value.update({ ...props, onChange: latest })
  expect(value.field()).toBe(binding)
  await act(() => value.field().reset("programmatic"))
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
  expect(latest.mock.calls[0][0]).toBeInstanceOf(CalendarDateTime)
  expect(latest.mock.calls[0][0].toString()).toBe(initial.toString())
  expect(value.state().timeValue.toString()).toBe("18:20:00")
  expect(value.field().editor()).toBe(value.original.segments[0].original)
})
it("retains programmatic server errors and clears them only for a native reset", async () => {
  const value = await setup({}, { clock: "Server says no" })
  await act(() => value.field().reset("programmatic"))
  expect(value.state().displayValidation.validationErrors).toEqual(["Server says no"])
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.validationErrors).toEqual([])
})
it("commits readonly required validation without changing segment interaction or requesting an owner value", async () => {
  const changed = jest.fn(),
    value = await setup({ value: null, isReadOnly: true, isRequired: true, onChange: changed })
  expect(value.field().data.isReadOnly).toBe(false)
  await act(() => value.field().commitValidation())
  expect(value.state().displayValidation).toMatchObject({ isInvalid: true, validationDetails: { valueMissing: true } })
  expect(value.state().isReadOnly).toBe(true)
  expect(changed).not.toHaveBeenCalled()
})
it("retires physical authority when any original or its identity changes, including non-primary segments", async () => {
  const value = await setup({ value: new Time(13, 45) })
  const field = value.field()
  for (const actual of [
    { ...value.original, root: {} as RN.View },
    { ...value.original, segments: [value.original.segments[0]] },
    {
      ...value.original,
      segments: [value.original.segments[0], { ...value.original.segments[1], original: {} as RN.View }],
    },
    {
      ...value.original,
      segments: [
        value.original.segments[0],
        { ...value.original.segments[1], identity: { ...value.original.segments[1].identity, epoch: 6 } },
      ],
    },
  ]) {
    value.replace(actual)
    expect(field.editor()).toBeNull()
    expect(field.isFocusObserved()).toBe(false)
  }
})
it("disconnects reset listeners in retained hidden Activity content and rejects malformed mount packets", async () => {
  const changed = jest.fn(),
    props = { value: new Time(18, 20), defaultValue: new Time(13, 45), onChange: changed }
  const value = await setup(props)
  const host = value.view.container.queryAll((node) => typeof node.props.editorTarget === "number")[0]
  for (const packet of [undefined, null, [], {}])
    await act(() => host.props.onNativeFormCommit({ nativeEvent: packet }))
  expect(value.field().mount()?.getSnapshot() ?? null).toBeNull()
  await value.update(props, "hidden")
  expect(value.registry.fields.size).toBe(1)
  await act(() => value.field().reset("native"))
  expect(changed).not.toHaveBeenCalled()
  await value.update(props, "visible")
  await act(() => value.field().reset("native"))
  expect(changed).toHaveBeenCalledTimes(1)
})

it("clears native reset validation after an owner queues validation during the value request", async () => {
  const currentState: { value?: ReturnType<typeof useTimeFieldState> } = {}
  const value = await setup({
    value: new Time(18, 20),
    defaultValue: new Time(13, 45),
    validationBehavior: "native",
    validate: () => "Still invalid",
    onChange: () => currentState.value?.commitValidation(),
  })
  currentState.value = value.state()
  expect(currentState.value.displayValidation.isInvalid).toBe(false)
  await act(() => value.field().reset("native"))
  expect(value.state().displayValidation.isInvalid).toBe(false)
  expect(value.state().displayValidation.validationErrors).toEqual([])
})

it("composes the private field input declaration and original mount/record callbacks with existing form ownership", async () => {
  const binding = jest.fn((ownerId: string) => JSON.stringify({ ownerId, bindingId: "private-group" })),
    commit = jest.fn(),
    receive = jest.fn(),
    record = jest.fn()
  const value = await setup({}, {}, "", { binding, commit, receive, record })
  const metadata = screen.getByTestId("time-field-metadata", { includeHiddenElements: true })
  expect(JSON.parse(metadata.props.fieldGroupBinding)).toEqual({
    ownerId: metadata.props.ownerId,
    bindingId: "private-group",
  })
  const packet = {
    ownerId: metadata.props.ownerId,
    descriptorId: metadata.props.descriptorId,
    descriptorRevision: metadata.props.descriptorRevision,
    target: 100,
    originalTarget: 6,
    surfaceId: 11,
    windowId: "window:1",
    epoch: 5,
    sequence: 1,
    mountRevision: "mount:1",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "CUIDateSegment",
    error: "",
  }
  await act(() => metadata.props.onNativeFormCommit({ nativeEvent: packet }))
  expect(commit).toHaveBeenCalledWith(packet)
  const original = { nativeEvent: { record: "original-native-record" } }
  await act(() => metadata.props.onNativeFieldInputRecord(original))
  expect(receive).toHaveBeenCalledWith(original)
  expect(record).toHaveBeenCalledWith(original)
  expect(receive.mock.invocationCallOrder[0]).toBeLessThan(record.mock.invocationCallOrder[0])
  expect(value.field().descriptor.ownedEditorBinding).toBe(metadata.props.ownedEditorBinding)
})
