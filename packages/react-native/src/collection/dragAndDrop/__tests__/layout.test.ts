import type { View } from "react-native"

import { NativeCollectionLayoutDelegate } from "../NativeCollectionLayoutDelegate"

const host = (x = 20, y = 40) =>
  ({
    getBoundingClientRect: () => ({ x, y, width: 100, height: 80 }),
    clientLeft: 3,
    clientTop: 5,
    clientWidth: 94,
    clientHeight: 70,
    scrollLeft: 11,
    scrollTop: 90,
    scrollWidth: 300,
    scrollHeight: 600,
  }) as unknown as View
it("uses original native border/scroll/viewport metrics with the received content coordinate system", () => {
  const root = { current: host() },
    item = host(70, 120),
    scroll = host(30, 50)
  const delegate = new NativeCollectionLayoutDelegate(
    root,
    () => item,
    () => scroll,
    () => true,
  )
  expect(delegate.getItemRect(0)).toEqual({ x: 48, y: 155, width: 100, height: 80 })
  expect(delegate.getVisibleRect()).toEqual({ x: 11, y: 90, width: 94, height: 70 })
  expect(delegate.getContentSize()).toEqual({ width: 300, height: 600 })
  expect(delegate.isScrollable()).toBe(true)
  const unscrolled = new NativeCollectionLayoutDelegate(
    root,
    () => item,
    () => null,
    () => true,
  )
  expect(unscrolled.isScrollable()).toBe(false)
})
it("keeps an unmaterialized row absent and refuses stale, replaced or invalid native layout authority", () => {
  const root = { current: host() },
    item = host(),
    current = jest.fn(() => true)
  let original: View | null = null
  const delegate = new NativeCollectionLayoutDelegate(
    root,
    () => original,
    () => null,
    current,
  )
  expect(delegate.getItemRect("")).toBeNull()
  original = item
  Object.assign(item, {
    getBoundingClientRect: () => {
      original = host()
      return { x: 0, y: 0, width: 1, height: 1 }
    },
  })
  expect(() => delegate.getItemRect(0)).toThrow("changed")
  current.mockReturnValue(false)
  expect(() => delegate.getVisibleRect()).toThrow("retired")
  current.mockReturnValue(true)
  Object.assign(root.current, { clientWidth: NaN })
  expect(() => delegate.getVisibleRect()).toThrow("metric")
})
