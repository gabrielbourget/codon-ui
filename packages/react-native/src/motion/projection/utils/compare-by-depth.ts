// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.

export interface WithDepth {
  depth: number
}

export const compareByDepth = (a: WithDepth, b: WithDepth) => a.depth - b.depth
