import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

export const owner = new NativeMotionOwner({
  props: { initial: false },
  base: {},
  config: {},
  reduced: false,
  canAct: () => true,
})
export const host = <NativeMotionOwnerHost motion={{ initial: { x: 0 }, animate: { x: 100 } }} />
// @ts-expect-error A real native ref is required, not a fabricated style/measure object.
owner.attach({ style: {} })
// @ts-expect-error Actual isolated geometry returns typed resolved keyframes.
export const invalidGeometry = <NativeMotionOwnerHost motion={{}} resolveGeometry={() => [1, 2]} />
export const invalidCallback = (
  <NativeMotionOwnerHost
    motion={{
      // @ts-expect-error Animation lifecycle callbacks retain animation definitions, not press events.
      onAnimationStart: (event: { nativeEvent: unknown }) => event.nativeEvent,
    }}
  />
)
