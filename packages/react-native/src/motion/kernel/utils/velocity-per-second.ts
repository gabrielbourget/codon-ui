// Received from motion-utils 12.39.0. See UPSTREAM.json and LICENSE.motion-utils.md.
/*
  Convert velocity into velocity per second
*/
/*#__NO_SIDE_EFFECTS__*/
export const velocityPerSecond = (velocity: number, frameDuration: number) =>
  frameDuration ? velocity * (1000 / frameDuration) : 0
