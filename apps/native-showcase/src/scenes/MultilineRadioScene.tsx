import { useRef, useState } from "react"
import { Keyboard, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Radio,
  RadioGroup,
  Text,
  TextArea,
  useNativeTheme,
  type TNativeTextAreaRef,
} from "@codon-ui/react-native"

const LONG_NOTES = Array.from(
  { length: 16 },
  (_, index) => `Line ${index + 1}: Bonjour Montréal — preserve complete native text and scrolling.`,
).join("\n")

export const MultilineRadioScene = () => {
  const theme = useNativeTheme()
  const [draft, setDraft] = useState("")
  const [submitDraft, setSubmitDraft] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [submits, setSubmits] = useState(0)
  const [value, setValue] = useState<string | null>(null)
  const [changes, setChanges] = useState(0)
  const [uncontrolled, setUncontrolled] = useState("first")
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [horizontal, setHorizontal] = useState(false)
  const [hideSelected, setHideSelected] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const inputRef = useRef<TNativeTextAreaRef>(null)
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const guards = { isDisabled: disabled, isReadOnly: readOnly }
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )

  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native multiline and radio controls
      </Text>
      <Text testID="multiline-radio-state">
        Draft: {draft || "empty"}. Submitted: {submitted || "empty"}. Submits: {submits}. Radio: {value ?? "none"}.
        Changes: {changes}. Uncontrolled: {uncontrolled}. State:{" "}
        {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Order: {order}. Geometry: {geometry}. Orientation:{" "}
        {horizontal ? "horizontal" : "vertical"}.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Toggle multiline disabled", () => setDisabled((current) => !current))}
        {action("Toggle multiline read-only", () => setReadOnly((current) => !current))}
        {action("Toggle multiline styles", () => setCustom((current) => !current))}
        {action("Toggle radio orientation", () => setHorizontal((current) => !current))}
        {action("Next radio order", () =>
          setOrderIndex((current) => (current + 1) % AVAILABLE_THEMING_ORDER_CODES.length),
        )}
        {action("Next radio geometry", () =>
          setGeometryIndex((current) => (current + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length),
        )}
        {action("Toggle selected radio removal", () => setHideSelected((current) => !current))}
        {action("Clear radio value", () => setValue(null))}
      </View>
      <Text>Default Return inserts a newline. Bonjour Montréal — write complete bilingual notes.</Text>
      <TextArea
        ref={inputRef}
        testID="multiline-draft"
        aria-label="Multiline notes"
        value={draft}
        onChangeText={setDraft}
        placeholder="Enter several lines"
        autoCorrect={false}
        autoCapitalize="none"
        width="100%"
        geometry={geometry}
        {...guards}
        customStyles={custom ? { fontSize: 18, borderColor: theme.colors.focusRing } : undefined}
        style={({ defaultStyle }) => defaultStyle}
      />
      <Text>Explicit submission reads the final native text event.</Text>
      <TextArea
        testID="multiline-submit"
        aria-label="Submit notes"
        value={submitDraft}
        onChangeText={setSubmitDraft}
        autoCorrect={false}
        autoCapitalize="none"
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        width="100%"
        geometry={geometry}
        {...guards}
        onSubmitEditing={({ nativeEvent: { text } }) => {
          setSubmitDraft(text)
          setSubmitted(text)
          setSubmits((count) => count + 1)
          Keyboard.dismiss()
        }}
      />
      <Text>Long uncontrolled notes keep their 96-unit editor and scroll internally.</Text>
      <TextArea
        testID="multiline-long"
        aria-label="Long notes"
        defaultValue={LONG_NOTES}
        autoCorrect={false}
        width="100%"
        {...guards}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Focus multiline notes", () => inputRef.current?.focus())}
        {action("Dismiss multiline keyboard", () => Keyboard.dismiss())}
      </View>
      <Text>Controlled choices</Text>
      <RadioGroup
        testID="multiline-radio-group"
        aria-label="Controlled radio choices"
        value={value}
        onChange={(next) => {
          setValue(next)
          setChanges((count) => count + 1)
        }}
        orientation={horizontal ? "horizontal" : "vertical"}
        {...guards}
        customStyles={custom ? { gap: 16 } : undefined}
        style={({ defaultStyle }) => defaultStyle}
      >
        {[
          { value: "first", name: "Radio first", label: "First choice" },
          {
            value: "second",
            name: "Radio second",
            label:
              "Second choice — sélectionnez les paramètres et continuez lorsque vous êtes prêt à enregistrer les modifications.",
          },
          { value: "unavailable", name: "Radio unavailable", label: "Unavailable choice" },
        ]
          .filter((item) => !hideSelected || item.value !== value)
          .map((item) => (
            <Radio
              key={item.value}
              value={item.value}
              accessibilityLabel={item.name}
              testID={`multiline-radio-${item.value}`}
              isDisabled={item.value === "unavailable"}
              order={order}
              geometry={geometry}
              customStyles={{ maxWidth: "100%" }}
              customShapeStyles={custom ? { width: 24, height: 24, borderColor: theme.colors.focusRing } : undefined}
            >
              {({ isSelected }) => (
                <>
                  {item.label}
                  {isSelected ? " ✓" : ""}
                </>
              )}
            </Radio>
          ))}
      </RadioGroup>
      <Text>Uncontrolled choices</Text>
      <RadioGroup
        testID="multiline-uncontrolled-group"
        aria-label="Uncontrolled radio choices"
        defaultValue="first"
        onChange={setUncontrolled}
        orientation={horizontal ? "horizontal" : "vertical"}
        {...guards}
      >
        <Radio
          testID="multiline-uncontrolled-first"
          value="first"
          aria-label="Uncontrolled first"
          order={order}
          geometry={geometry}
        >
          First
        </Radio>
        <Radio
          testID="multiline-uncontrolled-second"
          value="second"
          aria-label="Uncontrolled second"
          order={order}
          geometry={geometry}
        >
          Second
        </Radio>
      </RadioGroup>
      <Text testID="multiline-radio-footer">
        Multiline text retains native scrolling, newline and explicit submission. Radio groups own one value and
        preserve separate accessible members. Keyboard, large text, rotation and targets are inspected in the local lab;
        closer visual and physical review accompanies application integration.
      </Text>
    </View>
  )
}
