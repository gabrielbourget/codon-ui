import { createContext, createRef, useContext, useMemo, useRef, useState } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import { Button, Text, useNativeTheme } from "@codon-ui/react-native"

import { NativeCollection } from "../../../../packages/react-native/src/collection/CollectionBuilder"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../../packages/react-native/src/collection/renderer"
import { TagGroupLabel, TagGroupText } from "../../../../packages/react-native/src/components/TagGroup/field"
import { Tag } from "../../../../packages/react-native/src/components/TagGroup/Tag"
import { TagGroup } from "../../../../packages/react-native/src/components/TagGroup/TagGroup"
import type { TNativeTagGroupProps } from "../../../../packages/react-native/src/components/TagGroup/types"

import { useTagGroupVirtualRenderer } from "./TagGroupVirtualRenderer"

type TKey = string | number
type TValue = { id: TKey; label: string }
const ITEMS: TValue[] = [
  { id: 0, label: "Number zero" },
  { id: "0", label: "String zero" },
  { id: "", label: "Empty key" },
  { id: "link", label: "Navigation action" },
  { id: "last", label: "Dernière étiquette" },
]
const LARGE_ITEMS = [
  ...ITEMS,
  ...Array.from({ length: 64 }, (_, index) => ({ id: `extra:${index}`, label: `Étiquette ${index + 1}` })),
]
const MODES = ["multiple", "single", "none"] as const
const describeKey = (key: TKey) => `${typeof key}:${JSON.stringify(key)}`
const describeKeys = (keys: "all" | Iterable<TKey>) =>
  keys === "all" ? "all" : [...keys].map(describeKey).join(", ") || "empty"

const FieldRendererContext = createContext({ renderer: DefaultNativeCollectionRenderer, fields: false })
const FieldRoot = (props: TNativeCollectionRootProps) => {
  const { renderer, fields } = useContext(FieldRendererContext)
  const Root = renderer.CollectionRoot
  return (
    <>
      {fields && (
        <>
          <TagGroupLabel testID="tag-group-owner-label">Visible owner label</TagGroupLabel>
          <TagGroupText slot="description" testID="tag-group-owner-description">
            Owner instructions
          </TagGroupText>
          <TagGroupText slot="errorMessage" testID="tag-group-owner-error">
            Owner error description
          </TagGroupText>
        </>
      )}
      <Root {...props} />
    </>
  )
}

// Private family construction scene; no public counterpart or installed acceptance is implied.
export const TagGroupScene = () => {
  const theme = useNativeTheme()
  const [items, setItems] = useState(ITEMS)
  const [selected, setSelected] = useState<"all" | Set<TKey>>(new Set([0]))
  const [modeIndex, setModeIndex] = useState(0)
  const [virtual, setVirtual] = useState(false)
  const renderer = useTagGroupVirtualRenderer(virtual)
  const [fieldSlots, setFieldSlots] = useState(false)
  const fieldRenderer = useMemo(() => ({ ...renderer, CollectionRoot: FieldRoot }), [renderer])
  const [replace, setReplace] = useState(false)
  const [veto, setVeto] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [removable, setRemovable] = useState(true)
  const [vertical, setVertical] = useState(false)
  const [custom, setCustom] = useState(false)
  const [raised, setRaised] = useState(false)
  const [requests, setRequests] = useState(0)
  const [last, setLast] = useState("none")
  const [draft, setDraft] = useState("")
  const [frame, setFrame] = useState("unmeasured")
  const [refs, setRefs] = useState("unmeasured")
  const editor = useRef<TextInput>(null)
  const root = useRef<View>(null)
  const itemRefs = useMemo(() => new Map(LARGE_ITEMS.map((item) => [item.id, createRef<View>()])), [])
  const initial = useRef(new Map<TKey, View>())
  const requestSelection: NonNullable<TNativeTagGroupProps["onSelectionChange"]> = (keys) => {
    setRequests((count) => count + 1)
    setLast(`selection ${describeKeys(keys)}`)
    if (!veto) setSelected(keys)
  }
  const requestRemove = (keys: Set<TKey>) => {
    setRequests((count) => count + 1)
    setLast(`remove ${describeKeys(keys)}`)
    if (!veto) {
      setItems((current) => current.filter((item) => !keys.has(item.id)))
      setSelected((current) => (current === "all" ? current : new Set([...current].filter((key) => !keys.has(key)))))
    }
  }
  const inspectRefs = () =>
    setRefs(
      items
        .map((item) => {
          const current = itemRefs.get(item.id)!.current
          if (current && !initial.current.has(item.id)) initial.current.set(item.id, current)
          return `${describeKey(item.id)}=${findNodeHandle(current) ?? "absent"}/${current === initial.current.get(item.id) ? "same" : "replaced"}`
        })
        .join("; "),
    )
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Private TagGroup construction
      </Text>
      <Text testID="tag-group-owner-state">
        Owner: {describeKeys(selected)}. Mode: {MODES[modeIndex]}. Behavior: {replace ? "replace" : "toggle"}. Parent:{" "}
        {veto ? "veto" : "echo"}. Requests: {requests}. Last: {last}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button onPress={() => setVeto((value) => !value)}>Toggle tag-group owner veto</Button>
        <Button onPress={() => setModeIndex((value) => (value + 1) % MODES.length)}>
          Next tag-group selection mode
        </Button>
        <Button onPress={() => setReplace((value) => !value)}>Toggle tag-group selection behavior</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle number-zero disabled</Button>
        <Button onPress={() => setRemovable((value) => !value)}>Toggle tag-group removal</Button>
        <Button onPress={() => setVertical((value) => !value)}>Toggle tag-group orientation</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle tag-group styles</Button>
        <Button onPress={() => setRaised((value) => !value)}>Toggle grouped-tag shadow</Button>
        <Button onPress={() => setSelected("all")}>Set tag-group owner all</Button>
        <Button onPress={() => setSelected(new Set())}>Set tag-group owner empty</Button>
        <Button onPress={() => setItems((current) => (current.length ? [...current.slice(1), current[0]] : current))}>
          Rotate tag-group items
        </Button>
        <Button onPress={() => setItems([])}>Clear tag-group owner items</Button>
        <Button onPress={() => setItems(ITEMS)}>Restore tag-group owner items</Button>
        <Button
          onPress={() => {
            setVirtual((value) => !value)
            setItems(virtual ? ITEMS : LARGE_ITEMS)
          }}
        >
          Toggle 69-item native virtualization
        </Button>
        <Button onPress={inspectRefs}>Inspect grouped-tag refs</Button>
        <Button onPress={() => setFieldSlots((value) => !value)}>Toggle tag-group field slots</Button>
      </View>
      <TextInput
        ref={editor}
        testID="tag-group-owner-editor"
        accessibilityLabel="Draft before tag group"
        value={draft}
        onChangeText={setDraft}
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <FieldRendererContext.Provider value={{ renderer, fields: fieldSlots }}>
        <NativeCollectionRendererContext.Provider value={fieldRenderer}>
          <NativeCollection dependencies={[custom, raised, fieldSlots]}>
            <TagGroup<TValue>
              ref={root}
              items={items}
              selectedKeys={selected}
              selectionMode={MODES[modeIndex]}
              selectionBehavior={replace ? "replace" : "toggle"}
              disabledKeys={disabled ? [0] : []}
              onSelectionChange={requestSelection}
              onRemove={removable ? requestRemove : undefined}
              onAction={(key) => {
                setRequests((count) => count + 1)
                setLast(`action ${describeKey(key)}`)
              }}
              accessibilityLabel="Owner-controlled tags"
              orientation={vertical ? "vertical" : "horizontal"}
              width="100%"
              customStyles={custom ? { borderWidth: 1, borderColor: theme.colors.focusRing, padding: 8 } : undefined}
              customTagListStyles={custom ? { gap: 12 } : undefined}
              renderEmptyState={({ state }) => (
                <Text testID="tag-group-owner-empty">
                  No owner items. Logical count: {state.collection.size}. Selection:{" "}
                  {describeKeys(state.selectionManager.rawSelection)}.
                </Text>
              )}
              onLayout={({ nativeEvent }) => setFrame(`${nativeEvent.layout.width} x ${nativeEvent.layout.height}`)}
            >
              {(item) => (
                <Tag
                  id={item.id}
                  ref={itemRefs.get(item.id)}
                  textValue={item.label}
                  testID={`grouped-${describeKey(item.id)}`}
                  raised={raised}
                  geometry="rounded"
                  customStyles={custom ? { fontSize: 18 } : undefined}
                  href={item.id === "link" ? "https://example.test/tag-group" : undefined}
                  onNavigate={() => setLast("original navigation callback")}
                >
                  {item.label}
                  {item.id === 0 && fieldSlots ? (
                    <Button slot="remove" testID="tag-group-authored-remove">
                      Authored removal
                    </Button>
                  ) : null}
                </Tag>
              )}
            </TagGroup>
          </NativeCollection>
        </NativeCollectionRendererContext.Provider>
      </FieldRendererContext.Provider>
      <Button onPress={() => editor.current?.focus()}>Focus original draft editor</Button>
      <TextInput
        accessibilityLabel="Draft after tag group"
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <Text testID="tag-group-owner-layout">
        Frame: {frame}. Refs: {refs}.
      </Text>
    </View>
  )
}
