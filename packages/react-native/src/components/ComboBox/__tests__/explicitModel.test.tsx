import { act, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import type { TextInput, View } from "react-native"

import {
  NativeCollectionActionAdmissionContext,
  type TNativeCollectionActionAdmission,
} from "../../../collection/actions"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../../collection/snapshot"
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeForm } from "../../../form/NativeForm"
import { NativeFormRegistry } from "../../../form/registry"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { TagComboBox } from "../../TagComboBox/TagComboBox"
import { NativeCollectionComboBox } from "../CollectionComboBox"
import { NativeComboBoxInput } from "../CollectionComboBoxInput"
import { NativeComboBoxList } from "../CollectionComboBoxList"
import { NativeComboBoxItem } from "../ComboBoxItem"
import { NativeComboBoxHeader, NativeComboBoxSection } from "../ComboBoxSection"

jest.mock("../../../input/specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../../input/specs/CUIFormRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

// Records original refs without manufacturing native acknowledgements.
const fixture = () => {
  const owners = new Set<object>(),
    receivers = new Set<object>()
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: jest.fn((_binding, original) => {
      owners.add(original)
      return () => {
        owners.delete(original)
      }
    }),
    registerReceiver: jest.fn((_scope, original) => {
      receivers.add(original)
      return () => {
        receivers.delete(original)
      }
    }),
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: jest.fn(() => () => {}),
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  let collection: TNativeCollectionSnapshot<unknown> | undefined
  const renderer = {
    ...DefaultNativeCollectionRenderer,
    CollectionRoot: (props: TNativeCollectionRootProps) => {
      collection = props.collection
      return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
    },
  }
  const wrap = (children: ReactNode) => (
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <NativeThemeProvider>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost>
            <NativeCollectionRendererContext.Provider value={renderer}>
              {children}
            </NativeCollectionRendererContext.Provider>
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </NativeCollectionActionAdmissionContext.Provider>
  )
  return { wrap, admission, owners, receivers, collection: () => collection! }
}
const hidden = { includeHiddenElements: true }
const values = [
  { key: 0, text: "Zero" },
  { key: "0", text: "String zero" },
  { key: "", text: "Empty" },
]
const getKey = (value: (typeof values)[number]) => value.key
const getTextValue = (value: (typeof values)[number]) => value.text
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("uses explicit data identities and registers only the original list and option hosts", async () => {
  const f = fixture(),
    original = createRef<View>(),
    changed = jest.fn()
  await render(
    f.wrap(
      <NativeCollectionComboBox
        items={values}
        getKey={getKey}
        getTextValue={getTextValue}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
        onChange={changed}
      >
        {(item) => (
          <NativeComboBoxItem ref={item.key === 0 ? original : undefined} id="render-only-id" textValue={item.text}>
            {item.text}
          </NativeComboBoxItem>
        )}
      </NativeCollectionComboBox>,
    ),
  )
  expect([...f.collection()].map((node) => node.key)).toEqual([0, "0", ""])
  expect(f.collection().getItem(0)?.value).toBe(values[0])
  expect(f.owners.size).toBe(1)
  expect(f.receivers.has(original.current!)).toBe(true)
  expect(f.receivers.size).toBe(3)
  expect(f.admission.bindingFor({ ownerId: "", generation: "", revision: "", itemId: "", itemRevision: "" })).toBe("")
  expect(changed).not.toHaveBeenCalled()
  await screen.unmount()
  expect(f.owners.size).toBe(0)
  expect(f.receivers.size).toBe(0)
})

it("preserves explicit section/header rendering, option action metadata and custom original refs", async () => {
  const f = fixture(),
    section = createRef<View>(),
    option = createRef<View>(),
    action = jest.fn()
  await render(
    f.wrap(
      <NativeCollectionComboBox
        items={values}
        getKey={getKey}
        getTextValue={getTextValue}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
        collectionItems={[
          {
            key: "section",
            type: "section",
            value: null,
            rendered: "Choices",
            textValue: "",
            props: {},
            render: () => <NativeComboBoxSection ref={section} testID="section" accessibilityLabel="Choices" />,
            children: [
              {
                key: "heading",
                type: "header",
                value: null,
                rendered: "Heading",
                textValue: "Heading",
                props: {},
                render: () => <NativeComboBoxHeader>Heading</NativeComboBoxHeader>,
              },
              {
                key: 0,
                type: "item",
                value: values[0],
                rendered: "Zero",
                textValue: "Zero",
                props: { onAction: action },
                render: (node) => (
                  <NativeComboBoxItem {...node.props} ref={option}>
                    Zero
                  </NativeComboBoxItem>
                ),
              },
            ],
          },
        ]}
      />,
    ),
  )
  expect(section.current).not.toBeNull()
  expect(screen.getByTestId("section", hidden).props.nativeLabelledBy).toHaveLength(1)
  expect(f.collection().getItem(0)?.props.onAction).toBe(action)
  expect(f.receivers.has(option.current!)).toBe(true)
  expect(f.receivers.has(section.current!)).toBe(false)
})

it("updates explicit order and retires removed original options without changing the editor", async () => {
  const f = fixture(),
    editor = createRef<import("react-native").TextInput>(),
    removed = createRef<View>()
  const child = (item: (typeof values)[number]) => (
    <NativeComboBoxItem ref={item.key === "" ? removed : undefined}>{item.text}</NativeComboBoxItem>
  )
  const combo = (items: typeof values) =>
    f.wrap(
      <NativeCollectionComboBox
        items={items}
        controlledItems={items}
        getKey={getKey}
        getTextValue={getTextValue}
        renderContent={({ metadata }) => (
          <>
            <NativeComboBoxInput ref={editor} />
            {metadata}
            <NativeComboBoxList />
          </>
        )}
        isOpen
        inputLabel="Query"
        closeLabel="Close"
        inputValue="draft"
      >
        {child}
      </NativeCollectionComboBox>,
    )
  await render(combo(values))
  expect(editor.current).not.toBeNull()
  const original = editor.current,
    retired = removed.current
  await act(() => screen.rerender(combo([values[1]!, values[0]!])))
  expect([...f.collection()].map((node) => node.key)).toEqual(["0", 0])
  expect(f.receivers.has(retired!)).toBe(false)
  expect(editor.current).toBe(original)
  expect(screen.getByDisplayValue("draft", hidden)).toBeTruthy()
})

it("renders selected tags from their explicit data model and retains query semantic text", async () => {
  const f = fixture()
  await render(
    f.wrap(
      <TagComboBox
        items={values}
        selectedItems={[values[0]!]}
        getItemKey={getKey}
        getItemTextValue={getTextValue}
        onSelectedItemsChange={jest.fn()}
        formFieldId="tag-query"
        nativeAccessibilityText={{ label: "Query", description: "Add a value" }}
        labels={{ comboBox: { inputLabel: "Query" } }}
        isOpen
      />,
    ),
  )
  expect(screen.getAllByText("Zero", hidden).length).toBeGreaterThan(0)
  expect(screen.getByLabelText("Query", hidden).props.accessibilityHint).toBe("Add a value")
  expect(f.owners.size).toBe(2)
})

it("keeps declared Form ownership, semantic text and reset requests with the original explicit-model editor", async () => {
  const f = fixture(),
    registry = new NativeFormRegistry(),
    editor = createRef<TextInput>(),
    requests: unknown[][] = []
  const native = jest.requireActual<typeof import("react-native")>("react-native"),
    inherited = jest.isMockFunction(native.findNodeHandle)
      ? jest.mocked(native.findNodeHandle).getMockImplementation()!
      : native.findNodeHandle,
    targets = new WeakMap<object, number>()
  let sequence = 600000
  jest.spyOn(native, "findNodeHandle").mockImplementation((target) => {
    const existing = inherited(target)
    if (existing || !target || typeof target !== "object") return existing
    if (!targets.has(target)) targets.set(target, ++sequence)
    return targets.get(target)!
  })
  const content = (items: typeof values, value: string | number, inputValue: string) =>
    f.wrap(
      <NativeFormRegistryContext.Provider value={registry}>
        <NativeForm id="editor-form" fieldOrder={["search"]}>
          <NativeCollectionComboBox
            items={items}
            controlledItems={items}
            getKey={getKey}
            getTextValue={getTextValue}
            formFieldId="search"
            name="query"
            nativeAccessibilityText={{ label: "Declared query", description: "Caller-owned results" }}
            inputRef={editor}
            inputLabel="Query"
            closeLabel="Close"
            value={value}
            inputValue={inputValue}
            onInputChange={(query) => requests.push(["query", query])}
            onChange={(key) => requests.push(["selection", key])}
          />
        </NativeForm>
      </NativeFormRegistryContext.Provider>,
    )
  try {
    await render(content(values, 0, "initial owner"))
    const original = editor.current
    expect(original).not.toBeNull()
    const form = () => registry.resolveForm("editor-form", null),
      field = () => registry.fieldsFor(form())[0]!
    expect(form().fieldOrder).toEqual(["search"])
    expect(field().fieldId).toBe("search")
    expect(field().formOwnerId).toBe(form().descriptor.ownerId)
    expect(field().editor()).toBe(original)
    expect(field().data.entries).toEqual([["query", "0"]])
    expect(field().mount()).toBeNull()
    await screen.rerender(content([values[1]!, values[0]!], "0", "held owner"))
    expect(editor.current).toBe(original)
    expect(screen.getByLabelText("Declared query", hidden).props.accessibilityHint).toBe("Caller-owned results")
    expect(screen.getByDisplayValue("held owner", hidden)).toBeTruthy()
    await act(() => field().reset("programmatic"))
    expect(requests).toEqual([
      ["query", "Zero"],
      ["selection", 0],
    ])
    expect(field().data.entries).toEqual([["query", "0"]])
    expect(screen.getByDisplayValue("held owner", hidden)).toBeTruthy()
    expect(editor.current).toBe(original)
    expect(f.admission.request).not.toHaveBeenCalled()
    await screen.unmount()
    expect(editor.current).toBeNull()
    expect(registry.fields.size).toBe(0)
    expect(registry.forms.size).toBe(0)
  } finally {
    jest.restoreAllMocks()
  }
})
