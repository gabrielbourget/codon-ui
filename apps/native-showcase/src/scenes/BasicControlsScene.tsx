import { useRef, useState } from "react"
import { Keyboard, StyleSheet, TextInput as CoreInput, View } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Switch,
  Text,
  useNativeTheme,
  type TNativeInputRef,
} from "@codon-ui/react-native"

export const BasicControlsScene = () => {
  const theme = useNativeTheme()
  const [selectedSwitch, setSelectedSwitch] = useState(false)
  const [uncontrolledSwitch, setUncontrolledSwitch] = useState(false)
  const [selectedCheckbox, setSelectedCheckbox] = useState(false)
  const [uncontrolledCheckbox, setUncontrolledCheckbox] = useState(false)
  const [group, setGroup] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [submits, setSubmits] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [mixed, setMixed] = useState(false)
  const [custom, setCustom] = useState(false)
  const [orderIndex, setOrderIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const [coreComparison, setCoreComparison] = useState(false)
  const inputRef = useRef<TNativeInputRef>(null)
  const order = AVAILABLE_THEMING_ORDER_CODES[orderIndex]
  const geometry = AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]
  const controlState = { isDisabled: disabled, isReadOnly: readOnly }
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} onPress={onPress} accessibilityLabel={label}>
      {label}
    </Button>
  )

  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Native basic controls
      </Text>
      <Text testID="basic-control-state">
        Switch: {selectedSwitch ? "on" : "off"}. Checkbox: {selectedCheckbox ? "on" : "off"}. Group:{" "}
        {group.join(",") || "none"}. Input: {input || "empty"}. Submits: {submits}. State:{" "}
        {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Mixed: {mixed ? "yes" : "no"}.
      </Text>
      <View style={styles.controls}>
        {action("Toggle controls disabled", () => setDisabled((value) => !value))}
        {action("Toggle controls read-only", () => setReadOnly((value) => !value))}
        {action("Toggle mixed display", () => setMixed((value) => !value))}
        {action("Toggle control styles", () => setCustom((value) => !value))}
        {action("Next control order", () =>
          setOrderIndex((value) => (value + 1) % AVAILABLE_THEMING_ORDER_CODES.length),
        )}
        {action("Next control geometry", () =>
          setGeometryIndex((value) => (value + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length),
        )}
      </View>
      <Text>
        Order: {order}. Geometry: {geometry}. Uncontrolled switch: {uncontrolledSwitch ? "on" : "off"}. Uncontrolled
        checkbox: {uncontrolledCheckbox ? "on" : "off"}.
      </Text>
      <Switch
        testID="basic-switch"
        aria-label="Controlled switch"
        rightContent="Controlled switch"
        {...controlState}
        isSelected={selectedSwitch}
        onChange={setSelectedSwitch}
        order={order}
        geometry={geometry}
        showOnOffIcons
        customTrackStyles={custom ? { width: 60, height: 24, backgroundColor: "#123456" } : undefined}
        customIndicatorStyles={custom ? { width: 18, backgroundColor: "#abcdef" } : undefined}
        customStyles={custom ? { paddingHorizontal: 5 } : undefined}
        style={({ defaultStyle }) => defaultStyle}
      />
      <Switch
        testID="basic-uncontrolled-switch"
        aria-label="Uncontrolled switch"
        rightContent="Uncontrolled switch"
        {...controlState}
        onChange={setUncontrolledSwitch}
        order={order}
        geometry={geometry}
      />
      <Checkbox
        testID="basic-checkbox"
        aria-label="Controlled checkbox"
        {...controlState}
        isSelected={selectedCheckbox}
        isIndeterminate={mixed}
        onChange={setSelectedCheckbox}
        order={order}
        geometry={geometry}
        customStyles={custom ? { paddingHorizontal: 5 } : undefined}
        style={({ defaultStyle }) => defaultStyle}
      >
        {({ isSelected }) => <>Controlled checkbox {isSelected ? "on" : "off"}</>}
      </Checkbox>
      <Checkbox
        testID="basic-uncontrolled-checkbox"
        aria-label="Uncontrolled checkbox"
        {...controlState}
        onChange={setUncontrolledCheckbox}
        order={order}
        geometry={geometry}
      >
        Uncontrolled checkbox
      </Checkbox>
      <CheckboxGroup
        render={(props, state) => <View {...props} nativeID={`basic-group-${state.value.join("-") || "empty"}`} />}
        testID="basic-group"
        value={group}
        onChange={setGroup}
        {...controlState}
        orientation="horizontal"
      >
        {({ isDisabled, isReadOnly }) => (
          <>
            <View>
              <Checkbox
                isDisabled={isDisabled}
                isReadOnly={isReadOnly}
                testID="basic-group-first"
                aria-label="Group first"
                value="first"
                order={order}
                geometry={geometry}
              >
                First choice
              </Checkbox>
            </View>
            <View>
              <Checkbox
                testID="basic-group-second"
                aria-label="Group second"
                value="second"
                order={order}
                geometry={geometry}
              >
                Second choice
              </Checkbox>
            </View>
          </>
        )}
      </CheckboxGroup>
      <Checkbox
        testID="basic-long-checkbox"
        aria-label="Long checkbox"
        {...controlState}
        isSelected={selectedCheckbox}
        onChange={setSelectedCheckbox}
        order={order}
        geometry={geometry}
      >
        A long native label remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt à
        enregistrer les modifications.
      </Checkbox>
      {coreComparison ? (
        <CoreInput
          ref={inputRef}
          testID="basic-input"
          accessibilityLabel="Basic input"
          placeholder="Enter bilingual text"
          value={input}
          onChangeText={setInput}
          editable={!disabled && !readOnly}
          readOnly={disabled || readOnly}
          accessibilityState={{ disabled }}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={({ nativeEvent: { text } }) => {
            setInput(text)
            setSubmits((value) => value + 1)
            Keyboard.dismiss()
          }}
          style={{
            minHeight: 48,
            width: "100%",
            fontSize: 14,
            padding: 5,
            borderWidth: 1,
            color: theme.colors.controlForeground,
            backgroundColor: theme.colors.controlBackground,
            borderColor: theme.colors.controlBorder,
            opacity: disabled ? theme.opacity.disabled : 1,
          }}
        />
      ) : (
        <Input
          ref={inputRef}
          testID="basic-input"
          aria-label="Basic input"
          placeholder="Enter bilingual text"
          value={input}
          onChangeText={setInput}
          {...controlState}
          width="100%"
          geometry={geometry}
          errorState={mixed}
          textSize="medium"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={({ nativeEvent: { text } }) => {
            setInput(text)
            setSubmits((value) => value + 1)
            Keyboard.dismiss()
          }}
          customStyles={custom ? { fontSize: 18, borderColor: "#123456" } : undefined}
          style={({ defaultStyle }) => defaultStyle}
        />
      )}
      <View style={styles.controls}>
        {action("Focus basic input", () => inputRef.current?.focus())}
        {action("Dismiss basic keyboard", () => Keyboard.dismiss())}
        {action("Compare core input", () => setCoreComparison((value) => !value))}
      </View>
      <Text testID="basic-control-footer">
        Basic controls use native selection and text events. Keyboard reachability and large text are inspected in the
        local lab; closer visual and physical review accompanies application integration.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({ scene: { gap: 12 }, controls: { flexDirection: "row", flexWrap: "wrap", gap: 10 } })
