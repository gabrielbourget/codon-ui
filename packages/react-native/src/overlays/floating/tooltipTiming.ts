type TTimer = ReturnType<typeof setTimeout>
type TTooltipTimingOptions = {
  isOpen: boolean
  delay?: number
  closeDelay?: number
  request: (open: boolean) => void
}
type TEntry = {
  read: () => TTooltipTimingOptions
  closeTimer: TTimer | null
  closeGeneration: number
}

// One native-window host shares warmup; timers only request changes from their current owner.
export const createNativeTooltipTiming = () => {
  const entries = new Set<TEntry>()
  const participants = new Set<TEntry>()
  let live = true
  let warmed = false
  let warmup: { entry: TEntry; timer: TTimer; generation: number } | null = null
  let cooldown: TTimer | null = null
  let generation = 0
  const clearWarmup = () => {
    if (warmup) clearTimeout(warmup.timer)
    warmup = null
    generation++
  }
  const clearCooldown = () => {
    if (cooldown !== null) clearTimeout(cooldown)
    cooldown = null
  }
  const clearClose = (entry: TEntry) => {
    if (entry.closeTimer !== null) clearTimeout(entry.closeTimer)
    entry.closeTimer = null
    entry.closeGeneration++
  }
  const request = (entry: TEntry, open: boolean) => {
    if (!live || !entries.has(entry)) return
    const owner = entry.read()
    if (owner.isOpen !== open) owner.request(open)
  }
  const readOptions = (entry: TEntry) => {
    const options = entry.read()
    for (const value of [options.delay, options.closeDelay])
      if (value !== undefined && !Number.isFinite(value)) throw new TypeError("Tooltip delays must be finite")
    return options
  }
  const close = (entry: TEntry, immediate = false, eligible: () => boolean = () => true) => {
    if (!live || !entries.has(entry) || !eligible()) return
    const delay = readOptions(entry).closeDelay ?? 500
    if (warmup?.entry === entry) clearWarmup()
    if (immediate || delay <= 0) {
      clearClose(entry)
      request(entry, false)
    } else if (entry.closeTimer === null) {
      const token = ++entry.closeGeneration
      entry.closeTimer = setTimeout(() => {
        if (!live || !entries.has(entry) || token !== entry.closeGeneration) return
        entry.closeTimer = null
        if (eligible()) request(entry, false)
      }, delay)
    }
    if (warmed) {
      clearCooldown()
      const token = generation
      cooldown = setTimeout(
        () => {
          if (!live || generation !== token) return
          participants.delete(entry)
          cooldown = null
          warmed = false
        },
        Math.max(500, delay),
      )
    }
  }
  const closeOthers = (entry: TEntry) => {
    for (const other of [...participants]) {
      if (other === entry) continue
      close(other, true)
      participants.delete(other)
    }
  }
  const show = (entry: TEntry, eligible: () => boolean) => {
    if (!live || !entries.has(entry) || !eligible()) return
    clearClose(entry)
    closeOthers(entry)
    participants.add(entry)
    clearWarmup()
    clearCooldown()
    warmed = true
    request(entry, true)
  }
  return {
    register: (read: () => TTooltipTimingOptions) => {
      if (!live) throw new Error("Tooltip timing host is retired")
      const entry: TEntry = { read, closeTimer: null, closeGeneration: 0 }
      entries.add(entry)
      return {
        open: (immediate = false, eligible: () => boolean = () => true) => {
          if (!live || !entries.has(entry) || !eligible()) return
          const owner = readOptions(entry)
          const delay = owner.delay ?? 1500
          if (immediate || delay <= 0 || entry.closeTimer !== null || warmed) {
            show(entry, eligible)
            return
          }
          closeOthers(entry)
          participants.add(entry)
          if (owner.isOpen) return
          clearWarmup()
          const token = generation
          const timer = setTimeout(() => {
            if (warmup?.entry !== entry || warmup.generation !== token) return
            warmup = null
            show(entry, eligible)
          }, delay)
          warmup = { entry, timer, generation: token }
        },
        close: (immediate = false, eligible?: () => boolean) => close(entry, immediate, eligible),
        unregister: () => {
          clearClose(entry)
          if (warmup?.entry === entry) clearWarmup()
          entries.delete(entry)
          participants.delete(entry)
          if (entries.size === 0) {
            clearCooldown()
            warmed = false
          }
        },
      }
    },
    dispose: () => {
      live = false
      clearWarmup()
      clearCooldown()
      for (const entry of entries) clearClose(entry)
      entries.clear()
      participants.clear()
    },
  }
}
