/* Copyright 2020 Adobe. Licensed under Apache-2.0; see ../LICENSE.react-aria.md. */
import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionKey } from "../snapshot"
type Node<T> = { key: TNativeCollectionKey; type: string } & { readonly __valueType?: T }

import { readNativeDragGeometry } from "./geometry"
import type { TNativeDragRect } from "./geometry"
import type { TNativeDropTarget as DropTarget, TNativeDropTargetDelegate as DropTargetDelegate } from "./types"
type Orientation = "horizontal" | "vertical"
type Direction = "ltr" | "rtl"
type TRect = TNativeDragRect & { left: number; right: number; top: number; bottom: number }
const rectEdges = (rect: TNativeDragRect): TRect => ({
  ...rect,
  left: rect.x,
  top: rect.y,
  right: rect.x + rect.width,
  bottom: rect.y + rect.height,
})

export interface TNativeListDropTargetDelegateOptions {
  /**
   * Whether the items are arranged in a stack or grid.
   * @default 'stack'
   */
  layout?: "stack" | "grid"
  /**
   * The primary orientation of the items. Usually this is the
   * direction that the collection scrolls.
   * @default 'vertical'
   */
  orientation?: Orientation
  /**
   * The horizontal layout direction.
   * @default 'ltr'
   */
  direction?: Direction
}

// Terms used in the below code:
//   * "Primary"   – The main layout direction. For stacks, this is the direction
//                   that the stack is arranged in (e.g. horizontal or vertical).
//                   For grids, this is the main scroll direction.
//   * "Secondary" – The secondary layout direction. For stacks, there is no secondary
//                   layout direction. For grids, this is the opposite of the primary direction.
//   * "Flow"      – The flow direction of the items. For stacks, this is the the primary
//                   direction. For grids, it is the secondary direction.

export class NativeListDropTargetDelegate implements DropTargetDelegate {
  private collection: Iterable<Node<unknown>>
  private ref: RefObject<View | null>
  private layout: "stack" | "grid"
  private orientation: Orientation
  protected direction: Direction

  constructor(
    collection: Iterable<Node<unknown>>,
    ref: RefObject<View | null>,
    options?: TNativeListDropTargetDelegateOptions,
  ) {
    this.collection = collection
    this.ref = ref
    this.layout = options?.layout || "stack"
    this.orientation = options?.orientation || "vertical"
    this.direction = options?.direction || "ltr"
  }

  private getPrimaryStart(rect: TRect) {
    return this.orientation === "horizontal" ? rect.left : rect.top
  }

  private getPrimaryEnd(rect: TRect) {
    return this.orientation === "horizontal" ? rect.right : rect.bottom
  }

  private getSecondaryStart(rect: TRect) {
    return this.orientation === "horizontal" ? rect.top : rect.left
  }

  private getSecondaryEnd(rect: TRect) {
    return this.orientation === "horizontal" ? rect.bottom : rect.right
  }

  private getFlowStart(rect: TRect) {
    return this.layout === "stack" ? this.getPrimaryStart(rect) : this.getSecondaryStart(rect)
  }

  private getFlowEnd(rect: TRect) {
    return this.layout === "stack" ? this.getPrimaryEnd(rect) : this.getSecondaryEnd(rect)
  }

  private getFlowSize(rect: TRect) {
    return this.getFlowEnd(rect) - this.getFlowStart(rect)
  }

  getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null {
    if (this.collection[Symbol.iterator]().next().done || !this.ref.current) {
      return { type: "root" }
    }

    const geometry = readNativeDragGeometry(this.ref.current)
    let rect: TRect | undefined = rectEdges(geometry.root)
    let primary = this.orientation === "horizontal" ? x : y
    let secondary = this.orientation === "horizontal" ? y : x
    primary += this.getPrimaryStart(rect)
    secondary += this.getSecondaryStart(rect)

    const flow = this.layout === "stack" ? primary : secondary
    const isPrimaryRTL = this.orientation === "horizontal" && this.direction === "rtl"
    const isSecondaryRTL = this.layout === "grid" && this.orientation === "vertical" && this.direction === "rtl"
    const isFlowRTL = this.layout === "stack" ? isPrimaryRTL : isSecondaryRTL

    // Preserve the pinned item-only search; loaders are not materialized drop targets.
    const items = [...this.collection].filter((item) => item.type === "item")

    if (items.length < 1) {
      return { type: "root" }
    }

    let low = 0
    let high = items.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      const item = items[mid]
      const bounds = geometry.items.get(item.key)
      if (!bounds) return null
      const rect = rectEdges(bounds)
      const update = (isGreater: boolean) => {
        if (isGreater) {
          low = mid + 1
        } else {
          high = mid
        }
      }

      if (primary < this.getPrimaryStart(rect)) {
        update(isPrimaryRTL)
      } else if (primary > this.getPrimaryEnd(rect)) {
        update(!isPrimaryRTL)
      } else if (secondary < this.getSecondaryStart(rect)) {
        update(isSecondaryRTL)
      } else if (secondary > this.getSecondaryEnd(rect)) {
        update(!isSecondaryRTL)
      } else {
        const target: DropTarget = {
          type: "item",
          key: item.key,
          dropPosition: "on",
        }

        if (isValidDropTarget(target)) {
          // Otherwise, if dropping on the item is accepted, try the before/after positions if within 5px
          // of the start or end of the item.
          if (flow <= this.getFlowStart(rect) + 5 && isValidDropTarget({ ...target, dropPosition: "before" })) {
            target.dropPosition = isFlowRTL ? "after" : "before"
          } else if (flow >= this.getFlowEnd(rect) - 5 && isValidDropTarget({ ...target, dropPosition: "after" })) {
            target.dropPosition = isFlowRTL ? "before" : "after"
          }
        } else {
          // If dropping on the item isn't accepted, try the target before or after depending on the position.
          const mid = this.getFlowStart(rect) + this.getFlowSize(rect) / 2
          if (flow <= mid && isValidDropTarget({ ...target, dropPosition: "before" })) {
            target.dropPosition = isFlowRTL ? "after" : "before"
          } else if (flow >= mid && isValidDropTarget({ ...target, dropPosition: "after" })) {
            target.dropPosition = isFlowRTL ? "before" : "after"
          }
        }

        return target
      }
    }

    const item = items[Math.min(low, items.length - 1)]
    const bounds = geometry.items.get(item.key)
    if (!bounds) return null
    rect = rectEdges(bounds)

    if (
      rect &&
      (primary < this.getPrimaryStart(rect) ||
        Math.abs(flow - this.getFlowStart(rect)) < Math.abs(flow - this.getFlowEnd(rect)))
    ) {
      return {
        type: "item",
        key: item.key,
        dropPosition: isFlowRTL ? "after" : "before",
      }
    }

    return {
      type: "item",
      key: item.key,
      dropPosition: isFlowRTL ? "before" : "after",
    }
  }
}
