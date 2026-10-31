import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ReactElement } from "react"
import * as RN from "react-native"
import type { TestInstance } from "test-renderer"

export { fireEvent, screen, userEvent } from "@testing-library/react-native"

const mockTargets = new WeakMap<object, number>()
const mockRootTargets = new Map<string, number>()
const mockNodeTargets = new Map<string, number>()
let mockNextTarget = 1000000
jest.mock("../../input/specs/CUICollectionRootNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (host: RN.View | null) => {
          if (host && !mockTargets.has(host)) mockTargets.set(host, ++mockNextTarget)
          if (host) mockRootTargets.set(props.ownerId, mockTargets.get(host)!)
          if (typeof ref === "function") ref(host)
          else if (ref) ref.current = host
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
  }
})
jest.mock("../../input/specs/CUICollectionNodeNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

let restoreFindNodeHandle: (() => void) | undefined
beforeEach(() => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const original = native.findNodeHandle
  const spy = jest.spyOn(native, "findNodeHandle")
  spy.mockImplementation((host) =>
    host && typeof host === "object" && mockTargets.has(host) ? mockTargets.get(host)! : original(host),
  )
  restoreFindNodeHandle = () => spy.mockRestore()
})
afterEach(() => restoreFindNodeHandle?.())
const sequences = new Map<string, number>()
const signatures = new Map<string, string>()
type TView = Awaited<ReturnType<typeof render>>

// These explicit synthetic receipts exercise component behavior; they establish no native hierarchy or input proof.
export const confirmNativeCollections = async (view: Pick<TView, "container"> = screen) => {
  let published = 0
  for (const root of view.container.queryAll((host) => typeof host.props.rootRevision === "string")) {
    const nodes = root
      .queryAll((host) => typeof host.props.descriptorId === "string")
      .filter((host) => {
        let current: TestInstance | null = host
        while (current && current !== root) {
          if (RN.StyleSheet.flatten(current.props.style)?.display === "none") return false
          current = current.parent
        }
        return true
      })
    const positions = new Map<string, number>()
    const parentId = (host: TestInstance) => {
      let parent = host.parent
      while (parent && parent !== root) {
        if (typeof parent.props.descriptorId === "string") return parent.props.descriptorId as string
        parent = parent.parent
      }
      return ""
    }
    const parents = new Map(nodes.map((host) => [host, parentId(host)]))
    const retainedParents = new Set(parents.values())
    const hierarchy = nodes.map((host) => {
      const id = host.props.descriptorId as string,
        parentDescriptorId = parents.get(host)!
      const index = positions.get(parentDescriptorId) ?? 0
      positions.set(parentDescriptorId, index + 1)
      if (!mockNodeTargets.has(id)) mockNodeTargets.set(id, ++mockNextTarget)
      return {
        descriptorId: id,
        descriptorRevision: host.props.descriptorRevision,
        parentDescriptorId,
        target: mockNodeTargets.get(id),
        index,
        retainedIndex: index,
        hasRetainedChildren: retainedParents.has(id),
      }
    })
    const owner = root.props.ownerId as string
    const signature = JSON.stringify([
      owner,
      root.props.rootId,
      root.props.rootRevision,
      mockRootTargets.get(owner),
      hierarchy,
    ])
    if (signatures.get(owner) === signature) continue
    signatures.set(owner, signature)
    published++
    const sequence = (sequences.get(owner) ?? 0) + 1
    sequences.set(owner, sequence)
    // The root's real mock ref is the only object assigned this reserved target.
    const target = mockRootTargets.get(owner)
    if (!target) throw new Error("Synthetic metadata root ref was not bound: " + owner)
    await act(() =>
      root.props.onNativeCollectionCommit({
        persist: jest.fn(),
        nativeEvent: {
          ownerId: owner,
          rootId: root.props.rootId,
          rootRevision: root.props.rootRevision,
          target,
          surfaceId: 11,
          windowId: "source-model-window",
          epoch: 1,
          sequence,
          mountRevision: "source-model",
          complete: true,
          attached: true,
          metadataOnly: true,
          error: "",
          hierarchy: JSON.stringify(hierarchy),
        },
      }),
    )
  }
  return published
}

export const flushNativeCollectionActions = async () => {
  let acknowledged = 0
  for (const root of screen.container.queryAll((host) => typeof host.props.rootRevision === "string")) {
    const requests = JSON.parse(root.props.actionRequests ?? "[]") as {
      requestId: string
      binding: string
      visibleTarget: number
    }[]
    for (const request of requests) {
      acknowledged++
      await act(() =>
        root.props.onNativeCollectionAction({
          nativeEvent: {
            ...JSON.parse(request.binding),
            requestId: request.requestId,
            visibleTarget: request.visibleTarget,
            accepted: true,
          },
        }),
      )
    }
  }
  return acknowledged
}

export const actWithNativeCollections = async <T,>(callback: () => T | Promise<T>): Promise<T> => {
  const result = await act(callback)
  for (let turn = 0; turn < 8; turn++) {
    const actions = await flushNativeCollectionActions()
    const commits = await confirmNativeCollections()
    if (!actions && !commits) return result
  }
  throw new Error("Synthetic collection actions did not settle")
}

// Composition tests still deliver their original event; only the private synthetic native receipts are settled here.
export const fireEventWithNativeCollections: typeof fireEvent = Object.assign(
  (...args: Parameters<typeof fireEvent>) => actWithNativeCollections(() => fireEvent(...args)),
  {
    press: (...args: Parameters<typeof fireEvent.press>) => actWithNativeCollections(() => fireEvent.press(...args)),
    changeText: (...args: Parameters<typeof fireEvent.changeText>) =>
      actWithNativeCollections(() => fireEvent.changeText(...args)),
    scroll: (...args: Parameters<typeof fireEvent.scroll>) => actWithNativeCollections(() => fireEvent.scroll(...args)),
  },
)
export const rerenderWithNativeCollections = (...args: Parameters<typeof screen.rerender>) =>
  actWithNativeCollections(() => screen.rerender(...args))

export const renderWithNativeCollections: typeof render = async (element: ReactElement, options) => {
  const view = await render(element, options)
  await confirmNativeCollections(view)
  const rerender = view.rerender
  view.rerender = async (next) => {
    await rerender(next)
    await confirmNativeCollections(view)
  }
  return view
}
