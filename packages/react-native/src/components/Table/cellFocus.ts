import type { View } from "react-native"

import { captureNativeFocusTarget, isNativeFocusTarget } from "../../input/focus"

type TNativeNode = object & { readonly childNodes?: Iterable<object> }
export type TNativeTableFocusTarget = Parameters<typeof captureNativeFocusTarget>[0]

// RN0.86.3 ReadOnlyNode exposes the current native tree; retain the original host objects.
export const getNativeTableCellFocusTargets = (root: View): TNativeTableFocusTarget[] => {
  const result: TNativeTableFocusTarget[] = []
  const visit = (parent: TNativeNode) => {
    for (const child of parent.childNodes ?? []) {
      if (isNativeFocusTarget(child) && captureNativeFocusTarget(child)) result.push(child)
      visit(child)
    }
  }
  visit(root)
  return result
}

export const nativeTableCellContains = (root: View, target: TNativeTableFocusTarget) =>
  root === target || getNativeTableCellFocusTargets(root).includes(target)
