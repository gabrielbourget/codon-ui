import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
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
  type TNativeSelectKey,
} from "@codon-ui/react-native"

export const SCENARIOS = [
  "ownership",
  "programmatic",
  "collections",
  "tail",
  "empty",
  "custom",
  "removal",
  "nested",
  "uncontrolled",
] as const
type TScenario = (typeof SCENARIOS)[number]
type TChoice = { key: TNativeSelectKey; label: string }
const SHORT: TChoice[] = [
  { key: 0, label: "Numeric zero" },
  { key: "0", label: "String zero" },
  { key: "blocked", label: "Unavailable choice" },
]
const LONG: TChoice[] = Array.from({ length: 200 }, (_, index) => ({
  key: `choice-${index}`,
  label: `Choice ${index + 1}${index % 11 === 0 ? " — sélectionnez les paramètres et continuez lorsque vous êtes prêt." : ""}`,
}))
const FormContext = createContext("missing-context")
const keyLabel = (value: TNativeSelectKey | null) => (value === null ? "null" : `${typeof value}:${value}`)
type TObservation = { kind: string; value: string; theme?: string }

const ContextWitness = ({ report }: { report: (event: TObservation) => void }) => {
  const value = useContext(FormContext)
  const theme = useNativeTheme()
  useLayoutEffect(() => {
    report({ kind: "context", value, theme: theme.mode })
  }, [value, theme.mode, report])
  return <Text>{`Context: ${value}; ${theme.mode}`}</Text>
}

const Scene = ({
  scenario,
  updateContext,
  reset,
}: {
  scenario: TScenario
  updateContext: () => void
  reset: () => void
}) => {
  const theme = useNativeTheme()
  const nested = scenario === "nested" || scenario === "removal"
  const veto = scenario === "ownership" || scenario === "nested"
  const [value, setValue] = useState<TNativeSelectKey | null>(scenario === "tail" ? "choice-198" : 0)
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState({ opens: 0, closes: 0, values: 0 })
  const budgets = useRef({
    opens: veto ? 2 : 0,
    closes: veto || scenario === "programmatic" ? 2 : 0,
    values: veto ? 2 : 0,
  })
  const observations = useRef<TObservation[]>([])
  const report = useCallback((event: TObservation) => {
    observations.current.push(event)
  }, [])
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [renamed, setRenamed] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [ownerVisible, setOwnerVisible] = useState(true)
  const [removeParent, setRemoveParent] = useState(false)
  const [defaultSeed, setDefaultSeed] = useState<TNativeSelectKey>(0)
  const [parent, setParent] = useState(false)
  const [alert, setAlert] = useState(false)
  const [counter, setCounter] = useState(0)
  const [draft, setDraft] = useState("Draft")
  const [note, setNote] = useState("Alert draft")
  const [confirms, setConfirms] = useState(0)
  const parentTrigger = useRef<View>(null)
  const alertTrigger = useRef<View>(null)
  let items = scenario === "tail" ? LONG : scenario === "empty" ? [] : SHORT
  if (renamed) items = items.map((item) => (item.key === 0 ? { ...item, label: "Renamed zero" } : item))
  if (removed) items = items.filter((item) => item.key !== value)
  if (reversed) items = [...items].reverse()
  const requestOpen = (next: boolean) => {
    const field = next ? "opens" : "closes"
    report({ kind: "open-request", value: String(next) })
    setRequests((current) => ({ ...current, [field]: current[field] + 1 }))
    if (budgets.current[field] > 0) {
      budgets.current[field]--
      return
    }
    setOpen(next)
  }
  const requestValue = (next: TNativeSelectKey | null) => {
    report({ kind: "value-request", value: keyLabel(next) })
    setRequests((current) => ({ ...current, values: current.values + 1 }))
    if (scenario === "nested" && budgets.current.values === 2) updateContext()
    if (budgets.current.values > 0) {
      budgets.current.values--
      return
    }
    setValue(next)
    if (scenario === "programmatic") setOpen(false)
    if (scenario === "removal") {
      setOwnerVisible(false)
      setOpen(false)
      if (removeParent) setParent(false)
    }
  }
  const latestContext = observations.current.filter((event) => event.kind === "context").at(-1)
  const action = (label: string, onPress: () => void) => (
    <Button raised={false} onPress={onPress}>
      {label}
    </Button>
  )
  const panel = (
    <View style={{ gap: 8 }}>
      {nested && (
        <Input testID="parent-draft" accessibilityLabel="Parent draft" value={draft} onChangeText={setDraft} />
      )}
      {ownerVisible ? (
        <Select
          testID="lab-select"
          accessibilityLabel="Choose"
          closeLabel="Close choices"
          placeholder="Choose a value"
          items={items}
          getKey={(item) => item.key}
          getTextValue={(item) => item.label}
          {...(scenario === "uncontrolled"
            ? { defaultValue: defaultSeed, defaultOpen: true }
            : { value, isOpen: open })}
          onChange={requestValue}
          onOpenChange={requestOpen}
          disabledKeys={["blocked"]}
          isDisabled={disabled}
          isReadOnly={readOnly}
          width="100%"
          geometry={scenario === "custom" ? "orthogonal" : "rounded"}
          customSelectedItemStyles={
            scenario === "custom" ? { borderColor: theme.colors.focusRing, paddingHorizontal: 10 } : undefined
          }
          customSelectedItemTextStyles={scenario === "custom" ? { fontWeight: "700" } : undefined}
          renderSelectedValue={
            scenario === "custom"
              ? ({ selectedText, isPlaceholder }) => <>Picked {isPlaceholder ? "none" : selectedText}</>
              : undefined
          }
          renderItem={
            scenario === "nested" || scenario === "custom"
              ? (item) => (
                  <View>
                    <Text>{item.label}</Text>
                    <ContextWitness report={report} />
                  </View>
                )
              : undefined
          }
          style={({ defaultStyle }) => defaultStyle}
        />
      ) : (
        <Text testID="owner-removed">Select owner removed</Text>
      )}
      <Text testID="owner-state">{`Value ${keyLabel(value)}; open ${open}; requests ${requests.opens}/${requests.closes}/${requests.values}; confirms ${confirms}; local ${counter}`}</Text>
      <Text testID="context-state">{`Witness ${latestContext?.value ?? "none"}; ${latestContext?.theme ?? "none"}; theme ${theme.mode}`}</Text>
      {scenario === "ownership" && action("Clear controlled value", () => setValue(null))}
      {scenario === "programmatic" && action("Open programmatically", () => setOpen(true))}
      {scenario === "collections" && (
        <>
          {action("Relabel selected", () => setRenamed(true))}
          {action("Remove selected", () => setRemoved(true))}
          {action("Restore and reorder", () => {
            setRemoved(false)
            setReversed(true)
          })}
          {action("Toggle disabled", () => setDisabled((current) => !current))}
          {action("Toggle read-only", () => setReadOnly((current) => !current))}
        </>
      )}
      {scenario === "uncontrolled" && action("Change defaults", () => setDefaultSeed("blocked"))}
      {nested && (
        <>
          {action("Parent action", () => setCounter((current) => current + 1))}
          {scenario === "removal" && action("Remove parent on value", () => setRemoveParent(true))}
          {scenario === "nested" && (
            <>
              <Button ref={alertTrigger} onPress={() => setAlert(true)}>
                Open confirmation
              </Button>
              <AlertDialog
                testID="lab-alert"
                accessibilityLabel="Confirmation"
                titleText="Confirm change"
                bodyText="Commit this selection."
                isOpen={alert}
                onOpenChange={setAlert}
                restoreFocusRef={alertTrigger}
                confirmAction={() => {
                  report({ kind: "confirm", value: note })
                  setConfirms((current) => current + 1)
                }}
                labels={{
                  confirmActionButtonAriaLabel: "Confirm selection",
                  cancelActionButtonAriaLabel: "Cancel confirmation",
                }}
              >
                <Input testID="alert-note" accessibilityLabel="Confirmation note" value={note} onChangeText={setNote} />
                <Text testID="alert-note-owner">{note}</Text>
              </AlertDialog>
            </>
          )}
          {action("Close parent", () => setParent(false))}
        </>
      )}
    </View>
  )
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView testID="lab-root" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text testID="lab-configuration">{`Scenario ${scenario}; theme ${theme.mode}`}</Text>
        {nested ? (
          <>
            <Text testID="root-state">{`Parent ${parent}; owner ${ownerVisible}; value ${keyLabel(value)}`}</Text>
            <Button ref={parentTrigger} onPress={() => setParent(true)}>
              Open parent
            </Button>
            <Modal
              testID="lab-parent-core"
              accessibilityLabel="Parent dialog"
              isOpen={parent}
              onOpenChange={setParent}
              restoreFocusRef={parentTrigger}
              isScrollable={false}
              customDialogStyles={{ padding: 0 }}
            >
              <ScrollView
                testID="lab-parent"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ padding: 16, gap: 8 }}
              >
                {panel}
              </ScrollView>
            </Modal>
          </>
        ) : (
          panel
        )}
        {action("Reset fixture", reset)}
      </ScrollView>
    </SafeAreaView>
  )
}

export const App = () => {
  const [scenario, setScenario] = useState<TScenario | null>(null)
  const [dark, setDark] = useState(false)
  const [form, setForm] = useState("caller-form")
  const content = scenario ? (
    <FormContext.Provider value={form}>
      <Scene
        scenario={scenario}
        updateContext={() => {
          setForm("updated-form")
          setDark(true)
        }}
        reset={() => {
          setScenario(null)
          setDark(false)
          setForm("caller-form")
        }}
      />
    </FormContext.Provider>
  ) : (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView testID="lab-root" contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text testID="lab-configuration">Select acceptance fixture</Text>
        {SCENARIOS.map((name) => (
          <Button key={name} testID={`case-${name}`} onPress={() => setScenario(name)}>{`Case ${name}`}</Button>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        {scenario === "nested" || scenario === "removal" ? (
          <NativeOverlayProvider>{content}</NativeOverlayProvider>
        ) : (
          content
        )}
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
