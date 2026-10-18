import { act, fireEvent, render, screen } from "@testing-library/react-native"
import * as ReactNative from "react-native"

import { NativeFloatingLayerHost } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import type { TNativeBreadcrumbItem } from "../model"
import { NativeBreadcrumbOverflow } from "../Overflow"

const data: readonly TNativeBreadcrumbItem[] = [
  { id: "", href: "", content: "Alpha", disabled: false },
  { id: "b", href: "#b", content: "Beta", disabled: true },
  { id: "c", href: "#c", content: "Bravo", disabled: false },
  { id: "d", href: "#d", content: "Étage", disabled: false },
]
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
const tick = async () =>
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
beforeEach(() => {
  jest.clearAllMocks()
  frames.clear()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) frames.delete(id)
  })
  jest.spyOn(ReactNative, "findNodeHandle").mockImplementation((view) => {
    if (typeof view === "number") return view
    return view && typeof view === "object" && "_nativeTag" in view && typeof view._nativeTag === "number"
      ? view._nativeTag
      : null
  })
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())
const setup = (items = data, disabled = false) => (
  <NativeFloatingLayerHost testID="host">
    <NativeBreadcrumbOverflow items={items} disabled={disabled} label="Hidden pages" style={{}} onAction={jest.fn()} />
  </NativeFloatingLayerHost>
)
const host = () => screen.getByTestId("host").props
const row = (id: string) => screen.getByTestId(`breadcrumb-option-${id}`)
const focusView = () => jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] ?? null
const ready = async () => {
  await fireEvent(screen.getByTestId("breadcrumb-overflow-list"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 100 } },
  })
  for (const ready of [false, true])
    await act(() =>
      host().onNativeScopeStatus({
        nativeEvent: {
          ownerId: host().ownerId,
          windowId: "window",
          epoch: 1,
          policyRevision: host().policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  await tick()
}
const move = async (key: string, extra: Record<string, unknown> = {}) => {
  const policy = host().policies.find((policy: { tokens: string[] }) => policy.tokens.includes(`0000:${key}`))
  expect(policy).toBeDefined()
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: host().ownerId,
      policyId: policy.id,
      target: 17,
      focusedTarget: ReactNative.findNodeHandle(focusView()),
      windowId: "window",
      epoch: 1,
      policyRevision: host().policyRevision,
      key,
      phase: "down",
      repeat: false,
      cancelled: false,
      nativeCode: 0,
      characters: "",
      timestamp: 0,
      nativeDefaultHandled: true,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      ...extra,
    },
  }
  await act(() => host().onNativeScopedKey(event))
  await tick()
}
const raw = async (id: string, key: string, phase = "down", extra: Record<string, unknown> = {}) => {
  let prevented = false
  const event = {
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
    nativeEvent: {
      kind: "keyboard",
      ownerId: row(id).props.ownerId,
      target: 17,
      key,
      nativeCode: 0,
      phase,
      nativeDefaultHandled: true,
      repeat: false,
      cancelled: false,
      timestamp: 0,
      ...extra,
    },
  }
  await act(() => row(id).props.onNativeKey(event))
  await tick()
  return event
}

it("uses actual portable focus commands and one roving stop while skipping disabled IDs and wrapping", async () => {
  await render(setup())
  await ready()
  expect(row("").props.keyboardFocusable).toBe(true)
  expect(row("b")).toBeDisabled()
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(focusView(), row("").props.ownerId)
  await move("ArrowDown")
  expect(row("c").props.keyboardFocusable).toBe(true)
  expect(row("").props.keyboardFocusable).toBe(false)
  await move("End")
  expect(row("d").props.keyboardFocusable).toBe(true)
  await move("ArrowDown")
  expect(row("").props.keyboardFocusable).toBe(true)
  await move("ArrowUp")
  expect(row("d").props.keyboardFocusable).toBe(true)
  await move("Home")
  expect(row("").props.keyboardFocusable).toBe(true)
})
it("selects on Space down without navigation and acts once on actual Enter release", async () => {
  const onAction = jest.fn()
  await render(
    <NativeFloatingLayerHost testID="host">
      <NativeBreadcrumbOverflow items={data} disabled={false} label="Pages" style={{}} onAction={onAction} />
    </NativeFloatingLayerHost>,
  )
  await ready()
  await raw("", " ")
  expect(row("").props.accessibilityState.checked).toBe(true)
  await raw("", " ", "up")
  expect(onAction).not.toHaveBeenCalled()
  await raw("", "Enter")
  expect(onAction).not.toHaveBeenCalled()
  const up = await raw("", "Enter", "up")
  expect(onAction.mock.calls).toEqual([[data[0]]])
  expect(up.nativeEvent).not.toHaveProperty("pageX")
})
it("type-selects accent-insensitively, skips disabled matches and retires removed focus/selection before reinsertion", async () => {
  await render(setup())
  await ready()
  await raw("", "e", "down", { nativeDefaultHandled: false })
  expect(row("d").props.keyboardFocusable).toBe(true)
  await raw("d", " ")
  expect(row("d").props.accessibilityState.checked).toBe(true)
  await screen.rerender(setup(data.slice(0, 3)))
  expect(row("").props.keyboardFocusable).toBe(true)
  await screen.rerender(setup(data))
  expect(row("").props.keyboardFocusable).toBe(true)
  expect(row("d").props.accessibilityState.checked).toBe(false)
})
it("rejects foreign native focus targets and inactive/retired policy packets without changing the roving stop", async () => {
  await render(setup())
  await ready()
  await move("ArrowDown", { focusedTarget: 999999 })
  expect(row("").props.keyboardFocusable).toBe(true)
  const callback = host().onNativeScopedKey,
    policy = host().policies[0]
  await screen.unmount()
  await act(() =>
    callback({
      nativeEvent: {
        kind: "keyboard",
        ownerId: "old",
        policyId: policy.id,
        key: "ArrowDown",
        nativeDefaultHandled: true,
      },
    }),
  )
})

it("cancels retained focus frames after removal and unmount without calling the portable command", async () => {
  await render(setup())
  const old = [...frames.values()]
  await screen.rerender(setup(data.slice(2)))
  const current = [...frames.values()]
  await screen.unmount()
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await act(() => [...old, ...current].forEach((callback) => callback(0)))
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
it("uses measured row/viewport geometry for PageDown/PageUp and reveals the requested row", async () => {
  const scrollTo = jest.spyOn(ReactNative.ScrollView.prototype, "scrollTo")
  await render(setup())
  await ready()
  const positions = [
    { id: "", y: 0, height: 40 },
    { id: "b", y: 40, height: 80 },
    { id: "c", y: 120, height: 40 },
    { id: "d", y: 160, height: 80 },
  ]
  for (const frame of positions)
    await fireEvent(row(frame.id), "layout", {
      nativeEvent: { layout: { x: 0, y: frame.y, width: 200, height: frame.height } },
    })
  await fireEvent(screen.getByTestId("breadcrumb-overflow-scroll"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 100 } },
  })
  await move("PageDown")
  expect(row("c").props.keyboardFocusable).toBe(true)
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 60, animated: false })
  await fireEvent(screen.getByTestId("breadcrumb-overflow-scroll"), "scroll", {
    nativeEvent: { contentOffset: { y: 60 } },
  })
  await move("PageDown")
  expect(row("d").props.keyboardFocusable).toBe(true)
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 140, animated: false })
  await fireEvent(screen.getByTestId("breadcrumb-overflow-scroll"), "scroll", {
    nativeEvent: { contentOffset: { y: 140 } },
  })
  await move("PageUp")
  expect(row("c").props.keyboardFocusable).toBe(true)
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 120, animated: false })
})
