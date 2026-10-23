import { useCallback, useContext, useState } from "react"
import { findNodeHandle, View } from "react-native"

import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableContext } from "./context"
import type { TNativeTableProps } from "./types"

const Receiver = ({
  props,
  collection,
}: {
  props: TNativeTableProps
  collection: TNativeCollectionSnapshot<object>
}) => {
  const { children: _children, style, customStyles, zebra, zebraColor, ...native } = props
  const renderer = useContext(NativeCollectionRendererContext)
  const theme = useNativeTheme()
  const [target, setTarget] = useState(0)
  const [headerTargets, setHeaderTargets] = useState(new Map<string, number>())
  const bind = useCallback((view: View | null) => setTarget(view ? (findNodeHandle(view) ?? 0) : 0), [])
  const registerHeader = useCallback(
    (id: string, target: number) =>
      setHeaderTargets((previous) => {
        if ((previous.get(id) ?? 0) === target) return previous
        const next = new Map(previous)
        if (target) next.set(id, target)
        else next.delete(id)
        return next
      }),
    [],
  )
  const rows: TNativeCollectionNode<object>[] = []
  let headerCount = 0,
    columnCount = 0
  const visit = (nodes: Iterable<TNativeCollectionNode<object>>) => {
    for (const node of nodes) {
      if (node.type === "item") rows.push(node)
      if (node.type === "header") {
        headerCount++
        columnCount = Math.max(columnCount, Array.from(collection.getChildren(node.key)).length)
      }
      visit(collection.getChildren(node.key))
    }
  }
  visit(collection)
  const styles = splitNativeTextStyle(
    resolveNativeStyle([{ width: "100%", flexShrink: 0 }, customStyles, style], "Table", "style"),
  )
  return (
    <NativeTableContext.Provider
      value={{
        collection,
        target,
        rows,
        headerCount,
        columnCount,
        zebra: !!zebra,
        zebraColor: zebraColor ?? "transparent",
        headerTargets,
        registerHeader,
      }}
    >
      <View
        testID={`${props.testID ?? "table"}-shell`}
        style={{ width: "100%", height: "100%", minHeight: 0, flexDirection: "column" }}
      >
        <NativeCollectionSemanticsContext.Provider
          value={JSON.stringify({
            kind: "root",
            rowCount: rows.length + headerCount,
            columnCount,
            hierarchical: false,
            selectionMode: "none",
          })}
        >
          <NativeFocusHost
            {...nativeViewProps(native)}
            ref={bind}
            testID={props.testID ?? "table"}
            accessible={false}
            focusable={false}
            role="grid"
            style={styles.view}
          >
            <NativeContentContext.Provider
              value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
            >
              <renderer.CollectionRoot collection={collection} />
            </NativeContentContext.Provider>
          </NativeFocusHost>
        </NativeCollectionSemanticsContext.Provider>
      </View>
    </NativeTableContext.Provider>
  )
}
export const Table = (props: TNativeTableProps) => (
  <NativeCollectionBuilder<object> content={props.children}>
    {(collection) => <Receiver props={props} collection={collection} />}
  </NativeCollectionBuilder>
)
