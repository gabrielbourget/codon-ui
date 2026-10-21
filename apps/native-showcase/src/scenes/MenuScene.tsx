import { createRef, useMemo, useRef, useState } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import {
  Button,
  NativeCollection,
  NativeCollectionRendererContext,
  NativeFocusView,
  Text,
  useNativeTheme,
} from "@codon-ui/react-native"

import { MenuText, MenuKeyboardShortcut } from "../../../../packages/react-native/src/components/Menu/content"
import {
  NativeMenuListContext,
  NativeMenuPointerObservationContext,
} from "../../../../packages/react-native/src/components/Menu/context"
import { Menu, NativeMenuTrigger } from "../../../../packages/react-native/src/components/Menu/Menu"
import { MenuHeader } from "../../../../packages/react-native/src/components/Menu/MenuHeader"
import { MenuItem } from "../../../../packages/react-native/src/components/Menu/MenuItem"
import { MenuSection } from "../../../../packages/react-native/src/components/Menu/MenuSection"
import { MenuSeparator } from "../../../../packages/react-native/src/components/Menu/MenuSeparator"
import { SubmenuTrigger } from "../../../../packages/react-native/src/components/Menu/SubmenuTrigger"
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
              isOpen={open}
              onOpenChange={(next) => {
                record(`open:${next}`)
                if (!veto) setOpen(next)
              }}
              trigger={(state) => <Button {...state.triggerProps}>Open owner menu</Button>}
            >
              <Menu
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
              >
                {items.length > 0 &&
                  (virtualized ? (
                    <NativeCollection items={virtualItems}>
                      {(item) => (
                        <MenuItem
                          id={item.id}
                          textValue={item.label}
                          ref={itemRefs.get(item.id)}
                          testID={`menu-owner-${keyLabel(item.id)}`}
                        >
                          {item.label}
                        </MenuItem>
                      )}
                    </NativeCollection>
                  ) : (
                    <>
                      <MenuSection id="primary" style={custom ? { fontSize: 20 } : undefined}>
                        <MenuHeader>Primary actions</MenuHeader>
                        <NativeCollection items={items}>
                          {(item) => (
                            <MenuItem
                              ref={itemRefs.get(item.id)}
                              id={item.id}
                              textValue={item.label}
                              testID={`menu-owner-${keyLabel(item.id)}`}
                            >
                              <MenuText slot="label">{item.label}</MenuText>
                              <MenuText slot="description">Current owner item</MenuText>
                              <MenuKeyboardShortcut>⌘K</MenuKeyboardShortcut>
                            </MenuItem>
                          )}
                        </NativeCollection>
                      </MenuSection>
                      <MenuSeparator />
                      <SubmenuTrigger ref={trigger}>
                        <MenuItem id="more" testID="menu-owner-more">
                          More actions
                        </MenuItem>
                        <NativeMenuListContext.Provider value={{ ref: childList }}>
                          <Menu menuAriaLabel="Nested menu actions" testID="menu-owner-child" shouldFlip={false}>
                            <MenuItem id="child" testID="menu-owner-child-action">
                              Child action
                            </MenuItem>
                            <SubmenuTrigger>
                              <MenuItem id="deeper">Deeper actions</MenuItem>
                              <Menu menuAriaLabel="Deep menu actions" shouldFlip={false}>
                                <MenuItem id="deep">Deep action</MenuItem>
                              </Menu>
                            </SubmenuTrigger>
                          </Menu>
                        </NativeMenuListContext.Provider>
                      </SubmenuTrigger>
                      <MenuItem id="after" testID="menu-owner-after">
                        After submenu
                      </MenuItem>
                      <MenuItem id="destructive" variant="destructive">
                        Destructive action
                      </MenuItem>
                    </>
                  ))}
              </Menu>
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
