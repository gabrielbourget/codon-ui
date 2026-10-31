import type { TNativeSortParameter } from "./types"

export const reorderNativeSortParameters = (
  parameters: TNativeSortParameter[],
  draggedID: string | null,
  targetID: string,
) => {
  if (!draggedID || draggedID === targetID) return parameters
  const draggedIndex = parameters.findIndex((item) => item.ID === draggedID)
  const targetIndex = parameters.findIndex((item) => item.ID === targetID)
  if (draggedIndex < 0 || targetIndex < 0) return parameters
  const updated = [...parameters]
  const [moved] = updated.splice(draggedIndex, 1)
  updated.splice(targetIndex, 0, moved)
  return updated
}
