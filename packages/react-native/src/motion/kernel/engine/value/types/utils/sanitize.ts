// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
// If this number is a decimal, make it just five decimal places
// to avoid exponents
export const sanitize = (v: number) => Math.round(v * 100000) / 100000
