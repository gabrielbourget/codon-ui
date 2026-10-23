import {
  forwardRef,
  useCallback,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ForwardedRef,
  type RefAttributes,
  type ReactElement,
} from "react"
import { findNodeHandle, Text, View } from "react-native"
import Svg, { Circle, Polyline } from "react-native-svg"

import { resolveNativeStyle } from "../../components/colors"
import { NativeContentContext, useNativeContentContext } from "../../components/NativeContentContext"
import { splitNativeTextStyle } from "../../components/nativeTextStyle"
import type { TNativeTextRef } from "../../components/Text/types"
import { useNativeFieldSemanticRef, useNativeFieldSemantics } from "../../form/useFieldSemantics"
import { useNativeTimeFieldForm } from "../../form/useTimeField"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { getNativeDateFieldDescription } from "../entry/semantics"
import type { TimeValue } from "../state/types"

import {
  calibrateNativeTimePickerStyle,
  getNativeTimePickerAppearance,
  type TNativeTimePickerAppearanceProps,
} from "./appearance"
import { NativeTimeFieldStateContext } from "./context"
import {
  NativeTimeFieldGroupContext,
  NativeTimeFieldInputContext,
  NativeTimeFieldLabelContext,
  NativeTimeFieldTextContext,
  NativeTimeFieldErrorContext,
} from "./descendants"
import { NativeDateFieldFocusManager } from "./focus"
import { isNativeDateFieldFocusEvent } from "./focusEvent"
import { NativeDateFieldHostSet, nativeDateFieldSegmentId } from "./hostSet"
import { useNativeTimePickerMotion } from "./motion"
import { NativeTimePickerSegment } from "./NativeTimePickerSegment"
import type { TNativeTimeFieldProps } from "./types"
import { useNativeDateFieldLifecycle } from "./useLifecycle"
import { useNativeTimeField } from "./useTimeField"

type TProps<T extends TimeValue> = TNativeTimeFieldProps<T> & TNativeTimePickerAppearanceProps

const fieldOptions = new Set([
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
  "hourCycle",
  "granularity",
  "hideTimeZone",
  "shouldForceLeadingZeros",
  "placeholderValue",
  "autoFocus",
  "name",
  "form",
  "autoComplete",
  "id",
  "slot",
  "onFocus",
  "onBlur",
  "onFocusChange",
  "onKeyDown",
  "onKeyUp",
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
  "customInputIconGroupStyles",
  "ariaDescribedBy",
  "nativeAccessibilityLabels",
  "ariaDetails",
  "aria-describedby",
  "aria-details",
])

// Private construction receiver. Public export waits for the full descendant,
// pointer/default, semantic and installed-input obligations in roadmap 3.5.52.
export const NativeTimePickerRenderer = forwardRef(
  <T extends TimeValue>(authored: TProps<T>, forwardedRef: ForwardedRef<View>) => {
    const theme = useNativeTheme()
    const content = useNativeContentContext()
    const field = useNativeTimeField(
      {
        ...authored,
        hourCycle: authored.hourCycle ?? 24,
        shouldForceLeadingZeros: authored.shouldForceLeadingZeros ?? true,
        style: calibrateNativeTimePickerStyle(authored),
      },
      forwardedRef,
    )
    const { props, state, renderState, locale, direction } = field
    const ownerId = useId()
    const testID = props.testID ?? props["data-testid"] ?? "time-picker"
    const [hosts] = useState(() => new NativeDateFieldHostSet())
    useSyncExternalStore(hosts.subscribe, hosts.version, hosts.version)
    const current = useRef(state)
    useInsertionEffect(() => {
      current.current = state
    })
    const [focus] = useState(() => new NativeDateFieldFocusManager(() => hosts.snapshot(current.current.segments)))
    useInsertionEffect(() => () => focus.retire(), [focus])
    const bindGroup = useCallback(
      (target: View | null) => hosts.root(target, target ? (findNodeHandle(target) ?? 0) : 0),
      [hosts],
    )
    const [focused, setFocused] = useState(false)
    const observedFocus = useRef(false)
    const lifecycle = useNativeDateFieldLifecycle(
      state,
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
    const original = hosts.snapshot(state.segments)
    const currentOriginal = useCallback(() => {
      const value = hosts.snapshot(current.current.segments)
      return value ? { root: value.root, rootTarget: value.rootTarget, segments: value.rows } : null
    }, [hosts])
    const initialAutoFocus = useRef(!!props.autoFocus)
    useLayoutEffect(() => {
      if (initialAutoFocus.current && !state.isDisabled && original && focus.focusFirst())
        initialAutoFocus.current = false
    })
    const appearance = getNativeTimePickerAppearance(theme, authored, { ...renderState, isFocusWithin: focused })
    const authoredStyle =
      typeof props.style === "function" ? props.style({ ...renderState, defaultStyle: {} }) : props.style
    const rootStyle = resolveNativeStyle([appearance.root, authoredStyle], "TimePicker", "style")
    const root = splitNativeTextStyle(rootStyle)
    const group = splitNativeTextStyle(appearance.group)
    const input = splitNativeTextStyle(appearance.input)
    const foregroundColor = root.text.color ?? content?.foregroundColor ?? theme.colors.foreground
    const inheritedRootText = { ...content?.textStyle, color: foregroundColor, ...root.text }
    const motion = useNativeTimePickerMotion(
      root.view,
      group.view,
      foregroundColor,
      group.text.color ?? foregroundColor,
      appearance.defaultBorderColor,
    )
    const [label, labelRef] = useNativeFieldSemanticRef<TNativeTextRef>()
    const [description, descriptionRef] = useNativeFieldSemanticRef<TNativeTextRef>()
    const [error, errorRef] = useNativeFieldSemanticRef<TNativeTextRef>()
    const [selected, selectedRef] = useNativeFieldSemanticRef<TNativeTextRef>()
    const selectedDescription = getNativeDateFieldDescription(state, locale)
    const labelId = `${ownerId}:label`,
      descriptionId = `${ownerId}:description`,
      errorId = `${ownerId}:error`,
      selectedId = `${ownerId}:selected-time`
    const primary = useRef<View | null>(null),
      absent = useRef<View | null>(null)
    useInsertionEffect(() => {
      primary.current = original?.rows[0].original ?? null
    })
    const firstIndex = state.segments.findIndex((segment) => segment.isEditable)
    const firstPart = state.segments[firstIndex]
    const firstEditableTarget = firstPart
      ? original?.rows.find((row) => row.identity.segmentId === nativeDateFieldSegmentId(firstPart, firstIndex))
          ?.identity.target
      : undefined
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
      labels: props.nativeAccessibilityLabels,
      flags: {
        disabled: state.isDisabled,
        readOnly: state.isReadOnly,
        required: !!state.isRequired,
        invalid: state.isInvalid,
        expanded: false,
      },
      activeDescendant: null,
      dateField: firstEditableTarget ? { firstEditableTarget } : undefined,
    })
    const metadata = useNativeTimeFieldForm(
      { ...props, validationBehavior: field.validationBehavior },
      state,
      original ? { root: original.root, rootTarget: original.rootTarget, segments: original.rows } : null,
      currentOriginal,
      () => observedFocus.current,
      firstEditableTarget ? semanticFrame : "",
    )
    const groupProps = {
      ref: bindGroup,
      nativeID: props.id,
      accessibilityLabel: authored.labels?.inputIconGroupAriaLabel ?? "TimePicker Input Icon Group",
      accessibilityLabelledBy: label.current ? labelId : props.accessibilityLabelledBy,
      isDisabled: state.isDisabled,
      isReadOnly: state.isReadOnly,
      isInvalid: state.isInvalid,
    }
    const inheritedText = { ...inheritedRootText, ...group.text, color: motion.groupColor, ...input.text }
    const children = (
      <NativeFocusHost
        ref={bindGroup}
        nativeID={props.id}
        testID={`${testID}-group`}
        accessible={false}
        role="group"
        accessibilityLabel={groupProps.accessibilityLabel}
        nativeLabelledBy={label.current ? [labelId] : undefined}
        focusable={false}
        nativeFocusWithinObservation
        nativeOnFocusWithin={(event) => {
          if (!isNativeDateFieldFocusEvent(event)) return
          observedFocus.current = event.nativeEvent.within
          setFocused(event.nativeEvent.within)
          lifecycle.receive(event)
        }}
        nativeOnFocusWithinRetired={() => {
          observedFocus.current = false
          setFocused(false)
          lifecycle.retire()
        }}
        style={{ ...group.view, ...motion.group }}
      >
        <View
          testID={`${testID}-input`}
          accessible={false}
          role="group"
          accessibilityLabel={props.accessibilityLabel ?? props["aria-label"]}
          style={input.view}
        >
          {state.segments.map((segment, index) => (
            <NativeTimePickerSegment
              key={index}
              ownerId={ownerId}
              segmentId={nativeDateFieldSegmentId(segment, index)}
              segment={segment}
              state={state}
              locale={locale}
              direction={direction}
              hostSet={hosts}
              focus={focus}
              appearance={appearance}
              inheritedText={inheritedText}
              label={props.accessibilityLabel ?? props["aria-label"]}
              onKeyDown={props.onKeyDown}
              onKeyUp={props.onKeyUp}
              testID={`${testID}-segment-${index}`}
            />
          ))}
        </View>
        {metadata}
        <NativeContentContext.Provider
          value={{
            foregroundColor: appearance.iconColor,
            isButton: false,
            textStyle: { ...inheritedRootText, ...group.text, color: motion.groupColor },
          }}
        >
          {authored.ComponentIcon || (
            <Svg
              testID={`${testID}-clock`}
              accessible={false}
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={appearance.iconColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Circle cx={12} cy={12} r={10} />
              <Polyline points="12 6 12 12 16 14" />
            </Svg>
          )}
        </NativeContentContext.Provider>
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
      </NativeFocusHost>
    )
    const nativeProps = {
      ...(Object.fromEntries(
        Object.entries(props).filter(([name]) => !fieldOptions.has(name)),
      ) as TNativeFocusViewProps),
      ref: field.ref,
      testID,
      accessible: false,
      style: { ...root.view, ...motion.root },
      onLayout: props.onLayout,
      pointerEvents: props.pointerEvents,
      collapsable: props.collapsable,
      children,
    }
    return (
      <NativeTimeFieldStateContext.Provider value={state}>
        <NativeTimeFieldGroupContext.Provider value={groupProps}>
          <NativeTimeFieldInputContext.Provider
            value={{
              name: props.name,
              form: props.form,
              autoComplete: props.autoComplete,
              value: state.timeValue?.toString() ?? "",
              isDisabled: state.isDisabled,
              isRequired: !!state.isRequired,
              segments: original?.rows ?? [],
            }}
          >
            <NativeTimeFieldLabelContext.Provider
              value={{ nativeID: labelId, ref: labelRef, elementType: "span", focusField: focus.focusFirst }}
            >
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
                    value={{ foregroundColor, isButton: content?.isButton ?? false, textStyle: inheritedRootText }}
                  >
                    {props.render ? (
                      props.render(nativeProps, renderState)
                    ) : (
                      <NativeFocusHost {...nativeProps} focusable={false} />
                    )}
                  </NativeContentContext.Provider>
                </NativeTimeFieldErrorContext.Provider>
              </NativeTimeFieldTextContext.Provider>
            </NativeTimeFieldLabelContext.Provider>
          </NativeTimeFieldInputContext.Provider>
        </NativeTimeFieldGroupContext.Provider>
      </NativeTimeFieldStateContext.Provider>
    )
  },
) as <T extends TimeValue>(props: TProps<T> & RefAttributes<View>) => ReactElement
