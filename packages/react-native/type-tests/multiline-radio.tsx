import { createRef } from "react"

import { TextArea, type TextAreaProps, type TNativeTextAreaRef } from "../src"

export const ValidTextAreaProps: TextAreaProps = {
  "aria-label": "Notes",
  defaultValue: "Bonjour\nHello",
  submitBehavior: "newline",
  onContentSizeChange: (event) => event.nativeEvent.contentSize.height,
  onSubmitEditing: (event) => event.nativeEvent.text,
  style: ({ defaultStyle, isFocused }) => [defaultStyle, { opacity: isFocused ? 1 : 0.9 }],
}
export const ValidTextArea = <TextArea {...ValidTextAreaProps} ref={createRef<TNativeTextAreaRef>()} />
// @ts-expect-error an accessible name is required; a placeholder is not a name
export const InvalidTextAreaName = <TextArea placeholder="Notes" />
// @ts-expect-error multiline is component-owned
export const InvalidTextAreaMultiline = <TextArea aria-label="Notes" multiline={false} />
// @ts-expect-error use the explicit submitBehavior contract
export const InvalidTextAreaBlur = <TextArea aria-label="Notes" blurOnSubmit />
// @ts-expect-error single-line clear-button mode is excluded
export const InvalidTextAreaClear = <TextArea aria-label="Notes" clearButtonMode="always" />
// @ts-expect-error secure text is a single-line contract
export const InvalidTextAreaSecure = <TextArea aria-label="Notes" secureTextEntry />
// @ts-expect-error native editing availability is owned
export const InvalidTextAreaEditable = <TextArea aria-label="Notes" editable />
// @ts-expect-error no CSS resize contract
export const InvalidTextAreaResize = <TextArea aria-label="Notes" resize="vertical" />
// @ts-expect-error native events do not expose DOM target values
export const InvalidTextAreaEvent = <TextArea aria-label="Notes" onChange={(event) => event.target.value} />
