import { act, render, screen } from "@testing-library/react-native"
import { createRef, useContext, useEffect, useRef, useState } from "react"
import type { ContextType } from "react"
import { AccessibilityInfo, Text, TextInput, View } from "react-native"

import { MotionGlobalConfig, frameData, time } from "../kernel"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"
import { NativePopRootContext, useNativeIsPresent, useNativePresence, useNativePresenceData } from "../presence/context"
import type { TNativePopFrame } from "../presence/context"
import { NativeAnimatePresence } from "../presence/NativeAnimatePresence"
import { NativeLayoutGroup, NativeLayoutGroupContext } from "../projection/NativeLayoutGroup"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestContainerFocus: jest.fn(), requestKeyboardBlur: jest.fn() },
}))
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
const removals = new Map<string, () => void>(),
  identities = new Map<string, object>()
let nextFrame = 0
const turn = async () => {
  for (let i = 0; i < 14; i++) await Promise.resolve()
}
const flush = async (timestamp: number) => {
  await act(async () => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
    await turn()
  })
}
const Probe = ({ id }: { id: string }) => {
  const [present, remove] = useNativePresence(),
    data = useNativePresenceData()
  const [identity] = useState(() => ({}))
  identities.set(id, identity)
  useEffect(() => {
    if (!present && remove) removals.set(id, remove)
  }, [id, present, remove])
  return <Text testID={id}>{`${id}/${present}/${String(data)}`}</Text>
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(async () => {
  await flush(10000)
  frames.clear()
  removals.clear()
  identities.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it.each(["sync", "wait"] as const)(
  "retains original state and the latest committed incoming child in %s mode",
  async (mode) => {
    const complete = jest.fn()
    await render(
      <NativeAnimatePresence mode={mode} onExitComplete={complete}>
        <Probe key="a" id="a" />
      </NativeAnimatePresence>,
    )
    const identity = identities.get("a")
    await screen.rerender(
      <NativeAnimatePresence mode={mode} onExitComplete={complete}>
        <Probe key="b" id="b" />
      </NativeAnimatePresence>,
    )
    expect(screen.getByTestId("a").props.children).toContain("false")
    expect(identities.get("a")).toBe(identity)
    expect(screen.queryByTestId("b") !== null).toBe(mode === "sync")
    await screen.rerender(
      <NativeAnimatePresence mode={mode} onExitComplete={complete}>
        <Probe key="c" id="c" />
      </NativeAnimatePresence>,
    )
    await act(() => removals.get("a")!())
    if (mode === "sync") await act(() => removals.get("b")!())
    expect(screen.queryByTestId("a")).toBeNull()
    expect(screen.getByTestId("c")).toBeTruthy()
    expect(complete).toHaveBeenCalledTimes(1)
    await screen.unmount()
  },
)
it("keeps each descendant until every registered exit completes", async () => {
  const Child = () => (
    <View>
      <Probe id="one" />
      <Probe id="two" />
    </View>
  )
  await render(
    <NativeAnimatePresence>
      <Child key="child" />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence />)
  await act(() => removals.get("one")!())
  expect(screen.getByTestId("two")).toBeTruthy()
  await act(() => removals.get("two")!())
  expect(screen.queryByTestId("two")).toBeNull()
  await screen.unmount()
})
it("rejects stale safeToRemove generations after a child re-enters and exits again", async () => {
  await render(
    <NativeAnimatePresence>
      <Probe key="a" id="a" />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence />)
  const stale = removals.get("a")!
  await screen.rerender(
    <NativeAnimatePresence>
      <Probe key="a" id="a" />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence />)
  const current = removals.get("a")!
  await act(stale)
  expect(screen.getByTestId("a")).toBeTruthy()
  await act(current)
  expect(screen.queryByTestId("a")).toBeNull()
  await screen.unmount()
})
it("propagates a parent exit only when explicitly enabled", async () => {
  const Nested = ({ propagate }: { propagate: boolean }) => (
    <NativeAnimatePresence propagate={propagate}>
      <Probe key="leaf" id="leaf" />
    </NativeAnimatePresence>
  )
  await render(
    <NativeAnimatePresence>
      <Nested key="nested" propagate />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence />)
  expect(screen.getByTestId("leaf").props.children).toContain("false")
  await act(() => removals.get("leaf")!())
  expect(screen.queryByTestId("leaf")).toBeNull()
  await screen.unmount()
})
it("passes zero custom data to an exiting tree and removes children with no subscribers", async () => {
  await render(
    <NativeAnimatePresence custom={7}>
      <Probe key="a" id="a" />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence custom={0} />)
  expect(screen.getByTestId("a").props.children).toBe("a/false/0")
  await act(() => removals.get("a")!())
  await screen.unmount()
  await render(
    <NativeAnimatePresence>
      <Text key="plain" testID="plain">
        Plain
      </Text>
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence />)
  expect(screen.queryByTestId("plain")).toBeNull()
  await screen.unmount()
})
it("keeps the actual owned root and controlled empty editor until the real source exit animation completes", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    request = jest.fn(),
    complete = jest.fn()
  const child = (
    <NativeMotionOwnerHost
      key="owner"
      ref={root}
      testID="owner"
      motion={{
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1, ease: "linear" },
      }}
    >
      <TextInput ref={editor} testID="editor" value="" onChangeText={request} />
    </NativeMotionOwnerHost>
  )
  await render(<NativeAnimatePresence onExitComplete={complete}>{child}</NativeAnimatePresence>)
  const originalRoot = root.current,
    originalEditor = editor.current
  await screen.rerender(<NativeAnimatePresence onExitComplete={complete} />)
  await flush(1050)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("editor").props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  await flush(1120)
  await flush(1136)
  expect(root.current).toBeNull()
  expect(editor.current).toBeNull()
  expect(complete).toHaveBeenCalledTimes(1)
  await screen.unmount()
})
it("re-enters an interrupted owner without remounting its editor", async () => {
  const root = createRef<View>(),
    editor = createRef<TextInput>()
  const child = (
    <NativeMotionOwnerHost
      key="owner"
      ref={root}
      motion={{
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2, ease: "linear" },
      }}
    >
      <TextInput ref={editor} value="" onChangeText={() => {}} />
    </NativeMotionOwnerHost>
  )
  await render(<NativeAnimatePresence>{child}</NativeAnimatePresence>)
  const originalRoot = root.current,
    originalEditor = editor.current
  await screen.rerender(<NativeAnimatePresence />)
  await flush(1080)
  await screen.rerender(<NativeAnimatePresence>{child}</NativeAnimatePresence>)
  await flush(1300)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  await screen.unmount()
})
it("captures pop frames before freezing the same registered root and releases only that layer", async () => {
  const order: string[] = [],
    release = jest.fn(),
    frame: TNativePopFrame = { width: 100, height: 40, left: 10, top: 20, right: 190, bottom: 140, direction: "rtl" }
  const Root = () => {
    const register = useContext(NativePopRootContext),
      root = useRef({
        read: () => {
          order.push("read")
          return frame
        },
        freeze: jest.fn(() => {
          order.push("freeze")
          return release
        }),
      })
    useEffect(() => register?.(root.current), [register])
    return <Probe id="pop" />
  }
  await render(
    <NativeAnimatePresence mode="popLayout" anchorX="right" anchorY="bottom">
      <Root key="pop" />
    </NativeAnimatePresence>,
  )
  await screen.rerender(<NativeAnimatePresence mode="popLayout" anchorX="right" anchorY="bottom" />)
  expect(order).toEqual(["read", "freeze"])
  await act(() => removals.get("pop")!())
  expect(release).toHaveBeenCalledTimes(1)
  await screen.unmount()
})
it("namespaces layout IDs with stable inherited or independent groups", async () => {
  const captured: Record<string, ContextType<typeof NativeLayoutGroupContext>> = {}
  const Group = ({ id }: { id: string }) => {
    captured[id] = useContext(NativeLayoutGroupContext)
    return null
  }
  await render(
    <NativeLayoutGroup id="parent">
      <Group id="parent" />
      <NativeLayoutGroup id="child">
        <Group id="child" />
      </NativeLayoutGroup>
      <NativeLayoutGroup id="id" inherit="id">
        <Group id="id" />
      </NativeLayoutGroup>
      <NativeLayoutGroup id="separate" inherit={false}>
        <Group id="separate" />
      </NativeLayoutGroup>
    </NativeLayoutGroup>,
  )
  expect(captured.child.id).toBe("parent-child")
  expect(captured.child.group).toBe(captured.parent.group)
  expect(captured.id.id).toBe("parent-id")
  expect(captured.id.group).not.toBe(captured.parent.group)
  expect(captured.separate.id).toBe("separate")
  await screen.unmount()
})
it("reports presence outside a coordinator without conditional hooks", async () => {
  const Outside = () => {
    const present = useNativeIsPresent()
    const [subscribed] = useNativePresence()
    return <Text testID="outside">{`${present}/${subscribed}`}</Text>
  }
  await render(<Outside />)
  expect(screen.getByTestId("outside").props.children).toBe("true/true")
  await screen.unmount()
})
