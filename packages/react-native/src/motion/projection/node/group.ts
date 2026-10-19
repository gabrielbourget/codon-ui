// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.
import type { IProjectionNode } from "./types"

const notify = (node: IProjectionNode) => !node.isLayoutDirty && node.willUpdate(false)

export interface NodeGroup {
  add: (node: IProjectionNode) => void
  remove: (node: IProjectionNode) => void
  dirty: () => void
}

export function nodeGroup(): NodeGroup {
  const nodes = new Set<IProjectionNode>()
  const subscriptions = new WeakMap<IProjectionNode, () => void>()

  const dirtyAll = () => nodes.forEach(notify)

  return {
    add: (node) => {
      nodes.add(node)
      subscriptions.set(node, node.addEventListener("willUpdate", dirtyAll))
    },
    remove: (node) => {
      nodes.delete(node)
      const unsubscribe = subscriptions.get(node)
      if (unsubscribe) {
        unsubscribe()
        subscriptions.delete(node)
      }
      dirtyAll()
    },
    dirty: dirtyAll,
  }
}
