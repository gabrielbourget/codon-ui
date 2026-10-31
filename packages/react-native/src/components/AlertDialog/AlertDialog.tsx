import { forwardRef, useRef } from "react"
import { View } from "react-native"

import { OverlayFrame } from "../../overlays/OverlayFrame"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { validateNativeColor } from "../colors"
import { useModalState } from "../Modal/useModalState"
import { NativeContentContext } from "../NativeContentContext"
import { Text } from "../Text/Text"

import { DefaultAlertMark } from "./DefaultMark"
import { resolveAlertDialogLabels } from "./labels"
import {
  AVAILABLE_ALERT_DIALOG_TYPES,
  type TNativeAlertDialogProps,
  type TNativeAlertDialogRef,
  type TNativeAlertDialogType,
} from "./types"

export const AlertDialog = forwardRef<TNativeAlertDialogRef, TNativeAlertDialogProps>((props, ref) => {
  const state = useModalState(props, "AlertDialog")
  const theme = useNativeTheme()
  const heading = useRef<View>(null)
  const labels = resolveAlertDialogLabels(props)
  const type: TNativeAlertDialogType =
    props.type && AVAILABLE_ALERT_DIALOG_TYPES.includes(props.type) ? props.type : "info"
  const color =
    type === "info"
      ? theme.colors.controlSelectedBackground
      : type === "warning"
        ? theme.colors.statusWarning
        : type === "success"
          ? theme.colors.statusSuccess
          : theme.colors.statusDanger
  validateNativeColor(color, "AlertDialog", "statusColor")
  if (typeof props.titleText !== "string" || typeof props.bodyText !== "string")
    throw new TypeError("AlertDialog: titleText and bodyText must be strings")
  const renderedNames =
    props.showCancelAction === false
      ? [labels.confirmActionButtonAriaLabel]
      : [labels.cancelActionButtonAriaLabel, labels.confirmActionButtonAriaLabel]
  if (renderedNames.some((label) => typeof label !== "string" || !label.trim()))
    throw new TypeError("AlertDialog: each rendered action requires a nonempty accessible name")
  const identity = props.testID ?? props["data-testid"] ?? "alert-dialog"
  return (
    <OverlayFrame
      componentName="AlertDialog"
      props={{ ...props, testID: identity, isScrollable: true }}
      open={state.open}
      requestClose={() => state.request(false)}
      panelRef={ref}
      initialFocusRef={props.initialFocusRef ?? heading}
      radiusMultiplier={2}
      dialogDefaults={{ padding: theme.spacing.unit * 3, gap: theme.spacing.unit * 4 }}
      leading={(panelStyle) => (
        <View
          testID={`${identity}-ribbon`}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            height: theme.spacing.unit * 5,
            width: "100%",
            flexShrink: 0,
            backgroundColor: color,
            borderTopLeftRadius: panelStyle.borderTopLeftRadius ?? panelStyle.borderRadius,
            borderTopRightRadius: panelStyle.borderTopRightRadius ?? panelStyle.borderRadius,
          }}
        />
      )}
    >
      {({ isActive }) => (
        <>
          <View testID={`${identity}-body`} style={{ gap: theme.spacing.unit * 4 }}>
            <NativeContentContext.Provider value={{ foregroundColor: color, isButton: false }}>
              <View
                testID={`${identity}-icon`}
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  alignSelf: "center",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: theme.spacing.unit * 2,
                  marginBottom: theme.spacing.unit,
                  borderWidth: 3,
                  borderColor: color,
                  borderRadius: theme.radius.round,
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.24,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                {props.AlertIcon ?? <DefaultAlertMark type={type} color={color} />}
              </View>
            </NativeContentContext.Provider>
            <Text
              ref={heading}
              testID={`${identity}-title`}
              elementType="h2"
              variant="b8"
              fontWeight="bold"
              accessibilityLiveRegion="assertive"
            >
              {props.titleText}
            </Text>
            <Text testID={`${identity}-text`}>{props.bodyText}</Text>
            {getNativeButtonContent(props.children)}
          </View>
          <View
            testID={`${identity}-actions`}
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              flexShrink: 0,
              justifyContent: "flex-end",
              alignItems: "center",
              gap: theme.spacing.unit * 2,
            }}
          >
            {props.showCancelAction !== false && (
              <Button
                accessibilityLabel={labels.cancelActionButtonAriaLabel}
                transparent
                raised={false}
                customStyles={{ flexShrink: 1, maxWidth: "100%" }}
                onPress={() => {
                  if (!isActive()) return
                  props.cancelAction?.()
                  state.request(false)
                }}
              >
                <Text
                  fontWeight="bold"
                  color={color}
                  customStyles={{ flexShrink: 1, textAlign: "center", textDecorationLine: "underline" }}
                >
                  {labels.cancelActionButton}
                </Text>
              </Button>
            )}
            <Button
              accessibilityLabel={labels.confirmActionButtonAriaLabel}
              color={color}
              raised={false}
              customStyles={{ flexShrink: 1, maxWidth: "100%" }}
              onPress={() => {
                if (!isActive()) return
                props.confirmAction?.()
                state.request(false)
              }}
            >
              <Text
                fontWeight="bold"
                color={theme.colors.controlSelectedForeground}
                customStyles={{ flexShrink: 1, textAlign: "center" }}
              >
                {labels.confirmActionButton}
              </Text>
            </Button>
          </View>
        </>
      )}
    </OverlayFrame>
  )
})
AlertDialog.displayName = "AlertDialog"
