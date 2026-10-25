import {
  useCallback,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react"
import type { View } from "react-native"
import { findNodeHandle, Text } from "react-native"

import { NATIVE_DEFAULT_SLOT } from "../../collection/context"
import { Button } from "../../components/Button/Button"
import { NativeButtonContext } from "../../components/Button/context"
import { NativeFloatingSurface } from "../../components/ClickPopover/ClickPopover"
import { resolveNativeStyle } from "../../components/colors"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import type { TNativeTextRef } from "../../components/Text/types"
import { nativeDatePickerData } from "../../form/datePicker"
import type { TNativeDateInputGroup, TNativeDateInputSlot } from "../../form/dateSegments"
import { useNativeFieldSemanticRef, useNativeFieldSemantics } from "../../form/useFieldSemantics"
import { useNativeSegmentedFieldForm, type TOriginalDateField } from "../../form/useSegmentedField"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFieldInputContext, nativeFieldGroupKeyHandler } from "../../input/fieldInput"
import type { TNativeFieldInputPlan } from "../../input/fieldInputBinding"
import { getNativeFocusedTarget } from "../../input/focus"
import { NativeFocusHost, NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeFieldGroupPress } from "../../input/useFieldGroupPress"
import { useNativeFieldInputBinding } from "../../input/useFieldInputBinding"
import { useNativeTheme } from "../../theme"
import { NativeDateCalendar } from "../calendar/NativeDateCalendar"
import { getNativeDatePickerDescription, getNativeDateInputLabel } from "../entry/semantics"
import {
  NativeTimeFieldErrorContext,
  NativeTimeFieldGroupContext,
  NativeTimeFieldLabelContext,
  NativeTimeFieldTextContext,
} from "../field/descendants"
import { NativeDateFieldFocusManager } from "../field/focus"
import { isNativeDateFieldFocusEvent } from "../field/focusEvent"
import { NativeDateFieldHostSet } from "../field/hostSet"
import { useNativeDateFieldLifecycle } from "../field/useLifecycle"
import type { DateFieldState } from "../state/useDateFieldState"
import type { DatePickerState } from "../state/useDatePickerState"
import type { DateRangePickerState } from "../state/useDateRangePickerState"

import { getNativeDatePickerAppearance, resolveNativeDatePickerLabels } from "./appearance"
import { NativeDatePickerCalendarIcon } from "./icons"
import { useNativeDatePickerMotion } from "./motion"
import { NativeDateInputContext, NativePickerInput, type TNativePickerInputProps } from "./NativePickerInput"
import type { TNativeDatePickerAppearance, TNativeDateTimePickerProps, TNativeDateTimeRangePickerProps } from "./types"

type TOptions =
  | { range: false; props: TNativeDateTimePickerProps; state: DatePickerState }
  | { range: true; props: TNativeDateTimeRangePickerProps; state: DateRangePickerState }
type TFields = readonly Readonly<{ slot: TNativeDateInputSlot; state: DateFieldState }>[]
let nextRevision = 0
const omitted = new Set([
  "value",
  "defaultValue",
  "onChange",
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "validate",
  "validationBehavior",
  "validationErrors",
  "minValue",
  "maxValue",
  "isDateUnavailable",
  "hourCycle",
  "granularity",
  "hideTimeZone",
  "shouldForceLeadingZeros",
  "placeholderValue",
  "autoFocus",
  "name",
  "startName",
  "endName",
  "form",
  "autoComplete",
  "id",
  "slot",
  "children",
  "render",
  "style",
  "data-testid",
  "height",
  "width",
  "textSize",
  "geometry",
  "enableFocusStyle",
  "offsetFocusRing",
  "errorState",
  "warningState",
  "successState",
  "ComponentIcon",
  "labels",
  "customStyles",
  "customInputStyles",
  "customButtonStyles",
  "customInputButtonGroupStyles",
  "customDialogStyles",
  "customPopoverStyles",
  "customCalendarStyles",
  "customCalendarHeaderStyles",
  "customCalendarPrevBtnStyles",
  "customCalendarNextBtnStyles",
  "customCalendarGridStyles",
  "customCalendarGridHeaderStyles",
  "customCalendarGridHeaderCellStyles",
  "customCalendarGridBodyStyles",
  "customCalendarGridBodyCellStyles",
  "isOpen",
  "defaultOpen",
  "onOpenChange",
  "placement",
  "multiMonth",
  "dayLength",
  "pageBehavior",
  "firstDayOfWeek",
  "allowsNonContiguousRanges",
  "onFocus",
  "onBlur",
  "onKeyDown",
  "onKeyUp",
  "onFocusChange",
  "ariaDescribedBy",
  "ariaDetails",
  "nativeAccessibilityLabels",
])

export const NativeDatePickerView = (
  options: TOptions & {
    appearanceProps: TNativeDatePickerAppearance
    fields: TFields
    forwardedRef: Ref<View>
    locale: string
    direction: "ltr" | "rtl"
    validationBehavior: "native" | "aria"
  },
) => {
  const { props, state, range, fields, locale, direction } = options
  const keyScope = useNativeKeyScope()
  useSyncExternalStore(keyScope?.subscribe ?? (() => () => {}), keyScope?.snapshot ?? (() => 0), () => 0)
  const [observedOrigin, setObservedOrigin] = useState("unknown")
  const theme = useNativeTheme(),
    content = useNativeContentContext(),
    ownerId = useId()
  const [hosts] = useState(() => fields.map((field) => new NativeDateFieldHostSet(field.slot)))
  const subscribe = useCallback(
    (listener: () => void) => {
      const releases = hosts.map((host) => host.subscribe(listener))
      return () => releases.forEach((release) => release())
    },
    [hosts],
  )
  const snapshot = useCallback(() => hosts.map((host) => host.version()).join(":"), [hosts])
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const outer = useRef<View | null>(null),
    input = useRef<View | null>(null),
    trigger = useRef<View | null>(null),
    calendarFocus = useRef<View | null>(null)
  const restoreFocus = useRef<ReturnType<typeof getNativeFocusedTarget>>(null),
    previousOpen = useRef(false)
  useInsertionEffect(() => {
    if (state.isOpen && !previousOpen.current && !calendarFocus.current) restoreFocus.current = getNativeFocusedTarget()
    previousOpen.current = state.isOpen
  })
  const [outerTarget, setOuterTarget] = useState(0),
    [inputTarget, setInputTarget] = useState(0)
  const bindOuter = useCallback((target: View | null) => {
    outer.current = target
    setOuterTarget(target ? (findNodeHandle(target) ?? 0) : 0)
  }, [])
  const bindInput = useCallback((target: View | null) => {
    input.current = target
    setInputTarget(target ? (findNodeHandle(target) ?? 0) : 0)
  }, [])
  const [focused, setFocused] = useState(false),
    observedFocus = useRef(false)
  const latest = useRef({ fields, state, props })
  useInsertionEffect(() => {
    latest.current = { fields, state, props }
  })
  const currentOriginal = useCallback((): TOriginalDateField | null => {
    if (!outer.current) return null
    const actualOuterTarget = findNodeHandle(outer.current) ?? 0
    if (!actualOuterTarget) return null
    const values = hosts.map((host, index) => host.snapshot(latest.current.fields[index].state.segments))
    if (values.some((value) => !value)) return null
    const groups: TNativeDateInputGroup[] = values.map((value, index) => ({
      slot: latest.current.fields[index].slot,
      target: value!.rootTarget,
      segmentIds: value!.rows.map((row) => row.identity.segmentId),
    }))
    return {
      root: outer.current,
      rootTarget: actualOuterTarget,
      groups,
      segments: values.flatMap((value) => value!.rows),
    }
  }, [hosts])
  const original = currentOriginal(),
    originalSignature = JSON.stringify(original?.groups) + JSON.stringify(original?.segments.map((row) => row.identity))
  const revision = useMemo(
    () => `${ownerId}:date-group:${++nextRevision}`,
    [
      ownerId,
      originalSignature,
      locale,
      props.isDisabled,
      props.isReadOnly,
      props.onKeyDown,
      props.onKeyUp,
      props.render,
    ],
  )
  const inputPlan = useMemo<TNativeFieldInputPlan | null>(
    () =>
      outer.current && input.current && outerTarget && inputTarget && original
        ? {
            bindingId: ownerId,
            bindingRevision: revision,
            outer: outer.current,
            outerTarget,
            input: input.current,
            inputTarget,
            originalTarget: original.segments[0].identity.target,
          }
        : null,
    [ownerId, revision, outerTarget, inputTarget, originalSignature],
  )
  const binding = useNativeFieldInputBinding(inputPlan)
  const receiveGroupKey = binding.scope
    ? nativeFieldGroupKeyHandler(binding.scope, {
        direction,
        onContainedKeyDown: (event) => {
          const key = event.nativeEvent
          if (key.altKey && (key.key === "ArrowDown" || key.key === "ArrowUp")) {
            event.preventDefault()
            event.stopPropagation()
            state.setOpen(true)
          }
        },
        onKeyDown: (event) => {
          if (!state.isOpen) props.onKeyDown?.(event)
        },
        onKeyUp: (event) => {
          if (!state.isOpen) props.onKeyUp?.(event)
        },
      })
    : undefined
  const receiveInputKey = binding.scope ? nativeFieldGroupKeyHandler(binding.scope, { direction }) : undefined
  const press = useNativeFieldGroupPress({ scope: binding.scope })
  const [focus] = useState(
    () =>
      new NativeDateFieldFocusManager(() => {
        const current = currentOriginal()
        return current
          ? {
              root: current.root,
              rootTarget: current.rootTarget,
              rows: current.segments.map((row) => ({
                ...row,
                isPlaceholder: latest.current.fields.some((field, index) =>
                  field.state.segments.some(
                    (segment, segmentIndex) =>
                      hosts[index].segmentId(segment, segmentIndex) === row.identity.segmentId && segment.isPlaceholder,
                  ),
                ),
              })),
            }
          : null
      }),
  )
  useInsertionEffect(() => () => focus.retire(), [focus])
  const autoFocus = useRef(!!props.autoFocus)
  useLayoutEffect(() => {
    if (autoFocus.current && !props.isDisabled && original && focus.focusFirst()) autoFocus.current = false
  })
  const lifecycle = useNativeDateFieldLifecycle(
    {
      value: state.value,
      isDisabled: !!props.isDisabled,
      confirmPlaceholder: () => latest.current.fields.forEach((field) => field.state.confirmPlaceholder()),
      commitValidation: state.commitValidation,
    },
    {
      onFocus: (event) => {
        if (isNativeDateFieldFocusEvent(event)) props.onFocus?.(event)
      },
      onBlur: (event) => {
        if (isNativeDateFieldFocusEvent(event)) props.onBlur?.(event)
      },
      onFocusChange: props.onFocusChange,
    },
    isNativeDateFieldFocusEvent,
  )
  const [label, labelRef] = useNativeFieldSemanticRef<TNativeTextRef>(),
    [description, descriptionRef] = useNativeFieldSemanticRef<TNativeTextRef>(),
    [error, errorRef] = useNativeFieldSemanticRef<TNativeTextRef>(),
    [selected, selectedRef] = useNativeFieldSemanticRef<TNativeTextRef>()
  const primary = useRef<View | null>(null),
    absent = useRef<View | null>(null)
  useInsertionEffect(() => {
    primary.current = original?.segments[0].original ?? null
  })
  const selectedDescription = getNativeDatePickerDescription(state.formatValue(locale, { month: "long" }), locale)
  const labelId = `${ownerId}:label`,
    descriptionId = `${ownerId}:description`,
    errorId = `${ownerId}:error`,
    selectedId = `${ownerId}:selected-date`
  const firstEditableIndex = fields[0].state.segments.findIndex((segment) => segment.isEditable)
  const firstEditable = fields[0].state.segments[firstEditableIndex]
  const firstEditableId = firstEditable ? hosts[0].segmentId(firstEditable, firstEditableIndex) : ""
  const firstEditableTarget = original?.segments.find((row) => row.identity.segmentId === firstEditableId)?.identity
    .target
  const semanticFrame = useNativeFieldSemantics({
    ids: {
      input: `${ownerId}:input`,
      label: labelId,
      description: descriptionId,
      errorMessage: errorId,
      value: selectedId,
      list: `${ownerId}:list`,
    },
    refs: { input: primary, label, description, errorMessage: error, value: selected, list: absent },
    labelledBy: nativeAccessibilityIDs(props.accessibilityLabelledBy ?? props["aria-labelledby"]),
    describedBy: [
      ...(selected.current ? [selectedId] : []),
      ...(nativeAccessibilityIDs(props["aria-describedby"] ?? props.ariaDescribedBy) ?? []),
    ],
    flags: {
      disabled: !!props.isDisabled,
      readOnly: !!props.isReadOnly,
      required: !!props.isRequired,
      invalid: state.isInvalid,
      expanded: state.isOpen,
    },
    labels: props.nativeAccessibilityLabels,
    activeDescendant: null,
    dateField: firstEditableTarget ? { firstEditableTarget } : undefined,
  })
  const metadata = useNativeSegmentedFieldForm(
    props,
    nativeDatePickerData({ ...props, validationBehavior: options.validationBehavior }, state),
    state,
    () => {
      if (options.range) options.state.setValue(options.state.defaultValue)
      else options.state.setValue(options.state.defaultValue)
    },
    original,
    currentOriginal,
    () => observedFocus.current,
    firstEditableTarget ? semanticFrame : "",
    binding.metadata,
  )
  const flags = {
    isFocusWithin: focused,
    isFocusVisible: focused && (keyScope?.lastInput()?.origin ?? observedOrigin) !== "pointer",
    isDisabled: !!props.isDisabled,
    isReadOnly: !!props.isReadOnly,
    isRequired: !!props.isRequired,
    isInvalid: state.isInvalid,
    isOpen: state.isOpen,
  }
  const appearance = getNativeDatePickerAppearance(theme, options.appearanceProps, { ...flags, isFocusWithin: focused })
  const authoredStyle = options.range
    ? typeof options.props.style === "function"
      ? options.props.style({ ...flags, state: options.state, defaultStyle: {} })
      : options.props.style
    : typeof options.props.style === "function"
      ? options.props.style({ ...flags, state: options.state, defaultStyle: {} })
      : options.props.style
  const root = splitNativeTextStyle(
    resolveNativeStyle([{ ...appearance.root, direction }, authoredStyle], "DatePicker", "style"),
  )
  const group = splitNativeTextStyle(appearance.group)
  const foreground = root.text.color ?? content?.foregroundColor ?? theme.colors.foreground
  const motion = useNativeDatePickerMotion(
    root.view,
    group.view,
    group.text.color ?? foreground,
    appearance.iconColor,
    appearance.defaultBorderColor,
    direction,
  )
  const labels = resolveNativeDatePickerLabels(range, options.appearanceProps.labels),
    testID = props.testID ?? props["data-testid"] ?? (range ? "datetime-range-picker" : "datetime-picker")
  const inputs: Partial<Record<string | symbol, TNativePickerInputProps>> = Object.fromEntries(
    fields.map((field, index) => [
      field.slot,
      {
        field: { ...field, hosts: hosts[index] },
        ownerId,
        scope: binding.scope,
        outerTarget,
        appearance,
        locale,
        direction,
        label: getNativeDateInputLabel(
          locale,
          field.slot,
          range ? labels.inputButtonGroupAriaLabel : (props.accessibilityLabel ?? props["aria-label"]),
        ),
      },
    ]),
  )
  if (!range) inputs[NATIVE_DEFAULT_SLOT] = inputs.value
  const children = (
    <NativeButtonContext.Provider value={null}>
      <NativeDateInputContext.Provider value={{ slots: inputs }}>
        <NativeFieldInputContext.Provider value={binding.scope}>
          <NativeFocusHost
            ref={bindOuter}
            testID={`${testID}-group`}
            accessible={false}
            focusable={false}
            role="group"
            accessibilityLabel={labels.inputButtonGroupAriaLabel}
            nativeFieldGroupHandler={receiveGroupKey}
            nativeFieldGroupPointerHandler={press}
            nativeFocusWithinObservation
            nativeOnFocusWithin={(event) => {
              if (!isNativeDateFieldFocusEvent(event)) return
              observedFocus.current = event.nativeEvent.within
              setFocused(event.nativeEvent.within)
              setObservedOrigin(event.nativeEvent.origin)
              lifecycle.receive(event)
            }}
            nativeOnFocusWithinRetired={() => {
              observedFocus.current = false
              setFocused(false)
              lifecycle.retire()
            }}
            style={{ ...group.view, ...motion.group }}
          >
            <NativeContentContext.Provider
              value={{
                foregroundColor: motion.foreground,
                isButton: false,
                textStyle: { ...content?.textStyle, ...root.text, ...group.text, color: motion.foreground },
              }}
            >
              <NativeFocusHost
                ref={bindInput}
                accessible={false}
                focusable={false}
                style={{ flexDirection: "row", alignItems: "center" }}
                nativeFieldGroupHandler={receiveInputKey}
                nativeFieldGroupPointerHandler={press}
              >
                <NativePickerInput slot={fields[0].slot} testID={`${testID}-input${range ? "-start" : ""}`} />
                {range ? (
                  <>
                    <Text
                      accessible={false}
                      style={{ ...content?.textStyle, ...root.text, ...group.text, color: motion.foreground }}
                    >
                      –
                    </Text>
                    <NativePickerInput slot="end" testID={`${testID}-input-end`} />
                  </>
                ) : null}
              </NativeFocusHost>
              {metadata}
              {selectedDescription ? (
                <Text
                  ref={selectedRef}
                  nativeID={selectedId}
                  testID={`${testID}-selected-description`}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
                >
                  {selectedDescription}
                </Text>
              ) : null}
              <Button
                ref={trigger}
                isDisabled={!!props.isDisabled || !!props.isReadOnly}
                accessibilityLabel={[labels.triggerButtonAriaLabel, labels.inputButtonGroupAriaLabel]
                  .filter((value) => value !== undefined && value !== "")
                  .join(" ")}
                aria-haspopup="dialog"
                aria-expanded={state.isOpen}
                raised={false}
                geometry="rounded"
                customStyles={appearance.button}
                onPress={() => state.setOpen(true)}
                testID={`${testID}-trigger`}
              >
                <NativeContentContext.Provider
                  value={{
                    foregroundColor: motion.icon,
                    isButton: false,
                    textStyle: { ...content?.textStyle, color: motion.icon },
                  }}
                >
                  {props.ComponentIcon || <NativeDatePickerCalendarIcon color={motion.icon} />}
                </NativeContentContext.Provider>
              </Button>
            </NativeContentContext.Provider>
          </NativeFocusHost>
          <NativeFieldInputContext.Provider value={null}>
            <NativeFloatingSurface
              isOpen={state.isOpen}
              onOpenChange={state.setOpen}
              triggerRef={outer}
              restoreFocusRef={restoreFocus}
              initialFocusRef={calendarFocus}
              placement={props.placement ?? "bottom start"}
              direction={direction}
              offset={5}
              geometry={props.geometry === "orthogonal" ? "orthogonal" : "rounded"}
              customStyles={appearance.popover}
              customDialogStyles={appearance.dialog}
              accessibilityLabel={[labels.triggerButtonAriaLabel, labels.inputButtonGroupAriaLabel]
                .filter((value) => value !== undefined && value !== "")
                .join(" ")}
              testID={`${testID}-popover`}
            >
              <NativeDateCalendar
                options={options}
                appearance={appearance}
                labels={labels}
                initialFocusRef={calendarFocus}
                testID={testID}
              />
            </NativeFloatingSurface>
          </NativeFieldInputContext.Provider>
        </NativeFieldInputContext.Provider>
      </NativeDateInputContext.Provider>
    </NativeButtonContext.Provider>
  )
  const nativeProps = {
    ...(nativeViewProps(
      Object.fromEntries(Object.entries(props).filter(([name]) => !omitted.has(name))),
    ) as TNativeFocusViewProps),
    ref: options.forwardedRef,
    testID,
    accessible: false,
    focusable: props.tabIndex !== undefined ? !props.tabIndex : (props.focusable ?? false),
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onKeyDown: props.onKeyDown,
    onKeyUp: props.onKeyUp,
    style: { ...root.view },
    children,
  }
  return (
    <NativeTimeFieldGroupContext.Provider
      value={{ isDisabled: flags.isDisabled, isReadOnly: flags.isReadOnly, isInvalid: flags.isInvalid }}
    >
      <NativeTimeFieldLabelContext.Provider value={{ nativeID: labelId, ref: labelRef, focusField: focus.focusFirst }}>
        <NativeTimeFieldTextContext.Provider
          value={{
            slots: {
              description: { nativeID: descriptionId, ref: descriptionRef },
              errorMessage: { nativeID: errorId, ref: errorRef },
            },
          }}
        >
          <NativeTimeFieldErrorContext.Provider value={state.displayValidation}>
            <NativeContentContext.Provider
              value={{
                foregroundColor: foreground,
                isButton: false,
                textStyle: { ...content?.textStyle, ...root.text, color: foreground },
              }}
            >
              <NativeFieldInputContext.Provider value={null}>
                {options.range ? (
                  options.props.render ? (
                    options.props.render(nativeProps, { ...flags, state: options.state })
                  ) : (
                    <NativeFocusView {...nativeProps} />
                  )
                ) : options.props.render ? (
                  options.props.render(nativeProps, { ...flags, state: options.state })
                ) : (
                  <NativeFocusView {...nativeProps} />
                )}
              </NativeFieldInputContext.Provider>
            </NativeContentContext.Provider>
          </NativeTimeFieldErrorContext.Provider>
        </NativeTimeFieldTextContext.Provider>
      </NativeTimeFieldLabelContext.Provider>
    </NativeTimeFieldGroupContext.Provider>
  )
}
export type TNativeDatePickerOptions = TOptions
