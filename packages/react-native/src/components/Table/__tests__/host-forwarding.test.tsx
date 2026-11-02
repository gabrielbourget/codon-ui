import { createRef } from "react"
import {
  findNodeHandle,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type PointerEvent,
} from "react-native"

import { NativeFocusView, Table, TableCell, TableColumn } from "../../.."
import { NativeThemeProvider } from "../../../theme"
import {
  nativeTableChildren,
  createNativeTableHeaderModel,
  createNativeTableBodyModel,
  nativeTableReceiver,
  createNativeTableRowModel,
} from "../model"

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./collectionModel"
import { CellFixtureBody, CellFixtureRow } from "./fixtures/TableCellFixture"
import { ColumnFixtureHeader } from "./fixtures/TableColumnFixture"

const makeCallbacks = () => ({
  onTouchStartCapture: jest.fn<void, [GestureResponderEvent]>(),
  onTouchMoveCapture: jest.fn<void, [GestureResponderEvent]>(),
  onTouchCancelCapture: jest.fn<void, [GestureResponderEvent]>(),
  onPointerOver: jest.fn<void, [PointerEvent]>(),
  onPointerOverCapture: jest.fn<void, [PointerEvent]>(),
  onPointerOut: jest.fn<void, [PointerEvent]>(),
  onPointerOutCapture: jest.fn<void, [PointerEvent]>(),
  onGotPointerCapture: jest.fn<void, [PointerEvent]>(),
  onGotPointerCaptureCapture: jest.fn<void, [PointerEvent]>(),
  onLostPointerCapture: jest.fn<void, [PointerEvent]>(),
  onLostPointerCaptureCapture: jest.fn<void, [PointerEvent]>(),
})
type TPart = "root" | "header" | "body" | "column" | "row" | "cell"
const phases = [
  "onTouchStartCapture",
  "onTouchMoveCapture",
  "onTouchCancelCapture",
  "onPointerOver",
  "onPointerOverCapture",
  "onPointerOut",
  "onPointerOutCapture",
  "onGotPointerCapture",
  "onGotPointerCaptureCapture",
  "onLostPointerCapture",
  "onLostPointerCaptureCapture",
] as const

it.each(["generated", "raw"] as const)(
  "forwards original native touch/pointer callbacks and refs across default/custom %s Table hosts",
  async (kind) => {
    const callbacks = {
      root: makeCallbacks(),
      header: makeCallbacks(),
      body: makeCallbacks(),
      column: makeCallbacks(),
      row: makeCallbacks(),
      cell: makeCallbacks(),
    }
    const refs = {
      root: createRef<View>(),
      header: createRef<View>(),
      body: createRef<View>(),
      column: createRef<View>(),
      row: createRef<View>(),
      cell: createRef<View>(),
    }
    const editor = createRef<TextInput>(),
      changed = jest.fn()
    const rendererBags: Partial<Record<TPart, object>> = {}
    const remember = <T extends object>(name: TPart, props: T): T => {
      rendererBags[name] = props
      return props
    }
    const hostProps = (name: TPart) => ({ ...callbacks[name], ref: refs[name], testID: `touch-${name}` })
    const columns = [{ id: "name", name: "Name", isRowHeader: true }]
    const items = [{ id: "row", name: "Original" }]
    const heldEditor = () => <TextInput ref={editor} testID="capture-held-editor" value="held" onChangeText={changed} />
    const bodyColumns = [{ ...columns[0], cellRenderer: heldEditor }]
    const node = (custom: boolean) => (
      <NativeThemeProvider>
        <Table
          {...hostProps("root")}
          render={custom ? (props) => <NativeFocusView {...remember("root", props)} /> : undefined}
          items={(modelOptions) =>
            nativeTableChildren(
              kind === "generated"
                ? nativeTableChildren(
                    createNativeTableHeaderModel(
                      {
                        ...hostProps("header"),
                        columns: columns,
                        render: custom ? (props) => <View {...remember("header", props)} /> : undefined,
                      },
                      modelOptions,
                    ),
                    createNativeTableBodyModel(
                      {
                        ...hostProps("body"),
                        items: items,
                        columns: bodyColumns,
                        render: custom ? (props) => <View {...remember("body", props)} /> : undefined,
                      },
                      modelOptions,
                    ),
                  )
                : nativeTableChildren(
                    nativeTableReceiver<React.ComponentProps<typeof ColumnFixtureHeader>>(
                      "__header:1",
                      "tableheader",
                      {},
                      (visibleProps) => <ColumnFixtureHeader {...visibleProps} />,
                      nativeTableChildren(
                        nativeTableReceiver<React.ComponentProps<typeof TableColumn>>(
                          "name",
                          "column",
                          {
                            ...hostProps("column"),
                            id: "name",
                            columnID: "name",
                            isRowHeader: true,
                            render: custom ? (props) => <NativeFocusView {...remember("column", props)} /> : undefined,
                            children: <>Name</>,
                          },
                          (visibleProps) => <TableColumn {...visibleProps} />,
                          [],
                        ),
                      ),
                    ),
                    nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
                      "__body:2",
                      "tablebody",
                      {},
                      (visibleProps) => <CellFixtureBody {...visibleProps} />,
                      nativeTableChildren(
                        createNativeTableRowModel(
                          {
                            ...hostProps("row"),
                            id: "row",
                            item: items[0],
                            columns: columns,
                            render: custom ? (props) => <NativeFocusView {...remember("row", props)} /> : undefined,
                          },
                          modelOptions,
                        ),
                        nativeTableReceiver<React.ComponentProps<typeof CellFixtureRow>>(
                          "cell-row",
                          "item",
                          { id: "cell-row" },
                          (visibleProps) => <CellFixtureRow {...visibleProps} />,
                          nativeTableChildren(
                            nativeTableReceiver<React.ComponentProps<typeof TableCell>>(
                              "__cell:3",
                              "cell",
                              {
                                ...hostProps("cell"),
                                columnID: "name",
                                render: custom
                                  ? (props) => <NativeFocusView {...remember("cell", props)} />
                                  : undefined,
                                children: heldEditor(),
                              },
                              (visibleProps) => <TableCell {...visibleProps} />,
                              [],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
            )
          }
        />
      </NativeThemeProvider>
    )
    const parts =
      kind === "generated" ? (["root", "header", "body"] as const) : (["root", "column", "row", "cell"] as const)
    const view = await render(node(false))
    const originals = Object.fromEntries(parts.map((name) => [name, refs[name].current]))
    const originalEditor = editor.current!,
      write = jest.spyOn(originalEditor, "setNativeProps")
    for (const [round, custom] of [false, true, false].entries()) {
      if (round) await view.rerender(node(custom))
      for (const name of parts) {
        const host = screen.getByTestId(`touch-${name}`),
          original = originals[name]
        expect(original).not.toBeNull()
        expect(refs[name].current).toBe(original)
        if (custom) expect(rendererBags[name]).toMatchObject(callbacks[name])
        for (const phase of phases) {
          expect(host.props[phase]).toBe(callbacks[name][phase])
          const event = {
            target: findNodeHandle(refs[name].current),
            currentTarget: refs[name].current,
            nativeEvent: { target: findNodeHandle(refs[name].current), pointerType: "mouse" },
          }
          await act(() => host.props[phase](event))
          expect(callbacks[name][phase]).toHaveBeenCalledTimes(round + 1)
          expect(callbacks[name][phase].mock.calls[round][0]).toBe(event)
          expect(event.currentTarget).toBe(original)
          expect(event.nativeEvent.target).toBe(findNodeHandle(refs[name].current))
        }
      }
      expect(editor.current).toBe(originalEditor)
      expect(screen.getByTestId("capture-held-editor").props.value).toBe("held")
    }
    expect(changed).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  },
)

type TMetadataStep = {
  direction: "ltr" | "rtl"
  display: "none" | "flex"
  language: string | undefined
  custom: boolean
  rendererStyle?: { direction: "ltr" | "rtl"; display: "none" | "flex" }
}

it.each(["generated", "raw"] as const)(
  "retains existing native direction/language/display APIs and original %s Table hosts",
  async (kind) => {
    const refs = {
      root: createRef<View>(),
      header: createRef<View>(),
      body: createRef<View>(),
      column: createRef<View>(),
      row: createRef<View>(),
      cell: createRef<View>(),
    }
    const editor = createRef<TextInput>(),
      changed = jest.fn()
    const columns = [{ id: "name", name: "Name", isRowHeader: true }]
    const items = [{ id: "row", name: "Original" }]
    const heldEditor = () => (
      <TextInput ref={editor} testID="metadata-held-editor" value="held" onChangeText={changed} />
    )
    const bodyColumns = [{ ...columns[0], cellRenderer: heldEditor }]
    const node = (step: TMetadataStep) => {
      const props = (name: TPart) => ({
        ref: refs[name],
        testID: `metadata-${name}`,
        accessibilityLanguage: step.language,
        customStyles: {
          direction: step.direction === "ltr" ? ("rtl" as const) : ("ltr" as const),
          display: step.display === "none" ? ("flex" as const) : ("none" as const),
        },
        style: { direction: step.direction, display: step.display },
      })
      return (
        <NativeThemeProvider>
          <Table
            {...props("root")}
            render={
              step.custom ? (host) => <NativeFocusView {...host} style={[host.style, step.rendererStyle]} /> : undefined
            }
            items={(modelOptions) =>
              nativeTableChildren(
                kind === "generated"
                  ? nativeTableChildren(
                      createNativeTableHeaderModel(
                        {
                          ...props("header"),
                          columns: columns,
                          render: step.custom
                            ? (host) => <View {...host} style={[host.style, step.rendererStyle]} />
                            : undefined,
                        },
                        modelOptions,
                      ),
                      createNativeTableBodyModel(
                        {
                          ...props("body"),
                          items: items,
                          columns: bodyColumns,
                          render: step.custom
                            ? (host) => <View {...host} style={[host.style, step.rendererStyle]} />
                            : undefined,
                        },
                        modelOptions,
                      ),
                    )
                  : nativeTableChildren(
                      nativeTableReceiver<React.ComponentProps<typeof ColumnFixtureHeader>>(
                        "__header:4",
                        "tableheader",
                        {},
                        (visibleProps) => <ColumnFixtureHeader {...visibleProps} />,
                        nativeTableChildren(
                          nativeTableReceiver<React.ComponentProps<typeof TableColumn>>(
                            "name",
                            "column",
                            {
                              ...props("column"),
                              id: "name",
                              columnID: "name",
                              isRowHeader: true,
                              render: step.custom
                                ? (host) => <NativeFocusView {...host} style={[host.style, step.rendererStyle]} />
                                : undefined,
                              children: <>Name</>,
                            },
                            (visibleProps) => <TableColumn {...visibleProps} />,
                            [],
                          ),
                        ),
                      ),
                      nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
                        "__body:5",
                        "tablebody",
                        {},
                        (visibleProps) => <CellFixtureBody {...visibleProps} />,
                        nativeTableChildren(
                          createNativeTableRowModel(
                            {
                              ...props("row"),
                              id: "row",
                              item: items[0],
                              columns: columns,
                              render: step.custom
                                ? (host) => <NativeFocusView {...host} style={[host.style, step.rendererStyle]} />
                                : undefined,
                            },
                            modelOptions,
                          ),
                          nativeTableReceiver<React.ComponentProps<typeof CellFixtureRow>>(
                            "cell-row",
                            "item",
                            { id: "cell-row" },
                            (visibleProps) => <CellFixtureRow {...visibleProps} />,
                            nativeTableChildren(
                              nativeTableReceiver<React.ComponentProps<typeof TableCell>>(
                                "__cell:6",
                                "cell",
                                {
                                  ...props("cell"),
                                  columnID: "name",
                                  render: step.custom
                                    ? (host) => <NativeFocusView {...host} style={[host.style, step.rendererStyle]} />
                                    : undefined,
                                  children: heldEditor(),
                                },
                                (visibleProps) => <TableCell {...visibleProps} />,
                                [],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              )
            }
          />
        </NativeThemeProvider>
      )
    }
    const steps: TMetadataStep[] = [
      { direction: "ltr", display: "flex", language: "fr-CA", custom: false },
      { direction: "rtl", display: "none", language: "ar", custom: false },
      {
        direction: "ltr",
        display: "flex",
        language: "",
        custom: true,
        rendererStyle: { direction: "rtl", display: "none" },
      },
      {
        direction: "rtl",
        display: "none",
        language: undefined,
        custom: true,
        rendererStyle: { direction: "ltr", display: "flex" },
      },
      { direction: "ltr", display: "flex", language: "fr-CA", custom: false },
    ]
    const parts =
      kind === "generated" ? (["root", "header", "body"] as const) : (["root", "column", "row", "cell"] as const)
    const view = await render(node(steps[0]))
    const originals = Object.fromEntries(parts.map((name) => [name, refs[name].current]))
    const originalEditor = editor.current!,
      write = jest.spyOn(originalEditor, "setNativeProps")
    for (const [index, step] of steps.entries()) {
      if (index) await view.rerender(node(step))
      for (const name of parts) {
        const hosts = screen.container.queryAll((host) => host.props.testID === `metadata-${name}`)
        expect(hosts).toHaveLength(1)
        const host = hosts[0],
          expected = step.custom ? step.rendererStyle! : step
        expect(StyleSheet.flatten(host.props.style)).toMatchObject({
          direction: expected.direction,
          display: expected.display,
        })
        expect(host.props.accessibilityLanguage).toBe(step.language)
        expect(originals[name]).not.toBeNull()
        expect(refs[name].current).toBe(originals[name])
      }
      expect(editor.current).toBe(originalEditor)
      const inputs = screen.container.queryAll((host) => host.props.testID === "metadata-held-editor")
      expect(inputs).toHaveLength(1)
      expect(inputs[0].props.value).toBe("held")
    }
    expect(changed).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  },
)

const installTags = () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let tag = 70000
  const spy = jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++tag)
    return tags.get(view)!
  })
  return () => spy.mockRestore()
}

const makeClickCallbacks = () => ({
  onClick: jest.fn(),
  onClickCapture: jest.fn(),
})
const clickPhases = ["onClick", "onClickCapture"] as const

it.each(["generated", "raw"] as const)(
  "preserves original native click observers without duplicating Table actions across default/custom %s Table hosts",
  async (kind) => {
    const restore = installTags()
    try {
      const callbacks = {
        root: makeClickCallbacks(),
        header: makeClickCallbacks(),
        body: makeClickCallbacks(),
        column: makeClickCallbacks(),
        row: makeClickCallbacks(),
        cell: makeClickCallbacks(),
      }
      const refs = {
        root: createRef<View>(),
        header: createRef<View>(),
        body: createRef<View>(),
        column: createRef<View>(),
        row: createRef<View>(),
        cell: createRef<View>(),
      }
      const editor = createRef<TextInput>(),
        changed = jest.fn(),
        action = jest.fn()
      const rendererBags: Partial<Record<TPart, object>> = {}
      const remember = <T extends object>(name: TPart, props: T): T => {
        rendererBags[name] = props
        return props
      }
      const hostProps = (name: TPart, observe: boolean) => ({
        ...(observe ? callbacks[name] : {}),
        ref: refs[name],
        testID: `touch-${name}`,
      })
      const columns = [{ id: "name", name: "Name", isRowHeader: true }]
      const items = [{ id: "row", name: "Original" }]
      const heldEditor = () => (
        <TextInput ref={editor} testID="capture-held-editor" value="held" onChangeText={changed} />
      )
      const bodyColumns = [{ ...columns[0], cellRenderer: heldEditor }]
      const node = (custom: boolean, observe = true) => (
        <NativeThemeProvider>
          <Table
            clickableRows
            onRowAction={action}
            {...hostProps("root", observe)}
            render={custom ? (props) => <NativeFocusView {...remember("root", props)} /> : undefined}
            items={(modelOptions) =>
              nativeTableChildren(
                kind === "generated"
                  ? nativeTableChildren(
                      createNativeTableHeaderModel(
                        {
                          ...hostProps("header", observe),
                          columns: columns,
                          render: custom ? (props) => <View {...remember("header", props)} /> : undefined,
                        },
                        modelOptions,
                      ),
                      createNativeTableBodyModel(
                        {
                          ...hostProps("body", observe),
                          items: items,
                          columns: bodyColumns,
                          render: custom ? (props) => <View {...remember("body", props)} /> : undefined,
                        },
                        modelOptions,
                      ),
                    )
                  : nativeTableChildren(
                      nativeTableReceiver<React.ComponentProps<typeof ColumnFixtureHeader>>(
                        "__header:7",
                        "tableheader",
                        {},
                        (visibleProps) => <ColumnFixtureHeader {...visibleProps} />,
                        nativeTableChildren(
                          nativeTableReceiver<React.ComponentProps<typeof TableColumn>>(
                            "name",
                            "column",
                            {
                              ...hostProps("column", observe),
                              id: "name",
                              columnID: "name",
                              isRowHeader: true,
                              render: custom
                                ? (props) => <NativeFocusView {...remember("column", props)} />
                                : undefined,
                              children: <>Name</>,
                            },
                            (visibleProps) => <TableColumn {...visibleProps} />,
                            [],
                          ),
                        ),
                      ),
                      nativeTableReceiver<React.ComponentProps<typeof CellFixtureBody>>(
                        "__body:8",
                        "tablebody",
                        {},
                        (visibleProps) => <CellFixtureBody {...visibleProps} />,
                        nativeTableChildren(
                          createNativeTableRowModel(
                            {
                              ...hostProps("row", observe),
                              id: "row",
                              item: items[0],
                              columns: columns,
                              render: custom ? (props) => <NativeFocusView {...remember("row", props)} /> : undefined,
                            },
                            modelOptions,
                          ),
                          nativeTableReceiver<React.ComponentProps<typeof CellFixtureRow>>(
                            "cell-row",
                            "item",
                            { id: "cell-row" },
                            (visibleProps) => <CellFixtureRow {...visibleProps} />,
                            nativeTableChildren(
                              nativeTableReceiver<React.ComponentProps<typeof TableCell>>(
                                "__cell:9",
                                "cell",
                                {
                                  ...hostProps("cell", observe),
                                  columnID: "name",
                                  render: custom
                                    ? (props) => <NativeFocusView {...remember("cell", props)} />
                                    : undefined,
                                  children: heldEditor(),
                                },
                                (visibleProps) => <TableCell {...visibleProps} />,
                                [],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              )
            }
          />
        </NativeThemeProvider>
      )
      const parts =
        kind === "generated" ? (["root", "header", "body"] as const) : (["root", "column", "row", "cell"] as const)
      const view = await render(node(false))
      const originals = Object.fromEntries(parts.map((name) => [name, refs[name].current]))
      const originalEditor = editor.current!,
        write = jest.spyOn(originalEditor, "setNativeProps")
      for (const [round, custom] of [false, true, false].entries()) {
        if (round) await view.rerender(node(custom))
        for (const name of parts) {
          const host = screen.getByTestId(`touch-${name}`),
            original = originals[name]
          expect(original).not.toBeNull()
          expect(refs[name].current).toBe(original)
          if (custom) expect(rendererBags[name]).toMatchObject(callbacks[name])
          for (const phase of clickPhases) {
            expect(host.props[phase]).toBe(callbacks[name][phase])
            const event = {
              target: findNodeHandle(refs[name].current),
              currentTarget: refs[name].current,
              nativeEvent:
                phase === "onClick" ? {} : { target: findNodeHandle(refs[name].current), pointerType: "mouse" },
            }
            await act(() => host.props[phase](event))
            expect(callbacks[name][phase]).toHaveBeenCalledTimes(round + 1)
            expect(callbacks[name][phase].mock.calls[round][0]).toBe(event)
            expect(event.currentTarget).toBe(original)
            if (phase === "onClickCapture") expect(event.nativeEvent.target).toBe(findNodeHandle(refs[name].current))
            expect(action).not.toHaveBeenCalled()
          }
        }
        expect(editor.current).toBe(originalEditor)
        expect(screen.getByTestId("capture-held-editor").props.value).toBe("held")
      }
      const row = kind === "raw" ? screen.getByTestId("touch-row") : screen.getByTestId("table-row-string:row")
      const activation = {
        nativeEvent: {
          kind: "activation",
          ownerId: row.props.ownerId,
          source: "android-click",
          target: findNodeHandle(refs.row.current) ?? 17,
          observedAt: 0,
          activationId: 1,
          scopeOwnerId: "",
          windowId: "window-1",
          epoch: 0,
        },
      }
      await act(() => row.props.onNativeActivation(activation))
      expect(action).toHaveBeenCalledTimes(1)
      expect(action).toHaveBeenLastCalledWith("row")
      // Re-observing raw native clicks never routes a second selection/action.
      if (kind === "raw") await act(() => screen.getByTestId("touch-row").props.onClick({ nativeEvent: {} }))
      expect(action).toHaveBeenCalledTimes(1)
      await view.rerender(node(false, false))
      for (const name of parts) {
        const host = screen.getByTestId(`touch-${name}`)
        expect(host.props.onClick).toBeUndefined()
        expect(host.props.onClickCapture).toBeUndefined()
        expect(refs[name].current).toBe(originals[name])
      }
      const ordinary = kind === "raw" ? screen.getByTestId("touch-row") : screen.getByTestId("table-row-string:row")
      await act(() =>
        ordinary.props.onNativeActivation({
          nativeEvent: { ...activation.nativeEvent, ownerId: ordinary.props.ownerId, activationId: 2 },
        }),
      )
      expect(action).toHaveBeenCalledTimes(2)
      expect(changed).not.toHaveBeenCalled()
      expect(write).not.toHaveBeenCalled()
      await view.unmount()
    } finally {
      restore()
    }
  },
)
