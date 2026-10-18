import { useRef, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent, type TextInput } from "react-native"

import { Button, FormField, Input, Text, useNativeTheme } from "@codon-ui/react-native"

const LABELS = ["Email", "Adresse courriel pour recevoir les renseignements demandés", ""] as const
const MESSAGE_MODES = ["none", "all", "empty"] as const
const RIGHT_MODES = ["actions", "zero", "none"] as const
type TFrame = { width: number; height: number }

const FieldHelp = ({ onAction }: { onAction: () => void }) => {
  const [count, setCount] = useState(0)
  return (
    <Button
      onPress={() => {
        setCount((current) => current + 1)
        onAction()
      }}
    >
      Field help, count {count}
    </Button>
  )
}

export const FormFieldScene = () => {
  const [value, setValue] = useState("")
  const [request, setRequest] = useState<string>()
  const [requests, setRequests] = useState(0)
  const [focusEvents, setFocusEvents] = useState(0)
  const [helpActions, setHelpActions] = useState(0)
  const [veto, setVeto] = useState(false)
  const [labelIndex, setLabelIndex] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [rightIndex, setRightIndex] = useState(0)
  const [required, setRequired] = useState(true)
  const [description, setDescription] = useState(true)
  const [raised, setRaised] = useState(false)
  const [custom, setCustom] = useState(false)
  const [zero, setZero] = useState(false)
  const [target, setTarget] = useState(true)
  const [labelRelationship, setLabelRelationship] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [frames, setFrames] = useState<Record<string, TFrame>>({})
  const editor = useRef<TextInput>(null)
  const theme = useNativeTheme()
  const messages = MESSAGE_MODES[messageIndex]
  const right = RIGHT_MODES[rightIndex]
  const label = LABELS[labelIndex]
  const recordFrame =
    (name: string) =>
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const width = Math.round(layout.width * 1000) / 1000
      const height = Math.round(layout.height * 1000) / 1000
      setFrames((current) =>
        current[name]?.width === width && current[name]?.height === height
          ? current
          : { ...current, [name]: { width, height } },
      )
    }
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Form field composition and caller-owned input
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setVeto((current) => !current)}>Toggle field request veto</Button>
        <Button onPress={() => setValue("")}>Clear field owner</Button>
        <Button onPress={() => setLabelIndex((current) => (current + 1) % LABELS.length)}>Next field label</Button>
        <Button onPress={() => setMessageIndex((current) => (current + 1) % MESSAGE_MODES.length)}>
          Next field messages
        </Button>
        <Button onPress={() => setRightIndex((current) => (current + 1) % RIGHT_MODES.length)}>
          Next field right content
        </Button>
        <Button onPress={() => setRequired((current) => !current)}>Toggle field required marker</Button>
        <Button onPress={() => setDescription((current) => !current)}>Toggle field description</Button>
        <Button onPress={() => setRaised((current) => !current)}>Toggle field raised</Button>
        <Button onPress={() => setCustom((current) => !current)}>Toggle field styles</Button>
        <Button onPress={() => setZero((current) => !current)}>Toggle field zero dimensions</Button>
        <Button onPress={() => setTarget((current) => !current)}>Toggle field focus target</Button>
        <Button onPress={() => setLabelRelationship((current) => !current)}>
          Toggle field native label relationship
        </Button>
        <Button onPress={() => setDisabled((current) => !current)}>Toggle field editor disabled</Button>
        <Button onPress={() => setReadOnly((current) => !current)}>Toggle field editor read only</Button>
      </View>
      <FormField
        testID="field-example"
        label={label}
        labelID="field-example-label"
        labelFor={target ? editor : undefined}
        required={required}
        raised={raised}
        description={description ? "Enter an address / indiquez une adresse pour recevoir les renseignements." : ""}
        errorMessages={
          messages === "all" ? ["First error / première erreur", "Second error"] : messages === "empty" ? [] : undefined
        }
        warningMessages={messages === "all" ? ["A warning / un avertissement"] : messages === "empty" ? [] : undefined}
        successMessages={messages === "all" ? ["A success / une confirmation"] : messages === "empty" ? [] : undefined}
        topRightContent={
          right === "actions" ? (
            <FieldHelp onAction={() => setHelpActions((current) => current + 1)} />
          ) : right === "zero" ? (
            0
          ) : undefined
        }
        bottomRightContent={
          right === "actions" ? <Text>Caller-owned details / renseignements</Text> : right === "zero" ? 0 : undefined
        }
        onLayout={recordFrame("root")}
        customStyles={
          custom
            ? {
                padding: 5,
                borderWidth: 1,
                borderColor: theme.colors.controlBorder,
                backgroundColor: theme.colors.controlBackground,
              }
            : undefined
        }
        style={zero ? { width: 0, height: 0, padding: 0, borderWidth: 0 } : undefined}
        customTopRowStyles={custom ? { gap: 8, paddingVertical: 4 } : undefined}
        customLabelStyles={custom ? { fontSize: 16, fontWeight: "bold" } : undefined}
        customTopRightStyles={custom ? { padding: 2 } : undefined}
        customBottomRowStyles={custom ? { gap: 8, padding: 2 } : undefined}
        customBottomRightStyles={custom ? { maxWidth: 100 } : undefined}
        customValidationMessageStyles={custom ? { fontSize: 14, color: theme.colors.foreground, gap: 3 } : undefined}
        customDescriptionStyles={custom ? { fontStyle: "normal", fontSize: 14 } : undefined}
      >
        <Input
          ref={editor}
          testID="field-editor"
          nativeID="field-example-editor"
          accessibilityLabel="Form field editor"
          accessibilityLabelledBy={labelRelationship && label ? "field-example-label" : undefined}
          value={value}
          onChangeText={(next) => {
            setRequest(next)
            setRequests((current) => current + 1)
            if (!veto) setValue(next)
          }}
          onFocus={() => setFocusEvents((current) => current + 1)}
          onLayout={recordFrame("editor")}
          isDisabled={disabled}
          isReadOnly={readOnly}
          width="100%"
        />
      </FormField>
      <Text testID="field-state">
        Owner: {JSON.stringify(value)}. Request: {request === undefined ? "none" : JSON.stringify(request)}. Requests:{" "}
        {requests}. Veto: {String(veto)}. Messages: {messages}. Right: {right}. Label: {labelIndex}. Required:{" "}
        {String(required)}. Description: {String(description)}. Raised: {String(raised)}. Custom: {String(custom)}.
        Zero: {String(zero)}. Focus target: {String(target)}. Native label relationship: {String(labelRelationship)}.
        Disabled: {String(disabled)}. Read only: {String(readOnly)}. Focus events: {focusEvents}. Help actions:{" "}
        {helpActions}.
      </Text>
      <Text testID="field-frames">
        Last native frames:{" "}
        {Object.entries(frames)
          .map(([name, frame]) => `${name} ${frame.width} x ${frame.height}`)
          .join("; ") || "unmeasured"}
        .
      </Text>
      <Text testID="field-content-end">
        The wrapper never submits or changes the editor value. Native label focus, measured layout, viewport
        reachability and spoken output require their own installed evidence.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scene: { gap: 10 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
