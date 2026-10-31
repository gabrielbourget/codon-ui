import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Activity, createRef } from "react"
import type * as RN from "react-native"

import type { NativeFormActionStatus } from "../../input/specs/CUIFocusViewNativeComponent"
import { NativeThemeProvider } from "../../theme"
import { NativeFormRegistryContext } from "../context"
import { NativeForm } from "../NativeForm"
import { NativeFormAction, type TNativeFormActionProps } from "../NativeFormAction"
import { NativeFormRegistry } from "../registry"

const mockRead = jest.fn<Promise<string>, [string]>()
jest.mock("../../input/specs/NativeCUIFormDocument", () => ({
  __esModule: true,
  default: { getSnapshot: (request: string) => mockRead(request) },
}))
jest.mock("../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))

beforeEach(() => {
  jest.useFakeTimers()
  mockRead.mockReset()
  const targets = new WeakMap<object, number>()
  let next = 100
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((view) => {
    if (!view || typeof view !== "object") return null
    if (!targets.has(view)) targets.set(view, ++next)
    return targets.get(view)!
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const setup = async (props: Partial<TNativeFormActionProps> = {}) => {
  const registry = new NativeFormRegistry()
  const form = createRef<RN.View>(),
    button = createRef<RN.View>()
  const submit = jest.fn(),
    reset = jest.fn(),
    result = jest.fn(),
    press = jest.fn()
  const content = (props: Partial<TNativeFormActionProps>, mode: "visible" | "hidden" = "visible") => (
    <NativeThemeProvider>
      <NativeFormRegistryContext.Provider value={registry}>
        <NativeForm id="owner" ref={form} onSubmit={submit} onReset={reset}>
          <Activity mode={mode}>
            <NativeFormAction ref={button} onPress={press} onActionResult={result} {...props}>
              Act
            </NativeFormAction>
          </Activity>
        </NativeForm>
      </NativeFormRegistryContext.Provider>
    </NativeThemeProvider>
  )
  const view = await render(content(props))
  let status!: NativeFormActionStatus
  let accept = true
  const ready = async (updates: Partial<NativeFormActionStatus> = {}) => {
    const host = screen.getByRole("button").props
    const binding = JSON.parse(host.nativeFormActionBinding) as { ownerId: string; descriptorRevision: string }
    status = {
      ...binding,
      viewOwnerId: host.ownerId,
      target: jest.requireActual<typeof RN>("react-native").findNodeHandle(button.current)!,
      surfaceId: 11,
      windowId: "model-window",
      epoch: 1,
      sequence: 1,
      scopeOwnerId: "",
      scopeEpoch: 0,
      attached: true,
      active: true,
      enabled: true,
      ...updates,
    }
    await act(() => host.onNativeFormActionStatus({ nativeEvent: status }))
  }
  const packet = (request: { target: number; requestId: string }) => {
    const descriptor = [...registry.forms.values()][0].descriptor
    const nodes = [
      { target: 1, parent: 0, component: "RootView" },
      { target: descriptor.target, parent: 1, component: "View" },
      { target: descriptor.metadataTarget, parent: descriptor.target, component: "CUIFormRoot" },
      {
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(button.current),
        parent: descriptor.target,
        component: "CUIFocusView",
      },
    ].map((node) => ({ ...node, hidden: false, displayNone: false }))
    return {
      ...request,
      documentId: "model-doc",
      revision: "9",
      rootTarget: 1,
      surfaceId: 11,
      nodes,
      forms: [{ ...descriptor, position: 2 }],
      fields: [],
    }
  }
  mockRead.mockImplementation(async (encoded) => {
    const request = JSON.parse(encoded)
    const document = packet(request)
    return JSON.stringify({
      ...document,
      ...(request.actionAdmission
        ? {
            actionAdmission: {
              accepted: accept,
              lease: { ...status },
              documentId: "model-doc",
              revision: "9",
              formDescriptorId: document.forms[0].descriptorId,
              formDescriptorRevision: document.forms[0].descriptorRevision,
            },
          }
        : {}),
    })
  })
  const activate = () => act(() => userEvent.setup().press(screen.getByRole("button")))
  const activateOriginal = async () => {
    const host = screen.getByRole("button").props
    let prevented = false
    const event = {
      target: status.target,
      currentTarget: status.target,
      nativeEvent: {
        target: status.target,
        timestamp: 100,
        identifier: 0,
        pageX: 0,
        pageY: 0,
        locationX: 0,
        locationY: 0,
      },
      persist: jest.fn(),
      get defaultPrevented() {
        return prevented
      },
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
    }
    await act(() => host.onResponderGrant(event))
    await act(() => host.onResponderRelease(event))
    return event
  }
  return {
    registry,
    view,
    form,
    button,
    submit,
    reset,
    result,
    press,
    ready,
    activate,
    activateOriginal,
    packet,
    reject: () => {
      accept = false
    },
    update: (props: Partial<TNativeFormActionProps>) => view.rerender(content(props)),
    hide: () => view.rerender(content(props, "hidden")),
    restore: () => view.rerender(content(props)),
  }
}

it("preserves the actual original button and press event through exact native form admission", async () => {
  const value = await setup()
  const original = value.button.current
  await value.ready()
  await value.activate()
  expect(value.button.current === original).toBe(true)
  expect(value.submit).toHaveBeenCalledTimes(1)
  const request = value.submit.mock.calls[0][0]
  expect(request.form === value.form.current).toBe(true)
  expect(request.origin).toBe("native")
  expect(request.action).toBe("submit")
  expect(request.entries).toEqual([])
  expect(request.sourceEvent === value.press.mock.calls[0][0]).toBe(true)
  expect(mockRead).toHaveBeenCalledTimes(2)
  expect(value.result.mock.calls[0][0].status).toBe("submitted")
})

it("preserves the caller's original-event veto before any document read or form callback", async () => {
  const order: string[] = []
  const value = await setup({
    onPress: (event) => {
      order.push("press")
      event.preventDefault()
    },
  })
  await value.ready()
  await value.activateOriginal()
  expect(order).toEqual(["press"])
  expect(mockRead).not.toHaveBeenCalled()
  expect(value.submit).not.toHaveBeenCalled()
  expect(value.result.mock.calls[0][0].status).toBe("retired")
})

it("reports missing readiness and denied native admission without submitting", async () => {
  const value = await setup()
  await value.activate()
  expect(value.result.mock.calls[0][0].status).toBe("retired")
  expect(mockRead).not.toHaveBeenCalled()
  await value.ready()
  value.reject()
  await value.activate()
  expect(value.submit).not.toHaveBeenCalled()
  expect(value.result.mock.calls.at(-1)![0].status).toBe("retired")
})

it("keeps callback-only updates current without replacing the button or acknowledged lease", async () => {
  const first = jest.fn(),
    latest = jest.fn()
  const value = await setup({ onPress: first })
  await value.ready()
  const original = value.button.current,
    revision = screen.getByRole("button").props.nativeFormActionBinding
  await value.update({ onPress: latest })
  expect(value.button.current).toBe(original)
  expect(screen.getByRole("button").props.nativeFormActionBinding).toBe(revision)
  await value.activate()
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
  expect(value.submit).toHaveBeenCalledTimes(1)
})

it("retires the old action when submit changes to reset and admits only the new revision", async () => {
  const value = await setup()
  await value.ready()
  await value.update({ action: "reset" })
  await value.activate()
  expect(value.submit).not.toHaveBeenCalled()
  expect(value.reset).not.toHaveBeenCalled()
  await value.ready({ epoch: 2, sequence: 2 })
  await value.activate()
  expect(value.reset).toHaveBeenCalledTimes(1)
  expect(value.reset.mock.calls[0][0].action).toBe("reset")
})

it("retires a pending original action after a real status callback loses its window", async () => {
  const value = await setup()
  await value.ready()
  let finish!: () => void
  mockRead.mockImplementationOnce(
    (encoded) =>
      new Promise((resolve) => {
        const document = JSON.stringify(value.packet(JSON.parse(encoded)))
        finish = () => resolve(document)
      }),
  )
  await value.activate()
  await value.ready({ active: false, epoch: 2, sequence: 2 })
  await act(() => finish())
  expect(value.submit).not.toHaveBeenCalled()
  expect(mockRead).toHaveBeenCalledTimes(1)
  expect(value.result.mock.calls[0][0].status).toBe("retired")
})

it.each(["owner", ""])("uses the exact explicit form association %j", async (form) => {
  const value = await setup({ form })
  await value.ready()
  await value.activate()
  expect(value.submit.mock.calls.length).toBe(form ? 1 : 0)
  expect(value.result.mock.calls[0][0].status).toBe(form ? "submitted" : "retired")
  expect(mockRead.mock.calls.length).toBe(form ? 2 : 1)
})

it.each(["isDisabled", "isPending"] as const)("preserves the original button's %s activation guard", async (key) => {
  const value = await setup({ [key]: true })
  await value.ready({ enabled: false })
  await value.activate()
  expect(value.press).not.toHaveBeenCalled()
  expect(value.submit).not.toHaveBeenCalled()
  expect(mockRead).not.toHaveBeenCalled()
})

it("requires a fresh native lease after Activity disconnects and restores the same original button", async () => {
  const value = await setup()
  await value.ready()
  const original = value.button.current
  await value.hide()
  expect(value.button.current).toBeNull()
  await value.restore()
  expect(value.button.current === original).toBe(true)
  await value.activate()
  expect(mockRead).not.toHaveBeenCalled()
  expect(value.submit).not.toHaveBeenCalled()
  await value.ready({ epoch: 3, sequence: 3 })
  await value.activate()
  expect(value.submit).toHaveBeenCalledTimes(1)
})
