import "../../../collection/__tests__/nativeReceipts"

import { createRef, type ReactNode } from "react"
import type { View } from "react-native"
import { TextInput } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeThemeProvider } from "../../../theme"
import { NativeComboBoxGroup, type TNativeComboBoxGroupRenderState } from "../CollectionComboBoxGroup"
import { NativeComboBoxGroupContext } from "../collectionContext"

const wrap = (children: ReactNode) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost testID="window">{children}</NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const native = jest.requireActual<typeof import("react-native")>("react-native")
beforeEach(() => {
  jest.useFakeTimers()
  const original = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let next = 900000
  jest.mocked(native.findNodeHandle).mockImplementation((target) => {
    const inherited = original(target)
    if (inherited) return inherited
    if (!target || typeof target !== "object") return null
    if (!targets.has(target)) targets.set(target, ++next)
    return targets.get(target)!
  })
})
afterEach(() => {
  jest.clearAllTimers()
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const host = () => screen.getByTestId("window").props
const ready = async () => {
  for (const ready of [false, true])
    await act(() =>
      host().onNativeScopeStatus({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "physical-window",
          epoch: 1,
          policyRevision: host().policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
}
const within = async (
  target: number,
  focusedTarget: number,
  sequence: number,
  focused = true,
  textInputFocused = true,
) => {
  const props = screen.getByTestId("group").props
  const event = {
    nativeEvent: {
      ownerId: props.ownerId,
      bindingId: props.nativeFocusWithinBinding,
      target,
      surfaceId: 11,
      windowId: "physical-window",
      scopeOwnerId: host().ownerId,
      scopeEpoch: 1,
      sequence,
      attached: true,
      active: true,
      within: focused,
      focusedTarget: focused ? focusedTarget : 0,
      textInputFocused: focused && textInputFocused,
      origin: "pointer",
      observedAt: sequence,
    },
  }
  await act(() => props.onNativeFocusWithin(event))
  return event
}

it("composes default/named/null contexts and original group refs with complete render/style values", async () => {
  const inherited = createRef<View>(),
    caller = createRef<View>(),
    rendered = jest.fn(),
    styled = jest.fn()
  const view = await render(
    wrap(
      <NativeComboBoxGroupContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { nativeID: "default" },
            named: { ref: inherited, nativeID: "context", isInvalid: true, style: { padding: 9 } },
          },
        }}
      >
        <NativeComboBoxGroup testID="default" />
        <NativeComboBoxGroup
          slot="named"
          ref={caller}
          nativeID="caller"
          style={(state) => {
            styled(state)
            return { backgroundColor: "blue" }
          }}
          render={(props, state) => {
            rendered(state)
            return <NativeFocusHost {...props} testID="group" />
          }}
        >
          Child
        </NativeComboBoxGroup>
        <NativeComboBoxGroup slot={null} testID="isolated" />
      </NativeComboBoxGroupContext.Provider>,
    ),
  )
  await ready()
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current).not.toBeNull()
  expect(screen.getByTestId("group").props.nativeID).toBe("caller")
  expect(screen.getByTestId("default").props.nativeID).toBe("default")
  expect(screen.getByTestId("isolated").props.nativeID).toBeUndefined()
  expect(rendered.mock.calls.at(-1)?.[0]).toEqual({
    isHovered: false,
    isFocusWithin: false,
    isFocusVisible: false,
    isDisabled: false,
    isInvalid: true,
  })
  expect(styled.mock.calls.at(-1)?.[0].defaultStyle).toMatchObject({ padding: 9 })
  expect(screen.getByTestId("group")).toHaveStyle({ padding: 9, backgroundColor: "blue" })
  expect(screen.getByTestId("group").props.nativeFocusWithinBinding).not.toBe("")
  await view.unmount()
  expect([caller.current, inherited.current]).toEqual([null, null])
})

it("forwards a bubbled original focus event while waiting for actual physical descendant metadata", async () => {
  const group = createRef<View>(),
    input = createRef<TextInput>(),
    focus = jest.fn(),
    states: TNativeComboBoxGroupRenderState[] = []
  await render(
    wrap(
      <>
        <NativeComboBoxGroup ref={group} testID="group" onFocus={focus}>
          {(state) => {
            states.push(state)
            return "Group"
          }}
        </NativeComboBoxGroup>
        <TextInput ref={input} value="held" testID="external-editor" />
      </>,
    ),
  )
  await ready()
  const event = { nativeEvent: { target: native.findNodeHandle(input.current) } }
  await act(() => screen.getByTestId("group").props.onFocus(event))
  expect(focus.mock.calls).toEqual([[event]])
  expect(states.at(-1)?.isFocusWithin).toBe(false)
  await within(native.findNodeHandle(group.current)!, 0, 1, false)
  expect(states.at(-1)?.isFocusWithin).toBe(false)
  expect(screen.getByTestId("external-editor").props.value).toBe("held")
})

it("keeps pointer-origin text editing from enabling focus-visible until a current Escape observation", async () => {
  const group = createRef<View>(),
    input = createRef<TextInput>(),
    focus = jest.fn(),
    states: TNativeComboBoxGroupRenderState[] = []
  await render(
    wrap(
      <NativeComboBoxGroup ref={group} testID="group" onFocus={focus}>
        {(state) => {
          states.push(state)
          return <TextInput ref={input} testID="editor" value="held" />
        }}
      </NativeComboBoxGroup>,
    ),
  )
  await ready()
  const original = { nativeEvent: { target: native.findNodeHandle(input.current) } }
  await act(() => screen.getByTestId("group").props.onFocus(original))
  const groupTag = native.findNodeHandle(group.current)!,
    inputTag = native.findNodeHandle(input.current)!
  await within(groupTag, inputTag, 1)
  expect(states.at(-1)).toMatchObject({ isFocusWithin: true, isFocusVisible: false })
  for (let attempt = 0; attempt < 2; attempt++)
    await act(() =>
      host().onNativeObservationStatus({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "physical-window",
          epoch: 1,
          observationRevision: host().observationRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
  const registration = host().observations.find((entry: { targetTag: number }) => entry.targetTag === groupTag)
  let eventId = 0
  const key = async (key: string, target = inputTag) =>
    act(() =>
      host().onNativeObservedKey({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "physical-window",
          epoch: 1,
          observationRevision: host().observationRevision,
          observerIds: [registration.id],
          eventId: ++eventId,
          focusedTarget: target,
          target,
          key,
          code: key,
          cancelled: false,
          isComposing: false,
          repeat: false,
          timestamp: eventId,
        },
      }),
    )
  await key("a")
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  await key("Escape", inputTag + 1)
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  await key("Escape")
  expect(states.at(-1)?.isFocusVisible).toBe(true)
  expect(focus.mock.calls).toEqual([[original]])
  expect(screen.getByTestId("editor").props.value).toBe("held")
})

it("disables hover without discarding actual child focus and preserves the original hover objects", async () => {
  const group = createRef<View>(),
    hovered = jest.fn(),
    ended = jest.fn(),
    values = jest.fn()
  const content = (isDisabled: boolean) =>
    wrap(
      <NativeComboBoxGroup testID="group" ref={group} isDisabled={isDisabled} onHoverStart={hovered} onHoverEnd={ended}>
        {(state) => {
          values(state)
          return "Content"
        }}
      </NativeComboBoxGroup>,
    )
  const view = await render(content(false))
  await ready()
  const event = { persist: jest.fn(), nativeEvent: { pointerType: "mouse", target: 1 } }
  await act(() => screen.getByTestId("group").props.onPointerEnter(event))
  await within(native.findNodeHandle(group.current)!, 19, 1)
  await view.rerender(content(true))
  expect(hovered.mock.calls).toEqual([[event]])
  expect(ended.mock.calls).toEqual([[event]])
  expect(values.mock.calls.at(-1)?.[0]).toMatchObject({ isDisabled: true, isHovered: false, isFocusWithin: true })
})
