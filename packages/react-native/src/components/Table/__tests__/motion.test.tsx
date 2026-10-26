import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef, useContext, type ReactNode } from "react"
import { StyleSheet, TextInput, View, findNodeHandle } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { createNativeCollectionBranch } from "../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../collection/renderer"
import { geometryPacket, geometrySnapshot } from "../../../input/__tests__/motionGeometry.fixture"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeMotionConfig } from "../../../motion/config"
import { MotionGlobalConfig, frameData, time } from "../../../motion/kernel"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable } from "../context"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
const Body = createNativeCollectionBranch<object, { children?: ReactNode }, View>(
  "body",
  (_props, ref, parent) => {
    const table = useNativeTable(),
      renderer = useContext(NativeCollectionRendererContext)
    return (
      <View ref={ref}>
        <renderer.CollectionBranch collection={table.collection} parent={parent} />
      </View>
    )
  },
  (props) => props.children,
)
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameID = 0
const flush = async (timestamp: number) => {
  await rawAct(() => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
  })
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameID, callback)
    return frameID
  })
})
afterEach(async () => {
  await cleanup()
  await flush(10000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it.each([false, true])(
  "projects row layout and preserves the original host/editor with custom render %s",
  async (custom) => {
    const row = createRef<View>(),
      editor = createRef<TextInput>(),
      change = jest.fn(),
      item = { id: "a", name: "Alpha" }
    const columns = [
      {
        id: "name",
        name: "Name",
        isRowHeader: true,
        cellRenderer: () => <TextInput ref={editor} testID="held" value="held" onChangeText={change} />,
      },
    ]
    const tree = (offset: number) => (
      <NativeThemeProvider>
        <NativeMotionConfig transition={{ duration: 0.1, ease: "linear" }}>
          <Table>
            <TableHeader columns={columns} />
            <Body>
              <TableRow
                ref={row}
                id="a"
                testID="row"
                item={item}
                columns={columns}
                style={{ marginLeft: offset }}
                render={custom ? (props) => <NativeFocusView {...props} /> : undefined}
              />
            </Body>
          </Table>
        </NativeMotionConfig>
      </NativeThemeProvider>
    )
    await render(tree(0))
    const originalRow = row.current!,
      originalEditor = editor.current!,
      editorWrite = jest.spyOn(originalEditor, "setNativeProps")
    Object.assign(originalRow, { isConnected: true })
    const initial = screen.getByTestId("row").props
    expect(initial.nativeMotionGeometryBinding).not.toBe("")
    expect(initial.nativeMotionDrawingOwner).toBe(true)
    expect(initial.nativeMotionProjectionRevision).not.toBe("")
    let revision = 0
    // Original mock refs and modeled geometry/frame packets exercise the real shared projection;
    // this is source integration evidence, not an installed native measurement.
    const send = async (kind: "frame" | "mount-before" | "mount-after", x: number, intent: string) => {
      const snapshot = geometrySnapshot()
      Object.assign(snapshot, {
        layout: [x, 20, 100, 50],
        untransformed: { box: [x, 20, 100, 50], quad: [x, 20, x + 100, 20, x + 100, 70, x, 70] },
        model: { box: [x, 20, 100, 50], quad: [x, 20, x + 100, 20, x + 100, 70, x, 70] },
      })
      Object.assign(snapshot.ancestors[0], {
        tag: findNodeHandle(originalRow),
        identity: initial.ownerId,
        projectionRevision: intent,
      })
      snapshot.ancestors.push({ ...snapshot.ancestors[0], tag: 0, identity: "parent", bounds: [0, 0, 300, 200] })
      const props = screen.getByTestId("row").props
      await act(() =>
        props.onNativeMotionGeometry({
          nativeEvent: geometryPacket({
            ownerId: props.ownerId,
            bindingId: props.nativeMotionGeometryBinding,
            target: findNodeHandle(originalRow)!,
            scopeOwnerId: "",
            epoch: 0,
            geometryRevision: ++revision,
            kind,
            transactionId: kind === "frame" ? "" : "row-layout",
            snapshot: JSON.stringify(snapshot),
          }),
        }),
      )
    }
    await send("frame", 10, initial.nativeMotionProjectionRevision)
    await screen.rerender(tree(100))
    const next = screen.getByTestId("row").props
    expect(next.nativeMotionProjectionRevision).not.toBe(initial.nativeMotionProjectionRevision)
    await send("mount-before", 10, initial.nativeMotionProjectionRevision)
    await send("mount-after", 110, next.nativeMotionProjectionRevision)
    expect(StyleSheet.flatten(screen.getByTestId("row").props.style).transform).toContainEqual({ translateX: -100 })
    await flush(1050)
    await flush(1120)
    expect(StyleSheet.flatten(screen.getByTestId("row").props.style).transform ?? []).not.toContainEqual({
      translateX: -100,
    })
    expect(row.current).toBe(originalRow)
    expect(editor.current).toBe(originalEditor)
    expect(screen.getByTestId("held").props.value).toBe("held")
    expect(editorWrite).not.toHaveBeenCalled()
    expect(change).not.toHaveBeenCalled()
  },
)
