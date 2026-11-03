import { useContext, useLayoutEffect, useMemo, useSyncExternalStore } from "react"

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

const subscribeIdle = () => () => {}

// Root admission changes paint the original host without rebuilding the collection state.
export const useCollectionModelOwnerReceipt = () => {
  const actions = useContext(NativeCollectionActionsContext)!
  const getSnapshot = useMemo(() => {
    let previous: readonly [string, string] | undefined
    return () => {
      const lifetime = actions.ownerLifetime()
      const binding = actions.bindingFor(null)
      if (!previous || previous[0] !== lifetime || previous[1] !== binding) previous = [lifetime, binding]
      return previous
    }
  }, [actions])
  return useSyncExternalStore(actions.admission?.subscribe ?? subscribeIdle, getSnapshot, getSnapshot)
}
