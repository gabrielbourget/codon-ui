import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import type * as RN from "react-native"
import { findNodeHandle, TurboModuleRegistry, View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "@codon-ui/react-native"

import {
  actWithNativeCollections as act,
  fireEvent,
  renderWithNativeCollections as render,
  screen,
  sourceCollectionPublications,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import * as tableModel from "../../../../../packages/react-native/src/components/Table/model"
import { TableScene } from "../TableScene"

jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "source-model-module"),
    acceptsAction: jest.fn(() => false),
    settleAction: jest.fn(() => false),
  },
}))

const mockViews = new Map<string, RN.View>()
jest.mock("../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof import("react-native")>("react-native")
  const document = {}
  const targets = new WeakMap<object, { tag: number; mounted: boolean }>()
  let sequence = 2000000
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const previous = React.useRef<RN.View | null>(null)
      const bind = React.useCallback(
        (host: RN.View | null) => {
          if (previous.current && previous.current !== host) {
            const target = targets.get(previous.current)
            if (target) target.mounted = false
            Object.defineProperty(previous.current, "isConnected", { configurable: true, value: false })
          }
          if (host) {
            mockViews.set(props.ownerId, host)
            const target = targets.get(host) ?? { tag: ++sequence, mounted: true }
            targets.set(host, target)
            target.mounted = true
            Object.defineProperties(host, {
              // The native mock supplies an SDK tag only while its original ref is attached.
              _nativeTag: {
                configurable: true,
                get: () => {
                  if (!target.mounted) throw new Error("Native mock target is an unmounted component")
                  return target.tag
                },
              },
              isConnected: {
                configurable: true,
                value: props.testID === "table" || props.testID?.startsWith("table-column") === true,
              },
              ownerDocument: { configurable: true, value: document },
            })
          }
          if (!host) mockViews.delete(props.ownerId)
          previous.current = host
          if (typeof ref === "function") ref(host)
          else if (ref) ref.current = host
        },
        [ref],
      )
      return <Native.View {...props} ref={bind} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})

const stickyRequests: { action: string; owner?: string; lease?: string }[] = []
beforeEach(() => {
  jest.useRealTimers()
  stickyRequests.length = 0
  mockViews.clear()
  const leases = new Map<string, string>()
  const original = TurboModuleRegistry.get
  const backend = {
    tableStickyPresentation: (encoded: string) => {
      const request = JSON.parse(encoded)
      stickyRequests.push(request)
      if (request.action === "register") {
        if (
          !Number.isInteger(request.target) ||
          !Number.isInteger(request.containingRoot) ||
          request.target === request.containingRoot
        )
          throw new Error("Synthetic sticky registration requires distinct original native targets")
        const lease = `source-model-lease:${stickyRequests.length}`
        leases.set(request.owner, lease)
        return JSON.stringify({ ...request, lease, registered: true })
      }
      if (request.action === "check")
        return JSON.stringify({ ...request, current: leases.get(request.owner) === request.lease })
      leases.delete(request.owner)
      return JSON.stringify({ ...request, released: true })
    },
  }
  jest
    .spyOn(TurboModuleRegistry, "get")
    .mockImplementation((name) => (name === "CUIMotionSnapshot" ? (backend as never) : original(name)))
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const tree = (mode: "light" | "dark" = "light", width = 520, rounded = 8) => (
  <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
    <NativeThemeProvider mode={mode} overrides={{ radius: { rounded } }}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <View style={{ width }}>
            <TableScene />
          </View>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  </SafeAreaInsetsContext.Provider>
)
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }))
  await act(() => {})
}
const owner = () => JSON.parse(screen.getByTestId("table-scene-owner").props.children as string)
const modelRevision = () =>
  sourceCollectionPublications().find(({ model }) => model?.items.length === 106)?.model?.revision

// This case renders the full Table, changes its environment and exercises two owner callbacks.
it("retains the authored model and original editor for layout, theme and owner bookkeeping updates", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  const view = await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  const revision = modelRevision()
  const builds = bodyFactory.mock.calls.length
  expect(revision).toBeDefined()
  expect(bodyFactory.mock.calls.at(-1)![0].items).toHaveLength(20)
  await view.rerender(tree("dark", 320))
  await press("Toggle held Table owner")
  await press("Original Table widget")
  expect(bodyFactory).toHaveBeenCalledTimes(builds)
  expect(modelRevision()).toBe(revision)
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("Original editor")
  expect(owner().requests).toEqual(['widget:"person-0"'])
}, 15000)

it("refreshes the rendered draft and keeps its ref and callback current across subsequent stable updates", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  const before = modelRevision()
  await fireEvent.changeText(editor, "current draft")
  await act(() => {})
  expect(modelRevision()).not.toBe(before)
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("current draft")
  const builds = bodyFactory.mock.calls.length
  await press("Original Table widget")
  expect(bodyFactory).toHaveBeenCalledTimes(builds)
  expect(owner().requests).toEqual(['widget:"person-0"'])
  await press("Clear original Table editor")
  expect(bodyFactory.mock.calls.length).toBeGreaterThan(builds)
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("")
})

it("rebuilds reordered and empty data while retaining the original edited row through reorder", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  await fireEvent.changeText(editor, "retained draft")
  await act(() => {})
  const builds = bodyFactory.mock.calls.length
  await press("Reverse Table rows")
  expect(bodyFactory.mock.calls.length).toBeGreaterThan(builds)
  expect(bodyFactory.mock.calls.at(-1)![0].items?.map((item) => (item as { id: string }).id)).toEqual(
    Array.from({ length: 20 }, (_, index) => `person-${19 - index}`),
  )
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
  expect(editor).toHaveDisplayValue("retained draft")
  await press("Toggle empty Table")
  expect(bodyFactory.mock.calls.at(-1)![0].items).toEqual([])
  expect(screen.queryByLabelText("Original Table editor")).toBeNull()
  expect(screen.getByText("No people")).toBeTruthy()
})

it("refreshes line and truncation metadata in the actual mixed-content cell", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  const builds = bodyFactory.mock.calls.length
  await press("Cycle mixed-content line limit")
  expect(bodyFactory.mock.calls.length).toBeGreaterThan(builds)
  expect(bodyFactory.mock.calls.at(-1)![0].columns.find(({ id }) => id === "draft")?.maxLines).toBe(1)
  expect(screen.getByText("First paragraph with", { exact: false })).toBeTruthy()
  await press("Toggle mixed-content truncation")
  expect(bodyFactory.mock.calls.at(-1)![0].columns.find(({ id }) => id === "draft")?.truncate).toBe(true)
  expect(screen.getByText("Final paragraph remains in the complete original content.")).toBeTruthy()
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
})

it("passes live model options to the stable authored recipe", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  const view = await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  const builds = bodyFactory.mock.calls.length
  await view.rerender(tree("light", 520, 17))
  expect(bodyFactory.mock.calls.length).toBeGreaterThan(builds)
  expect(bodyFactory.mock.calls.at(-1)![1].roundedRadius).toBe(17)
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
})

it("uses current held-owner callbacks and refreshes resized column descriptors", async () => {
  const bodyFactory = jest.spyOn(tableModel, "createNativeTableBodyModel")
  await render(tree())
  const editor = screen.getByLabelText("Original Table editor")
  const resize = async () => {
    const handle = screen.getByRole("button", { name: "Resize Name column" })
    await fireEvent(handle, "nativeKey", {
      nativeEvent: {
        kind: "keyboard",
        ownerId: handle.props.ownerId,
        target: findNodeHandle(mockViews.get(handle.props.ownerId)!),
        key: "ArrowRight",
        nativeCode: 1,
        characters: "",
        phase: "down",
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "",
        nativeDefaultHandled: true,
        timestamp: 100,
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      persist: jest.fn(),
      isDefaultPrevented: () => false,
    })
    await act(() => {})
  }
  await press("Toggle held Table owner")
  const builds = bodyFactory.mock.calls.length
  await resize()
  expect(owner().widths.name).toBe(150)
  expect(owner().requests).toEqual(['resize:{"columnID":"name","width":166}'])
  expect(bodyFactory).toHaveBeenCalledTimes(builds)
  await press("Toggle held Table owner")
  await resize()
  expect(owner().widths.name).toBe(166)
  expect(bodyFactory.mock.calls.at(-1)![0].columns.find(({ id }) => id === "name")?.width).toBe(166)
  expect(screen.getByRole("columnheader", { name: "Name" })).toHaveStyle({ width: 166 })
  expect(screen.getByLabelText("Original Table editor")).toBe(editor)
})
