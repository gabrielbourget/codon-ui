import { createRef } from "react"
import type { View } from "react-native"

import { NativeDialogFocusScope } from "../src/input/NativeDialogFocusScope"
import { NativeFocusHost } from "../src/input/NativeFocusView"

const root = createRef<View>()
export const dialog = (
  <NativeDialogFocusScope rootRef={root}>
    <NativeFocusHost ref={root} />
  </NativeDialogFocusScope>
)
export const empty = <NativeDialogFocusScope rootRef={root} />
// @ts-expect-error The caller must bind the original Dialog root.
export const missingRoot = <NativeDialogFocusScope />
// @ts-expect-error An integer tag cannot substitute for the original root ref.
export const tagRoot = <NativeDialogFocusScope rootRef={17} />
// @ts-expect-error Entry does not expose a second initial-focus owner.
export const secondEntry = <NativeDialogFocusScope rootRef={root} initialFocusRef={root} />
// @ts-expect-error Containment is explicit; there is no switch to weaken its behavior.
export const disabledContainment = <NativeDialogFocusScope rootRef={root} contain={false} />
// @ts-expect-error The helper does not create a styled host.
export const styledWrapper = <NativeDialogFocusScope rootRef={root} style={{ opacity: 0 }} />
