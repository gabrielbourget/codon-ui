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
  style: [{ opacity: 0, fontStyle: "italic", letterSpacing: 0 }],
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
export const RelatedField = (
  <FormField
    ariaDescribedBy="description-id second"
    ariaDetails="details-id"
    labels={{ descriptionLabel: "Description", detailsLabel: "Détails" }}
  />
)
export const EmptyRelationships = (
  <FormField aria-describedby="" aria-details="" labels={{ descriptionLabel: "", detailsLabel: "" }} />
)
// @ts-expect-error ID relationships use whitespace-separated strings, not arrays.
export const InvalidDescriptionIDs = <FormField ariaDescribedBy={["description-id"]} />
// @ts-expect-error IDs remain strings rather than native numeric tags.
export const InvalidDetailsID = <FormField ariaDetails={7} />
// @ts-expect-error Supplementary content captions remain localizable strings.
export const InvalidRelationshipCaption = <FormField labels={{ detailsLabel: false }} />
// @ts-expect-error Canonical root style is a style value, not a render-state callback.
export const ReplacedFieldStyle = <FormField style={() => ({ opacity: 0 })} />
// @ts-expect-error Native font sizes use logical numbers.
export const DOMFieldFontSize = <FormField customLabelStyles={{ fontSize: "1rem" }} />
// @ts-expect-error FormField does not own a control value.
export const OwnedFieldValue = <FormField value="" />
// @ts-expect-error Message values remain strings.
export const NonStringFieldMessage = <FormField errorMessages={[0]} />
