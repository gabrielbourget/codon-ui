import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, TextInput, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import {
  useNativeDragAndDrop,
  type TNativeDragAndDropOptions,
  type TNativeDragAndDropHooks,
} from "../../../collection/dragAndDrop/hooks"
import { nativeDragFormatter } from "../../../collection/dragAndDrop/messages"
import { NativeListDropTargetDelegate } from "../../../collection/dragAndDrop/NativeListDropTargetDelegate"
import { nativeVirtualDrag } from "../../../collection/dragAndDrop/virtualDrag"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
} from "../../../collection/renderer"
import { createNativeKeyScope } from "../../../input/keyScope"
import {
  createNativeDragActions,
  NativeDragActionsContext,
  type TNativeDragMemberBinding,
} from "../../../input/nativeDragActions"
import { NativeFocusView } from "../../../input/NativeFocusView"
import type { TNativeKeyboardEvent } from "../../../input/types"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable } from "../context"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableRowProps } from "../types"

import { CellFixtureBody } from "./fixtures/TableCellFixture"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
  },
}))
afterEach(async () => {
  await nativeVirtualDrag.cancel()
  await cleanup()
  jest.restoreAllMocks()
})
const rows = [
    { id: 0, name: "Zero" },
    { id: "", name: "Empty" },
  ],
  columns = [{ id: "name", name: "Name", isRowHeader: true }]
type TRow = (typeof rows)[number]
const setup = async ({
  options = {},
  renderer = DefaultNativeCollectionRenderer,
  hooks: changeHooks,
  locale = "en-US",
}: {
  options?: TNativeDragAndDropOptions<TRow>
  renderer?: TNativeCollectionRenderer
  hooks?: (hooks: TNativeDragAndDropHooks<TRow>) => TNativeDragAndDropHooks<TRow>
  locale?: string
} = {}) => {
  const native = jest.requireActual<typeof import("react-native")>("react-native"),
    installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let serial = 80000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++serial)
    return tags.get(view)!
  })
  const keyboard = createNativeKeyScope("drag-owner"),
    actions = createNativeDragActions(keyboard)
  keyboard.acceptNativeStatus({
    ownerId: "drag-owner",
    windowId: "window",
    epoch: 7,
    ready: false,
    windowActive: true,
    policyRevision: keyboard.policyRevision(),
  })
  actions.acceptStatus(
    JSON.stringify({
      kind: "window",
      ownerId: "drag-owner",
      windowId: "window",
      epoch: 2,
      surfaceId: 1,
      scopeTarget: 10,
      available: true,
      canLift: true,
      canDrop: true,
    }),
  )
  let current: ReturnType<typeof useNativeTable> | undefined
  const Capture = () => {
    current = useNativeTable()
    return null
  }
  const editor = createRef<TextInput>(),
    changes = jest.fn(),
    values = new Map<string | number, unknown>(),
    endpointRefs = new Map<string | number, React.RefObject<View | null>>()
  const Fixture = () => {
    const { dragAndDropHooks: originalHooks } = useNativeDragAndDrop<TRow>({
      getItems: (_keys, values) => values.map((row) => ({ "text/plain": row.name })),
      onItemDrop: () => {},
      ...options,
    })
    const hooks = changeHooks?.(originalHooks) ?? originalHooks
    const useDropIndicator = hooks.useDropIndicator!
    const composed = {
      ...hooks,
      useDropIndicator: (...args: Parameters<typeof useDropIndicator>) => {
        if (args[0].target.type === "item" && args[0].target.dropPosition === "on")
          endpointRefs.set(args[0].target.key, args[2])
        return useDropIndicator(...args)
      },
    }
    const renderRow: NonNullable<TNativeTableRowProps<TRow>["render"]> = (props, state) => {
      values.set(state.id, state)
      return <NativeFocusView {...props} />
    }
    return (
      <Table
        accessibilityLabel="Drag table"
        dragAndDropHooks={composed}
        render={(props) => (
          <NativeFocusView {...props}>
            <Capture />
            {props.children}
          </NativeFocusView>
        )}
      >
        <TableHeader columns={columns} />
        <CellFixtureBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              id={row.id}
              item={row}
              value={row}
              textValue={row.name}
              hasChildItems
              iconColor="orchid"
              columns={columns}
              testID={`drag-row-${row.id === 0 ? "zero" : "empty"}`}
              render={renderRow}
              renderCell={({ row }) =>
                row.id === 0 ? (
                  <TextInput ref={editor} testID="original-drag-editor" value="untouched" onChange={changes} />
                ) : (
                  row.name
                )
              }
            />
          ))}
        </CellFixtureBody>
      </Table>
    )
  }
  const rendered = await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale={locale}>
        <NativeDragActionsContext.Provider value={actions}>
          <NativeCollectionRendererContext.Provider value={renderer}>
            <Fixture />
          </NativeCollectionRendererContext.Provider>
        </NativeDragActionsContext.Provider>
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  const owner = () => {
    if (!current) throw new Error("Original Table owner missing")
    return current
  }
  const binding = owner().dragAndDrop.binding!
  const metadata = () => JSON.parse(actions.bindings())[0]
  const ready = () => {
    const data = metadata()
    actions.acceptStatus(
      JSON.stringify({
        kind: "binding",
        ownerId: "drag-owner",
        windowId: "window",
        epoch: 2,
        moduleId: "native-module",
        bindingId: data.bindingId,
        revision: data.revision,
        rootTarget: data.rootTarget,
        ready: true,
        error: "",
      }),
    )
  }
  ready()
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  return { owner, binding, metadata, ready, rendered, actions, editor, changes, values, endpointRefs }
}

it("keeps original rows/editors and native target rectangles while exposing separate on-item drop buttons", async () => {
  const glyph = jest.spyOn(
    jest.requireActual<typeof import("../../SortAndFilterPanel/glyphs")>("../../SortAndFilterPanel/glyphs"),
    "QueryGlyph",
  )
  const onItemDrop = jest.fn(),
    fixture = await setup({ options: { onItemDrop } })
  const source = fixture.binding.rowView(0),
    target = fixture.binding.targetView(""),
    editor = fixture.editor.current
  expect(
    fixture.metadata().members.find((member: TNativeDragMemberBinding) => member.key === "number:0").handleTag,
  ).toBe(findNodeHandle(fixture.binding.handleView(0)))
  expect(fixture.binding.handleView(0)).not.toBeNull()
  const grips = glyph.mock.calls.filter(([props]) => props.kind === "grip")
  expect(grips.length).toBeGreaterThan(0)
  expect(grips.every(([props]) => props.color === "orchid")).toBe(true)
  expect(screen.getByTestId("drag-row-zero").props.iconColor).toBeUndefined()
  await act(async () => nativeVirtualDrag.start(fixture.binding, 0, nativeDragFormatter("en-US"), "virtual", "handle"))
  expect(fixture.values.get(0)).toMatchObject({ isDragging: true })
  expect(screen.getByTestId("drag-row-zero").props.accessibilityElementsHidden).not.toBe(true)
  expect(fixture.binding.rowView(0)).toBe(source)
  expect(fixture.binding.targetView("")).toBe(target)
  const endpoint = screen.getByTestId("table-row-drop-string:"),
    endpointRef = fixture.endpointRefs.get("")!.current
  expect(endpoint.props.accessible).toBe(true)
  expect(endpointRef).not.toBe(target)
  expect(
    fixture.metadata().members.find((member: TNativeDragMemberBinding) => member.key === "string:").targetTag,
  ).toBe(findNodeHandle(target))
  await act(async () => {
    endpoint.props.onNativeActivation({
      nativeEvent: {
        ownerId: endpoint.props.ownerId,
        activationId: 1,
        kind: "activation",
        source: "ios-accessibility-activate",
        scopeOwnerId: "drag-owner",
        windowId: "window",
        epoch: 7,
        target: findNodeHandle(endpointRef),
      },
    })
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(onItemDrop).toHaveBeenCalledTimes(1)
  expect(onItemDrop.mock.calls[0][0].target).toEqual({ type: "item", key: "", dropPosition: "on" })
  expect(fixture.editor.current).toBe(editor)
  expect(screen.getByTestId("original-drag-editor").props.value).toBe("untouched")
  expect(fixture.changes).not.toHaveBeenCalled()
  await fixture.rendered.unmount()
  fixture.actions.dispose()
})

it.each(["renderer", "hooks", "constructor"] as const)(
  "retains the %s drop delegate at the original Table collection boundary",
  async (kind) => {
    const rendererDelegate = {
      getDropTargetFromPoint: jest.fn(() => ({ type: "item" as const, key: "", dropPosition: "on" as const })),
    }
    const hookDelegate = {
      getDropTargetFromPoint: jest.fn(() => ({ type: "item" as const, key: 0, dropPosition: "on" as const })),
    }
    const constructed = jest.fn()
    class Delegate extends NativeListDropTargetDelegate {
      constructor(...args: ConstructorParameters<typeof NativeListDropTargetDelegate>) {
        super(...args)
        constructed(...args)
      }
    }
    const fixture = await setup({
      options: kind === "hooks" ? { dropTargetDelegate: hookDelegate } : {},
      renderer:
        kind === "constructor"
          ? DefaultNativeCollectionRenderer
          : { ...DefaultNativeCollectionRenderer, dropTargetDelegate: rendererDelegate },
      hooks: (hooks) => ({ ...hooks, ListDropTargetDelegate: Delegate }),
    })
    const delegate = fixture.binding.dropOptions.dropTargetDelegate!
    if (kind === "constructor")
      expect(constructed).toHaveBeenCalledWith(
        fixture.owner().collection.rows,
        expect.objectContaining({ current: fixture.owner().root.current }),
        { direction: "ltr" },
      )
    else {
      const result = delegate.getDropTargetFromPoint(10, 20, () => true)
      expect(result).toMatchObject({ key: kind === "hooks" ? 0 : "" })
      expect(
        kind === "hooks" ? hookDelegate.getDropTargetFromPoint : rendererDelegate.getDropTargetFromPoint,
      ).toHaveBeenCalledWith(10, 20, expect.any(Function))
      expect(constructed).not.toHaveBeenCalled()
      if (kind === "hooks") expect(rendererDelegate.getDropTargetFromPoint).not.toHaveBeenCalled()
    }
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  },
)

it.each(["en-US", "ar-AE"])(
  "binds original hover activation and virtual expand/collapse keys for %s",
  async (locale) => {
    const fixture = await setup({ locale })
    expect(fixture.owner().state.collection.getItem("")!.hasChildNodes).toBe(true)
    await act(() =>
      fixture.binding.virtualTarget(
        "physical-hover",
        { type: "item", key: "", dropPosition: "on" },
        new Set(["text/plain"]),
        ["copy"],
      ),
    )
    await act(() => fixture.binding.virtualActivate("physical-hover", { x: 60, y: 60 }))
    expect(fixture.owner().state.expandedKeys.has("")).toBe(true)
    await act(() => fixture.binding.virtualActivate("physical-hover", { x: 60, y: 60 }))
    expect(fixture.owner().state.expandedKeys.has("")).toBe(true)
    await act(() => fixture.binding.retire())
    fixture.binding.publish()
    fixture.ready()
    await act(async () => nativeVirtualDrag.start(fixture.binding, 0, nativeDragFormatter(locale), "virtual", "handle"))
    await act(() => nativeVirtualDrag.choose(fixture.binding, { type: "item", key: "", dropPosition: "on" }))
    await act(async () => nativeVirtualDrag.activate())
    expect(fixture.owner().state.expandedKeys.has("")).toBe(false)
    const event = (key: string) =>
      ({
        nativeEvent: { key },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      }) as unknown as TNativeKeyboardEvent
    await act(() => nativeVirtualDrag.key(event(locale === "ar-AE" ? "ArrowLeft" : "ArrowRight")))
    expect(fixture.owner().state.expandedKeys.has("")).toBe(true)
    await act(() => nativeVirtualDrag.key(event(locale === "ar-AE" ? "ArrowRight" : "ArrowLeft")))
    expect(fixture.owner().state.expandedKeys.has("")).toBe(false)
    await act(async () => nativeVirtualDrag.cancel())
    await fixture.rendered.unmount()
    fixture.actions.dispose()
  },
)
