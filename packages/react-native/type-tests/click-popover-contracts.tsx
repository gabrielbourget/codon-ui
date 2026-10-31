import { createRef } from "react"
import type { ScrollView, TextInput, View } from "react-native"

import { Button, ClickPopover, NativeDialogTrigger, type ClickPopoverProps } from "../src"

const root = createRef<View>(),
  editor = createRef<TextInput>(),
  scroll = createRef<ScrollView>()
export const controlledPopover = (
  <NativeDialogTrigger
    isOpen={false}
    onOpenChange={(open) => open.valueOf()}
    trigger={(state) => <Button {...state.triggerProps}>Open</Button>}
  >
    <ClickPopover
      ref={root}
      scrollRef={scroll}
      initialFocusRef={editor}
      restoreFocusRef={root}
      placement="bottom start"
      slot={null}
      width={0}
      offset={0}
      shouldCloseOnInteractOutside={(interaction) => {
        interaction.event.persist()
        return interaction.target === interaction.event.target
      }}
      customStyles={{ padding: 0 }}
      customDialogStyles={{ color: "red" }}
      customOverlayArrowStyles={{ fill: "orange", strokeWidth: 0 }}
    >
      Content
    </ClickPopover>
  </NativeDialogTrigger>
)
export const explicitPopover: ClickPopoverProps = {
  isOpen: false,
  triggerRef: editor,
  boundaryRef: root,
  trigger: "SubmenuTrigger",
  isNonModal: true,
  childIsDialog: false,
  "aria-describedby": "description",
  "aria-details": "details",
}
// @ts-expect-error DOM refs cannot be used as native anchors.
export const noDOMAnchor = <ClickPopover triggerRef={createRef<HTMLDivElement>()} />
// @ts-expect-error A View is not a native ScrollView.
export const noViewScrollRef = <ClickPopover scrollRef={root} />
// @ts-expect-error Native style slots do not accept CSS class names.
export const noClass = <ClickPopover className="popover" />
// @ts-expect-error The canonical style owner is an object, not a callback.
export const noStyleCallback = <ClickPopover style={() => ({ padding: 0 })} />
// @ts-expect-error Private native synchronization metadata is not a public prop.
export const noPrivateAnchor = <ClickPopover nativeScrollAnchorTag={123} />
// @ts-expect-error Native refs preserve actual native View methods.
export const noDOMRoot = <ClickPopover ref={createRef<HTMLDivElement>()} />
