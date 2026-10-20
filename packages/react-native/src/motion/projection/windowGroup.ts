import { nodeGroup } from "./node/group"
import type { IProjectionNode } from "./node/types"

// One React namespace can span portals; native projection dirties only the actual matching window tree.
export const nativeWindowNodeGroup = () => {
  const groups = new Map<IProjectionNode, { group: ReturnType<typeof nodeGroup>; count: number }>()
  const membership = new WeakMap<IProjectionNode, IProjectionNode>()
  return {
    add: (node: IProjectionNode) => {
      if (membership.has(node)) return
      const root = node.root ?? node
      const entry = groups.get(root) ?? { group: nodeGroup(), count: 0 }
      groups.set(root, entry)
      membership.set(node, root)
      entry.count++
      entry.group.add(node)
    },
    remove: (node: IProjectionNode) => {
      const root = membership.get(node),
        entry = root && groups.get(root)
      if (!root || !entry) return
      membership.delete(node)
      entry.group.remove(node)
      entry.count--
      if (!entry.count) groups.delete(root)
    },
    dirty: () => {
      for (const entry of groups.values()) entry.group.dirty()
    },
  }
}
