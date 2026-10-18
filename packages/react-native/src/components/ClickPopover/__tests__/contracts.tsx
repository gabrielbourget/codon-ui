import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { ClickPopover } from "../ClickPopover"

export const actualTargets = (
  <ClickPopover initialFocusRef={createRef<TextInput>()} restoreFocusRef={createRef<View>()} />
)
// @ts-expect-error Focus-shaped objects do not establish actual native target identity.
export const fakeFocus = <ClickPopover initialFocusRef={createRef<{ focus: () => void }>()} />
// @ts-expect-error Browser instances cannot replace native focus targets.
export const browserFocus = <ClickPopover restoreFocusRef={createRef<HTMLDivElement>()} />
