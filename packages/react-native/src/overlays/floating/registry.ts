import type { TNativeFloatingOutsideInteraction } from "./interaction"

export const NATIVE_FLOATING_DISMISS_REASONS = ["keyboard", "accessibilityEscape", "outside"] as const
export type TNativeFloatingDismissReason = (typeof NATIVE_FLOATING_DISMISS_REASONS)[number]
type TPhase = "closed" | "entering" | "open" | "exiting"
type TOptions = {
  parent: string | null
  isOpen: boolean
  isModal: boolean
  isKeyboardDismissDisabled: boolean
  priority?: number
  capturesOutside?: boolean
  onDismiss: (reason: TNativeFloatingDismissReason) => void
  onOutside?: (interaction: TNativeFloatingOutsideInteraction) => void
}
type TEntry = TOptions & {
  owner: symbol
  phase: TPhase
  generation: number
  order: number
  exitReady: boolean
  retiredParent: boolean
}

// Logical ownership and animation admission stay independent of caller-owned open values.
export const createNativeFloatingLayerRegistry = () => {
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0
  let generation = 0
  let order = 0
  const descendants = (parent: string): string[] =>
    [...entries].flatMap(([id, entry]) => (entry.parent === parent ? [id, ...descendants(id)] : []))
  const requested = (entry: TEntry): boolean => {
    if (!entry.isOpen || entry.retiredParent) return false
    if (entry.parent === null) return true
    const parent = entries.get(entry.parent)
    return !!parent && parent.phase === "open" && requested(parent)
  }
  const stack = () =>
    [...entries]
      .filter(([, entry]) => entry.phase !== "closed")
      .sort((a, b) => (a[1].priority ?? 0) - (b[1].priority ?? 0) || a[1].order - b[1].order)
  const covered = (id: string) => {
    const modal = stack()
      .reverse()
      .find(([, entry]) => entry.isModal)
    return !!modal && modal[0] !== id && !descendants(modal[0]).includes(id)
  }
  const top = () =>
    stack()
      .filter(([id]) => !covered(id))
      .at(-1)
  const outsideTop = () =>
    stack()
      .filter(([id, entry]) => !covered(id) && entry.capturesOutside !== false)
      .at(-1)
  const reconcile = () => {
    for (const entry of entries.values()) {
      const desired = requested(entry)
      if (!desired && entry.phase !== "closed" && entry.phase !== "exiting") {
        entry.phase = "exiting"
        entry.generation = ++generation
        entry.exitReady = false
      }
      if (desired && entry.phase === "closed") {
        entry.phase = "entering"
        entry.generation = ++generation
        entry.order = ++order
      }
    }
    let retired = true
    while (retired) {
      retired = false
      for (const [id, entry] of entries) {
        if (
          entry.phase === "exiting" &&
          entry.exitReady &&
          descendants(id).every((child) => entries.get(child)?.phase === "closed")
        ) {
          entry.phase = "closed"
          entry.generation = ++generation
          retired = true
        }
      }
    }
    // An owner may request reopen during exit; admit only after the old generation retires.
    for (const entry of entries.values()) {
      if (entry.phase === "closed" && requested(entry)) {
        entry.phase = "entering"
        entry.generation = ++generation
        entry.order = ++order
      }
    }
  }
  const publish = () => {
    reconcile()
    revision++
    for (const listener of listeners) listener()
  }
  const assertParent = (id: string, parent: string | null) => {
    let candidate = parent
    const visited = new Set([id])
    while (candidate !== null) {
      if (visited.has(candidate)) throw new Error("Floating layer ancestry must not contain cycles")
      visited.add(candidate)
      candidate = entries.get(candidate)?.parent ?? null
    }
  }
  const state = (id: string) => {
    const entry = entries.get(id)
    return {
      phase: entry?.phase ?? "closed",
      generation: entry?.generation ?? 0,
      mounted: !!entry && entry.phase !== "closed",
      active: !!entry && entry.phase === "open" && !covered(id) && requested(entry),
      covered: !!entry && entry.phase !== "closed" && covered(id),
    }
  }
  const requestDismiss = (reason: TNativeFloatingDismissReason) => {
    const active = reason === "outside" ? outsideTop() : top()
    if (!active) return false
    const [id, entry] = active
    // A transitioning or keyboard-protected layer still shields the window beneath it.
    if (!state(id).active || (reason !== "outside" && entry.isKeyboardDismissDisabled)) return true
    entry.onDismiss(reason)
    return true
  }
  return {
    snapshot: () => revision,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flush: publish,
    state,
    presentationOrder: () => stack().map(([id]) => id),
    hasModal: () => stack().some(([, entry]) => entry.isModal),
    requestDismiss,
    captureKeyboard: () => {
      const current = top()
      if (!current) return null
      const [id, entry] = current
      const key = `${id}:${entry.generation}:${entry.phase}:${+entry.isKeyboardDismissDisabled}`
      const isCurrent = () => {
        const latest = top()
        return (
          latest?.[0] === id &&
          latest[1] === entry &&
          key === `${id}:${entry.generation}:${entry.phase}:${+entry.isKeyboardDismissDisabled}`
        )
      }
      return { key, isCurrent, invoke: () => isCurrent() && requestDismiss("keyboard") }
    },
    captureOutside: () => {
      const active = outsideTop()
      if (!active || !state(active[0]).active) return null
      const [id, entry] = active
      const token = entry.generation
      const isCurrent = () =>
        entries.get(id) === entry && entry.generation === token && state(id).active && outsideTop()?.[0] === id
      return {
        id,
        isCurrent,
        invoke: (interaction: TNativeFloatingOutsideInteraction) => {
          if (!isCurrent()) return
          if (entry.onOutside) entry.onOutside(interaction)
          else entry.onDismiss("outside")
        },
      }
    },
    canRestore: (parent: string | null) => {
      const focusLayers = stack().filter(([, entry]) => entry.isModal || entry.capturesOutside !== false)
      return parent === null ? focusLayers.length === 0 : state(parent).active && focusLayers.at(-1)?.[0] === parent
    },
    register: (id: string, options: TOptions, notify = true) => {
      assertParent(id, options.parent)
      if (entries.has(id)) throw new Error("Floating layer identity is already registered")
      const owner = Symbol(id)
      const entry: TEntry = {
        ...options,
        owner,
        phase: "closed",
        generation: ++generation,
        order: 0,
        exitReady: false,
        retiredParent: false,
      }
      entries.set(id, entry)
      const live = () => entries.get(id)?.owner === owner
      if (notify) publish()
      return {
        state: () =>
          live()
            ? state(id)
            : {
                phase: "closed" as const,
                generation: 0,
                mounted: false,
                active: false,
                covered: false,
              },
        canAct: (token: number) => live() && entry.generation === token && state(id).active,
        update: (next: TOptions, notify = true) => {
          if (!live()) return
          assertParent(id, next.parent)
          if (next.parent !== entry.parent)
            throw new Error("A floating layer's logical parent is fixed for its lifetime")
          Object.assign(entry, next)
          if (notify) publish()
        },
        entered: (token: number) => {
          if (!live() || entry.phase !== "entering" || entry.generation !== token || !requested(entry)) return false
          entry.phase = "open"
          publish()
          return true
        },
        exited: (token: number) => {
          if (!live() || entry.phase !== "exiting" || entry.generation !== token) return false
          entry.exitReady = true
          publish()
          return true
        },
        unregister: (notify = true) => {
          if (!live()) return
          for (const child of descendants(id)) {
            const descendant = entries.get(child)!
            descendant.phase = "closed"
            descendant.retiredParent = true
            descendant.generation = ++generation
          }
          entries.delete(id)
          if (notify) publish()
        },
      }
    },
  }
}
export type TNativeFloatingLayerRegistry = ReturnType<typeof createNativeFloatingLayerRegistry>
