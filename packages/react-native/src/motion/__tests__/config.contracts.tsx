import { NativeMotionConfig } from "../config"
import type { TNativeMotionConfigProps } from "../config"

export const nativeConfigProps: TNativeMotionConfigProps = {
  isStatic: true,
  transition: { duration: 0, inherit: true },
  reducedMotion: "user",
  skipAnimations: false,
  transformPagePoint: ({ x, y }) => ({ x: x + 1, y }),
}
export const config = <NativeMotionConfig {...nativeConfigProps} />
// @ts-expect-error The native provider has no CSS nonce or DOM filtering surface.
export const nonce = <NativeMotionConfig nonce="browser" />
// @ts-expect-error Browser prop filtering is not a native provider operation.
export const filter = <NativeMotionConfig isValidProp={() => true} />
// @ts-expect-error Reduced motion accepts the exact three policy names.
export const mode = <NativeMotionConfig reducedMotion="sometimes" />
// @ts-expect-error Native page conversion must return a numeric point.
export const point = <NativeMotionConfig transformPagePoint={() => ({ x: "0", y: 0 })} />
