import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { Text } from "../../Text/Text"
import { ClickPopover } from "../ClickPopover"
import { NativeDialogContext, NativeOverlayTriggerStateContext, NativePopoverContext } from "../context"

export const completeNativeContexts = (
  <NativePopoverContext.Provider
    value={{
      slots: {
        named: {
          ref: createRef<View>(),
          triggerRef: createRef<View>(),
          style: ({ trigger, placement, isEntering, isExiting, defaultStyle }) => ({
            ...defaultStyle,
            opacity: isEntering || isExiting || trigger === placement ? 0 : 1,
          }),
          clearContexts: [NativeDialogContext, NativeOverlayTriggerStateContext],
        },
      },
    }}
  >
    <NativeDialogContext.Provider
      value={{
        ref: createRef<View>(),
        role: "alertdialog",
        "aria-describedby": "description",
        render: (props, state) => {
          const noState: undefined = state
          void noState
          return <NativeFocusHost {...props} />
        },
        children: ({ close }) => (
          <Text slot="title" onPress={close}>
            Title
          </Text>
        ),
      }}
    >
      <ClickPopover slot="named" />
      <ClickPopover slot={null} />
    </NativeDialogContext.Provider>
  </NativePopoverContext.Provider>
)
// @ts-expect-error Own popover style retains the canonical static wrapper contract.
export const dynamicOwnStyle = <ClickPopover style={() => ({ opacity: 0 })} />
// @ts-expect-error ClickPopover children remain ReactNode.
export const dynamicOwnChildren = <ClickPopover>{() => null}</ClickPopover>
// @ts-expect-error Dialog context style is static, matching its original public contract.
export const dynamicDialogStyle = <NativeDialogContext.Provider value={{ style: () => ({}) }} />
// @ts-expect-error A browser ref cannot replace the original native Dialog host.
export const browserDialog = <NativeDialogContext.Provider value={{ ref: createRef<HTMLDivElement>() }} />

export const renderedPopover = (
  <ClickPopover
    render={(props, state) => {
      const trigger: string | null = state.trigger
      const entering: boolean = state.isEntering
      void trigger
      void entering
      // @ts-expect-error Popover's render state has no Tooltip owner state.
      void state.state
      return <NativeFocusView {...props} />
    }}
  />
)

export const actualTargets = (
  <ClickPopover initialFocusRef={createRef<TextInput>()} restoreFocusRef={createRef<View>()} />
)
// @ts-expect-error Focus-shaped objects do not establish actual native target identity.
export const fakeFocus = <ClickPopover initialFocusRef={createRef<{ focus: () => void }>()} />
// @ts-expect-error Browser instances cannot replace native focus targets.
export const browserFocus = <ClickPopover restoreFocusRef={createRef<HTMLDivElement>()} />
