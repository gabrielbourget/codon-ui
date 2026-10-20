import { requireNativeModule } from "expo"
import { useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { findNodeHandle, PixelRatio, TextInput, View } from "react-native"
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context"

import {
  Button,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  Toaster,
} from "../../../../packages/react-native/src"
import {
  useNativeKeyboardObservation,
  useNativeKeyScope,
} from "../../../../packages/react-native/src/input/NativeKeyboardScope"
import type { TNativeObservedKeyboardEvent } from "../../../../packages/react-native/src/input/keyboardObservation"

export const PROBE = "codon-native-toaster-observation-v1"
export const LIBRARY_PRODUCER = "c2e4fded89f666f2b4097fa7a82f545487841f72"
type TFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (uri: string, value: string, options: { encoding: "utf8" }) => Promise<void>
}
type TRecord = Record<string, unknown>
type TJournal = { append: (record: TRecord) => void; flush: () => Promise<string> }
const createJournal = (): TJournal => {
  const lines: string[] = []
  let closed = false
  return {
    append: (record) => {
      if (closed) return
      const line = `CUI_TOASTER_OBSERVATION ${JSON.stringify({ probe: PROBE, sequence: lines.length + 1, observedAt: Date.now(), ...record })}`
      lines.push(line)
      console.warn(line)
    },
    flush: async () => {
      closed = true
      const fs = requireNativeModule<TFileSystem>("ExponentFileSystem")
      if (!fs.cacheDirectory?.startsWith("file://")) throw new Error("Native cache directory is unavailable")
      const path = `${fs.cacheDirectory.replace(/\/?$/, "/")}${PROBE}.jsonl`
      await fs.writeAsStringAsync(path, lines.join("\n") + "\n", { encoding: "utf8" })
      return path
    },
  }
}

const Observer = ({
  name,
  record,
  packetToken,
  retire,
}: {
  name: string
  record: (value: TRecord) => void
  packetToken: (event: object) => number
  retire?: () => void
}) => {
  const scope = useNativeKeyScope()
  useNativeKeyboardObservation({
    isEnabled: true,
    lifetimeKey: name,
    canAct: () => scope?.isWindowActive() !== false,
    onKeyDown: (event: TNativeObservedKeyboardEvent) => {
      record({
        kind: "observed-key",
        observer: name,
        packetToken: packetToken(event),
        actual: { ...event.nativeEvent },
      })
      if (event.nativeEvent.code === "KeyE") retire?.()
    },
  })
  return null
}

const Cases = () => {
  const [journal] = useState(createJournal),
    [value, setValue] = useState("")
  const [showA, setShowA] = useState(true),
    [finished, setFinished] = useState(false),
    [persisted, setPersisted] = useState("collecting")
  const editor = useRef<TextInput>(null),
    live = useRef(true),
    stopped = useRef(false),
    retiredA = useRef(false)
  const currentValue = useRef(value)
  useInsertionEffect(() => {
    currentValue.current = value
  }, [value])
  const scope = useNativeKeyScope()
  const packets = useRef(new WeakMap<object, number>()),
    packetSequence = useRef(0)
  const packetToken = (event: object) => {
    let token = packets.current.get(event)
    if (token === undefined) {
      token = ++packetSequence.current
      packets.current.set(event, token)
    }
    return token
  }
  const record = useCallback((record: TRecord) => journal.append(record), [journal])
  const persist = useCallback(() => {
    journal.flush().then(
      () => {
        if (live.current) setPersisted("persisted")
      },
      (error: unknown) => {
        console.warn(`CUI_TOASTER_OBSERVATION_PERSIST ${JSON.stringify({ probe: PROBE, error: String(error) })}`)
        if (live.current) setPersisted("logcat-only")
      },
    )
  }, [journal])
  useEffect(() => {
    record({
      kind: "begin",
      libraryProducer: LIBRARY_PRODUCER,
      fontScale: PixelRatio.getFontScale(),
      pixelRatio: PixelRatio.get(),
      nativeInput: "external Android input; callbacks are never invoked by this fixture",
    })
    const snapshot = () =>
      record({
        kind: "scope",
        ready: scope?.isNativeReady(),
        active: scope?.isWindowActive(),
        session: scope?.acknowledgedSession(),
        editorTag: findNodeHandle(editor.current),
      })
    snapshot()
    const release = scope?.subscribe(snapshot)
    const deadline = setTimeout(() => {
      if (stopped.current) return
      stopped.current = true
      record({ kind: "failure", reason: "native-input-deadline", ownerValue: currentValue.current })
      setFinished(true)
      persist()
    }, 600_000)
    return () => {
      clearTimeout(deadline)
      release?.()
      live.current = false
    }
  }, [persist, record, scope])
  useLayoutEffect(() => {
    record({ kind: "owner-commit", value, editorTag: findNodeHandle(editor.current) })
  }, [record, value])
  useEffect(() => {
    record({ kind: "observer-A-commit", mounted: showA })
  }, [record, showA])
  const retire = () => {
    if (retiredA.current) return
    retiredA.current = true
    record({ kind: "observer-A-retirement-request" })
    setShowA(false)
  }
  return (
    <View style={{ flex: 1, padding: 20, gap: 15 }}>
      <Text elementType="h1">Native Toaster key observation</Text>
      <Text>Real key packets and native editor callbacks. No input/value/focus repairs.</Text>
      <Button
        accessibilityLabel="Finish Toaster observation"
        onPress={(event) => {
          if (stopped.current) return
          record({ kind: "finish-action", actual: { ...event.nativeEvent } })
          stopped.current = true
          record({ kind: "complete", ownerValue: currentValue.current, session: scope?.acknowledgedSession() })
          setFinished(true)
          persist()
        }}
      >
        Finish observation
      </Button>
      <TextInput
        ref={editor}
        testID="toaster-observation-editor"
        accessibilityLabel="Toaster native observation editor"
        autoCorrect={false}
        autoCapitalize="none"
        value={value}
        onChange={(event) => {
          record({ kind: "editor-change", actual: { ...event.nativeEvent }, ownerBefore: currentValue.current })
          setValue(event.nativeEvent.text)
        }}
        onFocus={(event) =>
          record({ kind: "editor-focus", actual: { ...event.nativeEvent }, editorTag: findNodeHandle(editor.current) })
        }
        onBlur={(event) =>
          record({ kind: "editor-blur", actual: { ...event.nativeEvent }, editorTag: findNodeHandle(editor.current) })
        }
        onSelectionChange={(event) => record({ kind: "editor-selection", actual: { ...event.nativeEvent } })}
        style={{ minHeight: 60, borderWidth: 1, padding: 10 }}
      />
      <Text testID="toaster-observation-owner">Owner: {JSON.stringify(value)}</Text>
      <Text>
        A mounted: {String(showA)}. Receipt: {persisted}.
      </Text>
      {!finished ? (
        <>
          {showA ? <Observer name="A" record={record} packetToken={packetToken} retire={retire} /> : null}
          <Observer name="B" record={record} packetToken={packetToken} />
          <Toaster accessibilityLabel="First actual Toaster observer" />
          <Toaster accessibilityLabel="Second actual Toaster observer" />
        </>
      ) : null}
    </View>
  )
}

export default () => (
  <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost testID="toaster-observation-host">
          <Cases />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  </SafeAreaProvider>
)
