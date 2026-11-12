import { useState } from "react"
import { View } from "react-native"

import { DateTimePicker, DateTimeRangePicker, Text, TimePicker } from "@codon-ui/react-native"

export const TemporalScene = () => {
  const [time, setTime] = useState("empty")
  const [date, setDate] = useState("empty")
  const [range, setRange] = useState("empty")
  const [timeFocused, setTimeFocused] = useState(false)
  const [dateFocused, setDateFocused] = useState(false)
  const [rangeFocused, setRangeFocused] = useState(false)

  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Time and date
      </Text>
      <TimePicker
        testID="temporal-time"
        accessibilityLabel="Appointment time"
        onChange={(value) => setTime(value?.toString() ?? "empty")}
        onFocusChange={setTimeFocused}
      />
      <Text testID="temporal-time-state">
        Time: {time}. Focus within: {String(timeFocused)}.
      </Text>
      <DateTimePicker
        testID="temporal-date"
        accessibilityLabel="Appointment date"
        labels={{ inputButtonGroupAriaLabel: "Appointment date", triggerButtonAriaLabel: "Choose date" }}
        onChange={(value) => setDate(value?.toString() ?? "empty")}
        onFocusChange={setDateFocused}
      />
      <Text testID="temporal-date-state">
        Date: {date}. Focus within: {String(dateFocused)}.
      </Text>
      <DateTimeRangePicker
        testID="temporal-range"
        accessibilityLabel="Visit date range"
        labels={{ inputButtonGroupAriaLabel: "Visit date range", triggerButtonAriaLabel: "Choose range" }}
        onChange={(value) => setRange(value ? `${value.start.toString()} → ${value.end.toString()}` : "empty")}
        onFocusChange={setRangeFocused}
      />
      <Text testID="temporal-range-state">
        Range: {range}. Focus within: {String(rangeFocused)}.
      </Text>
    </View>
  )
}
