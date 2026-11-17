import { act, screen } from "@testing-library/react-native"
import type { ReactNode } from "react"
import type { GestureResponderEvent, View } from "react-native"

import { NativeFloatingLayerHost } from "../NativeFloatingLayerHost"

const hidden = { includeHiddenElements: true }
type Rect = [x: number, y: number, width: number, height: number]
type Node = ReturnType<typeof screen.getByTestId>
const layout = ([x, y, width, height]: Rect) => ({ nativeEvent: { layout: { x, y, width, height } } })

export const SelectTestHost = ({ children }: { children: ReactNode }) => (
  <NativeFloatingLayerHost>{children}</NativeFloatingLayerHost>
)

export const acknowledgeSelectHost = async (scope: Node) => {
  const windowId = scope.props.acceptedWindowId || "select-test-window"
  const epoch = scope.props.acceptedEpoch || 1
  for (const ready of scope.props.acceptedWindowId ? [true] : [false, true]) {
    const props = scope.props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId,
          epoch,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
}

export const prepareSelectPopover = async (
  id = "select",
  {
    viewport = [0, 0, 320, 500],
    anchor = [80, 100, 120, 25],
    content = [0, 0, anchor[2], 100],
    queries = screen,
    flushFrames,
  }: {
    viewport?: Rect
    anchor?: Rect
    content?: Rect
    queries?: Pick<typeof screen, "getAllByTestId" | "getByTestId">
    flushFrames?: () => Promise<void>
  } = {},
) => {
  const trigger = queries
    .getAllByTestId(`${id}-trigger`, hidden)
    .find((node) => node.props.accessibilityState?.expanded)
  if (!trigger) throw new Error(`Open Select trigger not found for ${id}`)
  const popup = queries.getByTestId(`${id}-popover`, hidden)
  let host: Node | null = trigger.parent
  while (
    host &&
    (typeof host.props.onTouchEndCapture !== "function" || typeof host.props.onNativeScopeStatus !== "function")
  )
    host = host.parent
  if (!host) throw new Error("The Select fixture requires a same-window floating host")
  const scope = host
  const measure = (target: Node, box: Rect) => {
    // The RN Jest preset forwards native refs to mock component instances.
    let fiber = target.unstable_fiber
    while (fiber && typeof fiber.stateNode?.measureInWindow !== "function") fiber = fiber.return
    if (!fiber) throw new Error(`Native measurement fixture missing for ${target.props.testID}`)
    Object.defineProperty(fiber.stateNode, "measureInWindow", {
      configurable: true,
      value: (callback: Parameters<View["measureInWindow"]>[0]) => callback(...box),
    })
  }
  measure(scope, viewport)
  measure(trigger, anchor)
  measure(popup, content)
  await act(() => trigger.props.onLayout(layout(anchor)))
  await act(() => scope.props.onLayout(layout(viewport)))
  await act(() => popup.props.onLayout(layout(content)))
  await acknowledgeSelectHost(scope)
  if (flushFrames) await flushFrames()
  else
    await act(async () => {
      if ("clock" in setTimeout) await jest.advanceTimersByTimeAsync(48)
      else await new Promise<void>((resolve) => setTimeout(resolve, 48))
    })
  const outside = async () => {
    const touch = () =>
      ({
        nativeEvent: { identifier: "1" },
        persist: jest.fn(),
        isPropagationStopped: () => false,
      }) as unknown as GestureResponderEvent
    await act(() => scope.props.onTouchStartCapture(touch()))
    await act(() => scope.props.onTouchEndCapture(touch()))
  }
  return { popup, trigger, host: scope, outside }
}

// Teleport's Jest tree retains the portal's logical parent under the hidden background.
export const pressSelectOption = async (node: Node) => {
  const event = {
    persist: jest.fn(),
    currentTarget: 17,
    nativeEvent: {
      target: 17,
      timestamp: Date.now(),
      identifier: 1,
      pageX: 1,
      pageY: 1,
      locationX: 1,
      locationY: 1,
      touches: [],
      changedTouches: [],
    },
  }
  await act(() => {
    node.props.onResponderGrant(event)
    node.props.onResponderRelease(event)
  })
}
