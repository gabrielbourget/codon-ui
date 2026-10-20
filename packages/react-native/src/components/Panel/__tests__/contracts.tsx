import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { Panel } from "../Panel"
import type { TNativePanelProps } from "../types"

const props: TNativePanelProps = {
  "aria-label": "Side panel",
  isOpen: false,
  width: 0,
  height: "100%",
  horizontalGap: -10,
  panelGeometry: "round",
  overlayBlur: true,
  style: [{ color: "navy" }, { padding: 0 }],
  onOpenChange: (open) => {
    const original: boolean = open
    void original
  },
}
export const ValidPanel = <Panel {...props} />
export const NativeFocusPanel = (
  <Panel
    {...props}
    ref={createRef<View>()}
    initialFocusRef={createRef<TextInput>()}
    restoreFocusRef={createRef<View>()}
  />
)
// @ts-expect-error only actual native view refs are accepted
export const DOMPanel = <Panel {...props} ref={createRef<HTMLDivElement>()} />
// @ts-expect-error an arbitrary focus-shaped object is not a native target
export const FakeFocusPanel = <Panel {...props} initialFocusRef={createRef<{ focus: () => void }>()} />
// @ts-expect-error there is no default/uncontrolled open value in the canonical contract
export const UncontrolledPanel = <Panel {...props} defaultOpen />
// @ts-expect-error require an explicit native accessible name
export const UnnamedPanel = <Panel />
// @ts-expect-error physical side values are closed
export const InvalidSide = <Panel {...props} position="start" />
// @ts-expect-error CSS units are not native dimensions
export const CSSWidth = <Panel {...props} width="300px" />
