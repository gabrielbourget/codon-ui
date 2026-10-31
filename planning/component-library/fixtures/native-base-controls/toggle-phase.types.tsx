import { NativeFocusView, type TNativeFocusViewProps } from "../../../../packages/react-native/src"

const receive: TNativeFocusViewProps["onKeyDown"] = () => {}
export const ExistingTargetCallback = <NativeFocusView onKeyDown={receive} />
// @ts-expect-error The current native public keyboard API cannot express the required ancestor capture callback.
export const MissingCaptureCallback = <NativeFocusView onKeyDownCapture={receive} />
