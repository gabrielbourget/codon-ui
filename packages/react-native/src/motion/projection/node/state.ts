// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.
/**
 * This should only ever be modified on the client otherwise it'll
 * persist through server requests. If we need instanced states we
 * could lazy-init via root.
 */
export const globalProjectionState = {
  /**
   * Global flag as to whether the tree has animated since the last time
   * we resized the window
   */
  hasAnimatedSinceResize: true,

  /**
   * We set this to true once, on the first update. Any nodes added to the tree beyond that
   * update will be given a `data-projection-id` attribute.
   */
  hasEverUpdated: false,
}
