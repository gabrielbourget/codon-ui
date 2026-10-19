import { NativeFocusHost, NativeFocusView } from "../NativeFocusView"

export const drawingContracts = () => {
  const privateReceiver = <NativeFocusHost nativeMotionDrawingOwner nativeMotionProjectionRadii="{}" />
  // @ts-expect-error Drawing ownership is a private composition capability.
  const publicOwner = <NativeFocusView nativeMotionDrawingOwner />
  // @ts-expect-error The private transport remains encoded native data.
  const wrongTransport = <NativeFocusHost nativeMotionProjectionRadii={{ topLeft: { x: 4, y: 8 } }} />
  return { privateReceiver, publicOwner, wrongTransport }
}
