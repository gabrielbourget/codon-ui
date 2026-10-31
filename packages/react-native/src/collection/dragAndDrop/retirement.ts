const retirements = new WeakMap<object, () => void>()

export const registerNativeDragStateRetirement = (state: object, retire: () => void) => {
  retirements.set(state, retire)
}

// A retired native owner cannot deliver a synthetic end/exit callback through
// stale props. Clear its state while retaining ordinary live event ordering.
export const retireNativeDragState = (state: object) => retirements.get(state)?.()
