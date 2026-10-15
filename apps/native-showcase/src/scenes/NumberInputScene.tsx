import { useRef, useState } from "react"
import { Keyboard, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  Button,
  NumberInput,
  Text,
  useNativeTheme,
  type TNativeNumberInputRef,
} from "@codon-ui/react-native"

export const NumberInputScene = () => {
  const theme = useNativeTheme()
  const input = useRef<TNativeNumberInputRef>(null)
  const [value, setValue] = useState<number | null>(0.2)
  const [raw, setRaw] = useState("")
  const [changes, setChanges] = useState(0)
  const [page, setPage] = useState<number | null>(null)
  const [french, setFrench] = useState<number | null>(1234.5)
  const [localized, setLocalized] = useState<number | null>(12.5)
  const [bounded, setBounded] = useState<number | null>(0.35)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [decline, setDecline] = useState(false)
  const [custom, setCustom] = useState(false)
  const [frenchFrance, setFrenchFrance] = useState(false)
  const [sixDigits, setSixDigits] = useState(false)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const common = {
    geometry,
    isDisabled: disabled,
    isReadOnly: readOnly,
    width: "100%" as const,
    customStyles: custom ? { borderColor: theme.colors.focusRing, borderWidth: 2 } : undefined,
    customInputStyles: custom ? { fontSize: 18 } : undefined,
    customGroupStyles: custom ? { gap: 10 } : undefined,
  }
  const locales = Intl.NumberFormat.supportedLocalesOf(["en-US", "fr-CA", "fr-FR"])
  const numberingSystem = new Intl.NumberFormat("en-US-u-nu-arab").resolvedOptions().numberingSystem
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native number controls
      </Text>
      <Text testID="number-intl-state">
        Intl locales: {locales.join(", ")}. Explicit numbering system: {numberingSystem}.
      </Text>
      <Text testID="number-state">
        Value: {value ?? "empty"}. Raw: {raw || "empty"}. Changes: {changes}. Page: {page ?? "empty"}. French:{" "}
        {french ?? "empty"}. Localized: {localized ?? "empty"}. Bounded: {bounded ?? "empty"}. State:{" "}
        {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Parent: {decline ? "declines" : "echoes"}. Locale:{" "}
        {frenchFrance ? "fr-FR" : "fr-CA"}. Precision: {sixDigits ? 6 : 3}. Geometry: {geometry}.
      </Text>
      <Text>Fractional controlled quantity — typing preserves the draft; commit publishes one number.</Text>
      <NumberInput
        {...common}
        ref={input}
        testID="number-fraction"
        accessibilityLabel="Fractional quantity"
        incrementLabel="Increase fractional quantity"
        decrementLabel="Decrease fractional quantity"
        value={value}
        minValue={-10}
        maxValue={10}
        step={0.1}
        formatOptions={{ maximumFractionDigits: sixDigits ? 6 : 3 }}
        onChangeText={setRaw}
        onChange={(next) => {
          setChanges((count) => count + 1)
          if (!decline) setValue(next)
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Commit number and dismiss keyboard", () => Keyboard.dismiss())}
        {action("Focus fractional quantity", () => input.current?.focus())}
      </View>
      <Text>Uncontrolled page-like integer, initially empty; bounds 1–10.</Text>
      <NumberInput
        {...common}
        testID="number-page"
        accessibilityLabel="Page number"
        incrementLabel="Next page number"
        decrementLabel="Previous page number"
        minValue={1}
        maxValue={10}
        formatOptions={{ maximumFractionDigits: 0 }}
        onChange={setPage}
      />
      <Text testID="number-long-label">
        Quantité pour la sélection courante — conservez les décimales, les espaces de groupement et toute cette longue
        explication lorsque le texte système grandit.
      </Text>
      <NumberInput
        {...common}
        testID="number-french"
        accessibilityLabel="Quantité pour la sélection courante"
        incrementLabel="Augmenter la quantité courante"
        decrementLabel="Réduire la quantité courante"
        locale={frenchFrance ? "fr-FR" : "fr-CA"}
        defaultValue={1234.5}
        onChange={setFrench}
      />
      <Text>
        Explicit Arabic numbering system; localized input does not change another field's declared output script.
      </Text>
      <NumberInput
        {...common}
        testID="number-localized"
        accessibilityLabel="Localized quantity"
        incrementLabel="Increase localized quantity"
        decrementLabel="Decrease localized quantity"
        locale="en-US-u-nu-arab"
        defaultValue={12.5}
        onChange={setLocalized}
      />
      <Text>Min-anchored grid: 0.1, 0.35, 0.6, 0.85; the off-grid maximum is 1.</Text>
      <NumberInput
        {...common}
        testID="number-bounded"
        accessibilityLabel="Bounded quantity"
        incrementLabel="Increase bounded quantity"
        decrementLabel="Decrease bounded quantity"
        minValue={0.1}
        maxValue={1}
        step={0.25}
        defaultValue={0.35}
        onChange={setBounded}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {action("Toggle number disabled", () => setDisabled((current) => !current))}
        {action("Toggle number read-only", () => setReadOnly((current) => !current))}
        {action("Toggle number parent echo", () => setDecline((current) => !current))}
        {action("Toggle number locale", () => setFrenchFrance((current) => !current))}
        {action("Toggle number precision", () => setSixDigits((current) => !current))}
        {action("Toggle number styles", () => setCustom((current) => !current))}
        {action("Next number geometry", () =>
          setGeometryIndex((current) => (current + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length),
        )}
        {action("Clear controlled number", () => setValue(null))}
      </View>
      <Text testID="number-footer">
        End of number controls. Bonjour Montréal — each editor and both step targets must remain reachable at large text
        and after rotation. Native keyboard layouts may omit a separator or Return; use the explicit commit action.
        Custom accessibility actions and installed traits do not certify VoiceOver or TalkBack speech. Closer visual and
        physical review belongs with application features; iPhone signing remains deferred.
      </Text>
    </View>
  )
}
