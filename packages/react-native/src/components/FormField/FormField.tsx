import { forwardRef, useEffect, useRef } from "react"
import { Easing, Text as NativeText, View } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { useNativeLinkColor } from "../Link/motion"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"
import { Text } from "../Text/Text"

import { getNativeFormFieldStyles } from "./styles"
import type { TNativeFormFieldProps, TNativeFormFieldRef } from "./types"

const textColorEasing = Easing.bezier(0.42, 0, 0.58, 1)

export const FormField = forwardRef<TNativeFormFieldRef, TNativeFormFieldProps>((props, ref) => {
  const {
    children,
    label,
    required = false,
    labelID,
    labelFor,
    topRightContent,
    bottomRightContent,
    errorMessages,
    warningMessages,
    successMessages,
    description,
    raised: _raised,
    customStyles: _customStyles,
    style: _style,
    customTopRowStyles: _topStyles,
    customLabelStyles: _labelStyles,
    customTopRightStyles: _topRightStyles,
    customBottomRowStyles: _bottomStyles,
    customBottomRightStyles: _bottomRightStyles,
    customValidationMessageStyles: _validationStyles,
    customDescriptionStyles: _descriptionStyles,
    accessibilityLabel,
    "aria-label": nativeLabel,
    ariaLabel,
    accessibilityLabelledBy,
    "aria-labelledby": nativeLabelledBy,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-describedby": nativeDescribedBy,
    "aria-details": nativeDetails,
    labels,
    onFocus,
    onBlur,
    focusable,
    tabIndex,
    testID,
    "data-testid": aliasID,
    ...rootProps
  } = props
  if (labelFor !== undefined && (labelFor === null || typeof labelFor !== "object" || !("current" in labelFor)))
    throw new TypeError("FormField: labelFor must be a native focus ref")
  const theme = useNativeTheme()
  const context = useNativeContentContext()
  const styles = getNativeFormFieldStyles(theme, props)
  const rootStyle = splitNativeTextStyle(styles.root)
  const animatedForeground = useNativeLinkColor(styles.root.color ?? theme.colors.foreground, 250, textColorEasing)
  const foreground = styles.root.color === undefined && context ? context.foregroundColor : animatedForeground
  const mounted = useRef(true)
  const labelLifetime = useRef({ label, labelFor, generation: 0 })
  if (labelLifetime.current.label !== label || labelLifetime.current.labelFor !== labelFor)
    labelLifetime.current = { label, labelFor, generation: labelLifetime.current.generation + 1 }
  const generation = labelLifetime.current.generation
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const focusLabelTarget = () => {
    if (!mounted.current || labelLifetime.current.generation !== generation || !labelLifetime.current.label) return
    labelLifetime.current.labelFor?.current?.focus()
  }
  const groups = [
    { kind: "error", messages: errorMessages, color: theme.colors.statusDanger },
    { kind: "warning", messages: warningMessages, color: theme.colors.statusWarning },
    { kind: "success", messages: successMessages, color: theme.colors.statusSuccess },
  ] as const
  const content = (
    <NativeContentContext.Provider
      value={{
        foregroundColor: foreground,
        isButton: context?.isButton ?? false,
      }}
    >
      <NativeFocusHost
        {...rootProps}
        ref={ref}
        focusable={tabIndex === undefined ? (focusable ?? false) : !tabIndex}
        tabIndex={tabIndex}
        onBubbledFocus={onFocus ?? undefined}
        onBubbledBlur={onBlur ?? undefined}
        nativeLabelledBy={nativeAccessibilityIDs(accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy)}
        nativeDescribedBy={nativeAccessibilityIDs(nativeDescribedBy ?? ariaDescribedBy)}
        nativeDetailsBy={nativeAccessibilityIDs(nativeDetails ?? ariaDetails)}
        nativeDescriptionLabel={labels?.descriptionLabel}
        nativeDetailsLabel={labels?.detailsLabel}
        accessibilityLabel={accessibilityLabel ?? nativeLabel ?? ariaLabel}
        accessibilityLabelledBy={accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy}
        testID={testID ?? aliasID ?? "form-field"}
        style={rootStyle.view}
      >
        <View testID="form-field-top-row" style={styles.top}>
          {label ? (
            <Text
              testID="form-field-label"
              elementType="label"
              variant="b11"
              nativeID={labelID}
              customStyles={styles.label}
              onPress={labelFor ? focusLabelTarget : undefined}
            >
              {label}{" "}
              <NativeText style={{ color: theme.colors.statusDanger }} testID="form-field-required-indicator">
                {required ? "*" : undefined}
              </NativeText>
            </Text>
          ) : null}
          <View testID="form-field-top-right-content" style={styles.topRight}>
            {getNativeButtonContent(topRightContent)}
          </View>
        </View>
        {getNativeButtonContent(children)}
        {styles.hasBottom ? (
          <View testID="form-field-bottom-row" style={styles.bottom}>
            <View testID="form-field-validation-messages" style={styles.validation}>
              {groups.map(({ kind, messages, color }) =>
                messages?.map((message, index) => (
                  <Text
                    key={`${kind}-${index}`}
                    testID={`form-field-${kind}-messages`}
                    variant="b11"
                    color={color}
                    customStyles={styles.message}
                  >
                    {message}
                  </Text>
                )),
              )}
            </View>
            <View testID="form-field-bottom-right-content" style={styles.bottomRight}>
              {getNativeButtonContent(bottomRightContent)}
            </View>
          </View>
        ) : null}
        {description ? (
          <Text testID="form-field-description" variant="b11" fontStyle="italic" customStyles={styles.description}>
            {description}
          </Text>
        ) : null}
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
  return <NativeTextStyleProvider style={rootStyle.text}>{content}</NativeTextStyleProvider>
})

FormField.displayName = "FormField"
