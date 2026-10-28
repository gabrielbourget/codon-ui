import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionKey } from "../snapshot"
import type { LayoutDelegate } from "../state/types"

const scalar = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Native drag keyboard: original viewport metric unavailable")
  return value
}
const dimension = (value: number) => {
  const number = scalar(value)
  if (number < 0) throw new Error("Native drag keyboard: negative original viewport extent")
  return number
}
const rectangle = (view: View) => {
  const value = view.getBoundingClientRect?.()
  if (
    !value ||
    ![value.x, value.y, value.width, value.height].every(Number.isFinite) ||
    value.width < 0 ||
    value.height < 0
  )
    throw new Error("Native drag keyboard: original native rectangle unavailable")
  return value
}

// Same content/viewport coordinate system as the received DOMLayoutDelegate;
// every value comes from original RN ReadOnlyElement hosts, never JSX positions.
export class NativeCollectionLayoutDelegate implements LayoutDelegate {
  constructor(
    private root: RefObject<View | null>,
    private item: (key: TNativeCollectionKey) => View | null,
    private scroll: () => View | null,
    private current: () => boolean,
  ) {}
  private viewport() {
    if (!this.current()) throw new Error("Native drag keyboard: original layout owner retired")
    return this.scroll() ?? this.root.current
  }
  getItemRect(key: TNativeCollectionKey) {
    const container = this.viewport(),
      item = this.item(key)
    if (!container || !item) return null
    const containerRect = rectangle(container),
      itemRect = rectangle(item)
    const result = {
      x: itemRect.x - containerRect.x - dimension(container.clientLeft) + scalar(container.scrollLeft),
      y: itemRect.y - containerRect.y - dimension(container.clientTop) + scalar(container.scrollTop),
      width: itemRect.width,
      height: itemRect.height,
    }
    if (!this.current() || this.viewport() !== container || this.item(key) !== item)
      throw new Error("Native drag keyboard: original item changed during layout read")
    return result
  }
  getContentSize() {
    const container = this.viewport()
    return {
      width: container ? dimension(container.scrollWidth) : 0,
      height: container ? dimension(container.scrollHeight) : 0,
    }
  }
  getVisibleRect() {
    const container = this.viewport()
    return {
      x: container ? scalar(container.scrollLeft) : 0,
      y: container ? scalar(container.scrollTop) : 0,
      width: container ? dimension(container.clientWidth) : 0,
      height: container ? dimension(container.clientHeight) : 0,
    }
  }
  isScrollable = () => {
    if (!this.scroll()) return false
    const content = this.getContentSize(),
      visible = this.getVisibleRect()
    return content.width > visible.width || content.height > visible.height
  }
}
