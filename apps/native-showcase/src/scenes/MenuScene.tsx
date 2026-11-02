import { createRef, useMemo, useRef, useState, type ReactNode } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import {
  Button,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuSection,
  MenuHeader,
  SubmenuTrigger,
  NativeMenuTrigger,
  NativeMenuListContext,
  MenuText,
  MenuKeyboardShortcut,
  NativeCollectionRendererContext,
  NativeFocusView,
  Text,
  useNativeTheme,
  type TNativeCollectionItem,
  type TNativeMenuItemProps,
} from "@codon-ui/react-native"

import { NativeMenuPointerObservationContext } from "../../../../packages/react-native/src/components/Menu/context"
import { inspectNativeAccessibility } from "../../../../packages/react-native/src/input/accessibilityInspection"
import type { TNativeMenuPointerEvent } from "../../../../packages/react-native/src/input/nativeMenuPointers"

import { useMenuVirtualRenderer } from "./MenuVirtualRenderer"

type TKey = string | number
const MODES = ["multiple", "single", "none"] as const
const ITEMS = [
  { id: 0, label: "Number zero" },
  { id: "0", label: "String zero" },
  { id: "", label: "Empty key" },
]
const EXTRA_ITEMS = Array.from({ length: 69 }, (_, index) => ({
  id: `extra:${index}`,
  label: `Menu action ${index + 1}`,
}))
const keyLabel = (key: TKey) => `${typeof key}:${JSON.stringify(key)}`
const keysLabel = (keys: "all" | Iterable<TKey>) =>
  keys === "all" ? "all" : [...keys].map(keyLabel).join(", ") || "empty"

export const MenuScene = () => {
  const theme = useNativeTheme()
  const [open, setOpen] = useState(false)
  const [nonModal, setNonModal] = useState(false)
  const [veto, setVeto] = useState(false)
  const [selected, setSelected] = useState<"all" | Set<TKey>>(new Set([0]))
  const [mode, setMode] = useState(0)
  const [items, setItems] = useState(ITEMS)
  const [disabled, setDisabled] = useState(false)
  const [selectionOnly, setSelectionOnly] = useState(false)
  const [rtl, setRTL] = useState(false)
  const [custom, setCustom] = useState(false)
  const [customHost, setCustomHost] = useState(false)
  const [virtualFocus, setVirtualFocus] = useState(false)
  const [longPressTrigger, setLongPressTrigger] = useState(false)
  const [frenchTrigger, setFrenchTrigger] = useState(false)
  const [virtualized, setVirtualized] = useState(false)
  const renderer = useMenuVirtualRenderer(virtualized)
  const virtualItems = useMemo(() => [...items, ...EXTRA_ITEMS], [items])
  const [closeOnSelect, setCloseOnSelect] = useState(false)
  const [requests, setRequests] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [textEvents, setTextEvents] = useState(0)
  const [refs, setRefs] = useState("unmeasured")
  const [sdkReads, setSDKReads] = useState(0)
  const sdkSequence = useRef(0)
  const pointerRecords = useRef<TNativeMenuPointerEvent["nativeEvent"][]>([])
  const omittedPointerRecords = useRef(0)
  const pointerExportSequence = useRef(0)
  const observePointer = (event: TNativeMenuPointerEvent) => {
    if (pointerRecords.current.length === 512) {
      pointerRecords.current.shift()
      omittedPointerRecords.current++
    }
    pointerRecords.current.push({ ...event.nativeEvent, hitPath: [...event.nativeEvent.hitPath] })
  }
  const exportPointers = () => {
    const content = JSON.stringify({ records: pointerRecords.current, omitted: omittedPointerRecords.current })
    const sequence = ++pointerExportSequence.current
    const parts = Math.ceil(content.length / 768)
    for (let part = 0; part < parts; part++)
      console.warn(
        `CUI_MENU_POINTER_CHUNK ${JSON.stringify({ sequence, part, parts, content: content.slice(part * 768, (part + 1) * 768) })}`,
      )
  }
  const root = useRef<View>(null),
    list = useRef<View>(null),
    editor = useRef<TextInput>(null)
  const itemRefs = useMemo(() => new Map(ITEMS.map((item) => [item.id, createRef<View>()])), [])
  const trigger = useRef<View>(null),
    childList = useRef<View>(null)
  const collectionItems = useMemo<readonly TNativeCollectionItem<object>[]>(() => {
    const item = (
      key: TKey,
      label: string,
      children: ReactNode = label,
      props: TNativeMenuItemProps & { ref?: React.Ref<View> } = {},
    ): TNativeCollectionItem<object> => ({
      key,
      type: "item",
      value: { id: key, label },
      props: { id: key, textValue: label, ...props },
      rendered: children,
      textValue: label,
      render: () => (
        <MenuItem id={key} textValue={label} {...props}>
          {children}
        </MenuItem>
      ),
    })
    const deepItems = [item("deep", "Deep action")]
    const childItems: readonly TNativeCollectionItem<object>[] = [
      item("child", "Child action", "Child action", { testID: "menu-owner-child-action" }),
      {
        key: "deeper-submenu",
        type: "submenutrigger",
        value: null,
        props: {},
        rendered: null,
        textValue: "Deeper actions",
        children: [item("deeper", "Deeper actions")],
        render: () => (
          <SubmenuTrigger>
            <Menu menuAriaLabel="Deep menu actions" shouldFlip={false} items={deepItems} />
          </SubmenuTrigger>
        ),
      },
    ]
    if (!items.length) return []
    if (virtualized)
      return virtualItems.map((value) =>
        item(value.id, value.label, value.label, {
          value,
          ref: itemRefs.get(value.id),
          testID: `menu-owner-${keyLabel(value.id)}`,
          render: customHost
            ? (props, state) => (
                <NativeFocusView
                  {...props}
                  accessibilityHint={state.isFocusVisible ? "Keyboard focused menu item" : "Custom menu item"}
                />
              )
            : undefined,
        }),
      )
    return [
      {
        key: "primary",
        type: "section",
        value: null,
        props: {},
        rendered: null,
        textValue: "Primary actions",
        render: () => <MenuSection id="primary" style={custom ? { fontSize: 20 } : undefined} />,
        children: [
          {
            key: "primary-header",
            type: "header",
            value: null,
            props: {},
            rendered: "Primary actions",
            textValue: "Primary actions",
            render: () => <MenuHeader>Primary actions</MenuHeader>,
          },
          ...items.map((value) =>
            item(
              value.id,
              value.label,
              <>
                <MenuText slot="label">{value.label}</MenuText>
                <MenuText slot="description">Current owner item</MenuText>
                <MenuKeyboardShortcut>⌘K</MenuKeyboardShortcut>
              </>,
              { ref: itemRefs.get(value.id), testID: `menu-owner-${keyLabel(value.id)}` },
            ),
          ),
        ],
      },
      {
        key: "primary-separator",
        type: "separator",
        value: null,
        props: {},
        rendered: null,
        textValue: "",
        render: () => <MenuSeparator />,
      },
      {
        key: "more-submenu",
        type: "submenutrigger",
        value: null,
        props: {},
        rendered: null,
        textValue: "More actions",
        children: [item("more", "More actions", "More actions", { testID: "menu-owner-more" })],
        render: () => (
          <SubmenuTrigger ref={trigger}>
            <NativeMenuListContext.Provider value={{ ref: childList }}>
              <Menu
                menuAriaLabel="Nested menu actions"
                testID="menu-owner-child"
                shouldFlip={false}
                items={childItems}
              />
            </NativeMenuListContext.Provider>
          </SubmenuTrigger>
        ),
      },
      item("after", "After submenu", "After submenu", { testID: "menu-owner-after" }),
      item("destructive", "Destructive action", "Destructive action", { variant: "destructive" }),
    ]
  }, [items, virtualized, virtualItems, itemRefs, customHost, custom])
  const initial = useRef(new Map<string, View | TextInput>())
  const receivers = () =>
    [
      ["surface", root.current],
      ["list", list.current],
      ["editor", editor.current],
      ["submenu-trigger", trigger.current],
      ["child-list", childList.current],
      ...items.map((item) => [keyLabel(item.id), itemRefs.get(item.id)!.current] as const),
    ] as const
  const record = (request: string) => setRequests((old) => [...old, request])
  const inspectRefs = () =>
    setRefs(
      receivers()
        .map(([id, target]) => {
          if (!target) return `${id}=absent`
          if (target && !initial.current.has(id)) initial.current.set(id, target)
          return `${id}=${findNodeHandle(target) ?? "absent"}/${target === initial.current.get(id) ? "same" : "replaced"}`
        })
        .join("; "),
    )
  const inspectSDK = () => {
    for (const [receiver, target] of receivers()) {
      if (receiver === "editor") continue
      inspectNativeAccessibility(target, (event) => {
        const content = JSON.stringify({ receiver, record: event.nativeEvent })
        const sequence = ++sdkSequence.current
        const parts = Math.ceil(content.length / 768)
        for (let part = 0; part < parts; part++)
          console.warn(
            `CUI_MENU_SDK_CHUNK ${JSON.stringify({ receiver, sequence, part, parts, content: content.slice(part * 768, (part + 1) * 768) })}`,
          )
        setSDKReads((count) => count + 1)
      })
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Menu
      </Text>
      <Text testID="menu-owner-state">
        Open: {String(open)}. Parent: {veto ? "veto" : "echo"}. Mode: {MODES[mode]}. Selected: {keysLabel(selected)}.
        Requests: {requests.length}. Last: {requests.at(-1) ?? "none"}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button onPress={() => setVeto((value) => !value)}>Toggle menu owner veto</Button>
        <Button onPress={() => setNonModal((value) => !value)}>Toggle menu modality</Button>
        <Button onPress={() => setOpen((value) => !value)}>Toggle menu owner open</Button>
        <Button onPress={() => setMode((value) => (value + 1) % MODES.length)}>Next menu selection mode</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle menu disabled key</Button>
        <Button onPress={() => setSelectionOnly((value) => !value)}>Toggle menu selection-only disabled</Button>
        <Button onPress={() => setRTL((value) => !value)}>Toggle menu direction</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle menu styles</Button>
        <Button onPress={() => setCustomHost((value) => !value)}>Toggle menu custom host</Button>
        <Button onPress={() => setVirtualFocus((value) => !value)}>Toggle menu virtual focus</Button>
        <Button onPress={() => setVirtualized((value) => !value)}>Toggle 72-item menu virtualization</Button>
        <Button onPress={() => setCloseOnSelect((value) => !value)}>Toggle menu close on selection</Button>
        <Button onPress={() => setItems((old) => [...old.slice(1), ...old.slice(0, 1)])}>Rotate menu items</Button>
        <Button onPress={() => setItems([])}>Clear menu items</Button>
        <Button onPress={() => setItems(ITEMS)}>Restore menu items</Button>
        <Button onPress={inspectRefs}>Inspect menu refs</Button>
        <Button onPress={inspectSDK}>Inspect menu native accessibility</Button>
        <Button onPress={exportPointers}>Export menu native pointer observations</Button>
      </View>
      <TextInput
        ref={editor}
        testID="menu-owner-editor"
        accessibilityLabel="Menu owner draft"
        value={draft}
        onChangeText={(value) => {
          setDraft(value)
          setTextEvents((count) => count + 1)
        }}
        style={{
          minHeight: 48,
          borderWidth: 1,
          padding: 8,
          color: theme.colors.foreground,
          borderColor: theme.colors.foreground,
        }}
      />
      <Text testID="menu-owner-editor-state">Text events: {textEvents}.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button onPress={() => setLongPressTrigger((value) => !value)}>Toggle menu long-press trigger</Button>
        <Button onPress={() => setFrenchTrigger((value) => !value)}>Toggle menu trigger locale</Button>
      </View>
      <NativeMenuPointerObservationContext.Provider value={observePointer}>
        <NativeCollectionRendererContext.Provider value={renderer}>
          <NativeMenuListContext.Provider
            value={{
              ref: list,
              disabledBehavior: selectionOnly ? "selection" : "all",
              shouldUseVirtualFocus: virtualFocus,
              renderEmptyState: () => <Text testID="menu-owner-empty">No owner menu items</Text>,
              render: customHost
                ? (props) => <NativeFocusView {...props} accessibilityHint="Custom menu list" />
                : undefined,
            }}
          >
            <NativeMenuTrigger
              triggerMode={longPressTrigger ? "longPress" : "press"}
              locale={frenchTrigger ? "fr-FR" : "en-US"}
              isOpen={open}
              onOpenChange={(next) => {
                record(`open:${next}`)
                if (!veto) setOpen(next)
              }}
              trigger={(state) => <Button {...state.triggerProps}>Open owner menu</Button>}
            >
              <Menu
                items={collectionItems}
                ref={root}
                testID="menu-owner-surface"
                menuAriaLabel="Owner menu actions"
                direction={rtl ? "rtl" : "ltr"}
                isNonModal={nonModal}
                shouldFlip={false}
                selectionMode={MODES[mode]}
                selectedKeys={selected}
                disabledKeys={disabled ? ["0"] : []}
                shouldCloseOnSelect={closeOnSelect}
                maxHeight={320}
                customMenuStyles={custom ? { fontSize: 18, color: "purple", padding: 12 } : undefined}
                onSelectionChange={(keys) => {
                  record(`selection:${keysLabel(keys)}`)
                  if (!veto) setSelected(keys)
                }}
                onAction={(key) => record(`action:${keyLabel(key)}`)}
              ></Menu>
            </NativeMenuTrigger>
          </NativeMenuListContext.Provider>
        </NativeCollectionRendererContext.Provider>
      </NativeMenuPointerObservationContext.Provider>
      <Button onPress={() => record("underlying-action")}>Underlying menu action</Button>
      <Text testID="menu-owner-refs">Refs: {refs}.</Text>
      <Text testID="menu-owner-sdk">SDK reads: {sdkReads}.</Text>
    </View>
  )
}
