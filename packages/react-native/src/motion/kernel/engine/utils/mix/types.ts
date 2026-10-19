// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
export type Mixer<T> = (p: number) => T

export type MixerFactory<T> = (a: T, b: T) => Mixer<T>
