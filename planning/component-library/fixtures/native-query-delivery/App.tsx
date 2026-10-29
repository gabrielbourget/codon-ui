import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  findNodeHandle,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import {
  Button,
  ComboBox,
  Input,
  ListBoxItem,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type TNativeComboBoxKey,
} from "@codon-ui/react-native"

export const CASES = ["raw", "input", "combo"] as const
export type TCase = (typeof CASES)[number]
type TChoice = { key: string; label: string }
type TEvent = { sequence: number; time: number; kind: string; text?: string; detail?: unknown }
const CallerContext = createContext("missing-context")
const Witness = ({ report }: { report: (context: string, mode: string) => void }) => {
  const context = useContext(CallerContext)
  const { mode } = useNativeTheme()
  useLayoutEffect(() => report(context, mode), [context, mode, report])
  return <Text>{`${context}; ${mode}`}</Text>
}

const CaseOwner = ({ kind }: { kind: TCase }) => {
  const theme = useNativeTheme()
  const [query, setQuery] = useState("")
  const [callback, setCallback] = useState("")
  const [committed, setCommitted] = useState("")
  const [native, setNative] = useState({ text: "", count: 0 })
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [value, setValue] = useState<TNativeComboBoxKey | null>(0)
  const [requests, setRequests] = useState({ query: 0, selection: 0, opens: 0, closes: 0 })
  const [results, setResults] = useState<TChoice[]>([])
  const [generation, setGeneration] = useState(0)
  const [witness, setWitness] = useState({ context: "none", mode: "none" })
  const [snapshot, setSnapshot] = useState("")
  const events = useRef<TEvent[]>([])
  const heartbeats = useRef<number[]>([])
  const identities = useRef(new WeakMap<TextInput, number>())
  const nextIdentity = useRef(1)
  const nativeIdentity = useRef<{ instance: number; tag: number | null }>({ instance: 0, tag: null })
  const record = useCallback((event: string, text?: string, detail?: unknown) => {
    events.current.push({ sequence: events.current.length, time: Date.now(), kind: event, text, detail })
  }, [])
  const inputRef = useCallback(
    (node: TextInput | null) => {
      if (!node) {
        record("ref-detach", undefined, nativeIdentity.current)
        return
      }
      let instance = identities.current.get(node)
      if (instance === undefined) {
        instance = nextIdentity.current++
        identities.current.set(node, instance)
      }
      nativeIdentity.current = { instance, tag: findNodeHandle(node) }
      record("ref-attach", undefined, nativeIdentity.current)
    },
    [record],
  )
  useEffect(() => {
    // The heartbeat never schedules a render or changes any controlled value.
    const timer = setInterval(() => heartbeats.current.push(Date.now()), 100)
    return () => clearInterval(timer)
  }, [])
  useLayoutEffect(() => {
    record("owner-commit", query)
    setCommitted(query)
  }, [query, record])
  useEffect(() => {
    record("results-request", query)
    setResults([])
    const timer = setTimeout(() => {
      record("results-replace", query, nativeIdentity.current)
      setResults([
        { key: "remote", label: query ? `Result for ${query}` : "Initial remote result" },
        { key: "second", label: "Second remote result" },
      ])
      setGeneration((old) => old + 1)
    }, 120)
    return () => clearTimeout(timer)
  }, [query, record])
  const report = useCallback(
    (context: string, mode: string) =>
      setWitness((old) => (old.context === context && old.mode === mode ? old : { context, mode })),
    [],
  )
  const change = (text: string) => {
    record("callback", text)
    setCallback(text)
    setRequests((old) => ({ ...old, query: old.query + 1 }))
    setQuery(text)
  }
  const requestOpen = (next: boolean) => {
    record(next ? "open-request" : "close-request")
    setRequests((old) => ({ ...old, [next ? "opens" : "closes"]: old[next ? "opens" : "closes"] + 1 }))
    setOpen(next)
  }
  const observers: Pick<TextInputProps, "onChange" | "onFocus" | "onBlur" | "onSelectionChange" | "onEndEditing"> = {
    onChange: ({ nativeEvent }) => {
      record("native-change", nativeEvent.text, { eventCount: nativeEvent.eventCount, ...nativeIdentity.current })
      setNative({ text: nativeEvent.text, count: nativeEvent.eventCount })
    },
    onFocus: () => {
      record("focus", undefined, nativeIdentity.current)
      setFocused(true)
    },
    onBlur: () => {
      record("blur", undefined, nativeIdentity.current)
      setFocused(false)
    },
    onSelectionChange: ({ nativeEvent }) => record("selection-range", undefined, nativeEvent.selection),
    onEndEditing: ({ nativeEvent }) => record("end-editing", nativeEvent.text),
  }
  const observeKey: TextInputProps["onKeyPress"] = ({ nativeEvent }) => record("key", nativeEvent.key)
  const observation = {
    kind,
    query,
    callback,
    committed,
    native,
    focused,
    open,
    value,
    requests,
    witness,
    generation,
    input: nativeIdentity.current,
    keyObservation: kind === "combo" ? "not-exposed-by-public-API" : "native-onKeyPress",
  }
  const status = { key: "status", label: `OBS ${JSON.stringify(observation)}` }
  const items = [status, ...results]
  const renderItem = (item: TChoice) => (
    <View>
      <Text>{item.key === "status" ? `Committed query: ${committed || "empty"}` : item.label}</Text>
      <Witness report={report} />
    </View>
  )
  const groupStyle = {
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    borderRadius: theme.radius.rounded,
    backgroundColor: theme.colors.controlBackground,
    ...(focused ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 1.5 } : {}),
  }
  const inputStyle: TextStyle = {
    minWidth: Platform.OS === "ios" ? 44 : 48,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    padding: theme.spacing.unit,
    color: theme.colors.controlForeground,
    fontFamily: theme.typography.fontFamilies.body,
    fontWeight: theme.typography.fontWeights.regular,
    fontSize: theme.typography.fontSizes.b10,
    lineHeight: theme.typography.lineHeight,
    borderRadius: theme.radius.rounded,
    borderWidth: 0,
    backgroundColor: "transparent",
  }
  const fieldProps = {
    ...observers,
    ref: inputRef,
    testID: "diag-field-input",
    accessibilityLabel: "Search choices",
    value: query,
    onChangeText: change,
    placeholder: "Search a choice",
  }
  return (
    <>
      {kind === "combo" ? (
        <ComboBox
          testID="diag-field"
          accessibilityLabel="Choose"
          inputLabel="Search choices"
          closeLabel="Close choices"
          placeholder="Search a choice"
          items={items}
          getKey={(item) => item.key}
          getTextValue={(item) => item.label}
          renderItem={renderItem}
          disabledKeys={["status"]}
          value={value}
          inputValue={query}
          isOpen={open}
          onInputChange={change}
          onOpenChange={requestOpen}
          onChange={(key) => {
            record("selection-request", String(key))
            setRequests((old) => ({ ...old, selection: old.selection + 1 }))
            setValue(key)
          }}
          inputRef={inputRef}
          inputProps={observers}
        />
      ) : (
        <>
          <Button testID="diag-field-trigger" accessibilityLabel="Choose" onPress={() => requestOpen(true)}>
            {query || "Search a choice"}
          </Button>
          <Modal
            visible={open}
            transparent={false}
            animationType="none"
            presentationStyle="fullScreen"
            allowSwipeDismissal={false}
            onRequestClose={() => requestOpen(false)}
            supportedOrientations={["portrait", "portrait-upside-down", "landscape-left", "landscape-right"]}
          >
            {open && (
              <SafeAreaProvider style={{ flex: 1 }}>
                <SafeAreaView
                  testID="diag-field-modal"
                  accessibilityViewIsModal
                  onAccessibilityEscape={() => requestOpen(false)}
                  style={{ flex: 1, backgroundColor: theme.colors.background }}
                >
                  <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: theme.spacing.unit * 2,
                        padding: theme.spacing.unit * 2,
                      }}
                    >
                      <View style={[{ flexGrow: 1, flexBasis: 160 }, groupStyle]}>
                        {kind === "raw" ? (
                          <TextInput
                            {...fieldProps}
                            onKeyPress={observeKey}
                            multiline={false}
                            editable
                            readOnly={false}
                            focusable
                            placeholderTextColor={theme.colors.controlPlaceholder}
                            underlineColorAndroid="transparent"
                            style={inputStyle}
                          />
                        ) : (
                          <Input
                            {...fieldProps}
                            onKeyPress={observeKey}
                            enableFocusStyle={false}
                            customStyles={{ borderWidth: 0, backgroundColor: "transparent" }}
                          />
                        )}
                      </View>
                      <Button
                        testID="diag-field-close"
                        accessibilityLabel="Close choices"
                        onPress={() => requestOpen(false)}
                        raised={false}
                      >
                        Close choices
                      </Button>
                    </View>
                    <FlatList
                      testID="diag-field-list"
                      data={items}
                      keyExtractor={(item) => `string:${item.key}`}
                      extraData={{ committed, witness }}
                      keyboardShouldPersistTaps="handled"
                      keyboardDismissMode="on-drag"
                      initialNumToRender={12}
                      maxToRenderPerBatch={16}
                      windowSize={5}
                      removeClippedSubviews={false}
                      style={{ flex: 1, backgroundColor: theme.colors.background }}
                      contentContainerStyle={{ padding: theme.spacing.unit * 2 }}
                      ItemSeparatorComponent={<View style={{ height: theme.spacing.unit }} />}
                      renderItem={({ item }) => (
                        <ListBoxItem
                          id={item.key}
                          textValue={item.label}
                          isSelected={false}
                          isDisabled={item.key === "status"}
                          testID={`diag-field-option-string:${item.key}`}
                        >
                          {renderItem(item)}
                        </ListBoxItem>
                      )}
                    />
                  </KeyboardAvoidingView>
                </SafeAreaView>
              </SafeAreaProvider>
            )}
          </Modal>
        </>
      )}
      <Text
        testID="diag-owner"
        accessibilityLabel={`OBS ${JSON.stringify(observation)}`}
      >{`Owner query: ${query || "empty"}`}</Text>
      <Button
        testID="diag-export"
        onPress={() => {
          record("export", query, { observation })
          setSnapshot(
            JSON.stringify({
              kind,
              observation,
              events: [...events.current],
              heartbeats: [...heartbeats.current],
              exportedAt: Date.now(),
            }),
          )
        }}
        raised={false}
      >
        Export diagnostic trace
      </Button>
      {snapshot && (
        <Text testID="diag-trace-json" accessibilityLabel={`TRACE ${snapshot}`}>
          Diagnostic trace exported
        </Text>
      )}
    </>
  )
}

export const App = () => {
  const [kind, setKind] = useState<TCase | null>(null)
  const [transport, setTransport] = useState(0)
  const [mode, setMode] = useState<"light" | "dark">("light")
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={mode}>
        <CallerContext.Provider value="caller-form">
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              testID="diag-root"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 8 }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button onPress={() => setMode((current) => (current === "light" ? "dark" : "light"))}>
                  Toggle diagnostic theme
                </Button>
                <Button
                  onPress={() => {
                    setKind(null)
                    setMode("light")
                    setTransport(0)
                  }}
                >
                  Reset query diagnostic
                </Button>
              </View>
              <Text testID="diag-theme">{mode}</Text>
              <Text testID="diag-configuration">{kind ? `Case ${kind}` : "Query delivery diagnostic"}</Text>
              {kind ? (
                <CaseOwner key={kind} kind={kind} />
              ) : (
                <>
                  <Button testID="diag-transport-action" onPress={() => setTransport((old) => old + 1)} raised={false}>
                    Transport action
                  </Button>
                  <Text testID="diag-transport-owner">{`Transport ${transport}`}</Text>
                  {CASES.map((name) => (
                    <Button key={name} testID={`case-${name}`} onPress={() => setKind(name)}>{`Case ${name}`}</Button>
                  ))}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </CallerContext.Provider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
