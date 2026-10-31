import { cloneElement, useMemo, type ReactElement, type ReactNode } from "react"

import type { TNativeCollectionKey } from "./snapshot"

export type TNativeCachedChildrenOptions<T> = {
  items?: Iterable<T>
  children?: ReactNode | ((item: T) => ReactNode)
  dependencies?: readonly unknown[]
  idScope?: TNativeCollectionKey
  addIdAndValue?: boolean
  getReactKey?: (key: TNativeCollectionKey) => string
}

// Adapted from pinned react-aria 3.48.0 useCachedChildren (Apache-2.0, Copyright 2024 Adobe).
export const useNativeCachedChildren = <T extends object>({
  children,
  items,
  dependencies = [],
  idScope,
  addIdAndValue,
  getReactKey,
}: TNativeCachedChildrenOptions<T>): ReactNode => {
  // The source invalidates its object-identity cache only through the explicit dependency list.
  const cache = useMemo(() => new WeakMap<T, ReactElement>(), dependencies)
  return useMemo(() => {
    if (items && typeof children === "function") {
      const result: ReactElement[] = []
      for (const item of items) {
        let rendered = cache.get(item)
        if (!rendered) {
          const candidate = children(item) as ReactElement<{ id?: TNativeCollectionKey; value?: T }>
          const value = item as T & { key?: TNativeCollectionKey; id?: TNativeCollectionKey }
          let key = candidate.props.id ?? value.key ?? value.id
          if (key == null) throw new Error("Could not determine key for item")
          if (idScope != null && candidate.props.id == null) key = idScope + ":" + key
          const reactKey = getReactKey ? getReactKey(key) : key
          rendered = cloneElement(
            candidate,
            addIdAndValue ? { key: reactKey, id: key, value: item } : { key: reactKey },
          )
          cache.set(item, rendered)
        }
        result.push(rendered)
      }
      return result
    }
    if (typeof children !== "function") return children
  }, [children, items, cache, idScope, addIdAndValue, getReactKey])
}
