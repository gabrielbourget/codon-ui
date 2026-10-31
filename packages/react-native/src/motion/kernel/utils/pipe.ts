// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
/**
 * Pipe
 * Compose other transformers to run linearily
 * pipe(min(20), max(40))
 * @param  {...functions} transformers
 * @return {function}
 */
export const pipe = (...transformers: Array<(value: never) => unknown>) =>
  transformers.reduce((a, b) => (v: never) => b(a(v) as never))
