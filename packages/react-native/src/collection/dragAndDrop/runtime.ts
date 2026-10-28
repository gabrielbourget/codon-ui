// React Native supplies both primitives; retain the original clock and microtask queue.
export const nativeDragRuntime = globalThis as typeof globalThis & {
  performance: { now: () => number }
  queueMicrotask: (callback: () => void) => void
}
