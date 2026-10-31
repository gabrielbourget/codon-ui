import { existsSync, readFileSync, writeFileSync } from "node:fs"
import process from "node:process"

const [input, output] = process.argv.slice(2)
if (!input || !output || existsSync(output)) throw new Error("Usage: make-typing-diagnostic.mjs APP NEW_OUTPUT")
let source = readFileSync(input, "utf8")
const replaceOnce = (before, after) => {
  if (source.split(before).length !== 2) throw new Error(`Ambiguous diagnostic insertion: ${before}`)
  source = source.replace(before, after)
}
replaceOnce("useContext,", "useContext, useEffect,")
replaceOnce("ScrollView,", "ScrollView, TextInput,")
replaceOnce(
  "const TrialAlert =",
  `type TDiagnosticEvent = Readonly<{ field: string; kind: string; text: string; eventCount?: number }>
const DiagnosticCommit = ({ value, report }: { value: string; report: (value: string) => void }) => {
  useEffect(() => { report(value) }, [value, report])
  return null
}

const TrialAlert =`,
)
replaceOnce(
  '  const [note, setNote] = useState("")',
  `  const [note, setNote] = useState("")
  const [rawNote, setRawNote] = useState("")
  const events = useRef<TDiagnosticEvent[]>([])
  const [snapshot, setSnapshot] = useState("")
  useEffect(() => { events.current.push({ field: "codon", kind: "owner", text: note }) }, [note])
  useEffect(() => { events.current.push({ field: "raw", kind: "owner", text: rawNote }) }, [rawNote])`,
)
replaceOnce(
  "onChangeText={setNote}",
  `onChange={(event) => events.current.push({ field: "codon", kind: "native", text: event.nativeEvent.text, eventCount: event.nativeEvent.eventCount })}
                  onFocus={() => events.current.push({ field: "codon", kind: "focus", text: note })}
                  onBlur={() => events.current.push({ field: "codon", kind: "blur", text: note })}
                  onChangeText={(next) => { events.current.push({ field: "codon", kind: "callback", text: next }); setNote(next) }}`,
)
replaceOnce(
  '<Text testID="alert-note-state">Controlled note: {note}</Text>',
  `<Text testID="alert-note-state">Controlled note: {note}</Text>
                <DiagnosticCommit value={note} report={(text) => events.current.push({ field: "codon", kind: "host", text })} />
                <TextInput testID="raw-alert-note" accessibilityLabel="Raw controlled diagnostic note" value={rawNote}
                  style={{ minHeight: 44, color: theme.colors.controlForeground, backgroundColor: theme.colors.controlBackground, padding: theme.spacing.unit, borderWidth: 1, borderColor: theme.colors.controlBorder }}
                  onChange={(event) => events.current.push({ field: "raw", kind: "native", text: event.nativeEvent.text, eventCount: event.nativeEvent.eventCount })}
                  onFocus={() => events.current.push({ field: "raw", kind: "focus", text: rawNote })}
                  onBlur={() => events.current.push({ field: "raw", kind: "blur", text: rawNote })}
                  onChangeText={(next) => { events.current.push({ field: "raw", kind: "callback", text: next }); setRawNote(next) }} />
                <Text testID="raw-alert-note-state">Raw note: {rawNote}</Text>
                <DiagnosticCommit value={rawNote} report={(text) => events.current.push({ field: "raw", kind: "host", text })} />
                <Button accessibilityLabel="Capture diagnostic trace" onPress={() => setSnapshot(JSON.stringify(events.current))}>Capture diagnostic trace</Button>
                <Text testID="diagnostic-events" accessibilityLabel={snapshot}>Event trace</Text>`,
)
writeFileSync(output, source)
