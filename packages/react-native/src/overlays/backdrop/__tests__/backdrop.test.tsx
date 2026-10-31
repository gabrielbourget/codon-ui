import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { createRef, forwardRef, useLayoutEffect, type ReactNode } from "react"
import { AppState, View, type AppStateStatus } from "react-native"

import {
  Modal,
  NativeBackdropHost,
  NativeOverlayProvider,
  Text,
  type TNativeBackdropAdapter,
  type TNativeBackdropEffectProps,
} from "../../.."

import { NativeBackdropFixture } from "./fixtures/NativeBackdropFixture"

jest.unmock("react-native/Libraries/Components/View/View")
jest.unmock("react-native/Libraries/Components/View/ViewNativeComponent")
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))

// This observes routing and lease ownership. It does not render or certify blur pixels.
const observations: TNativeBackdropEffectProps[] = []
const EffectProbe = (props: TNativeBackdropEffectProps) => {
  useLayoutEffect(() => {
    observations.push(props)
  })
  return <View testID="effect-probe" />
}
const adapter: TNativeBackdropAdapter = { Target: View, Effect: EffectProbe }
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const sourceId = (props: TNativeBackdropEffectProps) => props.targetRef.current?.props.testID
const latest = (id = "root") => observations.filter((props) => sourceId(props) === id).at(-1)!
const show = async (id = "modal") => fireEvent(row(`${id}-window`), "show")
const status = async (id = "modal", epoch = 1, windowActive = true) => {
  const host = row(`${id}-floating-host`).props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: `${id}-native-window`,
        epoch,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive,
      },
    }),
  )
}
const wrap = (children: ReactNode, selected = adapter) => (
  <NativeOverlayProvider backdropAdapter={selected}>
    <NativeBackdropHost testID="root" style={{ flex: 1 }}>
      {children}
    </NativeBackdropHost>
  </NativeOverlayProvider>
)
const listeners = new Set<(state: AppStateStatus) => void>()
const originalAppState = AppState.currentState
beforeEach(() => {
  observations.length = 0
  listeners.clear()
  AppState.currentState = "active"
  jest.spyOn(AppState, "addEventListener").mockImplementation((_name, listener) => {
    listeners.add(listener)
    return { remove: () => listeners.delete(listener) }
  })
})
afterEach(() => {
  AppState.currentState = originalAppState
  jest.restoreAllMocks()
})

it("keeps the default unblurred tree and controlled false free of adapter requirements", async () => {
  const { rerender } = await render(
    <NativeOverlayProvider>
      <Modal aria-label="Plain" isOpen={false} overlayBlur />
    </NativeOverlayProvider>,
  )
  expect(screen.queryByTestId("modal-backdrop-target")).toBeNull()
  expect(observations).toEqual([])
  await rerender(
    <NativeOverlayProvider>
      <Modal aria-label="Plain" isOpen overlayBlur={false} />
    </NativeOverlayProvider>,
  )
  expect(observations).toEqual([])
})

it("fails explicitly for an enabled effect without an adapter or parent-window host", async () => {
  await expect(
    render(
      <NativeOverlayProvider>
        <Modal aria-label="Blur" isOpen overlayBlur />
      </NativeOverlayProvider>,
    ),
  ).rejects.toThrow("backdropAdapter")
  await expect(
    render(
      <NativeOverlayProvider backdropAdapter={adapter}>
        <Modal aria-label="Blur" isOpen overlayBlur />
      </NativeOverlayProvider>,
    ),
  ).rejects.toThrow("parent-window NativeBackdropHost")
  await expect(
    render(
      <NativeOverlayProvider>
        <NativeBackdropHost />
      </NativeOverlayProvider>,
    ),
  ).rejects.toThrow("backdropAdapter")
})

it("forwards actual target refs and preserves callback cleanup on release", async () => {
  const ref = createRef<View>()
  const release = jest.fn()
  const callback = jest.fn(() => release)
  const { rerender, unmount } = await render(
    <NativeOverlayProvider backdropAdapter={adapter}>
      <NativeBackdropHost ref={ref} testID="target" />
    </NativeOverlayProvider>,
  )
  expect(ref.current?.measureInWindow).toEqual(expect.any(Function))
  expect(ref.current?.props.testID).toBe("target")
  await rerender(
    <NativeOverlayProvider backdropAdapter={adapter}>
      <NativeBackdropHost ref={callback} testID="target" />
    </NativeOverlayProvider>,
  )
  expect(ref.current).toBeNull()
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback.mock.calls[0]).toHaveLength(1)
  await unmount()
  expect(release).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledTimes(1)
})

it("routes nested windows to distinct parent targets while retaining covered output", async () => {
  await render(
    wrap(
      <Modal testID="parent" aria-label="Parent" isOpen overlayBlur>
        <Text>Parent content</Text>
        <Modal testID="child" aria-label="Child" isOpen overlayBlur>
          <Text>Child content</Text>
        </Modal>
      </Modal>,
    ),
  )
  await status("parent")
  const parent = latest()
  expect(parent.targetRef.current?.props.testID).toBe("root")
  expect(parent.lease.isCurrent()).toBe(true)
  await show("parent")
  await status("child")
  await show("child")
  expect(parent.lease.isCurrent()).toBe(false)
  expect(latest().isPaused).toBe(true)
  const child = latest("parent-backdrop-target")
  expect(child.targetRef).not.toBe(parent.targetRef)
  expect(child.lease.isCurrent()).toBe(true)
  expect(sourceId(child)).toBe("parent-backdrop-target")
  expect(screen.getAllByTestId("effect-probe", { includeHiddenElements: true })).toHaveLength(2)
  // The native target encloses the floating portal hosts as well as the body.
  expect(
    within(row("parent-backdrop-target")).getByTestId("parent-floating-host", { includeHiddenElements: true }),
  ).toBeTruthy()
})

it("retires work on native window loss/return and new epochs without reviving old leases", async () => {
  await render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />))
  await show()
  await status()
  const first = latest()
  expect(first.isPaused).toBe(false)
  expect(first.lease.isCurrent()).toBe(true)
  await status("modal", 1, false)
  expect(first.lease.isCurrent()).toBe(false)
  expect(latest().isPaused).toBe(true)
  await status()
  expect(first.lease.isCurrent()).toBe(false)
  expect(latest().lease.isCurrent()).toBe(true)
  const second = latest()
  await status("modal", 2)
  expect(second.lease.isCurrent()).toBe(false)
  expect(latest().lease.isCurrent()).toBe(true)
})

it("retires background work even when the app returns in the same batch", async () => {
  await render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />))
  await show()
  await status()
  const first = latest()
  await act(() => {
    for (const listener of [...listeners]) listener("background")
    expect(first.lease.isCurrent()).toBe(false)
    for (const listener of [...listeners]) listener("active")
  })
  expect(first.lease.isCurrent()).toBe(false)
  expect(latest().lease.isCurrent()).toBe(true)
})

it("retires old effect work on renderer replacement and owner unmount", async () => {
  const { rerender, unmount } = await render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />))
  await show()
  await status()
  const old = latest()
  const Replacement = (props: TNativeBackdropEffectProps) => <EffectProbe {...props} />
  await rerender(wrap(<Modal aria-label="Blur" isOpen overlayBlur />, { ...adapter, Effect: Replacement }))
  expect(old.lease.isCurrent()).toBe(false)
  const next = latest()
  expect(next.lease.isCurrent()).toBe(true)
  await unmount()
  expect(next.lease.isCurrent()).toBe(false)
  expect(next.targetRef.current).toBeNull()
})

it("retires target replacement and forwards the replacement native View", async () => {
  const { rerender } = await render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />))
  await show()
  await status()
  const old = latest()
  const oldTarget = old.targetRef.current
  const Target = forwardRef<View, React.ComponentProps<typeof View>>((props, ref) => <View {...props} ref={ref} />)
  await rerender(wrap(<Modal aria-label="Blur" isOpen overlayBlur />, { ...adapter, Target }))
  expect(old.lease.isCurrent()).toBe(false)
  expect(latest().targetRef.current).not.toBe(oldTarget)
  expect(latest().targetRef.current?.measureInWindow).toEqual(expect.any(Function))
})

it("rejects a target that drops its ref instead of silently displaying a dim-only result", async () => {
  const DroppedTarget: TNativeBackdropAdapter["Target"] = ({ children }) => <View>{children}</View>
  await expect(
    render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />, { ...adapter, Target: DroppedTarget })),
  ).rejects.toThrow("actual native View ref")
})

it("keeps pointer and keyboard guards independent with blur enabled and current callbacks", async () => {
  const old = jest.fn(),
    next = jest.fn()
  const { rerender } = await render(
    wrap(<Modal aria-label="Blur" isOpen overlayBlur isDismissable={false} onOpenChange={old} />),
  )
  await show()
  await status()
  await fireEvent.press(row("modal-backdrop"))
  expect(old).not.toHaveBeenCalled()
  await fireEvent(row("modal-window"), "requestClose")
  expect(old.mock.calls).toEqual([[false]])
  await rerender(wrap(<Modal aria-label="Blur" isOpen overlayBlur isKeyboardDismissDisabled onOpenChange={next} />))
  await fireEvent(row("modal-window"), "requestClose")
  expect(next).not.toHaveBeenCalled()
  await fireEvent.press(row("modal-backdrop"))
  expect(next.mock.calls).toEqual([[false]])
  expect(row("modal-window").props.visible).toBe(true)
  expect(latest().lease.isCurrent()).toBe(true)
})

it("retires an effect when blur is explicitly disabled without replacing its target", async () => {
  const { rerender } = await render(wrap(<Modal aria-label="Blur" isOpen overlayBlur />))
  await show()
  await status()
  const first = latest(),
    target = first.targetRef.current
  await rerender(wrap(<Modal aria-label="Blur" isOpen overlayBlur={false} />))
  expect(first.lease.isCurrent()).toBe(false)
  expect(first.targetRef.current).toBe(target)
  expect(screen.queryByTestId("effect-probe", { includeHiddenElements: true })).toBeNull()
})

it("SCENE.backdrop.001 preserves the maintained nested routing and explicit blur toggle", async () => {
  await render(<NativeBackdropFixture adapter={adapter} />)
  await fireEvent.press(screen.getByRole("button", { name: "Open parent" }))
  await show("backdrop-parent")
  await status("backdrop-parent")
  const parent = latest("backdrop-fixture-root")
  expect(parent.lease.isCurrent()).toBe(true)
  await fireEvent.press(screen.getByRole("button", { name: "Toggle parent blur" }))
  expect(parent.lease.isCurrent()).toBe(false)
  await fireEvent.press(screen.getByRole("button", { name: "Open nested child" }))
  await show("backdrop-child")
  await status("backdrop-child")
  expect(latest("backdrop-parent-backdrop-target").lease.isCurrent()).toBe(true)
  expect(screen.getAllByTestId("effect-probe", { includeHiddenElements: true })).toHaveLength(1)
})
