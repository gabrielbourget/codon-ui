import { render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, View } from "react-native"

import { deliverSourceReceipt, sourcePublication, sourceReceipt } from "../../../collection/__tests__/visiblePublisher"
import {
  NativeCollectionRendererContext,
  DefaultNativeCollectionRenderer,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import type { TNativeCollectionItem, TNativeCollectionSnapshot } from "../../../collection/snapshot"
import { nativeCollectionFocusBinding } from "../../../input/nativeVisibleCollectionAdmission"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { Menu } from "../Menu"
import { MenuHeader } from "../MenuHeader"
import { MenuItem } from "../MenuItem"
import { MenuSection } from "../MenuSection"
import { SubmenuTrigger } from "../SubmenuTrigger"
import type { TNativeMenuProps } from "../types"

const item = (key: string | number, label: string): TNativeCollectionItem<object> => ({
  key,
  type: "item",
  value: { key },
  props: {},
  rendered: label,
  textValue: label,
  render: () => <MenuItem testID={`item:${typeof key}:${key}`}>{label}</MenuItem>,
})
const fixture = (props: TNativeMenuProps, renderer = DefaultNativeCollectionRenderer) => (
  <NativeThemeProvider>
    <NativeCollectionRendererContext.Provider value={renderer}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <Menu isOpen triggerRef={createRef<View>()} {...props} />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeCollectionRendererContext.Provider>
  </NativeThemeProvider>
)
const row = (key: string | number) => screen.getByTestId(`item:${typeof key}:${key}`, { includeHiddenElements: true })

it("renders ordered explicit section children with selection, disabled items and original header naming", async () => {
  const ref = createRef<View>()
  const header: TNativeCollectionItem<object> = {
    key: "header",
    type: "header",
    value: null,
    props: {},
    rendered: "Group",
    textValue: "Group",
    render: () => (
      <MenuHeader ref={ref} nativeID="section-header">
        Group
      </MenuHeader>
    ),
  }
  const section: TNativeCollectionItem<object> = {
    key: "section",
    type: "section",
    value: null,
    props: {},
    rendered: null,
    textValue: "",
    children: [header, item(0, "Number"), item("0", "String")],
    render: () => <MenuSection testID="section" />,
  }
  const view = await render(
    fixture({ items: [section], selectionMode: "multiple", selectedKeys: [0], disabledKeys: ["0"] }),
  )
  expect(row(0).props.accessibilityState).toMatchObject({ checked: true, disabled: false })
  expect(row("0").props.accessibilityState).toMatchObject({ checked: false, disabled: true })
  expect(ref.current).not.toBeNull()
  const group = screen.getByTestId("section", { includeHiddenElements: true })
  expect(group.props.nativeLabelledBy).toEqual(["section-header"])
  expect(
    view.container.queryAll((host) => host.props.descriptorId !== undefined || host.props.rootRevision !== undefined),
  ).toHaveLength(0)
})

it("keeps complete items under a custom virtualizer and updates ordered membership without evaluating receivers", async () => {
  let collection: TNativeCollectionSnapshot<unknown> | undefined
  const Root = (props: TNativeCollectionRootProps) => {
    collection = props.collection
    return null
  }
  const a = item("a", "Alpha"),
    b = item("b", "Beta"),
    renderA = jest.fn(a.render!),
    renderB = jest.fn(b.render!)
  const items = [
    { ...a, render: renderA },
    { ...b, render: renderB },
  ]
  const renderer = { ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: Root }
  const view = await render(fixture({ items }, renderer))
  expect(collection!.size).toBe(2)
  expect(sourcePublication().receivers).toHaveLength(0)
  expect(renderA).not.toHaveBeenCalled()
  expect(renderB).not.toHaveBeenCalled()
  await view.rerender(fixture({ items: [items[1], items[0]] }, renderer))
  expect([...collection!].map((node) => node.key)).toEqual(["b", "a"])
  expect([...collection!.getKeys()]).toEqual(["a", "b"])
})

it("uses explicit submenu trigger membership while retaining its separate overlay content", async () => {
  const trigger = item("more", "More")
  const branch: TNativeCollectionItem<object> = {
    key: "branch",
    type: "submenutrigger",
    value: null,
    props: {},
    rendered: null,
    textValue: "",
    children: [trigger],
    render: () => (
      <SubmenuTrigger>
        <Menu items={[item("nested", "Nested")]} />
      </SubmenuTrigger>
    ),
  }
  await render(fixture({ items: [branch] }))
  expect(row("more").props.accessibilityState.expanded).toBe(false)
  expect(screen.queryByTestId("item:string:nested", { includeHiddenElements: true })).toBeNull()
})

it("registers only the original submenu trigger item, including a custom core View", async () => {
  const ref = createRef<View>()
  const trigger: TNativeCollectionItem<object> = {
    ...item("more", "More"),
    render: () => (
      <MenuItem
        ref={ref}
        render={({ onFocus: _focus, onBlur: _blur, ...props }) => <View {...props} testID="core-menu-item" />}
      >
        More
      </MenuItem>
    ),
  }
  const branch: TNativeCollectionItem<object> = {
    key: "branch",
    type: "submenutrigger",
    value: null,
    props: {},
    rendered: null,
    textValue: "",
    children: [trigger],
    render: () => (
      <SubmenuTrigger>
        <Menu items={[]} />
      </SubmenuTrigger>
    ),
  }
  await render(fixture({ items: [branch] }))
  const publication = sourcePublication()
  expect(publication.model.items).toHaveLength(2)
  expect(publication.receivers).toHaveLength(1)
  expect(publication.receivers[0].tag).toBe(findNodeHandle(ref.current))
  expect(nativeCollectionFocusBinding(ref.current!)).toBe("")
  await deliverSourceReceipt(sourceReceipt(1))
  expect(nativeCollectionFocusBinding(ref.current!)).toBe(`source-test-native-lease:${publication.receivers[0].id}`)
})
