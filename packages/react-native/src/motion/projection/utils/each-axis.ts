// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.
type Callback = (axis: "x" | "y") => void

export function eachAxis(callback: Callback) {
  return [callback("x"), callback("y")]
}
