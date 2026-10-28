import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PropsWithChildren,
  type RefAttributes,
} from "react"
import { Text as NativeText, TextInput, View, type NativeSyntheticEvent, type ViewProps } from "react-native"

import { Button, DefaultNativeBackdropAdapter, Text, type TNativeBackdropAdapter } from "../../../.."

export type THardwareCaptureState = Readonly<{
  target: number
  engineSequence: number
  hardwareReady: boolean
  registered: boolean
  captures: number
  cancellations: number
  held: number
  staleDeliveries: number
  failure: string
}>
export type THardwareTargetProps = ViewProps &
  RefAttributes<View> & {
    captureMode: number
    providerVersion: number
    deliverVersion: number
    inspectVersion: number
    onCaptureState: (event: NativeSyntheticEvent<THardwareCaptureState>) => void
  }

// Private fixture factory. The production adapter's Effect and its public Target/Effect contract are unchanged.
export const createHardwareCaptureFixture = (NativeTarget: ComponentType<THardwareTargetProps>) => {
  type TControls = {
    mode: number
    providerVersion: number
    deliverVersion: number
    inspectVersion: number
    states: Readonly<Record<number, THardwareCaptureState>>
    setMode: (value: number) => void
    replace: () => void
    deliver: () => void
    inspect: () => void
    observe: THardwareTargetProps["onCaptureState"]
  }
  const Context = createContext<TControls | null>(null)
  const useControls = () => {
    const controls = useContext(Context)
    if (!controls) throw new Error("Hardware capture fixture requires its Provider")
    return controls
  }
  const Provider = ({ children }: PropsWithChildren) => {
    const [mode, setMode] = useState(0)
    const [providerVersion, setProviderVersion] = useState(0)
    const [deliverVersion, setDeliverVersion] = useState(0)
    const [inspectVersion, setInspectVersion] = useState(0)
    const [states, setStates] = useState<Record<number, THardwareCaptureState>>({})
    const observe = useCallback<THardwareTargetProps["onCaptureState"]>((event) => {
      const state = { ...event.nativeEvent }
      setStates((previous) => ({ ...previous, [state.target]: state }))
    }, [])
    const controls = useMemo<TControls>(
      () => ({
        mode,
        providerVersion,
        deliverVersion,
        inspectVersion,
        states,
        setMode,
        replace: () => setProviderVersion((previous) => previous + 1),
        deliver: () => setDeliverVersion((previous) => previous + 1),
        inspect: () => setInspectVersion((previous) => previous + 1),
        observe,
      }),
      [mode, providerVersion, deliverVersion, inspectVersion, states, observe],
    )
    return <Context.Provider value={controls}>{children}</Context.Provider>
  }
  const Controls = ({ name }: { name: string }) => {
    const controls = useControls()
    const editor = useRef<TextInput>(null)
    const [expanded, setExpanded] = useState(false)
    const [left, setLeft] = useState(false)
    return (
      <View
        testID={`${name}-capture-controls`}
        style={{
          position: "absolute",
          bottom: 0,
          ...(left ? { left: 0 } : { right: 0 }),
          width: 220,
          backgroundColor: "white",
          padding: 4,
        }}
      >
        <Text>Hardware capture mode: {controls.mode}</Text>
        <NativeText numberOfLines={2} testID={`${name}-capture-state`}>
          {JSON.stringify(controls.states)}
        </NativeText>
        <TextInput ref={editor} accessibilityLabel="Capture held editor" value="" onChangeText={() => {}} />
        <Button onPress={() => setExpanded((previous) => !previous)}>Toggle capture controls</Button>
        <Button onPress={() => setLeft((previous) => !previous)}>Move capture controls</Button>
        {expanded && (
          <>
            <Button onPress={() => controls.setMode(0)}>Use complete capture</Button>
            <Button onPress={controls.replace}>Replace capture provider</Button>
            <Button onPress={() => controls.setMode(3)}>Hold capture completion</Button>
            <Button onPress={controls.deliver}>Deliver held capture</Button>
            <Button onPress={controls.inspect}>Inspect native capture</Button>
            <Button onPress={() => controls.setMode(1)}>Remove capture registration</Button>
            <Button onPress={() => controls.setMode(2)}>Return incomplete capture</Button>
          </>
        )}
      </View>
    )
  }
  const Target = forwardRef<View, ViewProps>((props, ref) => {
    const controls = useControls()
    return (
      <NativeTarget
        {...props}
        ref={ref}
        captureMode={controls.mode}
        providerVersion={controls.providerVersion}
        deliverVersion={controls.deliverVersion}
        inspectVersion={controls.inspectVersion}
        onCaptureState={controls.observe}
      >
        {props.children}
        <Controls name={props.testID ?? "hardware-target"} />
      </NativeTarget>
    )
  })
  Target.displayName = "HardwareCaptureFixtureTarget"
  const adapter: TNativeBackdropAdapter = { Target, Effect: DefaultNativeBackdropAdapter.Effect }
  return { Provider, adapter }
}
