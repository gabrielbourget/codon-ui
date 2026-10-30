import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createContext, createRef, useContext, type ReactNode } from "react"
import { View } from "react-native"

import {
  Button,
  ClickPopover,
  NativeDialogContext,
  NativeDialogTrigger,
  NativeFloatingLayerHost,
  NativeFocusView,
  NativeOverlayTriggerStateContext,
  NativePopoverContext,
  Text,
} from "../../.."
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import type { OverlayTriggerState } from "../../ComboBox/state/useOverlayTriggerState"
import { NativeRootMenuTriggerStateContext } from "../../Menu/context"
import type { TNativeRootMenuTriggerState } from "../../Menu/triggerState"
import type { TNativeFloatingRenderState } from "../ClickPopover"
import type { TNativeDialogContextProps } from "../context"
import { NativePopoverDialog } from "../NativePopoverDialog"

const hidden = { includeHiddenElements: true }
const stateWithClose = (close: () => void): OverlayTriggerState => ({
  isOpen: true,
  close,
  open: () => {},
  setOpen: () => {},
  toggle: () => {},
})
const dialog = (children: ReactNode, context: TNativeDialogContextProps = {}) => (
  <NativeDialogContext.Provider value={{ accessibilityLabelledBy: "trigger-fallback", ...context }}>
    <NativePopoverDialog nativeBaselineStyle={{ padding: 10 }} nativeFocusable testID="dialog">
      {children}
    </NativePopoverDialog>
  </NativeDialogContext.Provider>
)

it("names the original dialog from its title slot, preserving explicit labels, own IDs and null slots", async () => {
  const ref = createRef<React.ComponentRef<typeof Text>>()
  const content = (title: boolean, slot: string | null = "title") => (
    <>
      {title && (
        <Text ref={ref} slot={slot} nativeID="authored-title">
          Title
        </Text>
      )}
      <Text testID="ordinary">Ordinary</Text>
    </>
  )
  const view = await render(dialog(content(true)))
  const original = ref.current
  expect(screen.getByRole("heading", { name: "Title" }).props.nativeID).toBe("authored-title")
  expect(screen.getByTestId("dialog").props.nativeLabelledBy).toEqual(["authored-title"])
  expect(screen.getByTestId("ordinary").props.slot).toBeUndefined()
  await view.rerender(dialog(content(true), { accessibilityLabel: "Explicit" }))
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("dialog").props.accessibilityLabel).toBe("Explicit")
  expect(screen.getByTestId("dialog").props.nativeLabelledBy).toEqual(["trigger-fallback"])
  await view.rerender(dialog(content(false)))
  expect(screen.getByTestId("dialog").props.nativeLabelledBy).toEqual(["trigger-fallback"])
  await view.rerender(dialog(content(true, null)))
  expect(screen.queryByRole("heading")).toBeNull()
  expect(screen.getByTestId("dialog").props.nativeLabelledBy).toEqual(["trigger-fallback"])
})

it("uses the actual overlay close identity for default Dialog children and close slots in source order", async () => {
  const trace: unknown[] = []
  const first = jest.fn(() => trace.push("first-close"))
  const second = jest.fn(() => trace.push("second-close"))
  let suppliedClose: (() => void) | undefined
  const node = (close: () => void) => (
    <NativeOverlayTriggerStateContext.Provider value={stateWithClose(close)}>
      <NativeDialogContext.Provider
        value={{
          children: (state) => {
            suppliedClose = state.close
            return (
              <>
                <Button slot="close" testID="close" onPress={(event) => trace.push(event)}>
                  Close
                </Button>
                <Button testID="ordinary" onPress={() => trace.push("ordinary")}>
                  Ordinary
                </Button>
                <Button slot={null} testID="independent" onPress={() => trace.push("independent")}>
                  Independent
                </Button>
              </>
            )
          },
        }}
      >
        <NativePopoverDialog nativeBaselineStyle={{}} nativeFocusable />
      </NativeDialogContext.Provider>
    </NativeOverlayTriggerStateContext.Provider>
  )
  const view = await render(node(first))
  expect(suppliedClose).toBe(first)
  const event = { nativeEvent: { pageX: 1, pageY: 2 } }
  await fireEvent.press(screen.getByTestId("close"), event)
  expect(trace[0]).toBe("first-close")
  expect(trace[1]).toMatchObject({ nativeEvent: { pageX: 1, pageY: 2 } })
  await fireEvent.press(screen.getByTestId("ordinary"), event)
  await fireEvent.press(screen.getByTestId("independent"), event)
  expect(first).toHaveBeenCalledTimes(1)
  await view.rerender(node(second))
  expect(suppliedClose).toBe(second)
  await fireEvent.press(screen.getByTestId("close"), event)
  expect(trace.at(-2)).toBe("second-close")
  expect(trace.at(-1)).toMatchObject({ nativeEvent: { pageX: 1, pageY: 2 } })
})

it("retains dialog renderer/ref/event identity and context before authored dialog style", async () => {
  const ref = createRef<View>()
  const contextRef = createRef<View>()
  const trace: unknown[] = []
  const renderer = jest.fn((props, state) => {
    expect(state).toBeUndefined()
    return <NativeFocusView {...props} />
  })
  await render(
    <NativeDialogContext.Provider
      value={{
        ref: contextRef,
        render: renderer,
        style: { padding: 4, gap: 2 },
        onLayout: (event) => trace.push(event),
      }}
    >
      <NativePopoverDialog
        ref={ref}
        nativeBaselineStyle={{ padding: 10 }}
        nativeFocusable
        style={{ padding: 0 }}
        testID="dialog"
        onLayout={(event) => trace.push(event)}
      >
        Authored
      </NativePopoverDialog>
    </NativeDialogContext.Provider>,
  )
  expect(ref.current).toBe(contextRef.current)
  expect(screen.getByTestId("dialog")).toHaveStyle({ padding: 0, gap: 2 })
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 90, height: 40 } } }
  await fireEvent(screen.getByTestId("dialog"), "layout", event)
  expect(trace).toEqual([event, event])
})

it("keeps explicit own dialog relationships ahead of a title and context fallback", async () => {
  await render(
    <NativeDialogContext.Provider value={{ accessibilityLabelledBy: "fallback" }}>
      <NativePopoverDialog nativeBaselineStyle={{}} nativeFocusable testID="dialog" accessibilityLabelledBy="own">
        <Text slot="title">Title</Text>
      </NativePopoverDialog>
    </NativeDialogContext.Provider>,
  )
  expect(screen.getByTestId("dialog").props.nativeLabelledBy).toEqual(["own"])
})

it("keeps inherited direct-child typography on the popover root", async () => {
  const trigger = createRef<View>()
  await render(
    <NativeFloatingLayerHost>
      <View ref={trigger} />
      <ClickPopover
        defaultOpen
        triggerRef={trigger}
        childIsDialog={false}
        style={{ letterSpacing: 7, fontStyle: "italic" }}
      >
        <Text testID="authored-text">Original</Text>
      </ClickPopover>
    </NativeFloatingLayerHost>,
  )
  expect(screen.getByTestId("authored-text", hidden)).toHaveStyle({ letterSpacing: 7, fontStyle: "italic" })
})

it("shares the complete menu/overlay state object and preserves method semantics and owner veto", async () => {
  let overlay!: OverlayTriggerState
  let menu!: TNativeRootMenuTriggerState
  const onOpenChange = jest.fn()
  const Probe = () => {
    overlay = useContext(NativeOverlayTriggerStateContext)!
    menu = useContext(NativeRootMenuTriggerStateContext)!
    return null
  }
  const view = await render(
    <NativeDialogTrigger isOpen onOpenChange={onOpenChange} trigger={() => null}>
      <Probe />
    </NativeDialogTrigger>,
  )
  expect(overlay).toBe(menu)
  await act(() => menu.openSubmenu("child", 0))
  expect(menu.expandedKeysStack).toEqual(["child"])
  await act(() => overlay.setOpen(false))
  expect(overlay.isOpen).toBe(true)
  expect(menu.expandedKeysStack).toEqual(["child"])
  await act(() => overlay.close())
  expect(menu.expandedKeysStack).toEqual([])
  expect(onOpenChange.mock.calls).toEqual([[false], [false]])
  await act(() => menu.open("last"))
  expect(menu.focusStrategy).toBe("last")
  expect(overlay).toBe(menu)
  const retained = overlay.close
  await view.unmount()
  retained()
  expect(onOpenChange).toHaveBeenCalledTimes(2)
})

it("preserves named/default/null popover context, dynamic style precedence and clearContexts", async () => {
  const cleared = createContext<string | null>("outer")
  const trigger = createRef<View>()
  const contextRef = createRef<View>()
  const ref = createRef<View>()
  let currentState!: TNativeFloatingRenderState
  const inheritedStyle = jest.fn(() => ({ padding: 4, fontStyle: "italic" as const }))
  const Child = () => <Text testID="cleared">{useContext(cleared) ?? "cleared"}</Text>
  const node = (slot: string | null | undefined, ownOpen?: boolean) => (
    <NativeFloatingLayerHost>
      <View ref={trigger} />
      <NativePopoverContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { triggerRef: trigger, defaultOpen: true },
            named: {
              ref: contextRef,
              triggerRef: trigger,
              defaultOpen: true,
              trigger: "named",
              style: inheritedStyle,
              clearContexts: [cleared],
              render: (props, state) => {
                currentState = state
                return <NativeFocusView {...props} />
              },
            },
          },
        }}
      >
        <ClickPopover
          ref={ref}
          slot={slot}
          triggerRef={trigger}
          isOpen={ownOpen}
          customStyles={{ padding: 2 }}
          style={{ padding: 0 }}
        >
          <Child />
        </ClickPopover>
      </NativePopoverContext.Provider>
    </NativeFloatingLayerHost>
  )
  const view = await render(node("named"))
  expect(contextRef.current).toBe(ref.current)
  expect(Object.keys(currentState).sort()).toEqual(["isEntering", "isExiting", "placement", "trigger"])
  expect(currentState.trigger).toBe("named")
  expect(screen.getByTestId("click-popover", hidden)).toHaveStyle({ padding: 0 })
  expect(screen.getByTestId("cleared", hidden).props.children).toBe("cleared")
  await view.rerender(node("named", false))
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
  await view.rerender(node(undefined))
  expect(screen.getByTestId("cleared", hidden).props.children).toBe("outer")
  await view.rerender(node(null, false))
  expect(screen.queryByTestId("click-popover", hidden)).toBeNull()
})
