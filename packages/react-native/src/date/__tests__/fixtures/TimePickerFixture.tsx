import { Time } from "@internationalized/date"
import { useCallback, useEffect, useState, type Ref } from "react"
import type { View } from "react-native"
import { Pressable, Text } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import {
  TimePicker,
  NativeThemeProvider,
  NativeLocaleProvider,
  NativeOverlayProvider,
  NativeFloatingLayerHost,
  type TNativeTimePickerValue,
} from "../../../index"

export const TimePickerFixture = ({
  rootRef,
  response,
}: {
  rootRef?: Ref<View>
  response?: Promise<TNativeTimePickerValue | null>
}) => {
  const [value, setValue] = useState<TNativeTimePickerValue | null>(() => new Time(13, 45, 7))
  const [requests, setRequests] = useState<string[]>([])
  const [echo, setEcho] = useState(false)
  const [dark, setDark] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [large, setLarge] = useState(false)
  useEffect(() => {
    let live = true
    void response?.then((next) => {
      if (live) setValue(next)
    })
    return () => {
      live = false
    }
  }, [response])
  const change = useCallback(
    (next: TNativeTimePickerValue | null) => {
      setRequests((current) => [...current, next?.toString() ?? "null"])
      if (echo) setValue(next)
    },
    [echo],
  )
  const controls = [
    { label: "Toggle time echo", run: () => setEcho((current) => !current) },
    { label: "Toggle time theme", run: () => setDark((current) => !current) },
    { label: "Toggle time read only", run: () => setReadOnly((current) => !current) },
    { label: "Toggle time disabled", run: () => setDisabled((current) => !current) },
    { label: "Toggle time large fixture", run: () => setLarge((current) => !current) },
    {
      label: "Reset time scene",
      run: () => {
        setValue(new Time(13, 45, 7))
        setRequests([])
        setEcho(false)
        setDark(false)
        setReadOnly(false)
        setDisabled(false)
        setLarge(false)
      },
    },
  ]
  return (
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <NativeLocaleProvider locale="en-GB">
          <NativeOverlayProvider>
            <NativeFloatingLayerHost testID="temporal-host">
              <Text testID="temporal-time-owner">
                {JSON.stringify({ value: value?.toString() ?? null, requests, echo, dark, readOnly, disabled, large })}
              </Text>
              {controls.map(({ label, run }) => (
                <Pressable key={label} role="button" accessibilityLabel={label} onPress={run}>
                  <Text>{label}</Text>
                </Pressable>
              ))}
              <TimePicker
                ref={rootRef}
                testID="temporal-time"
                aria-label="Source time"
                value={value}
                onChange={change}
                granularity="second"
                hourCycle={24}
                textSize={large ? "large" : "medium"}
                isReadOnly={readOnly}
                isDisabled={disabled}
              />
            </NativeFloatingLayerHost>
          </NativeOverlayProvider>
        </NativeLocaleProvider>
      </NativeThemeProvider>
    </SafeAreaInsetsContext.Provider>
  )
}
