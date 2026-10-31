// React Native provides these runtime primitives; no fallback clock or global shim.
export const nativeMotionRuntime = globalThis as typeof globalThis & {
  performance: { now: () => number }
  queueMicrotask: (callback: () => void) => void
}
