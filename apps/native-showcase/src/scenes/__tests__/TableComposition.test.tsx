import "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"

import { createRef } from "react"
import type * as RN from "react-native"
import { Dimensions, findNodeHandle, TurboModuleRegistry } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import {
  actWithNativeCollections as act,
  fireEvent,
  renderWithNativeCollections as render,
  screen,
  userEvent,
} from "../../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { NativeFocusView } from "../../../../../packages/react-native/src/input/NativeFocusView"
import { NativeShowcase } from "../NativeShowcase"

jest.mock("../../../../../packages/react-native/src/input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "source-model-module"),
    acceptsAction: jest.fn(() => false),
    settleAction: jest.fn(() => false),
  },
}))

jest.mock("../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof import("react-native")>("react-native")
  const document = {}
  const targets = new WeakMap<object, { tag: number; mounted: boolean }>()
  let sequence = 2000000
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps>((props, ref) => {
      const previous = React.useRef<RN.View | null>(null)
      const bind = React.useCallback(
        (host: RN.View | null) => {
          if (previous.current && previous.current !== host) {
            const target = targets.get(previous.current)
            if (target) target.mounted = false
            Object.defineProperty(previous.current, "isConnected", { configurable: true, value: false })
          }
          if (host) {
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

const press = async (name: string) => {
  await userEvent.setup().press(screen.getByRole("button", { name }))
  await act(() => {})
}
const enter = async (name: string) => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  await press(name)
}
const changeEnvironment = async () => {
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
  return window
}

const enterTable = async () => {
  try {
    await enter("Table scene")
  } catch (error) {
    if (error instanceof AggregateError)
      throw new Error(
        error.errors.map((cause: unknown) => (cause instanceof Error ? cause.stack : String(cause))).join("\n"),
      )
    throw error
  }
}

describe("Table selection owner", () => {
  let editor: ReturnType<typeof screen.getByLabelText>
  beforeEach(async () => {
    await enterTable()
    editor = screen.getByLabelText("Original Table editor")
    await fireEvent.changeText(editor, "retained Table draft")
    await act(() => {})
    await press("Toggle held Table owner")
  })

  it("keeps actual Table selection requests owner controlled while retaining its original edited row through reorder", async () => {
    const owner = () => JSON.parse(screen.getByTestId("table-scene-owner").props.children as string)
    await userEvent.setup().press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
    await act(() => {})
    expect(owner().selected).toEqual([])
    expect(owner().requests).toEqual(['selection:["person-0"]'])
    await press("Toggle held Table owner")
    await userEvent.setup().press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
    await act(() => {})
    expect(owner().selected).toEqual(["person-0"])
    expect(owner().requests).toEqual(['selection:["person-0"]', 'selection:["person-0"]'])
    await press("Reverse Table rows")
    expect(screen.getByLabelText("Original Table editor")).toBe(editor)
    expect(editor).toHaveDisplayValue("retained Table draft")
    expect(owner().selected).toEqual(["person-0"])
  })
})

describe("Table environment and reset", () => {
  let editor: ReturnType<typeof screen.getByLabelText>
  beforeEach(async () => {
    await enterTable()
    editor = screen.getByLabelText("Original Table editor")
    await fireEvent.changeText(editor, "retained Table draft")
    await act(() => {})
  })

  it("retains the original Table editor and value through live showcase changes, then resets its complete owner", async () => {
    const window = await changeEnvironment()
    try {
      expect(screen.getByLabelText("Original Table editor")).toBe(editor)
      expect(editor).toHaveDisplayValue("retained Table draft")
      expect(JSON.parse(screen.getByTestId("table-scene-owner").props.children as string)).toMatchObject({
        selected: [],
        requests: [],
        page: 1,
        pageSize: 10,
      })
      await press("Reset scene")
      expect(screen.queryByTestId("table-scene-owner")).toBeNull()
      await press("Table scene")
      expect(screen.getByLabelText("Original Table editor")).toHaveDisplayValue("Original editor")
      expect(JSON.parse(screen.getByTestId("table-scene-owner").props.children as string)).toMatchObject({
        selected: [],
        sorts: [],
        filters: [],
        requests: [],
        page: 1,
        pageSize: 10,
        widths: { name: 150, active: 100, draft: 190 },
      })
    } finally {
      await act(() => Dimensions.set({ window }))
    }
  })
})

it("binds the actual public Table entry to the current workspace source", () => {
  const publicEntry = jest.requireActual("@codon-ui/react-native")
  const source = jest.requireActual("../../../../../packages/react-native/src/components/Table/Table")
  expect(publicEntry.Table).toBe(source.Table)
})

it("models stable original SDK tags and retires replaced and unmounted native mock refs", async () => {
  const sdk = jest.requireActual<{ findNodeHandle: typeof RN.findNodeHandle }>(
    "react-native/Libraries/ReactNative/RendererImplementation",
  )
  const ref = createRef<RN.View>()
  const view = await render(<NativeFocusView ref={ref} testID="table" />)
  const original = ref.current!,
    tag = sdk.findNodeHandle(original)
  expect(tag).toBeGreaterThan(2000000)
  expect(findNodeHandle(original)).toBe(tag)
  await view.rerender(<NativeFocusView ref={ref} testID="table" style={{ width: 120 }} />)
  expect(ref.current).toBe(original)
  expect(sdk.findNodeHandle(original)).toBe(tag)
  await view.rerender(<NativeFocusView key="replacement" ref={ref} testID="table" />)
  const replacement = ref.current!
  expect(replacement).not.toBe(original)
  expect(findNodeHandle(replacement)).not.toBe(tag)
  expect(() => sdk.findNodeHandle(original)).toThrow("unmounted component")
  expect(findNodeHandle(original)).toBeNull()
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(findNodeHandle(replacement)).toBeNull()
})
