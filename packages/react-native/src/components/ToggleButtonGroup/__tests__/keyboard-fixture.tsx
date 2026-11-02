import { act, render } from "@testing-library/react-native"
import type { ReactNode } from "react"
import type * as native from "react-native"
import type { View } from "react-native"

import {
  createNativeToolbarKeyboard,
  NativeToolbarKeyboardContext,
  type TNativeToolbarOriginalKeyEvent,
} from "../../../input/nativeToolbarKeyboard"
import {
  createNativeOrdinaryEditorKeys,
  NativeOrdinaryEditorKeysContext,
  type TNativeToolbarDateKeyEvent,
} from "../../../input/ordinaryEditorKeys"

const disposals: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose()
  jest.restoreAllMocks()
})

// Source-only host/status admission fixture. Native Fabric phase traversal is not emulated by production code.
export const createToggleKeyboardFixture = () => {
  const tags = new Map<unknown, number>()
  const tag = (target: unknown) => {
    if (!target) return null
    if (!tags.has(target)) tags.set(target, tags.size + 101)
    return tags.get(target)!
  }
  jest.spyOn(jest.requireActual<typeof native>("react-native"), "findNodeHandle").mockImplementation(tag)
  const session = { windowId: "window", epoch: 1, active: true }
  const toolbar = createNativeToolbarKeyboard("toolbar", () => session)
  const ordinary = createNativeOrdinaryEditorKeys("listeners", () => session)
  disposals.push(() => {
    toolbar.dispose()
    ordinary.dispose()
  })
  const wrap = (children: ReactNode) => (
    <NativeToolbarKeyboardContext.Provider value={toolbar}>
      <NativeOrdinaryEditorKeysContext.Provider value={ordinary}>{children}</NativeOrdinaryEditorKeysContext.Provider>
    </NativeToolbarKeyboardContext.Provider>
  )
  const bindings = () =>
    JSON.parse(toolbar.bindings()) as {
      bindingId: string
      bindingRevision: string
      rootTarget: number
      orientation: string
    }[]
  let sequence = 0
  const acknowledge = async (nested?: View | null) => {
    await act(() => {
      for (const binding of bindings())
        toolbar.acceptStatus(
          JSON.stringify({
            ...binding,
            ownerId: "toolbar",
            ...session,
            sequence: ++sequence,
            ready: true,
            observationReady: true,
            windowActive: true,
            nestedToolbar: binding.rootTarget === tag(nested),
            error: "",
          }),
        )
      for (const binding of ordinary.bindings())
        ordinary.acceptStatus({
          ...binding,
          target: binding.targetTag,
          ownerId: "listeners",
          ...session,
          sequence: ++sequence,
          ready: true,
          windowActive: true,
          error: "",
        })
    })
  }
  let serial = 0
  const event = (
    root: View | null,
    target: View | null,
    ancestor: View | null,
    options: {
      key?: string
      phase?: "down" | "up"
      disposition?: "ordinary" | "arrow" | "tab"
      shiftKey?: boolean
      isComposing?: boolean
      date?: boolean
    } = {},
  ) => {
    const binding = bindings().find((value) => value.rootTarget === tag(root))!
    expect(binding).toBeDefined()
    const observers = ordinary
      .bindings()
      .map((value) => ({ ...value, ownerId: "listeners", windowId: session.windowId, epoch: session.epoch }))
    const route = {
      ...binding,
      ownerId: "toolbar",
      ...session,
      eventId: ++serial,
      physicalPath: [tag(target), tag(root), tag(ancestor)].filter(Boolean),
      observerBindings: observers,
      target: tag(target),
      focusedTarget: tag(target),
      requestedTarget: -1,
      destinationTarget: -1,
      focusObserved: false,
      key: options.key ?? "Home",
      nativeCode: 122,
      phase: options.phase ?? "down",
      cancelled: false,
      repeat: false,
      isComposing: options.isComposing ?? false,
      shiftKey: options.shiftKey ?? false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      characters: "",
      nativeDefaultHandled: false,
      disposition: options.disposition ?? "ordinary",
      timestamp: serial,
    }
    let stopped = false,
      prevented = false
    return {
      target,
      currentTarget: ancestor,
      nativeEvent: {
        ...route,
        kind: "keyboard",
        bindingId: "source-editor",
        bindingRevision: "source-revision",
        observerBindings: JSON.stringify(observers),
        toolbarRoute: JSON.stringify(route),
        ...(options.date ? { segmentId: "day", nativeInstance: "date-instance", sequence: serial } : {}),
      },
      persist: jest.fn(),
      preventDefault: jest.fn(() => {
        prevented = true
      }),
      stopPropagation: jest.fn(() => {
        stopped = true
      }),
      isPropagationStopped: () => stopped,
      isDefaultPrevented: () => prevented,
    } as unknown as TNativeToolbarOriginalKeyEvent & TNativeToolbarDateKeyEvent
  }
  return { tag, session, toolbar, ordinary, wrap, bindings, acknowledge, event }
}

export const renderWithToggleKeyboard: typeof render = (element, options) => {
  const keyboard = createToggleKeyboardFixture()
  return render(element, { ...options, wrapper: ({ children }) => keyboard.wrap(children) })
}
