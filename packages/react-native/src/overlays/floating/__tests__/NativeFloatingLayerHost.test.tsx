import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createContext, createRef, useContext, useLayoutEffect, useState } from "react"
import { View } from "react-native"

import { Button, Modal, NativeFloatingLayerHost, NativeOverlayProvider, Text } from "../../.."
import { NativeFloatingPortal, useNativeFloatingHost } from "../NativeFloatingLayerHost"

const DraftContext = createContext("outside")
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
type THost = ReturnType<typeof useNativeFloatingHost>
const Probe = ({ observe }: { observe: (host: THost) => void }) => {
  const host = useNativeFloatingHost()
  useLayoutEffect(() => {
    observe(host)
  }, [host, observe])
  return null
}
const Draft = () => {
  const [count, setCount] = useState(0)
  const draft = useContext(DraftContext)
  return (
    <>
      <Text testID="draft">{`${draft}:${count}`}</Text>
      <Button onPress={() => setCount((value) => value + 1)}>Increase</Button>
    </>
  )
}

it("requires an explicit same-window host for floating content", async () => {
  await expect(
    render(
      <NativeFloatingPortal>
        <Text>Missing host</Text>
      </NativeFloatingPortal>,
    ),
  ).rejects.toThrow("NativeFloatingLayerHost in the same native window")
})

it("exposes the actual root ref, native layout event and caller's zero-size style", async () => {
  const ref = createRef<View>()
  const onLayout = jest.fn()
  let host: THost | undefined
  await render(
    <NativeFloatingLayerHost ref={ref} testID="root" style={{ width: 0, height: 0 }} onLayout={onLayout}>
      <Probe observe={(value) => (host = value)} />
    </NativeFloatingLayerHost>,
  )
  const root = screen.getByTestId("root")
  expect(ref.current?.measureInWindow).toEqual(expect.any(Function))
  expect(root).toHaveStyle({ flex: 1, width: 0, height: 0 })
  expect(root.props).toMatchObject({ pointerEvents: "box-none", collapsable: false })
  expect(host?.layout).toBeNull()
  const event = { nativeEvent: { layout: { x: 8, y: 12, width: 0, height: 0 } } }
  await fireEvent(root, "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
  expect(host?.layout).toEqual({ width: 0, height: 0 })
  expect(host?.generation.current).toBe(1)
})

it("keeps each host name and layout independent, including nested native-window roots", async () => {
  const hosts = new Map<string, THost>()
  await render(
    <NativeFloatingLayerHost testID="outer">
      <Probe observe={(host) => hosts.set("outer", host)} />
      <NativeFloatingLayerHost testID="inner">
        <Probe observe={(host) => hosts.set("inner", host)} />
      </NativeFloatingLayerHost>
    </NativeFloatingLayerHost>,
  )
  expect(hosts.get("inner")?.name).not.toBe(hosts.get("outer")?.name)
  await fireEvent(screen.getByTestId("inner"), "layout", {
    nativeEvent: { layout: { x: 100, y: 200, width: 300, height: 400 } },
  })
  expect(hosts.get("inner")?.layout).toEqual({ width: 300, height: 400 })
  expect(hosts.get("outer")?.layout).toBeNull()
  expect(hosts.get("outer")?.generation.current).toBe(0)
})

it("gives an existing Modal window its own host without moving the source context", async () => {
  const hosts = new Map<string, THost>()
  await render(
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>
        <Probe observe={(host) => hosts.set("root", host)} />
        <DraftContext.Provider value="modal draft">
          <Modal defaultOpen accessibilityLabel="Draft">
            <Probe observe={(host) => hosts.set("window", host)} />
            <NativeFloatingPortal>
              <Draft />
            </NativeFloatingPortal>
          </Modal>
        </DraftContext.Provider>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>,
  )
  expect(screen.getByTestId("modal-floating-host")).toBeOnTheScreen()
  expect(hosts.get("window")?.name).not.toBe(hosts.get("root")?.name)
  expect(screen.getByTestId("draft", { includeHiddenElements: true })).toHaveTextContent("modal draft:0")
})

it("preserves the original React context, child state and callbacks through host layout updates", async () => {
  const fixture = (draft: string) => (
    <NativeFloatingLayerHost testID="root">
      <DraftContext.Provider value={draft}>
        <View style={{ overflow: "hidden", height: 1 }}>
          <NativeFloatingPortal>
            <Draft />
          </NativeFloatingPortal>
        </View>
      </DraftContext.Provider>
    </NativeFloatingLayerHost>
  )
  const result = await render(fixture("first"))
  await fireEvent.press(screen.getByRole("button", { name: "Increase" }))
  expect(screen.getByTestId("draft")).toHaveTextContent("first:1")
  await fireEvent(screen.getByTestId("root"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 400 } },
  })
  await result.rerender(fixture("replacement"))
  expect(screen.getByTestId("draft")).toHaveTextContent("replacement:1")
  await fireEvent.press(screen.getByRole("button", { name: "Increase" }))
  expect(screen.getByTestId("draft")).toHaveTextContent("replacement:2")
})

it("retires the host generation and old layout callback after keyed replacement/unmount", async () => {
  const oldLayout = jest.fn()
  const hosts: THost[] = []
  const fixture = (key: string) => (
    <NativeFloatingLayerHost key={key} testID="root" onLayout={oldLayout}>
      <Probe observe={(host) => hosts.push(host)} />
    </NativeFloatingLayerHost>
  )
  const result = await render(fixture("first"))
  const old = hosts[0]!
  const stale = screen.getByTestId("root").props.onLayout
  await result.rerender(fixture("second"))
  expect(old.live.current).toBe(false)
  expect(old.generation.current).toBe(1)
  expect(hosts.at(-1)?.name).not.toBe(old.name)
  await act(() => stale({ nativeEvent: { layout: { x: 0, y: 0, width: 1, height: 1 } } }))
  expect(oldLayout).not.toHaveBeenCalled()
  expect(hosts.at(-1)?.layout).toBeNull()
  await result.unmount()
  expect(hosts.at(-1)?.live.current).toBe(false)
})

it("renders unique native target hosts in the owned presentation order without moving React children", async () => {
  let host: THost | undefined
  const result = await render(
    <NativeFloatingLayerHost>
      <Probe
        observe={(value) => {
          host = value
        }}
      />
    </NativeFloatingLayerHost>,
  )
  const options = { parent: null, isOpen: true, isModal: false, isKeyboardDismissDisabled: false, onDismiss: jest.fn() }
  await act(() => {
    host!.layers.register("first", { ...options, priority: 10 })
    host!.layers.register("second", { ...options, priority: 0 })
  })
  const names = (tree: unknown): string[] => {
    if (Array.isArray(tree)) return tree.flatMap(names)
    if (!tree || typeof tree !== "object") return []
    const node = tree as { type?: string; props?: { name?: string }; children?: unknown[] }
    const current = node.type === "PortalHostView" && node.props?.name?.startsWith(host!.name) ? [node.props.name] : []
    return [...current, ...names(node.children)]
  }
  expect(names(result.toJSON())).toEqual([host!.name, `${host!.name}-layer-second`, `${host!.name}-layer-first`])
})
