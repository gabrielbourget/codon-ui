import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { useRef, useState, type ComponentProps, type Ref } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import {
  Button,
  DateTimePicker,
  DateTimeRangePicker,
  Input,
  NativeFloatingLayerHost,
  NativeFocusView,
  NativeForm,
  NativeFormAction,
  NativeLocaleProvider,
  NativeThemeProvider,
  Text,
  type TNativeDateTimePickerValue,
  type TNativeFormRequest,
} from "../../../.."

const values = [
  new CalendarDate(2024, 11, 1),
  new CalendarDateTime(2024, 11, 1, 13, 45, 7),
  parseZonedDateTime("2024-11-01T13:45:07[America/New_York]"),
]
const locales = ["en-US", "ar-EG", "ja-JP-u-ca-japanese"] as const
const interval = (start: TNativeDateTimePickerValue) => ({
  start,
  end: "hour" in start ? start.add({ days: 3, hours: 4, minutes: 5 }) : start.add({ days: 3 }),
})

export const DatePickerFixture = ({ hostRef, inputRef }: { hostRef?: Ref<View>; inputRef?: Ref<TextInput> }) => {
  const [value, setValue] = useState<TNativeDateTimePickerValue | null>(values[0]),
    [range, setRange] = useState<{ start: TNativeDateTimePickerValue; end: TNativeDateTimePickerValue } | null>(() =>
      interval(values[0]),
    )
  const [sample, setSample] = useState(0),
    [locale, setLocale] = useState(0),
    [veto, setVeto] = useState(false),
    [readOnly, setReadOnly] = useState(false),
    [disabled, setDisabled] = useState(false),
    [dark, setDark] = useState(false),
    [large, setLarge] = useState(false),
    [custom, setCustom] = useState(false),
    [nonContiguous, setNonContiguous] = useState(false),
    [months, setMonths] = useState(false),
    [firstMonday, setMonday] = useState(false)
  const [events, setEvents] = useState<string[]>([]),
    [formData, setFormData] = useState("")
  const single = useRef<View>(null),
    pair = useRef<View>(null)
  const record = (text: string) => setEvents((current) => [...current.slice(-7), text])
  const submit = (request: TNativeFormRequest) => setFormData(JSON.stringify(request.entries))
  const renderRoot = (props: ComponentProps<typeof NativeFocusView>) => (
    <NativeFocusView {...props} style={[props.style, { opacity: custom ? 0.85 : 1 }]} />
  )
  return (
    <NativeThemeProvider
      mode={dark ? "dark" : "light"}
      overrides={large ? { typography: { fontSizes: { b9: 22, b10: 20, b11: 18 } } } : undefined}
    >
      <NativeLocaleProvider locale={locales[locale]}>
        <NativeFloatingLayerHost ref={hostRef} testID="date-fixture-host">
          <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
            <Text elementType="h1">Date picker source family</Text>
            <Text>
              Owner-held date classes, independent range times, calendar/zone entry, range dragging and original native
              form groups. Installed and profile qualification remains open.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              <Button
                onPress={() => {
                  const next = (sample + 1) % values.length
                  setSample(next)
                  setValue(values[next])
                  setRange(interval(values[next]))
                }}
              >
                Next date class
              </Button>
              <Button onPress={() => setLocale((current) => (current + 1) % locales.length)}>
                Next date locale/calendar
              </Button>
              <Button onPress={() => setVeto((current) => !current)}>Toggle date owner veto</Button>
              <Button onPress={() => setReadOnly((current) => !current)}>Toggle date read only</Button>
              <Button onPress={() => setDisabled((current) => !current)}>Toggle date disabled</Button>
              <Button onPress={() => setDark((current) => !current)}>Toggle date theme</Button>
              <Button onPress={() => setLarge((current) => !current)}>Toggle date large text fixture</Button>
              <Button onPress={() => setCustom((current) => !current)}>Toggle date root renderer</Button>
              <Button onPress={() => setNonContiguous((current) => !current)}>Toggle noncontiguous ranges</Button>
              <Button onPress={() => setMonths((current) => !current)}>Toggle date month count</Button>
              <Button onPress={() => setMonday((current) => !current)}>Toggle Monday first</Button>
              <Button
                onPress={() => {
                  setValue(null)
                  setRange(null)
                }}
              >
                Clear date owners
              </Button>
            </View>
            <Text testID="date-fixture-state">
              Class {["CalendarDate", "CalendarDateTime", "ZonedDateTime"][sample]}. Locale {locales[locale]}. Veto{" "}
              {String(veto)}. Read only {String(readOnly)}. Disabled {String(disabled)}. Date{" "}
              {value?.toString() ?? "null"}. Range{" "}
              {range ? `${range.start.toString()} / ${range.end.toString()}` : "null"}.
            </Text>
            <NativeForm onSubmit={submit}>
              <DateTimePicker
                ref={single}
                accessibilityLabel="Single date"
                name="date"
                value={value}
                granularity={sample === 0 ? "day" : "second"}
                placeholderValue={values[sample]}
                isReadOnly={readOnly}
                isDisabled={disabled}
                isRequired
                multiMonth={!months}
                firstDayOfWeek={firstMonday ? "mon" : undefined}
                isDateUnavailable={(date) => date.day === 12}
                render={custom ? renderRoot : undefined}
                onChange={(next) => {
                  record(`single:${next?.toString() ?? "null"}`)
                  if (!veto) setValue(next)
                }}
              />
              <DateTimeRangePicker
                ref={pair}
                accessibilityLabel="Date interval"
                startName="endpoint"
                endName="endpoint"
                value={range}
                granularity={sample === 0 ? "day" : "second"}
                placeholderValue={values[sample]}
                isReadOnly={readOnly}
                isDisabled={disabled}
                isRequired
                multiMonth={months}
                firstDayOfWeek={firstMonday ? "mon" : undefined}
                allowsNonContiguousRanges={nonContiguous}
                isDateUnavailable={(date) => date.day === 12}
                render={custom ? renderRoot : undefined}
                onChange={(next) => {
                  record(`range:${next ? `${next.start.toString()}/${next.end.toString()}` : "null"}`)
                  if (!veto) setRange(next)
                }}
              />
              <NativeFormAction action="submit">Submit date form</NativeFormAction>
              <NativeFormAction action="reset">Reset date form</NativeFormAction>
            </NativeForm>
            <Input
              ref={inputRef}
              accessibilityLabel="Held empty date-scene editor"
              value=""
              selection={{ start: 0, end: 0 }}
            />
            <Text testID="date-fixture-form">{formData || "No original native form action yet"}</Text>
            <Text testID="date-fixture-events">{events.join("\n")}</Text>
          </ScrollView>
        </NativeFloatingLayerHost>
      </NativeLocaleProvider>
    </NativeThemeProvider>
  )
}
