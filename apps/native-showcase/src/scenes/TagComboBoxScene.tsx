import { useCallback, useMemo, useRef, useState } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import {
  NativeComboBoxContext,
  NativeComboBoxPopoverContext,
  TagComboBox,
  NativeForm,
  NativeFormAction,
  resetNativeForm,
  submitNativeForm,
  type TNativeTagComboBoxChangeDetails,
  type TNativeFormAction,
  type TNativeFormRequest,
  type TNativeFormResult,
} from "../../../../packages/react-native/src"
import { useNativeContextProps } from "../../../../packages/react-native/src/collection/context"
import { NativeCollectionRendererContext } from "../../../../packages/react-native/src/collection/renderer"
import { Button } from "../../../../packages/react-native/src/components/Button/Button"
import type { TNativeFloatingHostRender } from "../../../../packages/react-native/src/components/ClickPopover/ClickPopover"
import { Text } from "../../../../packages/react-native/src/components/Text/Text"
import { NativeFocusView } from "../../../../packages/react-native/src/input/NativeFocusView"
import { useNativeTheme } from "../../../../packages/react-native/src/theme"

import { useTagComboVirtualRenderer } from "./TagComboBoxVirtualRenderer"

type TItem = { id: string | number; label: string }
const ITEMS: TItem[] = [
  { id: 0, label: "Number zero" },
  { id: "0", label: "String zero" },
  { id: "", label: "Empty key" },
  { id: "last", label: "Dernière étiquette" },
]
const VIRTUAL_ITEMS: TItem[] = [
  ...ITEMS,
  ...Array.from({ length: 68 }, (_, index) => ({ id: `window-${index + 1}`, label: `Window choice ${index + 1}` })),
]
const keyLabel = (key: TItem["id"]) => `${typeof key}:${JSON.stringify(key)}`
const itemLabels = (items: readonly TItem[]) => items.map((item) => keyLabel(item.id)).join(", ") || "empty"

// Exercises the public source composition; installed acceptance stays in the family ledger.
export const TagComboBoxScene = () => {
  const theme = useNativeTheme()
  const [items, setItems] = useState(ITEMS)
  const [virtual, setVirtual] = useState(false)
  const [rtl, setRTL] = useState(false)
  const renderer = useTagComboVirtualRenderer(virtual)
  const [inheritedPopup, inheritedPopupRef] = useNativeContextProps({}, undefined, NativeComboBoxPopoverContext)
  const renderVirtualPopup = useCallback<TNativeFloatingHostRender>(
    (props, state) => {
      const host = {
        ...props,
        children: (
          <NativeCollectionRendererContext.Provider value={renderer}>
            {props.children}
          </NativeCollectionRendererContext.Provider>
        ),
      }
      return inheritedPopup.render ? inheritedPopup.render(host, state) : <NativeFocusView {...host} />
    },
    [inheritedPopup.render, renderer],
  )
  const [selected, setSelected] = useState<TItem[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [vetoSelection, setVetoSelection] = useState(false)
  const [vetoInput, setVetoInput] = useState(false)
  const [vetoOpen, setVetoOpen] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [allowsEmpty, setAllowsEmpty] = useState(false)
  const [custom, setCustom] = useState(false)
  const [customRoot, setCustomRoot] = useState(false)
  const [large, setLarge] = useState(false)
  const [requests, setRequests] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [textEvents, setTextEvents] = useState(0)
  const [refs, setRefs] = useState("unmeasured")
  const [formVeto, setFormVeto] = useState(false)
  const [required, setRequired] = useState(false)
  const [ariaValidation, setAriaValidation] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [disassociated, setDisassociated] = useState(false)
  const [formRequests, setFormRequests] = useState<string[]>([])
  const [formResult, setFormResult] = useState("none")
  const [formattedSelection, setFormattedSelection] = useState("unrequested")
  const form = useRef<View>(null)
  const root = useRef<View>(null)
  const input = useRef<TextInput>(null)
  const picker = useRef<View>(null)
  const editor = useRef<TextInput>(null)
  const firstRefs = useRef(new Map<string, View | TextInput>())
  const scenario = useRef<{ selections: number } | null>(null)
  const record = (request: string) => setRequests((current) => [...current.slice(-11), request])
  const requestSelection = (next: TItem[], details: TNativeTagComboBoxChangeDetails<TItem>) => {
    if (scenario.current && details.action === "add") scenario.current.selections++
    record(`${details.action}:${itemLabels(details.changedItems)}`)
    if (scenario.current ? scenario.current.selections > 2 : !vetoSelection) setSelected(next)
  }
  const observeForm = (request: TNativeFormRequest) => {
    setFormRequests((current) => [
      ...current.slice(-7),
      `${request.action}:${request.origin}:${JSON.stringify(request.entries)}`,
    ])
    if (formVeto) request.preventDefault()
  }
  const observeFormResult = (result: TNativeFormResult) =>
    setFormResult(`${result.status}${result.status === "retired" ? `:${result.reason}` : ""}`)
  const programmaticAction = async (action: TNativeFormAction) => {
    const original = form.current
    if (!original) {
      setFormResult("retired:original-form-unavailable")
      return
    }
    try {
      observeFormResult(await (action === "submit" ? submitNativeForm(original) : resetNativeForm(original)))
    } catch (error) {
      setFormResult(`failed:${String(error)}`)
    }
  }
  const inspectRefs = useCallback(() => {
    const targets = [
      ["form", form.current],
      ["root", root.current],
      ["input", input.current],
      ["picker", picker.current],
      ["editor", editor.current],
    ] as const
    setRefs(
      targets
        .map(([name, target]) => {
          if (target && !firstRefs.current.has(name)) firstRefs.current.set(name, target)
          const identity = target ? (target === firstRefs.current.get(name) ? "same" : "replaced") : "absent"
          return `${name}=${findNodeHandle(target) ?? "unresolved"}/${identity}`
        })
        .join("; "),
    )
  }, [])
  const ownerControls = useMemo(
    () => (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          onPress={() => {
            scenario.current = { selections: 0 }
            setSelected([])
            setQuery("Empty")
            setVetoSelection(false)
            setVetoInput(false)
            setVetoOpen(false)
            setOpen(true)
          }}
        >
          Run two-veto tag-combo selection
        </Button>
        <Button onPress={() => setVetoSelection((value) => !value)}>Toggle tag-combo selection veto</Button>
        <Button onPress={() => setVetoInput((value) => !value)}>Toggle tag-combo input veto</Button>
        <Button onPress={() => setVetoOpen((value) => !value)}>Toggle tag-combo popup veto</Button>
        <Button onPress={() => setOpen((value) => !value)}>Toggle tag-combo owner open</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle tag-combo disabled</Button>
        <Button onPress={() => setReadOnly((value) => !value)}>Toggle tag-combo read only</Button>
        <Button onPress={() => setAllowsEmpty((value) => !value)}>Toggle tag-combo empty-collection allowance</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle tag-combo styles</Button>
        <Button onPress={() => setCustomRoot((value) => !value)}>Toggle tag-combo custom picker root</Button>
        <Button onPress={() => setLarge((value) => !value)}>Toggle tag-combo text size</Button>
        <Button onPress={() => setSelected([ITEMS[0]])}>Set tag-combo number zero</Button>
        <Button onPress={() => setSelected([ITEMS[1]])}>Set tag-combo string zero</Button>
        <Button onPress={() => setSelected([])}>Clear tag-combo selection</Button>
        <Button onPress={() => setQuery("held query")}>Set tag-combo owner query</Button>
        <Button onPress={() => setItems((current) => [...current].reverse())}>Reverse tag-combo items</Button>
        <Button onPress={() => setItems([])}>Clear tag-combo items</Button>
        <Button onPress={() => setItems(virtual ? VIRTUAL_ITEMS : ITEMS)}>Restore tag-combo items</Button>
        <Button
          onPress={() => {
            setItems(virtual ? ITEMS : VIRTUAL_ITEMS)
            setVirtual(!virtual)
          }}
        >
          Toggle 72-item tag-combo virtualization
        </Button>
        <Button onPress={() => setRTL((value) => !value)}>Toggle tag-combo direction</Button>
        <Button onPress={inspectRefs}>Inspect tag-combo refs</Button>
        <Button onPress={() => setFormVeto((value) => !value)}>Toggle tag-combo form veto</Button>
        <Button onPress={() => setRequired((value) => !value)}>Toggle tag-combo required</Button>
        <Button onPress={() => setAriaValidation((value) => !value)}>Toggle tag-combo form validation</Button>
        <Button onPress={() => setServerError((value) => !value)}>Toggle tag-combo server error</Button>
        <Button onPress={() => setDisassociated((value) => !value)}>Toggle tag-combo form association</Button>
      </View>
    ),
    [inspectRefs, virtual],
  )
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        TagComboBox
      </Text>
      <Text testID="tag-combo-owner-state">
        Selected: {itemLabels(selected)}. Query: {JSON.stringify(query)}. Open: {String(open)}. Selection:{" "}
        {scenario.current ? "veto two, echo third" : vetoSelection ? "veto" : "echo"}. Input:{" "}
        {scenario.current ? "held until third selection" : vetoInput ? "veto" : "echo"}. Popup:{" "}
        {scenario.current ? "owner-held open" : vetoOpen ? "veto" : "echo"}.
      </Text>
      <Text testID="tag-combo-owner-profile">
        Logical items: {items.length}. Renderer: {virtual ? "VirtualizedList" : "ordinary"}. Direction:{" "}
        {rtl ? "rtl" : "ltr"}. Text: {large ? "large" : "medium"}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button onPress={() => setSelected([ITEMS[0], ITEMS[3]])}>Set two selected tags</Button>
        <Button
          onPress={() => {
            try {
              setFormattedSelection(
                new Intl.ListFormat(rtl ? "ar-EG" : "en-US", { style: "long", type: "conjunction" }).format(
                  selected.map((item) => item.label),
                ),
              )
            } catch (error) {
              setFormattedSelection(`Unavailable: ${String(error)}`)
            }
          }}
        >
          Format selected tag names
        </Button>
      </View>
      <Text testID="tag-combo-owner-formatted-selection">Formatted selection: {formattedSelection}.</Text>
      <Text testID="tag-combo-owner-requests">Requests: {requests.join(" → ") || "none"}.</Text>
      {ownerControls}
      <TextInput
        ref={editor}
        testID="tag-combo-owner-editor"
        accessibilityLabel="Draft before tag combo box"
        value={draft}
        onChangeText={(value) => {
          setDraft(value)
          setTextEvents((count) => count + 1)
        }}
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <Text testID="tag-combo-form-state">
        Form veto: {String(formVeto)}. Required: {String(required)}. Validation: {ariaValidation ? "aria" : "native"}.
        Server error: {String(serverError)}. Association: {disassociated ? "none" : "ancestor"}. Result: {formResult}.
      </Text>
      <Text testID="tag-combo-form-requests">Form requests: {formRequests.join(" → ") || "none"}.</Text>
      <NativeForm
        ref={form}
        id="tag-combo-owner-form"
        testID="tag-combo-owner-form"
        validationBehavior={ariaValidation ? "aria" : "native"}
        validationErrors={serverError ? { tagQuery: ["Owner server validation"] } : {}}
        onSubmit={observeForm}
        onReset={observeForm}
        style={{ gap: 8 }}
      >
        <NativeComboBoxPopoverContext.Provider
          value={{
            ...inheritedPopup,
            ref: inheritedPopupRef,
            render: virtual ? renderVirtualPopup : inheritedPopup.render,
          }}
        >
          <NativeComboBoxContext.Provider value={{ ref: picker }}>
            <TagComboBox
              id="tag-combo-owner-query-field"
              name="tagQuery"
              formValue="text"
              form={disassociated ? "" : undefined}
              isRequired={required}
              render={
                customRoot
                  ? (props, state) => (
                      <NativeFocusView
                        {...props}
                        testID="tag-combo-owner-custom-picker"
                        accessibilityHint={state.isOpen ? "Choices open" : "Choices closed"}
                      />
                    )
                  : undefined
              }
              ref={root}
              inputRef={input}
              inputProps={{ onFocus: inspectRefs }}
              items={items}
              selectedItems={selected}
              getItemKey={(item) => item.id}
              getItemTextValue={(item) => item.label}
              onSelectedItemsChange={requestSelection}
              inputValue={query}
              onInputChange={(value) => {
                record(`input:${JSON.stringify(value)}`)
                if (scenario.current ? scenario.current.selections > 2 : !vetoInput) setQuery(value)
              }}
              isOpen={open}
              onOpenChange={(value) => {
                record(`open:${String(value)}`)
                if (!vetoOpen) {
                  setOpen(value)
                  if (!value) scenario.current = null
                }
              }}
              isDisabled={disabled}
              isReadOnly={readOnly}
              allowsEmptyCollection={allowsEmpty}
              accessibilityLabel="Owner-controlled tag choices"
              textSize={large ? "large" : "medium"}
              locale={rtl ? "ar-EG" : "en-US"}
              maxWidth="100%"
              customStyles={[
                { direction: rtl ? "rtl" : "ltr" },
                custom ? { borderWidth: 2, borderColor: theme.colors.focusRing, padding: 8 } : undefined,
              ]}
              customTagStyles={custom ? { padding: 12 } : undefined}
              customComboBoxStyles={custom ? { backgroundColor: theme.colors.background } : undefined}
              customComboBoxProps={{ onInputChange: (value) => record(`nested-input:${JSON.stringify(value)}`) }}
            />
          </NativeComboBoxContext.Provider>
        </NativeComboBoxPopoverContext.Provider>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <NativeFormAction action="submit" onActionResult={observeFormResult}>
            Submit tag-combo form
          </NativeFormAction>
          <NativeFormAction action="reset" onActionResult={observeFormResult}>
            Reset tag-combo form
          </NativeFormAction>
          <Button onPress={() => void programmaticAction("submit")}>Submit tag-combo form programmatically</Button>
          <Button onPress={() => void programmaticAction("reset")}>Reset tag-combo form programmatically</Button>
        </View>
      </NativeForm>
      <Button onPress={() => editor.current?.focus()}>Focus original tag-combo draft editor</Button>
      <TextInput
        accessibilityLabel="Draft after tag combo box"
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <Text testID="tag-combo-owner-editor-state">
        Text events: {textEvents}. Refs: {refs}.
      </Text>
    </View>
  )
}
