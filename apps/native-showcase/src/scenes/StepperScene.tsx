import { useCallback, useId, useLayoutEffect, useRef, useState } from "react"
import { View } from "react-native"

import {
  Button,
  NativeForm,
  NativeFormAction,
  Stepper,
  Text,
  useNativeTheme,
  type TNativeFormRequest,
  type TNativeFormResult,
  type TNativeStepperProps,
  type TNativeStepperRef,
} from "@codon-ui/react-native"

const GEOMETRIES = ["round", "rounded", "orthogonal"] as const
const ORDERS = [undefined, "primary", "secondary", "tertiary", "quaternary", "quintenary"] as const
const SIZES = ["medium", "small", "large"] as const
const STATUSES = ["none", "error", "warning", "success"] as const

const DEFAULTS = [undefined, 0, 0.4, null] as const
const STEPS = [0.1, undefined, 0.3] as const
const BOUNDS = ["both", "minimum", "maximum", "none"] as const
const RETIREMENTS = ["none", "disabled", "read-only", "remove"] as const
const INVALID = [undefined, false, true] as const
const VALIDATION_STATES = [undefined, "valid", "invalid"] as const
const FORMATS: readonly { label: string; options?: Intl.NumberFormatOptions }[] = [
  { label: "decimal" },
  { label: "decimal-2", options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
  { label: "currency", options: { style: "currency", currency: "CAD", currencySign: "accounting" } },
  { label: "percent", options: { style: "percent" } },
  { label: "unit", options: { style: "unit", unit: "liter", unitDisplay: "long" } },
  { label: "significant", options: { maximumSignificantDigits: 3, useGrouping: false } },
]
type TStepperKeyEvent = Parameters<NonNullable<TNativeStepperProps["onKeyDown"]>>[0]
type TReceipt = { generation: number; kind: string; data: unknown }
type TTeardownReceipt = {
  owner: string
  unmounted: boolean
  callbacks: (TReceipt & { afterUnmount: boolean })[]
}
// One explicitly armed scene owner survives Reset scene for the G02 teardown observation.
let lastTeardownReceipt: TTeardownReceipt | null = null

export const StepperScene = () => {
  const theme = useNativeTheme()
  const owner = useId()
  const teardownReceipt = useRef<TTeardownReceipt | null>(null)
  const [teardownSnapshot, setTeardownSnapshot] = useState(() => JSON.stringify(lastTeardownReceipt))
  useLayoutEffect(
    () => () => {
      if (teardownReceipt.current) teardownReceipt.current.unmounted = true
    },
    [],
  )
  const ref = useRef<TNativeStepperRef>(null)
  const form = useRef<View>(null)
  const events = useRef(new WeakMap<object, number>())
  const eventSequence = useRef(0)
  const [receipts, setReceipts] = useState<TReceipt[]>([])
  const [refs, setRefs] = useState({ attached: false, attachments: 0, detachments: 0 })
  const bindEditor = useCallback((node: TNativeStepperRef | null) => {
    if (ref.current === node) return
    ref.current = node
    setRefs((current) => ({
      attached: node !== null,
      attachments: current.attachments + (node ? 1 : 0),
      detachments: current.detachments + (node ? 0 : 1),
    }))
  }, [])
  const [generation, setGeneration] = useState(0)
  const [mounted, setMounted] = useState(true)
  const [uncontrolled, setUncontrolled] = useState(false)
  const [defaultIndex, setDefaultIndex] = useState(0)
  const [formatIndex, setFormatIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [boundsIndex, setBoundsIndex] = useState(0)
  const [validateCommit, setValidateCommit] = useState(false)
  const [ariaValidation, setAriaValidation] = useState(false)
  const [required, setRequired] = useState(false)
  const [customValidation, setCustomValidation] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [invalidIndex, setInvalidIndex] = useState(0)
  const [validationStateIndex, setValidationStateIndex] = useState(0)
  const [selectionZero, setSelectionZero] = useState(false)
  const [cancelForm, setCancelForm] = useState(false)
  const [retirementIndex, setRetirementIndex] = useState(0)
  const [formResult, setFormResult] = useState<unknown>(null)
  const [value, setValue] = useState<number | null>(0)
  const [requested, setRequested] = useState<number | null>()
  const [raw, setRaw] = useState("")
  const [requests, setRequests] = useState(0)
  const [veto, setVeto] = useState(false)
  const [cohesive, setCohesive] = useState(false)
  const [vertical, setVertical] = useState(false)
  const [outline, setOutline] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [zero, setZero] = useState(false)
  const [icons, setIcons] = useState(false)
  const [french, setFrench] = useState(false)
  const [geometryIndex, setGeometryIndex] = useState(0)
  const [orderIndex, setOrderIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [frame, setFrame] = useState("unmeasured")
  const record = (kind: string, data: unknown) => {
    const receipt = { generation, kind, data }
    const observation = teardownReceipt.current
    if (observation) observation.callbacks.push({ ...receipt, afterUnmount: observation.unmounted })
    setReceipts((current) => [...current, receipt])
  }
  const recordKey = (source: "root" | "input", phase: "down" | "up", event: TStepperKeyEvent) => {
    let identity = events.current.get(event)
    if (identity === undefined) {
      identity = ++eventSequence.current
      events.current.set(event, identity)
    }
    const native = event.nativeEvent
    record(`${source}:key:${phase}`, {
      identity,
      targetIsEditor: event.target === ref.current,
      currentTargetIsEditor: event.currentTarget === ref.current,
      eventId: native.eventId,
      key: native.key,
      code: native.code,
      repeat: native.repeat,
      cancelled: native.cancelled,
      isComposing: native.isComposing,
      shiftKey: native.shiftKey,
      altKey: native.altKey,
      ctrlKey: native.ctrlKey,
      metaKey: native.metaKey,
      nativeDefaultHandled: native.nativeDefaultHandled,
    })
  }
  const recordForm = (request: TNativeFormRequest) => {
    if (cancelForm) request.preventDefault()
    record(`form:${request.action}`, {
      entries: request.entries,
      origin: request.origin,
      originalForm: request.form === form.current,
      hasSourceEvent: request.sourceEvent !== undefined,
      defaultPrevented: request.defaultPrevented,
    })
  }
  const recordResult = (result: TNativeFormResult) => {
    const data = {
      status: result.status,
      reason: result.reason,
      entries: result.request?.entries,
      origin: result.request?.origin,
      invalidFields: result.invalidFields,
      focus: result.focus,
      requestedFields: result.requestedFields,
    }
    setFormResult(data)
    record("form:result", data)
  }
  const action = (label: string, onPress: () => void) => (
    <Button order="primary" raised={false} accessibilityLabel={label} onPress={onPress}>
      {label}
    </Button>
  )
  const status = STATUSES[statusIndex]
  const bounds = BOUNDS[boundsIndex]
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        Native Stepper
      </Text>
      <Text testID="stepper-state">
        Value: {uncontrolled ? "uncontrolled" : (value ?? "empty")}. Request:{" "}
        {requested === undefined ? "none" : (requested ?? "empty")}. Requests: {requests}. Raw:{" "}
        {raw === "" ? "empty" : raw}. Parent: {veto ? "veto" : "echo"}. Type: {cohesive ? "cohesive" : "segmented"}.
        Orientation: {vertical ? "vertical" : "horizontal"}. Mode: {outline ? "outline" : "fill"}. Order:{" "}
        {ORDERS[orderIndex] ?? "none"}. Geometry: {GEOMETRIES[geometryIndex]}. Size: {SIZES[sizeIndex]}. Guard:{" "}
        {disabled ? "disabled" : readOnly ? "read-only" : "enabled"}. Locale: {french ? "fr-CA" : "en-US"}. Status:{" "}
        {status}.
      </Text>
      <Text testID="stepper-frame">Last native root: {frame}.</Text>
      <NativeForm
        ref={form}
        id="stepper-form"
        fieldOrder={mounted ? ["quantity"] : []}
        validationErrors={serverError ? { quantity: "Server quantity error" } : {}}
        onSubmit={recordForm}
        onReset={recordForm}
      >
        {mounted && (
          <Stepper
            key={generation}
            ref={bindEditor}
            testID="stepper-example"
            accessibilityLabel="Controlled quantity"
            incrementLabel="Increase controlled quantity"
            decrementLabel="Decrease controlled quantity"
            value={uncontrolled ? undefined : value}
            defaultValue={DEFAULTS[defaultIndex]}
            minValue={bounds === "both" || bounds === "minimum" ? -1 : undefined}
            maxValue={bounds === "both" || bounds === "maximum" ? 1 : undefined}
            step={STEPS[stepIndex]}
            formatOptions={FORMATS[formatIndex].options}
            commitBehavior={validateCommit ? "validate" : "snap"}
            name="quantity"
            formFieldId="quantity"
            isRequired={required}
            isInvalid={INVALID[invalidIndex]}
            validationState={VALIDATION_STATES[validationStateIndex]}
            validate={
              customValidation
                ? (next) => (next !== null && next < 0 ? "Quantity must be nonnegative" : true)
                : undefined
            }
            validationBehavior={ariaValidation ? "aria" : "native"}
            locale={french ? "fr-CA" : "en-US"}
            onKeyDown={(event) => recordKey("root", "down", event)}
            onKeyUp={(event) => recordKey("root", "up", event)}
            inputProps={{
              selection: selectionZero ? { start: 0, end: 0 } : undefined,
              onKeyDown: (event) => recordKey("input", "down", event),
              onKeyUp: (event) => recordKey("input", "up", event),
              onChange: ({ nativeEvent }) =>
                record("native:change", {
                  text: nativeEvent.text,
                  eventCount: nativeEvent.eventCount,
                  target: nativeEvent.target,
                }),
              onSelectionChange: ({ nativeEvent }) => record("native:selection", nativeEvent.selection),
              onFocus: () => record("native:focus", null),
              onBlur: () => record("native:blur", null),
              onSubmitEditing: ({ nativeEvent }) => record("native:submit", nativeEvent.text),
              onEndEditing: ({ nativeEvent }) => record("native:end", nativeEvent.text),
            }}
            onChangeText={(text) => {
              record("raw", text)
              setRaw(text)
            }}
            onChange={(next) => {
              record("request", next)
              setRequested(next)
              setRequests((count) => count + 1)
              if (!uncontrolled && !veto) setValue(next)
              if (RETIREMENTS[retirementIndex] === "disabled") setDisabled(true)
              if (RETIREMENTS[retirementIndex] === "read-only") setReadOnly(true)
              if (RETIREMENTS[retirementIndex] === "remove") setMounted(false)
              setRetirementIndex(0)
            }}
            type={cohesive ? "cohesive" : "segmented"}
            orientation={vertical ? "vertical" : "horizontal"}
            colorMode={outline ? "outline" : "fill"}
            order={ORDERS[orderIndex]}
            geometry={GEOMETRIES[geometryIndex]}
            textSize={SIZES[sizeIndex]}
            isDisabled={disabled}
            isReadOnly={readOnly}
            errorState={status === "error"}
            warningState={status === "warning"}
            successState={status === "success"}
            width={zero ? 0 : "100%"}
            labels={{ inputButtonGroupAriaLabel: french ? "Commandes de quantité" : "Quantity controls" }}
            PlusIcon={icons ? <Text>+</Text> : undefined}
            MinusIcon={icons ? <Text>−</Text> : undefined}
            customStyles={custom ? { borderWidth: 2, borderColor: theme.colors.focusRing, padding: 8 } : undefined}
            customGroupStyles={custom ? { gap: 12, backgroundColor: theme.colors.controlBackground } : undefined}
            customInputStyles={
              custom ? { fontSize: 18, maxWidth: 80, color: theme.actions.secondary.border } : undefined
            }
            customButtonStyles={
              custom ? { width: 44, height: 44, padding: 0, paddingHorizontal: 0, borderRadius: 5 } : undefined
            }
            style={({ defaultStyle, isReadOnly }) => ({
              ...defaultStyle,
              opacity: isReadOnly ? 0.8 : defaultStyle.opacity,
            })}
            onLayout={({ nativeEvent: { layout } }) => {
              const next = `${Number(layout.width.toFixed(3))} x ${Number(layout.height.toFixed(3))}`
              setFrame((current) => (current === next ? current : next))
            }}
          />
        )}
        <NativeFormAction action="submit" onActionResult={recordResult}>
          Submit stepper form
        </NativeFormAction>
        <NativeFormAction action="reset" onActionResult={recordResult}>
          Reset stepper form
        </NativeFormAction>
      </NativeForm>
      <Text>
        Caller-owned decimal quantity, bounded from−1 to1. A short release requests one step. Hold to repeat; the
        separate request count also exposes repeated owner veto. Callback receipts observe delivery; installed input,
        keyboard and Form outcomes require native qualification.
      </Text>
      {action("Toggle stepper owner veto", () => setVeto((current) => !current))}
      {action("Set stepper zero", () => setValue(0))}
      {action("Set stepper empty", () => setValue(null))}
      {action("Set stepper maximum", () => setValue(1))}
      {action("Set stepper minimum", () => setValue(-1))}
      {action("Toggle stepper type", () => setCohesive((current) => !current))}
      {action("Toggle stepper orientation", () => setVertical((current) => !current))}
      {action("Toggle stepper color mode", () => setOutline((current) => !current))}
      {action("Next stepper order", () => setOrderIndex((index) => (index + 1) % ORDERS.length))}
      {action("Next stepper geometry", () => setGeometryIndex((index) => (index + 1) % GEOMETRIES.length))}
      {action("Next stepper text size", () => setSizeIndex((index) => (index + 1) % SIZES.length))}
      {action("Next stepper status", () => setStatusIndex((index) => (index + 1) % STATUSES.length))}
      {action("Toggle stepper disabled", () => setDisabled((current) => !current))}
      {action("Toggle stepper read-only", () => setReadOnly((current) => !current))}
      {action("Toggle stepper styles", () => setCustom((current) => !current))}
      {action("Toggle stepper zero width", () => setZero((current) => !current))}
      {action("Toggle stepper icons", () => setIcons((current) => !current))}
      {action("Toggle stepper locale", () => setFrench((current) => !current))}
      {action("Focus stepper editor", () => ref.current?.focus())}
      {action("Toggle stepper controlled mode and remount", () => {
        setUncontrolled((current) => !current)
        setGeneration((current) => current + 1)
      })}
      {action("Next stepper default", () => setDefaultIndex((index) => (index + 1) % DEFAULTS.length))}
      {action("Next stepper numeric format", () => setFormatIndex((index) => (index + 1) % FORMATS.length))}
      {action("Next stepper numeric step", () => setStepIndex((index) => (index + 1) % STEPS.length))}
      {action("Next stepper bounds", () => setBoundsIndex((index) => (index + 1) % BOUNDS.length))}
      {action("Toggle stepper commit validation", () => setValidateCommit((current) => !current))}
      {action("Toggle stepper aria validation", () => setAriaValidation((current) => !current))}
      {action("Toggle stepper required", () => setRequired((current) => !current))}
      {action("Toggle stepper custom validation", () => setCustomValidation((current) => !current))}
      {action("Toggle stepper server error", () => setServerError((current) => !current))}
      {action("Next stepper explicit invalid", () => setInvalidIndex((index) => (index + 1) % INVALID.length))}
      {action("Next stepper validation state", () =>
        setValidationStateIndex((index) => (index + 1) % VALIDATION_STATES.length),
      )}
      {action("Toggle stepper zero selection", () => setSelectionZero((current) => !current))}
      {action("Toggle stepper Form cancellation", () => setCancelForm((current) => !current))}
      {action("Next stepper retirement on request", () =>
        setRetirementIndex((index) => (index + 1) % RETIREMENTS.length),
      )}
      {action("Remove or reinsert stepper editor", () => {
        setMounted((current) => !current)
        if (!mounted) setGeneration((current) => current + 1)
      })}
      {action("Remount stepper editor", () => setGeneration((current) => current + 1))}
      {action("Arm stepper scene teardown observation", () => {
        const observation: TTeardownReceipt = { owner, unmounted: false, callbacks: [] }
        teardownReceipt.current = observation
        lastTeardownReceipt = observation
        setTeardownSnapshot(JSON.stringify(observation))
      })}
      {action("Read stepper scene teardown observation", () =>
        setTeardownSnapshot(JSON.stringify(lastTeardownReceipt)),
      )}
      <Text>Arm before Reset scene, then reenter and read without arming again.</Text>
      <Text testID="stepper-teardown">{teardownSnapshot}</Text>
      <Text testID="stepper-config">
        {JSON.stringify({
          generation,
          mounted,
          ownership: uncontrolled ? "uncontrolled" : "controlled",
          defaultValue: DEFAULTS[defaultIndex] === undefined ? "undefined" : DEFAULTS[defaultIndex],
          format: FORMATS[formatIndex].label,
          step: STEPS[stepIndex] ?? "undefined",
          bounds,
          commit: validateCommit ? "validate" : "snap",
          validation: ariaValidation ? "aria" : "native",
          required,
          customValidation,
          serverError,
          isInvalid: INVALID[invalidIndex] ?? "undefined",
          validationState: VALIDATION_STATES[validationStateIndex] ?? "undefined",
          selection: selectionZero ? { start: 0, end: 0 } : "undefined",
          cancelForm,
          retireOnRequest: RETIREMENTS[retirementIndex],
        })}
      </Text>
      <Text testID="stepper-presentation">
        {JSON.stringify({ styles: custom ? "custom" : "default", icons: icons ? "custom" : "default" })}
      </Text>
      <Text testID="stepper-refs">{JSON.stringify(refs)}</Text>
      <Text testID="stepper-callbacks">{JSON.stringify(receipts)}</Text>
      <Text testID="stepper-form-result">{JSON.stringify(formResult)}</Text>
      <Text testID="stepper-content-end">
        Fin des contrôles de quantité — gardez cette dernière action et les messages accessibles lorsque le texte
        système ou la fenêtre change.
      </Text>
    </View>
  )
}
