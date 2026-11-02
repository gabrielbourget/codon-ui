import { useContext, useLayoutEffect, useMemo } from "react"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { nativeCollectionOwnerBinding, type TNativeCollectionModelSnapshot } from "../../collection/model"

// Register the original visible root with the shared native admission adapter.
// A model commit alone never establishes attachment or window readiness.
export const useCollectionModelOwner = (
  model: TNativeCollectionModelSnapshot<object>,
  root: object | null,
  target: number,
) => {
  const actions = useContext(NativeCollectionActionsContext)!
  const binding = useMemo(() => nativeCollectionOwnerBinding(model), [model])
  useLayoutEffect(() => {
    if (!root || !target) return
    return actions.admission?.registerOwner(binding, root)
  }, [actions.admission, binding, root, target])
  return actions.ownerLifetime()
}
