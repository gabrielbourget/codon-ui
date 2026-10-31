import { createRef } from "react"
import { PlatformColor, type View } from "react-native"

import { motionValue } from "../kernel"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"
import type { TNativeMotionAngle, TNativeMotionTranslation } from "../visual/types"

export const NativeVisual = (
  <NativeMotionVisualHost
    ref={createRef<View>()}
    style={{ width: 0, height: "auto", color: PlatformColor("labelColor"), fontSize: 0 }}
    bindings={{
      x: motionValue<TNativeMotionTranslation>("25%"),
      opacity: motionValue(0),
      rotate: motionValue<TNativeMotionAngle>("1rad"),
    }}
    transformTemplate={(_values, generated) => [{ scale: 2 }, ...generated]}
  >
    Owned native content
  </NativeMotionVisualHost>
)
// @ts-expect-error Card-owned styles retain their static source contract.
export const NoMotionValueStyle = <NativeMotionVisualHost style={{ opacity: motionValue(0) }} />
// @ts-expect-error A native transform template returns a transform array, not CSS text.
export const NoCSSTemplate = <NativeMotionVisualHost transformTemplate={() => "translateX(10px)"} />
// @ts-expect-error Native translation bindings do not silently accept CSS length strings.
export const NoCSSLength = <NativeMotionVisualHost bindings={{ x: motionValue("10px") }} />
// @ts-expect-error Native angle bindings do not accept a percentage.
export const NoPercentageAngle = <NativeMotionVisualHost bindings={{ rotate: motionValue<`${number}%`>("50%") }} />
// @ts-expect-error Native children retain the source ReactNode contract.
export const NoMotionValueChildren = <NativeMotionVisualHost>{motionValue(0)}</NativeMotionVisualHost>
