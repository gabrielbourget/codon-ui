import { useLayoutEffect, useRef, useState } from "react"
import { Keyboard, ScrollView, TextInput, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import {
  AlertDialog,
  Button,
  Input,
  Modal,
  NativeOverlayProvider,
  NativeThemeProvider,
  Select,
  Text,
  useNativeTheme,
} from "@codon-ui/react-native"

export const TEXT_PHRASE = "Native alert note"
export const FIELD_ORDERS = ["raw-first", "codon-first"] as const
export type TFieldOrder = (typeof FIELD_ORDERS)[number]
export type TScenario = { nested: boolean; correctionsOff: boolean; order: TFieldOrder }
type TTrace = { sequence: number; time: number; kind: string; field?: string; value?: string; detail?: unknown }

export const scenarioName = ({ nested, correctionsOff, order }: TScenario) =>
  `${nested ? "nested" : "standalone"}-${correctionsOff ? "off" : "default"}-${order}`

export const SCENARIOS = [false, true].flatMap((nested) =>
  [false, true].flatMap((correctionsOff) => FIELD_ORDERS.map((order) => ({ nested, correctionsOff, order }))),
)

const PairedFields = ({ scenario }: { scenario: TScenario }) => {
  const theme = useNativeTheme()
  const [raw, setRaw] = useState("")
  const [codon, setCodon] = useState("")
  const [snapshot, setSnapshot] = useState("")
  const rawRef = useRef<TextInput>(null)
  const codonRef = useRef<TextInput>(null)
  const trace = useRef<TTrace[]>([])
  const record = (kind: string, field?: string, value?: string, detail?: unknown) => {
    trace.current.push({ sequence: trace.current.length, time: Date.now(), kind, field, value, detail })
  }
  useLayoutEffect(() => {
    record("owner-commit", "raw", raw)
    record("owner-commit", "codon", codon)
  }, [raw, codon])
  const corrections = scenario.correctionsOff ? { autoCorrect: false, spellCheck: false } : {}
  const fields = scenario.order === "raw-first" ? ["raw", "codon"] : ["codon", "raw"]
  return (
    <View style={{ gap: theme.spacing.unit * 2 }}>
      {fields.map((field) => {
        const props = {
          ...corrections,
          testID: `${field}-note`,
          accessibilityLabel: `${field} controlled note`,
          value: field === "raw" ? raw : codon,
          onChange: (event: Parameters<NonNullable<React.ComponentProps<typeof TextInput>["onChange"]>>[0]) =>
            record("native-change", field, event.nativeEvent.text, { eventCount: event.nativeEvent.eventCount }),
          onChangeText: (value: string) => {
            record("callback", field, value)
            if (field === "raw") setRaw(value)
            else setCodon(value)
          },
          onSelectionChange: (
            event: Parameters<NonNullable<React.ComponentProps<typeof TextInput>["onSelectionChange"]>>[0],
          ) => record("selection", field, undefined, event.nativeEvent.selection),
          onFocus: () => record("focus", field),
          onBlur: () => record("blur", field),
        }
        return (
          <View key={field} style={{ gap: theme.spacing.unit }}>
            {field === "raw" ? (
              <TextInput
                {...props}
                ref={rawRef}
                style={{ minHeight: 44, borderWidth: 1, color: theme.colors.foreground, padding: 8 }}
              />
            ) : (
              <Input {...props} ref={codonRef} />
            )}
            <Text testID={`${field}-owner`}>{`${field} owner: ${field === "raw" ? raw : codon}`}</Text>
          </View>
        )
      })}
      <Button
        onPress={() => {
          record("finish-editing")
          rawRef.current?.blur()
          codonRef.current?.blur()
          Keyboard.dismiss()
        }}
      >
        Finish editing
      </Button>
      <Button
        onPress={() => {
          record("capture", undefined, undefined, { raw, codon, scenario: scenarioName(scenario) })
          setSnapshot(JSON.stringify(trace.current))
        }}
      >
        Capture diagnostic trace
      </Button>
      {snapshot ? (
        <Text testID="diagnostic-events" accessibilityLabel={snapshot} numberOfLines={1}>
          Diagnostic trace ready
        </Text>
      ) : null}
    </View>
  )
}

const OPTIONS = [
  { key: 0, label: "Numeric zero" },
  { key: "0", label: "String zero" },
]

const Scene = ({ toggleTheme }: { toggleTheme: () => void }) => {
  const theme = useNativeTheme()
  const [scenario, setScenario] = useState<TScenario | null>(null)
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [alert, setAlert] = useState(false)
  const [count, setCount] = useState(0)
  const [confirms, setConfirms] = useState(0)
  const [selected, setSelected] = useState<string | number | null>(0)
  const parentRef = useRef<View>(null)
  const alertRef = useRef<View>(null)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        testID="trial-root-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 8 }}
      >
        <Text testID="trial-configuration">{scenario ? scenarioName(scenario) : "Choose diagnostic scenario"}</Text>
        {!scenario ? (
          SCENARIOS.map((entry) => (
            <Button key={scenarioName(entry)} onPress={() => setScenario(entry)}>
              {scenarioName(entry)}
            </Button>
          ))
        ) : scenario.nested ? (
          <>
            <Button ref={parentRef} onPress={() => setParent(true)}>
              Open trial parent
            </Button>
            <Modal
              testID="trial-parent-core"
              accessibilityLabel="Trial parent dialog"
              isOpen={parent}
              onOpenChange={setParent}
              restoreFocusRef={parentRef}
              isScrollable={false}
              customDialogStyles={{ padding: 0 }}
            >
              <ScrollView
                testID="trial-parent"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 16, gap: 8 }}
              >
                <Text testID="parent-state">
                  Confirms: {confirms}; local: {count}; theme: {theme.mode}
                </Text>
                <Button onPress={() => setCount((value) => value + 1)}>Increment local counter</Button>
                <Input testID="local-input" defaultValue="Local draft" accessibilityLabel="Local uncontrolled note" />
                <Button onPress={() => setChild(true)}>Open trial child</Button>
                <Modal
                  testID="trial-child"
                  accessibilityLabel="Trial child dialog"
                  isOpen={child}
                  onOpenChange={setChild}
                >
                  <Button onPress={() => setChild(false)}>Close trial-child</Button>
                </Modal>
                <Button onPress={toggleTheme}>Toggle overlay theme</Button>
                <Text testID="selected-value">
                  Selection: {typeof selected}:{selected}
                </Text>
                <Select
                  testID="baseline-select"
                  accessibilityLabel="Open trial selection"
                  closeLabel="Close trial selection"
                  items={OPTIONS}
                  getKey={(option) => option.key}
                  getTextValue={(option) => option.label}
                  value={selected}
                  onChange={setSelected}
                />
                <Button ref={alertRef} onPress={() => setAlert(true)}>
                  Open trial alert
                </Button>
                <AlertDialog
                  testID="baseline-alert"
                  accessibilityLabel="Trial confirmation"
                  isOpen={alert}
                  onOpenChange={setAlert}
                  restoreFocusRef={alertRef}
                  titleText="Confirm trial change"
                  bodyText="Paired controlled-text diagnostic."
                  confirmAction={() => setConfirms((value) => value + 1)}
                  labels={{
                    cancelActionButtonAriaLabel: "Cancel trial confirmation",
                    confirmActionButtonAriaLabel: "Confirm trial confirmation",
                  }}
                >
                  <PairedFields scenario={scenario} />
                </AlertDialog>
                <Button onPress={() => setParent(false)}>Close trial-parent</Button>
              </ScrollView>
            </Modal>
          </>
        ) : (
          <PairedFields scenario={scenario} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

export const App = () => {
  const [dark, setDark] = useState(false)
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <NativeOverlayProvider>
          <Scene toggleTheme={() => setDark((value) => !value)} />
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
