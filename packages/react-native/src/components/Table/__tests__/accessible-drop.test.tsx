import { cleanup } from "@testing-library/react-native"
import { Fragment, createRef, useInsertionEffect, useState } from "react"
import { AccessibilityInfo, AppState, TextInput, type AppStateStatus } from "react-native"

import { useNativeDragAndDrop } from "../../../collection/dragAndDrop/hooks"
import { nativeDragFormatter } from "../../../collection/dragAndDrop/messages"
import type { TNativeDropEvent } from "../../../collection/dragAndDrop/types"
import { nativeVirtualDrag } from "../../../collection/dragAndDrop/virtualDrag"
import { renderNativeCollectionNode } from "../../../collection/renderer"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionBranchProps,
} from "../../../collection/renderer"
import { createNativeKeyScope } from "../../../input/keyScope"
import { NativeDragActionsContext, createNativeDragActions } from "../../../input/nativeDragActions"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable } from "../context"
import {
  nativeTableChildren,
  createNativeTableHeaderModel,
  nativeTableReceiver,
  createNativeTableRowModel,
} from "../model"
import { Table } from "../Table"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "./collectionModel"
import { CellFixtureBody } from "./fixtures/TableCellFixture"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    acceptsAction: jest.fn(() => true),
    settleAction: jest.fn(() => true),
  },
}))
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
const hidden = { includeHiddenElements: true }
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {})
})
afterEach(async () => {
  await nativeVirtualDrag.cancel()
  await cleanup()
  jest.restoreAllMocks()
})

const setup = async () => {
  const keyboard = createNativeKeyScope("chooser-owner")
  const actions = createNativeDragActions(keyboard)
  const window = (epoch: number, canLift = true) =>
    actions.acceptStatus(
      JSON.stringify({
        kind: "window",
        ownerId: "chooser-owner",
        windowId: "original-window",
        epoch,
        surfaceId: 1,
        scopeTarget: 10,
        available: true,
        canLift,
        canDrop: canLift,
      }),
    )
  window(1)
  const editor = createRef<TextInput>()
  const changed = jest.fn()
  const onDrop = jest.fn((_event: TNativeDropEvent) => {})
  const onItemDrop = jest.fn()
  const onDragStart = jest.fn()
  const onDragEnd = jest.fn()
  let rejection: "mime" | "operation" | null = null
  const getItems = jest.fn(() =>
    rejection === "mime" ? [{ "application/json": "{}" }] : [{ "text/plain": "original payload" }],
  )
  let owner!: ReturnType<typeof useNativeTable>
  let materialize = () => {}
  const requestRendering = jest.fn(() => materialize())
  const scrollToKey = jest.fn()
  const Body = ({ collection, parent }: TNativeCollectionBranchProps) => {
    const [mounted, setMounted] = useState(false)
    useInsertionEffect(() => {
      materialize = () => setMounted(true)
    })
    return (
      <>
        {[...collection.getChildren(parent.key)]
          .filter((node) => node.key !== "target" || mounted)
          .map((node) => (
            <Fragment key={node.key}>{renderNativeCollectionNode(node)}</Fragment>
          ))}
      </>
    )
  }
  const Capture = () => {
    owner = useNativeTable()
    return null
  }
  const columns = [{ id: "value", name: "Value", isRowHeader: true }]
  let sourceRevision = 0
  const Fixture = () => {
    const { dragAndDropHooks } = useNativeDragAndDrop({
      getItems,
      onDrop,
      onItemDrop,
      onDragStart,
      onDragEnd,
      acceptedDragTypes: ["text/plain"],
      getDropOperation: (_target, _types, operations) => (rejection === "operation" ? "cancel" : operations[0]!),
    })
    return (
      <Table
        accessibilityLabel="Original table"
        dragAndDropHooks={dragAndDropHooks}
        render={(props) => (
          <NativeFocusView {...props}>
            {props.children}
            <Capture />
          </NativeFocusView>
        )}
        items={(modelOptions) =>
          nativeTableChildren(
            createNativeTableHeaderModel({ columns: columns }, modelOptions),
            nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
              "__body:1",
              "tablebody",
              {},
              (visibleProps) => <CellFixtureBody {...visibleProps} />,
              nativeTableChildren(
                createNativeTableRowModel(
                  {
                    key: sourceRevision,
                    id: 0,
                    item: { value: "Source" },
                    textValue: "Source",
                    columns: columns,
                    renderCell: () => (
                      <TextInput
                        ref={editor}
                        testID="held-chooser-editor"
                        value="dirty draft"
                        selection={{ start: 3, end: 3 }}
                        onChangeText={changed}
                      />
                    ),
                  },
                  modelOptions,
                ),
                createNativeTableRowModel(
                  { id: "target", item: { value: "Offscreen" }, textValue: "Offscreen", columns: columns },
                  modelOptions,
                ),
              ),
            ),
          )
        }
      />
    )
  }
  const element = () => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeDragActionsContext.Provider value={actions}>
          <NativeCollectionRendererContext.Provider
            value={{
              ...DefaultNativeCollectionRenderer,
              isVirtualized: true,
              CollectionBranch: (props) =>
                props.parent.type === "body" || props.parent.type === "tablebody" ? (
                  <Body {...props} />
                ) : (
                  <DefaultNativeCollectionRenderer.CollectionBranch {...props} />
                ),
              layoutDelegate: {
                requestRendering,
                scrollToKey,
                getItemRect: () => null,
                getVisibleRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
                getContentSize: () => ({ width: 100, height: 200 }),
              },
            }}
          >
            <Fixture />
          </NativeCollectionRendererContext.Provider>
        </NativeDragActionsContext.Provider>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const rendered = await render(element())
  const binding = owner.dragAndDrop.binding!
  const metadata = () =>
    JSON.parse(actions.bindings()).find((value: { bindingId: string }) => value.bindingId === binding.id)
  const ready = (epoch: number) =>
    actions.acceptStatus(
      JSON.stringify({
        ...metadata(),
        kind: "binding",
        ownerId: "chooser-owner",
        windowId: "original-window",
        epoch,
        ready: true,
        error: "",
      }),
    )
  await act(() => ready(1))
  jest.spyOn(binding, "measure").mockResolvedValue({ x: 10, y: 20, width: 100, height: 80 })
  return {
    binding,
    editor,
    getItems,
    changed,
    onDrop,
    onItemDrop,
    onDragStart,
    onDragEnd,
    ready,
    window,
    requestRendering,
    scrollToKey,
    metadata,
    owner: () => owner,
    reject: async (kind: "mime" | "operation") => {
      rejection = kind
    },
    replaceSource: async () => {
      sourceRevision++
      await rendered.rerender(element())
    },
    dispose: async () => {
      await rendered.unmount()
      actions.dispose()
    },
  }
}

const open = async (fixture: Awaited<ReturnType<typeof setup>>) => {
  await act(() => nativeVirtualDrag.start(fixture.binding, 0, nativeDragFormatter("en-US"), "keyboard"))
  expect(screen.getAllByTestId("native-drop-chooser-window", { includeHiddenElements: true })).toHaveLength(1)
  const modal = screen.getByTestId("native-drop-chooser-window", hidden)
  const dismiss = modal.props.onDismiss
  await fireEvent(modal, "show")
  return dismiss as () => void
}

it("keeps a held Table editor through chooser coverage and waits for the current offscreen target before dropping", async () => {
  const fixture = await setup()
  const {
    binding,
    editor,
    getItems,
    changed,
    onDrop,
    onItemDrop,
    onDragStart,
    ready,
    window,
    requestRendering,
    scrollToKey,
    metadata,
  } = fixture
  const owner = fixture.owner()
  const originalEditor = editor.current
  const originalRoot = owner.root.current
  const originalSource = binding.rowView(0)
  expect(originalEditor).not.toBeNull()
  expect(originalSource).not.toBeNull()
  expect(binding.targetView("target")).toBeNull()
  const dismiss = await open(fixture)
  await act(() => window(2, false))
  expect(nativeVirtualDrag.active()).toBeNull()
  expect(binding.controller.activeSession()).toBeNull()
  expect(getItems).not.toHaveBeenCalled()
  expect(onDragStart).not.toHaveBeenCalled()
  expect(metadata().virtualFocus).toBeUndefined()
  await fireEvent.press(screen.getByRole("button", { name: "Drop on Offscreen" }))
  await fireEvent.press(screen.getByRole("button", { name: "Drop" }))
  expect(nativeVirtualDrag.pendingRequest()?.phase).toBe("closing")
  expect(onDrop).not.toHaveBeenCalled()
  await act(() => dismiss())
  expect(nativeVirtualDrag.pendingRequest()?.phase).toBe("waiting")
  expect(onDragStart).not.toHaveBeenCalled()
  await act(() => window(3))
  await act(() => ready(3))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(onDragStart).toHaveBeenCalledTimes(1)
  expect(getItems).toHaveBeenCalledTimes(1)
  expect(onDragStart.mock.invocationCallOrder[0]).toBeLessThan(getItems.mock.invocationCallOrder[0]!)
  expect(requestRendering).toHaveBeenCalledWith("target")
  expect(scrollToKey).toHaveBeenCalledWith("target")
  expect(onDrop).not.toHaveBeenCalled()
  expect(binding.targetView("target")).not.toBeNull()
  await act(() => ready(3))
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(onDrop).toHaveBeenCalledTimes(1)
  expect(onItemDrop).not.toHaveBeenCalled()
  expect(onDrop.mock.calls[0]![0].target).toEqual({ type: "item", key: "target", dropPosition: "on" })
  const item = onDrop.mock.calls[0]![0].items[0]!
  expect(item.kind).toBe("text")
  if (item.kind !== "text") throw new Error("Expected the original text payload")
  await expect(item.getText("text/plain")).resolves.toBe("original payload")
  expect(editor.current).toBe(originalEditor)
  expect(owner.root.current).toBe(originalRoot)
  expect(binding.rowView(0)).toBe(originalSource)
  expect(screen.getByTestId("held-chooser-editor").props).toMatchObject({
    value: "dirty draft",
    selection: { start: 3, end: 3 },
  })
  expect(changed).not.toHaveBeenCalled()
  await fixture.dispose()
})

it.each(["source", "window"])(
  "rejects %s replacement after chooser confirmation before a transaction starts",
  async (kind) => {
    const fixture = await setup()
    const dismiss = await open(fixture)
    await act(() => fixture.window(2, false))
    await fireEvent.press(screen.getByRole("button", { name: "Drop on Offscreen" }))
    await fireEvent.press(screen.getByRole("button", { name: "Drop" }))
    if (kind === "source") await fixture.replaceSource()
    else
      await act(() => {
        const before = fixture.binding.scope!.window()
        jest.spyOn(fixture.binding.scope!, "window").mockReturnValue({ ...before, windowId: "replacement-window" })
        nativeVirtualDrag.reconcile(fixture.binding)
      })
    await act(() => dismiss())
    expect(nativeVirtualDrag.pendingRequest()).toBeNull()
    expect(fixture.onDragStart).not.toHaveBeenCalled()
    expect(fixture.getItems).not.toHaveBeenCalled()
    expect(fixture.onDrop).not.toHaveBeenCalled()
    expect(fixture.onDragEnd).not.toHaveBeenCalled()
    await fixture.dispose()
  },
)

it("cancels an open chooser without fabricating drag callbacks or changing the held draft", async () => {
  const fixture = await setup()
  const original = fixture.editor.current
  const dismiss = await open(fixture)
  await act(() => fixture.window(2, false))
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }))
  await act(() => dismiss())
  expect(nativeVirtualDrag.pendingRequest()).toBeNull()
  expect(fixture.editor.current).toBe(original)
  expect(fixture.changed).not.toHaveBeenCalled()
  for (const callback of [fixture.onDragStart, fixture.onDragEnd, fixture.onDrop, fixture.getItems])
    expect(callback).not.toHaveBeenCalled()
  await fixture.dispose()
})

it("retires its chooser request on backgrounding without an original editor write", async () => {
  const states = new Set<(state: AppStateStatus) => void>()
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    states.add(listener)
    return {
      remove: () => {
        states.delete(listener)
      },
    }
  })
  const fixture = await setup()
  const original = fixture.editor.current
  await open(fixture)
  await act(() => {
    for (const listener of states) listener("background")
  })
  expect(nativeVirtualDrag.pendingRequest()).toBeNull()
  expect(fixture.editor.current).toBe(original)
  expect(fixture.getItems).not.toHaveBeenCalled()
  expect(fixture.onDrop).not.toHaveBeenCalled()
  await fixture.dispose()
})

it.each(["mime", "operation"] as const)(
  "rechecks %s acceptance after selection and dismissal before any target work or business drop",
  async (kind) => {
    const fixture = await setup()
    const original = fixture.editor.current
    const dismiss = await open(fixture)
    await act(() => fixture.window(2, false))
    await fireEvent.press(screen.getByRole("button", { name: "Drop on Offscreen" }))
    await fixture.reject(kind)
    await fireEvent.press(screen.getByRole("button", { name: "Drop" }))
    expect(fixture.onDragStart).not.toHaveBeenCalled()
    await act(() => dismiss())
    await act(() => fixture.window(3))
    await act(() => fixture.ready(3))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(fixture.onDragStart).toHaveBeenCalledTimes(1)
    expect(fixture.getItems).toHaveBeenCalledTimes(1)
    expect(fixture.onDragStart.mock.invocationCallOrder[0]).toBeLessThan(fixture.getItems.mock.invocationCallOrder[0]!)
    expect(fixture.onDrop).not.toHaveBeenCalled()
    expect(fixture.onItemDrop).not.toHaveBeenCalled()
    expect(fixture.requestRendering).not.toHaveBeenCalled()
    expect(fixture.onDragEnd).toHaveBeenCalledTimes(1)
    expect(fixture.onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ dropOperation: "cancel" }))
    expect(nativeVirtualDrag.pendingRequest()).toBeNull()
    expect(fixture.editor.current).toBe(original)
    expect(fixture.changed).not.toHaveBeenCalled()
    await fixture.dispose()
  },
)
