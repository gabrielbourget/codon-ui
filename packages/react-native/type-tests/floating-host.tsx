import { createRef } from "react"
import { View, type LayoutChangeEvent } from "react-native"

import { NativeFloatingLayerHost, type NativeFloatingLayerHostProps, type TNativeFloatingLayerHostRef } from "../src"

const ref = createRef<TNativeFloatingLayerHostRef>()
const props: NativeFloatingLayerHostProps = { style: [{ height: 0 }, false, { width: "100%" }] }
export const host = (
  <NativeFloatingLayerHost
    {...props}
    ref={ref}
    onLayout={(event: LayoutChangeEvent) => event.nativeEvent.layout.width.toFixed()}
  >
    <View />
  </NativeFloatingLayerHost>
)
// @ts-expect-error Native hit ownership is fixed to box-none.
export const pointerOwner = <NativeFloatingLayerHost pointerEvents="none" />
// @ts-expect-error Native host refs expose a View, not a DOM element.
export const domRef = <NativeFloatingLayerHost ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Native styling has no CSS position:fixed contract.
export const cssStyle = <NativeFloatingLayerHost style={{ position: "fixed" }} />
// @ts-expect-error The portal implementation is private.
export { NativeFloatingPortal } from "../src"
