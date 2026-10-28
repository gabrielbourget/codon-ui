// React Native supplies both primitives; retain the original clock and microtask queue.
export const nativeDragRuntime = globalThis as typeof globalThis & {
  requestAnimationFrame: (callback: (time: number) => void) => number
  performance: { now: () => number }
  queueMicrotask: (callback: () => void) => void
}
