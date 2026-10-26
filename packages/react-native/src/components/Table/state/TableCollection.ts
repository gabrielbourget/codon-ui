/* Copyright 2020, 2024 Adobe. Apache-2.0; see ../../../collection/LICENSE.react-aria.md. */
import {
  copyNativeCollectionNodeIdentity,
  type TNativeCollectionKey,
  type TNativeCollectionNode as TBaseNativeCollectionNode,
  type TNativeCollectionSnapshot,
} from "../../../collection/snapshot"

type TNativeCollectionNode<T> = TBaseNativeCollectionNode<T> & {
  readonly colspan?: number
  readonly column?: TNativeCollectionNode<T>
}
type TOptions<T> = { nodes?: ReadonlyMap<TNativeCollectionKey, TNativeCollectionNode<T>>; shareRows?: boolean }
type TMutableNode<T> = { -readonly [P in keyof TNativeCollectionNode<T>]: TNativeCollectionNode<T>[P] }
type TFilter<T> = (textValue: string, node: TNativeCollectionNode<T>) => boolean
const mutableNode = <T>(node: TNativeCollectionNode<T>): TMutableNode<T> =>
  copyNativeCollectionNodeIdentity(node, { ...node }) as TMutableNode<T>
const freezeNode = <T>(node: TMutableNode<T>): TNativeCollectionNode<T> =>
  Object.freeze(
    Object.defineProperty(node, "childNodes", {
      get: () => {
        throw new Error("childNodes is not supported")
      },
    }),
  )
const emptyNode = <T>(type: string, key: TNativeCollectionKey): TNativeCollectionNode<T> => ({
  type,
  key,
  value: null,
  rendered: null,
  textValue: "",
  props: {},
  level: 0,
  index: 0,
  parentKey: null,
  prevKey: null,
  nextKey: null,
  firstChildKey: null,
  lastChildKey: null,
  hasChildNodes: false,
  childNodes: [],
  colIndex: null,
  colSpan: null,
})

// Pinned TableCollection header projection. Only derived node shells change; native
// descriptor identities, original values, props, renderers and visible refs remain owned.
const buildHeaderRows = <T>(keyMap: Map<TNativeCollectionKey, TMutableNode<T>>, leaves: TMutableNode<T>[]) => {
  if (!leaves.length) return []
  const columns: (TMutableNode<T> | null)[][] = []
  const seen = new Map<TMutableNode<T>, { column: (TMutableNode<T> | null)[]; index: number }>()
  for (const leaf of leaves) {
    let parentKey = leaf.parentKey
    const column: (TMutableNode<T> | null)[] = [leaf]
    while (parentKey != null) {
      const parent = keyMap.get(parentKey)
      if (!parent) break
      const previous = seen.get(parent)
      if (previous) {
        parent.colSpan = (parent.colSpan ?? 0) + 1
        parent.colspan = parent.colSpan
        if (previous.index > column.length) break
        for (let index = previous.index; index < column.length; index++) previous.column.splice(index, 0, null)
        for (let index = column.length; index < previous.column.length; index++) {
          const shifted = previous.column[index]
          if (shifted && seen.has(shifted)) seen.get(shifted)!.index = index
        }
      } else {
        parent.colSpan = 1
        parent.colspan = 1
        column.push(parent)
        seen.set(parent, { column, index: column.length - 1 })
      }
      parentKey = parent.parentKey
    }
    columns.push(column)
    leaf.index = columns.length - 1
  }
  const rows: TMutableNode<T>[][] = Array.from(
    { length: Math.max(...columns.map((column) => column.length)) },
    () => [],
  )
  let columnIndex = 0
  for (const column of columns) {
    let rowIndex = rows.length - 1
    for (const item of column) {
      if (item) {
        const row = rows[rowIndex]
        const width = row.reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0)
        if (width < columnIndex) {
          const placeholder = {
            ...emptyNode<T>("placeholder", `placeholder-${item.key}`),
            index: width,
            level: rowIndex,
            colSpan: columnIndex - width,
            colspan: columnIndex - width,
          }
          if (row.length) {
            row.at(-1)!.nextKey = placeholder.key
            placeholder.prevKey = row.at(-1)!.key
          }
          row.push(placeholder)
        }
        if (row.length) {
          row.at(-1)!.nextKey = item.key
          item.prevKey = row.at(-1)!.key
        }
        item.level = rowIndex
        item.colIndex = columnIndex
        row.push(item)
      }
      rowIndex--
    }
    columnIndex++
  }
  return rows.map((row, index) => {
    const width = row.reduce((sum, node) => sum + (node.colSpan ?? 1), 0)
    if (width < leaves.length)
      row.push({
        ...emptyNode<T>("placeholder", `placeholder-${row.at(-1)!.key}`),
        index: width,
        level: index,
        colSpan: leaves.length - width,
        colspan: leaves.length - width,
        prevKey: row.at(-1)!.key,
      })
    return { ...emptyNode<T>("headerrow", `headerrow-${index}`), index, hasChildNodes: true, childNodes: row }
  })
}

export class NativeTableCollection<T> implements TNativeCollectionSnapshot<T> {
  readonly #sourceNodes: ReadonlyMap<TNativeCollectionKey, TNativeCollectionNode<T>>
  readonly #nodes: ReadonlyMap<TNativeCollectionKey, TNativeCollectionNode<T>>
  readonly size: number
  readonly head: TNativeCollectionNode<T>
  readonly body: TNativeCollectionNode<T>
  readonly columns: TNativeCollectionNode<T>[]
  readonly headerRows: TNativeCollectionNode<T>[]
  readonly rows: TNativeCollectionNode<T>[]
  readonly rowHeaderColumnKeys: Set<TNativeCollectionKey>
  readonly expandedKeys: Set<TNativeCollectionKey>

  constructor(
    source: TNativeCollectionSnapshot<T>,
    expandedKeys: Set<TNativeCollectionKey> = new Set<TNativeCollectionKey>(),
    options?: TOptions<T>,
  ) {
    if (source instanceof NativeTableCollection && !options?.nodes) {
      this.#sourceNodes = source.#sourceNodes
      this.#nodes = source.#nodes
      this.head = source.head
      this.body = source.body
      this.columns = source.columns
      this.headerRows = source.headerRows
      this.rowHeaderColumnKeys = source.rowHeaderColumnKeys
      this.size = source.size
      this.expandedKeys = expandedKeys
      this.rows = options?.shareRows ? source.rows : [...this.getChildren(this.body.key)]
      Object.freeze(this)
      return
    }
    this.#sourceNodes = options?.nodes ?? new Map([...source.getKeys()].map((key) => [key, source.getItem(key)!]))
    const nodes = new Map<TNativeCollectionKey, TMutableNode<T>>()
    let headKey: TNativeCollectionKey | null = null,
      bodyKey: TNativeCollectionKey | null = null
    for (const [key, original] of this.#sourceNodes) {
      const node = mutableNode(original)
      if (node.type === "header" || node.type === "tableheader") {
        node.type = "tableheader"
        headKey = key
      }
      if (node.type === "body" || node.type === "tablebody") {
        node.type = "tablebody"
        bodyKey = key
      }
      nodes.set(key, node)
    }
    const columns: TMutableNode<T>[] = [],
      columnMap = new Map<TNativeCollectionKey, TMutableNode<T>>()
    const visit = (key: TNativeCollectionKey | null) => {
      while (key != null) {
        const node = nodes.get(key)
        if (!node) break
        if (node.type === "column") {
          columnMap.set(key, node)
          if (!node.hasChildNodes) columns.push(node)
        }
        visit(node.firstChildKey)
        key = node.nextKey
      }
    }
    if (headKey != null) visit(nodes.get(headKey)!.firstChildKey)
    const headerRows = buildHeaderRows(columnMap, columns)
    this.#nodes = nodes
    this.head = headKey != null ? nodes.get(headKey)! : emptyNode("tableheader", -1)
    this.body = bodyKey != null ? nodes.get(bodyKey)! : emptyNode("tablebody", -2)
    this.columns = columns
    for (const node of nodes.values()) {
      if (node.type === "cell")
        Object.defineProperty(node, "column", { get: () => this.columns[node.index], enumerable: true })
      freezeNode(node)
    }
    this.headerRows = headerRows
    this.expandedKeys = expandedKeys
    this.rowHeaderColumnKeys = new Set(columns.filter((node) => node.props.isRowHeader).map((node) => node.key))
    if (columns.length && !this.rowHeaderColumnKeys.size)
      throw new Error("A table must have at least one Column with the isRowHeader prop set to true")
    this.size = [...nodes.values()].filter((node) => node.type === "item").length
    this.rows = [...this.getChildren(this.body.key)]
    for (const row of this.rows) {
      let cell = row.lastChildKey != null ? this.getItem(row.lastChildKey) : null
      while (cell && cell.type !== "cell") cell = cell.prevKey != null ? this.getItem(cell.prevKey) : null
      if (cell) {
        const count = (cell.colIndex ?? cell.index) + (cell.colSpan ?? 1)
        if (count !== columns.length)
          throw new Error(`Cell count must match column count. Found ${count} cells and ${columns.length} columns.`)
      }
    }
    Object.freeze(this)
  }
  get columnCount() {
    return this.columns.length
  }
  *[Symbol.iterator](): Iterator<TNativeCollectionNode<T>> {
    if (this.head.key !== -1) {
      yield this.head
      yield this.body
    }
  }
  getKeys = (): IterableIterator<TNativeCollectionKey> => this.#nodes.keys()
  getItem = (key: TNativeCollectionKey) => this.#nodes.get(key) ?? null
  getFirstKey = () => this.body.firstChildKey
  getLastKey = (): TNativeCollectionKey | null => {
    let node = this.body.lastChildKey != null ? this.getItem(this.body.lastChildKey) : null
    while (node?.lastChildKey != null && (node.type !== "item" || this.expandedKeys.has(node.key)))
      node = this.getItem(node.lastChildKey)
    return node?.key ?? null
  }
  getKeyAfter = (key: TNativeCollectionKey): TNativeCollectionKey | null => {
    let node = this.getItem(key)
    if (!node) return null
    if (node.type === "column") return node.nextKey
    if (node.type === "item" && this.expandedKeys.has(key)) {
      let child = node.firstChildKey != null ? this.getItem(node.firstChildKey) : null
      while (child) {
        if (child.type === "item") return child.key
        child = child.nextKey != null ? this.getItem(child.nextKey) : null
      }
    }
    if (node.type !== "item" && node.firstChildKey != null) return node.firstChildKey
    while (node) {
      if (node.nextKey != null) return node.nextKey
      node = node.parentKey != null ? this.getItem(node.parentKey) : null
    }
    return null
  }
  getKeyBefore = (key: TNativeCollectionKey): TNativeCollectionKey | null => {
    let node = this.getItem(key)
    if (!node) return null
    if (node.type === "column") return node.prevKey
    let previous: TNativeCollectionKey | null = null
    if (node.prevKey != null) {
      node = this.getItem(node.prevKey)
      while (node && (node.type !== "item" || this.expandedKeys.has(node.key)) && node.lastChildKey != null)
        node = this.getItem(node.lastChildKey)
      previous = node?.key ?? null
    }
    previous ??= node?.parentKey ?? null
    return previous != null && this.getItem(previous)?.type === "tablebody" ? null : previous
  }
  getChildren = (key: TNativeCollectionKey): Iterable<TNativeCollectionNode<T>> => {
    const parent = this.getItem(key)
    if (!parent) return this.headerRows.find((row) => row.key === key)?.childNodes ?? []
    const { getFirstKey, getKeyAfter, getItem } = this
    if (key === this.body.key)
      return {
        *[Symbol.iterator]() {
          let next = getFirstKey()
          while (next != null) {
            const node = getItem(next)
            if (!node) break
            yield node
            next = getKeyAfter(node.key)
          }
        },
      }
    return {
      *[Symbol.iterator]() {
        let node = parent.firstChildKey != null ? getItem(parent.firstChildKey) : null
        while (node) {
          yield node
          node = node.nextKey != null ? getItem(node.nextKey) : null
          if (parent.type === "item" && node?.type !== "cell") break
        }
      },
    }
  }
  getTextValue = (key: TNativeCollectionKey) => {
    const row = this.getItem(key)
    if (!row) return ""
    if (row.textValue) return row.textValue
    const text: string[] = []
    for (const cell of this.getChildren(key)) {
      const column = this.columns[cell.index]
      if (column && this.rowHeaderColumnKeys.has(column.key) && cell.textValue) text.push(cell.textValue)
      if (text.length === this.rowHeaderColumnKeys.size) break
    }
    return text.join(" ")
  }
  at = (_index: number): TNativeCollectionNode<T> | null => {
    throw new Error("Not implemented")
  }
  clone = () => new NativeTableCollection(this, this.expandedKeys, { shareRows: true })
  withExpandedKeys = (keys: Set<TNativeCollectionKey>) => new NativeTableCollection(this, keys)
  filter = (predicate: TFilter<T>): NativeTableCollection<T> => {
    const kept = new Map<TNativeCollectionKey, TMutableNode<T>>()
    const addDescendants = (node: TNativeCollectionNode<T>) => {
      let key = node.firstChildKey
      while (key != null) {
        const child = this.#sourceNodes.get(key)
        if (!child) break
        kept.set(key, mutableNode(child))
        addDescendants(child)
        key = child.nextKey
      }
    }
    const siblings = (
      firstKey: TNativeCollectionKey | null,
    ): [TNativeCollectionKey | null, TNativeCollectionKey | null] => {
      let current = firstKey != null ? (this.#sourceNodes.get(firstKey) ?? null) : null
      let first: TMutableNode<T> | null = null,
        last: TMutableNode<T> | null = null
      while (current) {
        let node: TMutableNode<T> | null = null
        if (current.type === "tablebody" || current.type === "body") {
          const [firstChildKey, lastChildKey] = siblings(current.firstChildKey)
          node = { ...mutableNode(current), firstChildKey, lastChildKey }
        } else if (
          current.type !== "item" ||
          [...this.getChildren(current.key)].some((cell) => predicate(cell.textValue, cell))
        ) {
          node = mutableNode(current)
          addDescendants(current)
        }
        if (node) {
          copyNativeCollectionNodeIdentity(current, node)
          node.nextKey = null
          if (last) {
            last.nextKey = node.key
            node.prevKey = last.key
          }
          first ??= node
          last = node
          kept.set(node.key, node)
        }
        current = current.nextKey ? (this.#sourceNodes.get(current.nextKey) ?? null) : null
      }
      return [first?.key ?? null, last?.key ?? null]
    }
    siblings(this.head.key === -1 ? null : this.head.key)
    return new NativeTableCollection(this, new Set(), { nodes: kept })
  }
}
