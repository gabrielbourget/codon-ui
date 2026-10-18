import { createRef } from "react"
import { PlatformColor, StyleSheet, type TextInput, type View } from "react-native"

import { FormField, Input, Text, type FormFieldProps, type TNativeFormFieldFocusTarget } from "../src"

const editor = createRef<TextInput>()
const root = createRef<View>()
const focusTarget = createRef<TNativeFormFieldFocusTarget>()
const styles = StyleSheet.create({ label: { color: "purple", fontSize: 16 }, row: { padding: 0 } })
export const fieldProps: FormFieldProps = {
  label: "Email",
  labelID: "email-label",
  labelFor: editor,
  required: false,
  errorMessages: [] as const,
  warningMessages: ["A warning"] as const,
  successMessages: [""] as const,
  description: "",
  topRightContent: 0,
  bottomRightContent: false,
  customStyles: [{ color: PlatformColor("labelColor") }, { width: 0 }],
  style: [{ opacity: 0 }],
  customTopRowStyles: styles.row,
  customLabelStyles: styles.label,
  customTopRightStyles: [false, styles.row],
  customBottomRowStyles: styles.row,
  customBottomRightStyles: { minWidth: 0 },
  customValidationMessageStyles: [{ fontSize: 18, color: "orange" }, { padding: 0 }],
  customDescriptionStyles: { fontStyle: "normal" },
  accessibilityLabel: "Form context",
  accessibilityHint: "This section contains the email editor",
  accessibilityLabelledBy: ["context-label", "other-label"],
  ariaLabel: "Alias",
  ariaLabelledBy: "alias-label",
  onLayout: (event) => event.nativeEvent.layout.width,
}
export const ValidField = (
  <FormField {...fieldProps} ref={root}>
    <Input ref={editor} nativeID="email" accessibilityLabel="Email" value="" />
    <Text>Caller-owned content</Text>
  </FormField>
)
export const FocusOnlyField = <FormField label="Target" labelFor={focusTarget} />
export const EmptyField = <FormField testID="" aria-label="" aria-labelledby="" />
// @ts-expect-error Native focus refs replace DOM labelFor ID strings.
export const DOMLabelTarget = <FormField labelFor="email" />
// @ts-expect-error A native View ref replaces the HTMLDivElement ref.
export const DOMFieldRef = <FormField ref={createRef<HTMLDivElement>()} />
// @ts-expect-error Native styles replace DOM class names.
export const DOMFieldClass = <FormField className="field" />
// @ts-expect-error Native label styles replace DOM classes.
export const DOMLabelClass = <FormField customLabelClassName="label" />
// @ts-expect-error Native events replace DOM click payloads.
export const DOMFieldClick = <FormField onClick={() => undefined} />
// @ts-expect-error Generic browser description-ID relationships remain an open capability, not an implemented native prop.
export const DOMDescriptionAlias = <FormField ariaDescribedBy="description-id" />
// @ts-expect-error Browser details-ID semantics have no implemented generic native equivalent.
export const DOMDetailsAlias = <FormField ariaDetails="details-id" />
// @ts-expect-error Hyphenated DOM ID-reference props are explicitly rejected too.
export const DOMDescriptionAttribute = <FormField aria-describedby="description-id" />
// @ts-expect-error Native type rejection must also cover the hyphenated details attribute.
export const DOMDetailsAttribute = <FormField aria-details="details-id" />
// @ts-expect-error Canonical root style is a style value, not a render-state callback.
export const ReplacedFieldStyle = <FormField style={() => ({ opacity: 0 })} />
// @ts-expect-error Native font sizes use logical numbers.
export const DOMFieldFontSize = <FormField customLabelStyles={{ fontSize: "1rem" }} />
// @ts-expect-error FormField does not own a control value.
export const OwnedFieldValue = <FormField value="" />
// @ts-expect-error Message values remain strings.
export const NonStringFieldMessage = <FormField errorMessages={[0]} />
