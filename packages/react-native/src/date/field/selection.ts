/* Adapted from pinned react-aria useDatePickerGroup; Apache-2.0. See ../entry/UPSTREAM.json. */
// The source compares physical left edges, including wrapped segments. A tie
// retains the first node in reading order; vertical proximity is not substituted.
export const nativeDateFieldVisualIndex = (positions: readonly number[], fromX: number, direction: -1 | 1) => {
  let closest = -1,
    closestDistance = Infinity
  for (let index = 0; index < positions.length; index++) {
    const distance = positions[index] - fromX,
      absoluteDistance = Math.abs(distance)
    if (Number.isFinite(distance) && Math.sign(distance) === direction && absoluteDistance < closestDistance) {
      closest = index
      closestDistance = absoluteDistance
    }
  }
  return closest
}

// before is the original focusable predecessor of the native press target,
// resolved by the renderer from the committed document. Null selects the end.
export const nativeDateFieldPressIndex = (placeholders: readonly boolean[], before: number | null) => {
  let target = before ?? placeholders.length - 1
  if (!Number.isInteger(target) || target < 0 || target >= placeholders.length) return -1
  while (placeholders[target] && target > 0 && placeholders[target - 1]) target--
  return target
}
