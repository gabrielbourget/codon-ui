type TPhase = "idle" | "presenting" | "shown" | "closing"
type TEntry = {
  parent: string | null
  leaf: boolean
  requested: boolean
  phase: TPhase
}

// Per-provider ownership only. Native windows stay at their original React locations.
export const createOverlayRegistry = () => {
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0
  const effective = (id: string): boolean => {
    const entry = entries.get(id)
    return !!entry?.requested && (entry.parent === null || effective(entry.parent))
  }
  const depth = (id: string): number => {
    const parent = entries.get(id)?.parent
    return parent ? 1 + depth(parent) : 0
  }
  const live = () =>
    [...entries.keys()].filter((id) => entries.get(id)?.phase !== "idle").sort((a, b) => depth(a) - depth(b))
  const advance = () => {
    const requested = [...entries.keys()].filter(effective)
    const branches = new Map<string | null, string>()
    for (const id of requested) {
      const entry = entries.get(id)!
      if (branches.has(entry.parent))
        throw new Error("NativeOverlayProvider: competing overlay branches are unsupported")
      if (entry.parent && entries.get(entry.parent)?.leaf)
        throw new Error("NativeOverlayProvider: Select is a leaf overlay")
      branches.set(entry.parent, id)
    }
    const chain = live()
    const last = chain.at(-1)
    if (last && !effective(last)) entries.get(last)!.phase = "closing"
    if (chain.some((id) => entries.get(id)?.phase === "closing")) return
    const parent = last ? entries.get(last)! : undefined
    const next = branches.get(last ?? null)
    if (next && (!parent || parent.phase === "shown")) entries.get(next)!.phase = "presenting"
  }
  const publish = () => {
    advance()
    revision++
    for (const listener of listeners) listener()
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot: () => revision,
    register: (id: string, parent: string | null, leaf: boolean, requested: boolean, notify = true) => {
      entries.set(id, { parent, leaf, requested, phase: "idle" })
      if (notify) publish()
    },
    request: (id: string, requested: boolean, notify = true) => {
      const entry = entries.get(id)
      if (!entry || entry.requested === requested) return
      entry.requested = requested
      if (notify) publish()
    },
    unregister: (id: string, notify = true) => {
      entries.delete(id)
      if (notify) publish()
    },
    shown: (id: string) => {
      const entry = entries.get(id)
      if (entry?.phase !== "presenting") return
      entry.phase = "shown"
      publish()
    },
    dismissed: (id: string) => {
      const entry = entries.get(id)
      if (entry?.phase !== "closing") return false
      entry.phase = "idle"
      publish()
      return true
    },
    state: (id: string) => {
      const phase = entries.get(id)?.phase ?? "idle"
      const chain = live()
      return {
        visible: phase === "presenting" || phase === "shown",
        mounted: phase !== "idle",
        closing: phase === "closing",
        active: phase === "shown" && effective(id) && chain.at(-1) === id,
        covered: chain.includes(id) && chain.at(-1) !== id,
      }
    },
    canRestore: (parent: string | null) => {
      const chain = live()
      return parent === null
        ? chain.length === 0
        : chain.at(-1) === parent && effective(parent) && entries.get(parent)?.phase === "shown"
    },
    flush: publish,
  }
}

export type TOverlayRegistry = ReturnType<typeof createOverlayRegistry>
