import type { TNativeKeyScope } from "../../input/keyScope"

export const subscribeNativeTableStickyLifetime = (scope: TNativeKeyScope | null, listener: () => void) => {
  if (!scope) return () => {}
  let session = scope.acknowledgedSession()
  let active = scope.isWindowActive()
  return scope.subscribe(() => {
    const next = scope.acknowledgedSession()
    const nextActive = scope.isWindowActive()
    // Keyboard policy settlement does not change the sticky presentation's window lifetime.
    // Original refs, authored styles and native lease authority are still checked on every real render.
    if (next.windowId === session.windowId && next.epoch === session.epoch && nextActive === active) return
    session = next
    active = nextActive
    listener()
  })
}
