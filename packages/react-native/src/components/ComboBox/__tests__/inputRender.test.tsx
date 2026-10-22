import "../../../collection/__tests__/nativeReceipts"

import { createRef, type ReactNode } from "react"
import { TextInput, View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeMotionConfig } from "../../../motion/config"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeThemeProvider } from "../../../theme"
import { NativeComboBoxInput } from "../CollectionComboBoxInput"
import { NativeCollectionComboBoxTrigger, NativeComboBoxButton } from "../CollectionComboBoxTrigger"
import {
  NativeComboBoxInputContext,
  NativeComboBoxButtonContext,
  NativeComboBoxStateContext,
} from "../collectionContext"
import type { TNativeComboBoxInputRenderState } from "../collectionInputTypes"
import { collection, ITEMS } from "../state/__tests__/collection"
import { useComboBoxState } from "../state/useComboBoxState"

const wrap = (children: ReactNode) => <NativeThemeProvider>{children}</NativeThemeProvider>
const pointer = (pointerType = "mouse") => ({ persist: jest.fn(), nativeEvent: { pointerType, target: 1 } })
const focusEvent = { nativeEvent: { target: 1 } }
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("renders the original scoped input with caller precedence, named/null slots and complete style values", async () => {
  const inherited = createRef<TextInput>(),
    caller = createRef<TextInput>()
  const changes: string[] = [],
    values = jest.fn(),
    styles = jest.fn()
  const view = await render(
    wrap(
      <NativeComboBoxInputContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { nativeID: "default-input" },
            search: {
              ref: inherited,
              value: "held",
              isInvalid: true,
              onChangeText: () => changes.push("context"),
              style: { padding: 9 },
            },
          },
        }}
      >
        <NativeComboBoxInput testID="default-input" />
        <NativeComboBoxInput
          ref={caller}
          slot="search"
          nativeID="caller"
          onChangeText={() => changes.push("caller")}
          style={(state) => {
            styles(state)
            return { color: "green" }
          }}
          render={(props, state) => {
            values(state)
            return <TextInput {...props} testID="rendered-input" />
          }}
        />
        <NativeComboBoxInput slot={null} testID="isolated-input" />
      </NativeComboBoxInputContext.Provider>,
    ),
  )
  expect(caller.current).not.toBeNull()
  expect(caller.current === inherited.current).toBe(true)
  expect(typeof caller.current?.focus).toBe("function")
  expect(screen.getByTestId("rendered-input").props).toMatchObject({
    nativeID: "caller",
    value: "held",
    editable: true,
    multiline: false,
  })
  expect(screen.getByTestId("default-input").props.nativeID).toBe("default-input")
  expect(screen.getByTestId("isolated-input").props.nativeID).toBeUndefined()
  expect(values.mock.calls.at(-1)?.[0]).toMatchObject({
    isHovered: false,
    isFocused: false,
    isFocusVisible: false,
    isInvalid: true,
    isDisabled: false,
  })
  expect(styles.mock.calls.at(-1)?.[0]).toMatchObject({ isInvalid: true, defaultStyle: { padding: 9 } })
  expect(screen.getByTestId("rendered-input")).toHaveStyle({ padding: 9, color: "green" })
  await act(() => screen.getByTestId("rendered-input").props.onChangeText("request"))
  expect(changes).toEqual(["context", "caller"])
  expect(screen.getByTestId("rendered-input").props.value).toBe("held")
  await view.unmount()
  expect([inherited.current, caller.current]).toEqual([null, null])
})

it("forwards original hover/focus objects and clears hover when disabled without changing text", async () => {
  const hoverStart = jest.fn(),
    hoverEnd = jest.fn(),
    hoverChange = jest.fn(),
    focused = jest.fn(),
    states: TNativeComboBoxInputRenderState[] = []
  const content = (disabled = false) =>
    wrap(
      <NativeComboBoxInput
        value="held"
        isDisabled={disabled}
        onFocus={focused}
        onHoverStart={hoverStart}
        onHoverEnd={hoverEnd}
        onHoverChange={hoverChange}
        render={(props, state) => {
          states.push(state)
          return <TextInput {...props} testID="editor" />
        }}
      />,
    )
  const view = await render(content())
  const touch = pointer("touch"),
    mouse = pointer()
  await act(() => screen.getByTestId("editor").props.onPointerEnter(touch))
  expect(hoverStart).not.toHaveBeenCalled()
  await act(() => screen.getByTestId("editor").props.onPointerEnter(mouse))
  await act(() => screen.getByTestId("editor").props.onFocus(focusEvent))
  expect(hoverStart.mock.calls).toEqual([[mouse]])
  expect(focused.mock.calls).toEqual([[focusEvent]])
  expect(states.at(-1)).toMatchObject({ isHovered: true, isFocused: true, isFocusVisible: true })
  await act(() => screen.getByTestId("editor").props.onPointerDown(mouse))
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  await view.rerender(content(true))
  expect(hoverEnd.mock.calls).toEqual([[mouse]])
  expect(hoverChange.mock.calls).toEqual([[true], [false]])
  expect(states.at(-1)).toMatchObject({ isHovered: false, isFocused: false, isFocusVisible: false, isDisabled: true })
  expect(screen.getByTestId("editor").props.value).toBe("held")
})

it("keeps text-input focus visibility unchanged by typing and updates only for admitted Tab/Escape observations", async () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const targets = new WeakMap<object, number>()
  let nextTarget = 600000
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    const original = inherited(view)
    if (original) return original
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++nextTarget)
    return targets.get(view)!
  })
  const states: TNativeComboBoxInputRenderState[] = []
  await render(
    wrap(
      <NativeFloatingLayerHost testID="window">
        <NativeComboBoxInput
          render={(props, state) => {
            states.push(state)
            return <TextInput {...props} testID="editor" />
          }}
        />
      </NativeFloatingLayerHost>,
    ),
  )
  const host = () => screen.getByTestId("window").props
  const status = async () => {
    await act(() =>
      host().onNativeScopeStatus({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "actual-window",
          epoch: 1,
          policyRevision: host().policyRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
  }
  await status()
  await act(() =>
    host().onNativeInputModality({
      nativeEvent: { ownerId: host().ownerId, windowId: "actual-window", epoch: 1, origin: "pointer", timestamp: 1 },
    }),
  )
  await act(() => screen.getByTestId("editor").props.onFocus(focusEvent))
  await status()
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  for (let attempt = 0; attempt < 2; attempt++)
    await act(() =>
      host().onNativeObservationStatus({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "actual-window",
          epoch: 1,
          observationRevision: host().observationRevision,
          ready: true,
          windowActive: true,
        },
      }),
    )
  const registered = host().observations.find((entry: { targetTag: number }) => entry.targetTag > 0)
  expect(registered).toBeDefined()
  let eventId = 0
  const key = async (key: string, cancelled = false, windowId = "actual-window") =>
    act(() =>
      host().onNativeObservedKey({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId,
          epoch: 1,
          observationRevision: host().observationRevision,
          eventId: ++eventId,
          observerIds: [registered.id],
          target: registered.targetTag,
          focusedTarget: registered.targetTag,
          key,
          code: key,
          phase: "down",
          cancelled,
          isComposing: false,
          repeat: false,
          timestamp: eventId,
        },
      }),
    )
  await act(() =>
    host().onNativeInputModality({
      nativeEvent: { ownerId: host().ownerId, windowId: "actual-window", epoch: 1, origin: "keyboard", timestamp: 2 },
    }),
  )
  await key("a")
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  await key("Escape", true)
  await key("Escape", false, "foreign-window")
  expect(states.at(-1)?.isFocusVisible).toBe(false)
  await key("Escape")
  expect(states.at(-1)?.isFocusVisible).toBe(true)
  await act(() =>
    host().onNativeInputModality({
      nativeEvent: { ownerId: host().ownerId, windowId: "actual-window", epoch: 1, origin: "pointer", timestamp: 9 },
    }),
  )
  expect(states.at(-1)?.isFocusVisible).toBe(false)
})

it("preserves original scoped button host refs and supplies focus-visible state to render/children/style callbacks", async () => {
  const inherited = createRef<View>(),
    caller = createRef<View>(),
    values = jest.fn(),
    styles = jest.fn(),
    children = jest.fn((_state: unknown) => "Trigger")
  await render(
    wrap(
      <NativeComboBoxButtonContext.Provider value={{ ref: inherited, isPressed: true }}>
        <NativeComboBoxButton
          ref={caller}
          style={(state) => {
            styles(state)
            return { padding: 9 }
          }}
          render={(props, state) => {
            values(state)
            return <NativeFocusHost {...props} testID="button" />
          }}
        >
          {children}
        </NativeComboBoxButton>
      </NativeComboBoxButtonContext.Provider>,
    ),
  )
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current).not.toBeNull()
  expect(values.mock.calls.at(-1)?.[0]).toMatchObject({ isPressed: true, isFocusVisible: false })
  expect(styles.mock.calls.at(-1)?.[0]).toMatchObject({ isPressed: true, isFocusVisible: false })
  expect(children.mock.calls.at(-1)?.[0]).toMatchObject({ isPressed: true, isFocusVisible: false })
  expect(screen.getByTestId("button")).toHaveStyle({ padding: 9 })
})

it("connects both default and custom trigger icons to the complete motion owner and actual open state", async () => {
  const Harness = ({ open, custom }: { open: boolean; custom: boolean }) => {
    const state = useComboBoxState({ collection: collection(), isOpen: open })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeCollectionComboBoxTrigger
          owner={{
            items: ITEMS,
            inputLabel: "Editor",
            closeLabel: "Close",
            getKey: (item) => item.id,
            getTextValue: (item) => item.label,
            ComponentIcon: custom ? <View testID="custom-icon" /> : undefined,
          }}
          foreground="black"
        />
      </NativeComboBoxStateContext.Provider>
    )
  }
  // This model verifies composition/endpoints only, not installed frames or native pixels.
  const content = (open: boolean, custom: boolean) =>
    wrap(
      <NativeMotionConfig skipAnimations>
        <Harness open={open} custom={custom} />
      </NativeMotionConfig>,
    )
  const view = await render(content(false, false))
  expect(screen.getByTestId("combo-box-icon")).toHaveStyle({ transform: [] })
  await view.rerender(content(true, true))
  await act(() => jest.advanceTimersByTime(500))
  expect(screen.getByTestId("combo-box-icon")).toHaveStyle({ transform: [{ rotateX: "180deg" }] })
  expect(screen.getByTestId("custom-icon")).toBeOnTheScreen()
})
