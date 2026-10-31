import {
  actWithNativeCollections as act,
  confirmNativeCollections,
  fireEvent,
  screen,
  renderWithNativeCollections as render,
} from "../../../../packages/react-native/src/collection/__tests__/nativeReceipts"
import { writeFileSync } from "node:fs"

import { createRef, useState, type ReactNode } from "react"
import * as RN from "react-native"

import {
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
} from "../../../../packages/react-native/src"
import { Tag } from "../../../../packages/react-native/src/components/TagGroup/Tag"
import { TagGroup } from "../../../../packages/react-native/src/components/TagGroup/TagGroup"
import { Commands } from "../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-collection-native-order.json",
    JSON.stringify({ scope: "source-model reproduction; native actions0", records }, null, 2) + "\n",
  ),
)
beforeEach(() => {
  jest.replaceProperty(RN.Platform, "OS", "android")
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const handles = () => Object.fromEntries(["a", "b", "c", "generated"].map((id) => [id, createRef<RN.View>()]))
const node = (children: ReactNode) => (
  <NativeThemeProvider>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost testID="host">
        <TagGroup>{children}</TagGroup>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const ready = async () => {
  await fireEvent(row("tag-list"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 80 } } })
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "collection-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
}
const home = async (focused: RN.View | null) => {
  const host = row("host").props,
    policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes("0000:Home"))
  expect(policy).toBeDefined()
  await act(() =>
    host.onNativeScopedKey({
      preventDefault: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        target: 17,
        focusedTarget: RN.findNodeHandle(focused),
        windowId: "collection-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        key: "Home",
        phase: "down",
        repeat: false,
        cancelled: false,
        nativeCode: 1,
        characters: "",
        nativeDefaultHandled: true,
        timestamp: 100,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
      },
    }),
  )
  return jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0]
}
const content = (order: string[], refs: ReturnType<typeof handles>) => (
  <>
    {order.map((id) => (
      <Tag key={id} id={id} ref={refs[id]} testID={id}>
        {id}
      </Tag>
    ))}
  </>
)
const verdict = (name: string, requested: unknown, refs: ReturnType<typeof handles>, expected: string) => {
  const actual = Object.keys(refs).find((id) => refs[id].current === requested)
  records.push({ case: name, expected, actual, matchesCanonical: actual === expected })
  expect(actual).toBe(expected)
}

it("requires Home to follow an opaque parent's committed reorder", async () => {
  const refs = handles()
  const Opaque = ({ order }: { order: string[] }) => content(order, refs)
  const view = await render(node(<Opaque order={["a", "b", "c"]} />))
  await ready()
  await view.rerender(node(<Opaque order={["b", "c", "a"]} />))
  await ready()
  expect(screen.getAllByRole("row").map((item) => item.props.testID)).toEqual(["b", "c", "a"])
  verdict("opaque parent reorder", await home(refs.c.current), refs, "b")
})

it("requires Home to follow child-local reorder without parent props changing", async () => {
  const refs = handles()
  let update!: (order: string[]) => void
  const Opaque = () => {
    const [order, setOrder] = useState(["a", "b", "c"])
    update = setOrder
    return content(order, refs)
  }
  await render(node(<Opaque />))
  await ready()
  await act(() => update(["c", "a", "b"]))
  await confirmNativeCollections()
  await ready()
  verdict("opaque local reorder", await home(refs.b.current), refs, "c")
})

it("requires Home to retain a generated member before explicitly keyed members", async () => {
  const refs = handles()
  await render(
    node(
      <>
        <Tag ref={refs.generated} testID="generated">
          generated
        </Tag>
        <Tag id="b" ref={refs.b}>
          b
        </Tag>
        <Tag id="a" ref={refs.a}>
          a
        </Tag>
      </>,
    ),
  )
  await ready()
  verdict("generated and explicit", await home(refs.a.current), refs, "generated")
})
