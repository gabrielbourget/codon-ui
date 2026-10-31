import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useContext, useLayoutEffect, type ReactNode } from "react"
import { AccessibilityInfo, AppState, findNodeHandle, Platform, type TextInput, type View } from "react-native"
import { Portal } from "react-native-teleport"

import { NativeFloatingLayerHost, NativeFocusView, NativeOverlayProvider, Text } from "../../.."
import { getNativeFocusedTarget } from "../../../input/focus"
import * as focusRegistry from "../../../input/focus"
import { NativeDialogFocusScope } from "../../../input/NativeDialogFocusScope"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { useNativeFloatingHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
import { useNativeFloatingLayer } from "../../../overlays/floating/useFloatingLayer"
import { Panel } from "../Panel"
import type { TNativePanelProps } from "../types"

import { PanelFixture } from "./fixtures/PanelFixture"

jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: jest.requireActual("react-native").View }))

const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
const appListeners = new Set<(state: "active" | "background") => void>()
const appChanged = (state: "active" | "background") => appListeners.forEach((listener) => listener(state))
beforeEach(() => {
  jest.clearAllMocks()
  frames.clear()
  appListeners.clear()
  Object.defineProperty(AppState, "currentState", { configurable: true, get: () => "active" })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    appListeners.add(listener)
    return { remove: () => appListeners.delete(listener) }
  })
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())
const flush = async () => {
  const pending = [...frames.values()]
  frames.clear()
  await act(() => pending.forEach((callback) => callback(0)))
}
const acknowledge = async (id: string, epoch = 1, active = true) => {
  for (const ready of [false, true]) {
    const host = row(id).props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: id,
          epoch,
          ready,
          windowActive: active,
          policyRevision: host.policyRevision,
        },
      }),
    )
  }
}
const observe = async (id: string, target: View, isFocused = true) =>
  act(() =>
    row(id).props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row(id).props.ownerId,
        target: findNodeHandle(target),
        isFocused,
        isFocusVisible: true,
        origin: "keyboard",
        timestamp: 100,
      },
    }),
  )
const setup = () => {
  const prior = createRef<View>(),
    replacement = createRef<View>(),
    panel = createRef<View>(),
    first = createRef<View>(),
    second = createRef<View>()
  const node = (props: Partial<TNativePanelProps> = {}, extra?: ReactNode, includePrior = true) => (
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="parent-host">
        {includePrior && <NativeFocusView testID="prior" ref={prior} accessibilityLabel="Return target" />}
        <NativeFocusView testID="replacement" ref={replacement} accessibilityLabel="Replacement return target" />
        <Panel aria-label="Named panel" ref={panel} isOpen {...props}>
          <NativeFocusView testID="first" ref={first} accessibilityLabel="First target" />
          <NativeFocusView testID="second" ref={second} accessibilityLabel="Second target" />
          <Text>Arbitrary body</Text>
          {extra}
        </Panel>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  )
  let nativeDismissed: (() => void) | undefined
  const shown = async () => {
    nativeDismissed = row("panel-window").props.onDismiss
    await fireEvent(row("panel-window"), "show")
  }
  const measured = async () =>
    fireEvent(row("panel"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 600 } } })
  const ready = async () => {
    await shown()
    await measured()
    await acknowledge("panel-floating-host")
  }
  const dismissed = async () => {
    if (Platform.OS === "ios") await act(() => nativeDismissed?.())
    else await flush()
  }
  return { prior, replacement, panel, first, second, node, shown, measured, ready, dismissed }
}

it("keeps the Panel boundary programmatically focusable without adding it to native Tab traversal", async () => {
  const f = setup()
  await render(f.node())
  expect(row("panel").props.nativeTabStop).toBe(false)
  expect(row("panel").props.keyboardFocusable).toBe(true)
  expect(row("panel-backdrop").props.focusable).toBe(false)
  expect(row("first").props.keyboardFocusable).toBe(true)
  await f.ready()
  await flush()
  expect(focusRegistry.captureNativeFocusTarget(f.panel.current!)).not.toBeNull()
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.panel.current, row("panel").props.ownerId)
})

it("CAP.panel.focus.002 waits for native presentation, measurement and scope readiness before requesting its actual root", async () => {
  const f = setup()
  await render(f.node())
  await acknowledge("panel-floating-host")
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await f.shown()
  await acknowledge("panel-floating-host")
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await f.measured()
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.panel.current, row("panel").props.ownerId)
  expect(f.panel.current).not.toBe(f.first.current)
  expect(getNativeFocusedTarget()).not.toBe(f.panel.current)
  await observe("panel", f.panel.current!)
  expect(getNativeFocusedTarget()).toBe(f.panel.current)
  await acknowledge("panel-floating-host")
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

it("CAP.panel.focus.002 uses the current explicit target without replacing the native root ref", async () => {
  const f = setup()
  const { rerender } = await render(f.node({ initialFocusRef: f.first }))
  await f.ready()
  const obsolete = [...frames.values()]
  await rerender(f.node({ initialFocusRef: f.second }))
  await act(() => obsolete.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.second.current, row("second").props.ownerId)
  expect(f.panel.current).not.toBe(f.second.current)
})

it("CAP.panel.focus.004 keeps an explicit null target and rejects an ineligible native target without a fallback", async () => {
  const f = setup()
  const absent = createRef<View>()
  const { rerender } = await render(f.node({ initialFocusRef: absent }))
  await f.ready()
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await rerender(f.node({ initialFocusRef: absent }, <NativeFocusView ref={absent} focusable={false} />))
  await acknowledge("panel-floating-host")
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("CAP.panel.focus.004 retires queued entry after native loss/return in one batch and acquires only from the new epoch", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  const obsolete = [...frames.values()]
  await act(() => {
    const host = row("panel-floating-host").props
    for (const [epoch, windowActive] of [
      [1, false],
      [2, true],
    ] as const)
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "panel-floating-host",
          epoch,
          windowActive,
          ready: false,
          policyRevision: host.policyRevision,
        },
      })
  })
  await act(() => obsolete.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await acknowledge("panel-floating-host", 2)
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

it("CAP.panel.focus.003 blocks covered parent acquisition and current/stale dismissal while a child window is active", async () => {
  const f = setup()
  const close = jest.fn()
  const { rerender } = await render(f.node({ onOpenChange: close }))
  await f.ready()
  const obsolete = [...frames.values()]
  const staleClose = row("panel-window").props.onRequestClose
  await rerender(f.node({ onOpenChange: close }, <Panel aria-label="Child" testID="child" isOpen />))
  await fireEvent(row("child-window"), "show")
  await act(() => obsolete.forEach((callback) => callback(0)))
  await act(() => staleClose())
  await fireEvent.press(row("panel-backdrop"))
  expect(close).not.toHaveBeenCalled()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(row("panel").props.pointerEvents).toBe("none")
})

it("CAP.panel.focus.004 cancels old entry on close/reopen and never runs after unmount", async () => {
  const f = setup()
  const { rerender, unmount } = await render(f.node())
  await f.ready()
  const obsolete = [...frames.values()]
  await rerender(f.node({ isOpen: false }))
  await f.dismissed()
  await rerender(f.node())
  await f.ready()
  await act(() => obsolete.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  const latest = [...frames.values()]
  await unmount()
  await act(() => latest.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(f.panel.current).toBeNull()
})

it.each(["ios", "android"] as const)(
  "CAP.panel.focus.001 restores an observed parent target after the %s dismissal barrier",
  async (platform) => {
    jest.replaceProperty(Platform, "OS", platform)
    const f = setup()
    const { rerender } = await render(f.node({ isOpen: false }))
    const capture = jest.spyOn(focusRegistry, "captureNativeFocusTarget")
    await acknowledge("parent-host")
    await observe("prior", f.prior.current!)
    expect(getNativeFocusedTarget()).toBe(f.prior.current)
    await rerender(f.node())
    expect(capture).toHaveBeenLastCalledWith(f.prior.current)
    await f.ready()
    await flush()
    await observe("panel", f.panel.current!)
    expect(row("parent-host").props.policies).toHaveLength(0)
    jest.mocked(Commands.requestKeyboardFocus).mockClear()
    await rerender(f.node({ isOpen: false }))
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
    await f.dismissed()
    expect(capture.mock.results.at(-1)?.value?.()).toBe(true)
    await acknowledge("parent-host")
    expect(frames.size).toBeGreaterThan(0)
    await flush()
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
    expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.prior.current, row("prior").props.ownerId)
    expect(getNativeFocusedTarget()).not.toBe(f.prior.current)
    await observe("prior", f.prior.current!)
    expect(getNativeFocusedTarget()).toBe(f.prior.current)
  },
)

it("CAP.panel.focus.001 waits for the parent scope to acknowledge readiness after dismissal", async () => {
  const f = setup()
  const { rerender } = await render(f.node({ isOpen: false, restoreFocusRef: f.prior }))
  await acknowledge("parent-host")
  await rerender(f.node({ restoreFocusRef: f.prior }))
  await f.ready()
  await flush()
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await acknowledge("parent-host", 1, false)
  await rerender(f.node({ isOpen: false, restoreFocusRef: f.prior }))
  await f.dismissed()
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await acknowledge("parent-host")
  await flush()
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.prior.current, row("prior").props.ownerId)
})

it.each(["removed", "ref-replaced", "target-replaced", "epoch", "background", "reopened"])(
  "CAP.panel.focus.004 retires the old return request when %s",
  async (change) => {
    const f = setup()
    const { rerender } = await render(f.node({ isOpen: false, restoreFocusRef: f.prior }))
    await acknowledge("parent-host")
    await rerender(f.node({ restoreFocusRef: f.prior }))
    await f.ready()
    await flush()
    jest.mocked(Commands.requestKeyboardFocus).mockClear()
    await rerender(f.node({ isOpen: false, restoreFocusRef: f.prior }))
    await f.dismissed()
    await acknowledge("parent-host")
    const obsolete = [...frames.values()]
    if (change === "removed") await rerender(f.node({ isOpen: false, restoreFocusRef: f.prior }, undefined, false))
    if (change === "ref-replaced") await rerender(f.node({ isOpen: false, restoreFocusRef: createRef<View>() }))
    if (change === "target-replaced") f.prior.current = f.replacement.current
    if (change === "epoch") await acknowledge("parent-host", 2)
    if (change === "background")
      await act(() => {
        appChanged("background")
        appChanged("active")
      })
    if (change === "reopened") await rerender(f.node({ restoreFocusRef: f.prior }))
    await act(() => obsolete.forEach((callback) => callback(0)))
    await flush()
    expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  },
)

it("CAP.panel.focus.004 does not capture a later target for an explicit initially empty return ref", async () => {
  const f = setup()
  const absent = createRef<View>()
  const { rerender } = await render(f.node({ isOpen: false, restoreFocusRef: absent }))
  await acknowledge("parent-host")
  await observe("prior", f.prior.current!)
  await rerender(f.node({ restoreFocusRef: absent }))
  await f.ready()
  await flush()
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  absent.current = f.prior.current
  await rerender(f.node({ isOpen: false, restoreFocusRef: absent }))
  await f.dismissed()
  await flush()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

const escape = async (overrides: Record<string, unknown> = {}, retained?: ReturnType<typeof row>["props"]) => {
  const host = retained ?? row("panel-floating-host").props
  const policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes("0000:Escape"))
  expect(policy).toBeDefined()
  await act(() =>
    host.onNativeScopedKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        windowId: "panel-floating-host",
        epoch: 1,
        policyRevision: host.policyRevision,
        target: 17,
        focusedTarget: 29,
        key: "Escape",
        phase: "down",
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        nativeDefaultHandled: true,
        nativeCode: 53,
        timestamp: 100,
        ...overrides,
      },
    }),
  )
}

it("CAP.panel.focus.005 sends repeated real scoped Escape requests through the current callback while an owner vetoes", async () => {
  const f = setup()
  const old = jest.fn(),
    next = jest.fn()
  const { rerender } = await render(f.node({ onOpenChange: old }))
  await f.ready()
  await escape()
  await rerender(f.node({ onOpenChange: next, isDismissable: false }))
  await escape()
  await escape()
  expect(old.mock.calls).toEqual([[false]])
  expect(next.mock.calls).toEqual([[false], [false]])
  expect(row("panel-window").props.visible).toBe(true)
})

it.each([{ repeat: true }, { cancelled: true }, { phase: "up" }, { nativeDefaultHandled: false }])(
  "CAP.panel.focus.005 rejects invalid native key delivery %p",
  async (packet) => {
    const f = setup()
    const callback = jest.fn()
    await render(f.node({ onOpenChange: callback }))
    await f.ready()
    await escape(packet)
    expect(callback).not.toHaveBeenCalled()
  },
)

it("CAP.panel.focus.005 removes keyboard policy under its independent guard and rejects a retained old packet", async () => {
  const f = setup()
  const callback = jest.fn()
  const { rerender } = await render(f.node({ onOpenChange: callback }))
  await f.ready()
  const obsolete = row("panel-floating-host").props
  await rerender(f.node({ onOpenChange: callback, isKeyboardDismissDisabled: true }))
  await acknowledge("panel-floating-host")
  await escape({}, obsolete)
  expect(callback).not.toHaveBeenCalled()
  expect(row("panel-floating-host").props.policies).toHaveLength(0)
  await fireEvent.press(row("panel-backdrop"))
  expect(callback.mock.calls).toEqual([[false]])
})

it("CAP.panel.focus.004 retires queued entry across background/active in one batch", async () => {
  const f = setup()
  await render(f.node())
  await f.ready()
  const obsolete = [...frames.values()]
  await act(() => {
    appChanged("background")
    appChanged("active")
  })
  await act(() => obsolete.forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

type TLayer = ReturnType<typeof useNativeFloatingLayer>
const FloatingChild = ({
  open,
  observe,
  onDismiss,
}: {
  open: boolean
  observe: (layer: TLayer) => void
  onDismiss: () => void
}) => {
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const layer = useNativeFloatingLayer({
    registry: host.layers,
    parent: parent?.id ?? null,
    isOpen: open,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss,
  })
  useLayoutEffect(() => observe(layer))
  return null
}

it("CAP.panel.focus.005 delegates scoped Escape to a floating child through its exit barrier before closing Panel", async () => {
  const f = setup()
  let layer: TLayer
  const floatingDismissed = jest.fn(),
    parentChanged = jest.fn()
  const child = (open: boolean) => (
    <FloatingChild
      open={open}
      observe={(value) => {
        layer = value
      }}
      onDismiss={floatingDismissed}
    />
  )
  const { rerender } = await render(f.node({ onOpenChange: parentChanged }, child(true)))
  await f.ready()
  await act(() => layer!.entered())
  await acknowledge("panel-floating-host")
  await escape()
  expect(floatingDismissed).toHaveBeenCalledWith("keyboard")
  expect(parentChanged).not.toHaveBeenCalled()
  await rerender(f.node({ onOpenChange: parentChanged }, child(false)))
  await acknowledge("panel-floating-host")
  await escape()
  expect(parentChanged).not.toHaveBeenCalled()
  await act(() => layer!.exited())
  await acknowledge("panel-floating-host")
  await escape()
  expect(parentChanged.mock.calls).toEqual([[false]])
})

it("SCENE.panel.003 retains current owner/editor/theme values while explicit native focus returns after a vetoed close", async () => {
  const input = createRef<TextInput>()
  const returnTarget = createRef<View>()
  await render(<PanelFixture inputRef={input} openerRef={returnTarget} />)
  await acknowledge("panel-scene-window")
  const opener = row("panel-opener")
  await observe("panel-opener", returnTarget.current!)
  await fireEvent.press(opener)
  const dismissed = row("panel-window").props.onDismiss
  await fireEvent(row("panel-window"), "show")
  await fireEvent(row("panel"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 600 } } })
  await acknowledge("panel-floating-host")
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  const closeTarget = jest.mocked(Commands.requestKeyboardFocus).mock.calls[0][0] as View
  expect(row("panel-close").props.ownerId).toBe(jest.mocked(Commands.requestKeyboardFocus).mock.calls[0][1])
  await observe("panel-close", closeTarget)
  expect(screen.getByText("Observed focus: Close action")).toBeOnTheScreen()
  const editor = input.current
  await fireEvent.press(row("panel-close"))
  await fireEvent.press(row("panel-close"))
  expect(screen.getByText("Close requests: 2")).toBeOnTheScreen()
  expect(row("panel-window").props.visible).toBe(true)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle scene theme" }))
  await fireEvent.press(screen.getByRole("button", { name: "Toggle physical side" }))
  expect(row("panel")).toHaveStyle({ backgroundColor: "#171717", right: 0 })
  expect(input.current).toBe(editor)
  expect(screen.getByLabelText("Held query").props.value).toBe("")
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle veto" }))
  await fireEvent.press(row("panel-close"))
  if (Platform.OS === "ios") await act(() => dismissed())
  else await flush()
  await acknowledge("panel-scene-window")
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(2)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[1]).toBe(row("panel-opener").props.ownerId)
  await fireEvent.press(screen.getByRole("button", { name: "Reset panel scene" }))
  expect(screen.getByText("Close requests: 0")).toBeOnTheScreen()
  expect(screen.getByText("Owner open: false")).toBeOnTheScreen()
})

it("binds explicit Dialog entry to the original root and the enclosing Panel without a JavaScript focus request", async () => {
  const f = setup(),
    dialog = createRef<View>(),
    onFocus = jest.fn()
  const extra = (
    <NativeDialogFocusScope rootRef={dialog}>
      <NativeFocusView ref={dialog} testID="explicit-dialog" onFocus={onFocus}>
        <NativeFocusView testID="dialog-child" />
      </NativeFocusView>
    </NativeDialogFocusScope>
  )
  await render(f.node({}, extra))
  await f.ready()
  await flush()
  const binding = row("panel-floating-host").props.dialogScopes[0]
  expect(binding).toMatchObject({ targetTag: findNodeHandle(f.panel.current), enabled: true, entryAllowed: false })
  expect(binding.entryTargets).toEqual([
    expect.objectContaining({ targetTag: findNodeHandle(dialog.current), allowed: true }),
  ])
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(onFocus).not.toHaveBeenCalled()
  const original = dialog.current
  await observe("explicit-dialog", original!)
  expect(onFocus).toHaveBeenCalledTimes(1)
  expect(dialog.current).toBe(original)
  expect(row("first").props.keyboardFocusable).toBe(true)
})

it("keeps the enclosing native containment lease after removing its requesting Dialog without replacing sibling targets", async () => {
  const f = setup(),
    dialog = createRef<View>()
  const extra = (
    <NativeDialogFocusScope rootRef={dialog}>
      <NativeFocusView ref={dialog} testID="explicit-dialog" />
    </NativeDialogFocusScope>
  )
  const result = await render(f.node({}, extra))
  await f.ready()
  await flush()
  const first = f.first.current,
    second = f.second.current
  const binding = row("panel-floating-host").props.dialogScopes[0]
  await result.rerender(f.node())
  const retained = row("panel-floating-host").props.dialogScopes[0]
  expect(retained.bindingId).toBe(binding.bindingId)
  expect(retained.targetTag).toBe(binding.targetTag)
  expect(retained.entryTargets).toEqual([])
  expect(retained.enabled).toBe(true)
  expect(f.first.current).toBe(first)
  expect(f.second.current).toBe(second)
})

it("keeps explicit parent entry authoritative through its actual native observation", async () => {
  const f = setup(),
    dialog = createRef<View>()
  const extra = (
    <NativeDialogFocusScope rootRef={dialog}>
      <NativeFocusView ref={dialog} testID="explicit-dialog" />
    </NativeDialogFocusScope>
  )
  await render(f.node({ initialFocusRef: f.first }, extra))
  await f.ready()
  await flush()
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(f.first.current, row("first").props.ownerId)
  expect(row("panel-floating-host").props.dialogScopes[0].entryTargets[0].allowed).toBe(false)
  await observe("first", f.first.current!)
  expect(row("panel-floating-host").props.dialogScopes[0].entryTargets[0].allowed).toBe(false)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
})

it("keeps an authored raw portal outside the enclosing Dialog boundary", async () => {
  const f = setup(),
    dialog = createRef<View>(),
    authored = createRef<View>()
  const AuthoredPortal = () => {
    const host = useNativeFloatingHost()
    return (
      <Portal hostName={host.name}>
        <NativeFocusView testID="authored-portal-target" ref={authored} />
      </Portal>
    )
  }
  await render(
    f.node(
      {},
      <NativeDialogFocusScope rootRef={dialog}>
        <NativeFocusView testID="explicit-dialog" ref={dialog}>
          <AuthoredPortal />
        </NativeFocusView>
      </NativeDialogFocusScope>,
    ),
  )
  await f.ready()
  await flush()
  expect(authored.current).not.toBeNull()
  const binding = row("panel-floating-host").props.dialogScopes[0]
  expect(binding.memberTargets.map((member: { targetTag: number }) => member.targetTag)).not.toContain(
    findNodeHandle(authored.current),
  )
})
