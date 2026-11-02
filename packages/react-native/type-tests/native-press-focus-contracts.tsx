import type { ComponentProps } from "react"

import { Button, NativeButtonContext, type TNativeButtonProps } from "../src"
// @ts-expect-error The original-host constructor remains private to owned components.
import { NativeButton } from "../src"

// @ts-expect-error Pointer-focus mapping is not a general public Button prop.
export const InvalidPublicButtonFocus = <Button nativeFocusOnPress />
// @ts-expect-error Public prop aliases exclude the private original-host option.
export const InvalidPublicButtonFocusProps: TNativeButtonProps = { nativeFocusOnPress: true }
// @ts-expect-error The explicitly typed public component cannot infer the internal option.
export const InvalidInferredButtonFocusProps: ComponentProps<typeof Button> = { nativeFocusOnPress: true }
// @ts-expect-error Context cannot install the private pointer-focus operation on other buttons.
export const InvalidButtonFocusContext = <NativeButtonContext.Provider value={{ nativeFocusOnPress: true }} />
export const PrivateButtonConstructorIsAbsent = NativeButton
