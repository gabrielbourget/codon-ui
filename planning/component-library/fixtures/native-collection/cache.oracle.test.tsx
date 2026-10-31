import { writeFileSync } from "node:fs"

import { renderHook } from "@testing-library/react"
import { createRef, type ReactElement, type ReactNode } from "react"
import { afterAll, expect, it, vi } from "vitest"

import type * as TSource from "../../../../packages/react/node_modules/react-aria/dist/types/src/collections/useCachedChildren"
import {
  useNativeCachedChildren,
  type TNativeCachedChildrenOptions,
} from "../../../../packages/react-native/src/collection/cachedChildren"

const sourcePath = "../../../../packages/react/node_modules/react-aria/dist/private/collections/useCachedChildren.mjs"
const { useCachedChildren } = (await import(sourcePath)) as typeof TSource
const implementations = [useCachedChildren, useNativeCachedChildren] as const
const records: unknown[] = []
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-collection-cache-oracle.json", JSON.stringify(records, null, 2) + "\n"),
)
type TValue = { id?: string | number; key?: string | number; title: string }
const elements = (value: ReactNode) =>
  value as ReactElement<{ id?: string | number; value?: TValue; children?: ReactNode; ref?: unknown }>[]

it("matches typed fallback/explicit IDs and preserves original value and ref identities", () => {
  const results = implementations.map((useCache) => {
    const item = { key: 0, id: "ignored", title: "Zero" },
      ref = createRef<HTMLDivElement>()
    const children = vi.fn((value: TValue) => <div ref={ref}>{value.title}</div>)
    const hook = renderHook(() => useCache({ items: [item], children, addIdAndValue: true }))
    const first = elements(hook.result.current)[0]
    const result = {
      id: first.props.id,
      key: first.key,
      originalValue: first.props.value === item,
      originalRef: first.props.ref === ref,
      calls: children.mock.calls.length,
    }
    hook.unmount()
    return result
  })
  expect(results[1]).toEqual(results[0])
  expect(results[0]).toEqual({ id: 0, key: "0", originalValue: true, originalRef: true, calls: 1 })
  records.push({ case: "typed key and original identities", source: results[0], native: results[1] })
})

it("matches source object-identity caching across renderer changes and explicit dependency invalidation", () => {
  const results = implementations.map((useCache) => {
    const item = { id: "a", title: "A" },
      initial = vi.fn(() => <div>initial</div>),
      updated = vi.fn(() => <div>updated</div>)
    const options: TNativeCachedChildrenOptions<TValue> = {
      items: [item],
      children: initial,
      dependencies: [0],
      addIdAndValue: true,
    }
    const hook = renderHook((props: TNativeCachedChildrenOptions<TValue>) => useCache(props), { initialProps: options })
    const first = elements(hook.result.current)[0]
    hook.rerender({ ...options, children: updated })
    const held = elements(hook.result.current)[0] === first
    hook.rerender({ ...options, children: updated, dependencies: [1] })
    const next = elements(hook.result.current)[0]
    const result = {
      held,
      replaced: next !== first,
      text: next.props.children,
      initialCalls: initial.mock.calls.length,
      updatedCalls: updated.mock.calls.length,
      originalValue: next.props.value === item,
    }
    hook.unmount()
    return result
  })
  expect(results[1]).toEqual(results[0])
  expect(results[0]).toMatchObject({
    held: true,
    replaced: true,
    text: "updated",
    initialCalls: 1,
    updatedCalls: 1,
    originalValue: true,
  })
  records.push({ case: "object cache and dependencies", source: results[0], native: results[1] })
})

it("retains source idScope cache identity until dependencies invalidate it, including numeric zero scopes", () => {
  const results = implementations.map((useCache) => {
    const item = { id: 0, title: "Zero" },
      render = () => <div />
    const options: TNativeCachedChildrenOptions<TValue> = {
      items: [item],
      children: render,
      dependencies: [0],
      idScope: 0,
      addIdAndValue: true,
    }
    const hook = renderHook((props: TNativeCachedChildrenOptions<TValue>) => useCache(props), { initialProps: options })
    const ids = [elements(hook.result.current)[0].props.id]
    hook.rerender({ ...options, idScope: "changed" })
    ids.push(elements(hook.result.current)[0].props.id)
    hook.rerender({ ...options, idScope: "changed", dependencies: [1] })
    ids.push(elements(hook.result.current)[0].props.id)
    hook.rerender({ ...options, idScope: "changed", dependencies: [2], children: () => <div id="explicit" /> })
    ids.push(elements(hook.result.current)[0].props.id)
    hook.unmount()
    return ids
  })
  expect(results[1]).toEqual(results[0])
  expect(results[0]).toEqual(["0:0", "0:0", "changed:0", "explicit"])
  records.push({ case: "scope/cache precedence", source: results[0], native: results[1] })
})

it("does not consume a one-shot iterable again for unchanged cache inputs", () => {
  const results = implementations.map((useCache) => {
    let iterations = 0
    const item = { id: "a", title: "A" },
      children = () => <div />
    const items = (function* () {
      iterations++
      yield item
    })()
    const options: TNativeCachedChildrenOptions<TValue> = { items, children, addIdAndValue: true }
    const hook = renderHook((props: TNativeCachedChildrenOptions<TValue>) => useCache(props), { initialProps: options })
    const first = hook.result.current
    hook.rerender({ ...options })
    const result = { iterations, sameArray: first === hook.result.current, count: elements(hook.result.current).length }
    hook.unmount()
    return result
  })
  expect(results[1]).toEqual(results[0])
  expect(results[0]).toEqual({ iterations: 1, sameArray: true, count: 1 })
  records.push({ case: "one-shot iterable", source: results[0], native: results[1] })
})

it("matches primitive children and an uninvoked renderer without items", () => {
  const results = implementations.map((useCache) => {
    const children = vi.fn(() => <div />)
    const options: TNativeCachedChildrenOptions<TValue> = { children: 0 }
    const hook = renderHook((props: TNativeCachedChildrenOptions<TValue>) => useCache(props), { initialProps: options })
    const zero = hook.result.current
    hook.rerender({ children })
    const empty = hook.result.current
    hook.unmount()
    return { zero, empty, calls: children.mock.calls.length }
  })
  expect(results[1]).toEqual(results[0])
  expect(results[0]).toEqual({ zero: 0, empty: undefined, calls: 0 })
  records.push({ case: "primitive/absent-items", source: results[0], native: results[1] })
})

it("retains exact source missing-key failure instead of deriving an index key", () => {
  for (const useCache of implementations) {
    expect(() => renderHook(() => useCache({ items: [{ title: "missing" }], children: () => <div /> }))).toThrow(
      "Could not determine key for item",
    )
  }
  records.push({
    case: "missing key",
    source: "Could not determine key for item",
    native: "Could not determine key for item",
  })
})
