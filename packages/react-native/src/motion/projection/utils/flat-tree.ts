import type { IProjectionNode } from "../node/types"
// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.
import { addUniqueItem, removeItem } from "../types"

import type { WithDepth } from "./compare-by-depth"
import { compareByDepth } from "./compare-by-depth"

export class FlatTree<T extends WithDepth = IProjectionNode> {
  private children: T[] = []

  private isDirty: boolean = false

  add(child: T) {
    addUniqueItem(this.children, child)
    this.isDirty = true
  }

  remove(child: T) {
    removeItem(this.children, child)
    this.isDirty = true
  }

  forEach(callback: (child: T) => void) {
    if (this.isDirty) {
      this.children.sort(compareByDepth)
    }
    this.isDirty = false
    this.children.forEach(callback)
  }
}
