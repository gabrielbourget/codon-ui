import { createRef } from "react"
import { View } from "react-native"

import {
  Modal,
  NativeBackdropHost,
  NativeOverlayProvider,
  type TNativeBackdropAdapter,
  type TNativeBackdropEffectProps,
  type TNativeBackdropLease,
} from "../src"

// A renderer is supplied by the consumer; this fixture supplies no blur implementation.
export const BackdropConsumer = ({ adapter }: { adapter: TNativeBackdropAdapter }) => (
  <NativeOverlayProvider backdropAdapter={adapter}>
    <NativeBackdropHost ref={createRef<View>()} style={{ flex: 1 }}>
      <Modal aria-label="Parent" overlayBlur>
        <Modal aria-label="Nested" overlayBlur />
      </Modal>
    </NativeBackdropHost>
  </NativeOverlayProvider>
)
export const validateEffect = (props: TNativeBackdropEffectProps): boolean => {
  const lease: TNativeBackdropLease = props.lease
  const radius: number = props.radius
  return radius >= 0 && !props.isPaused && lease.isCurrent()
}
// @ts-expect-error the adapter needs both a target and an actual effect renderer
export const MissingEffect: TNativeBackdropAdapter = { Target: View }
// @ts-expect-error no native capture token or window identifier is invented by the JS host
export const InventedNativeWindow = (lease: TNativeBackdropLease) => lease.nativeWindowId
// @ts-expect-error the host forwards a View rather than a DOM element
export const DOMBackdrop = <NativeBackdropHost ref={createRef<HTMLDivElement>()} />
