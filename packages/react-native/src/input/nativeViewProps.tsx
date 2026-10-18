import { useContext, type Context, type ReactNode } from "react"
import type { ViewProps } from "react-native"
// @ts-expect-error Pinned RN publishes this inspected context without TypeScript declarations.
import upstreamTextAncestorContext from "react-native/Libraries/Text/TextAncestorContext"

const TextAncestorContext: Context<boolean> = upstreamTextAncestorContext
export const NativeViewContextBoundary = ({ children }: { children: ReactNode }) => {
  const hasTextAncestor = useContext(TextAncestorContext)
  return hasTextAncestor ? (
    <TextAncestorContext.Provider value={false}>{children}</TextAncestorContext.Provider>
  ) : (
    children
  )
}

// Keep the pinned core View's alias precedence at the source-owned native boundary.
export const nativeViewProps = <T extends ViewProps>(props: T): T => {
  const {
    accessibilityState,
    accessibilityValue,
    "aria-busy": busy,
    "aria-checked": checked,
    "aria-disabled": disabled,
    "aria-expanded": expanded,
    "aria-hidden": hidden,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    "aria-live": live,
    "aria-selected": selected,
    "aria-valuemax": max,
    "aria-valuemin": min,
    "aria-valuenow": now,
    "aria-valuetext": text,
    id,
    tabIndex,
    ...other
  } = props
  const result: ViewProps = { ...other }
  if (labelledBy !== undefined) result.accessibilityLabelledBy = labelledBy.split(/\s*,\s*/g)
  if (label !== undefined) result.accessibilityLabel = label
  if (live !== undefined) result.accessibilityLiveRegion = live === "off" ? "none" : live
  if (hidden !== undefined) {
    result.accessibilityElementsHidden = hidden
    if (hidden === true) result.importantForAccessibility = "no-hide-descendants"
  }
  if (id !== undefined) result.nativeID = id
  if (tabIndex !== undefined) result.focusable = !tabIndex
  if (
    accessibilityState != null ||
    busy != null ||
    checked != null ||
    disabled != null ||
    expanded != null ||
    selected != null
  ) {
    result.accessibilityState = {
      busy: busy ?? accessibilityState?.busy,
      checked: checked ?? accessibilityState?.checked,
      disabled: disabled ?? accessibilityState?.disabled,
      expanded: expanded ?? accessibilityState?.expanded,
      selected: selected ?? accessibilityState?.selected,
    }
  }
  if (accessibilityValue != null || max != null || min != null || now != null || text != null) {
    result.accessibilityValue = {
      max: max ?? accessibilityValue?.max,
      min: min ?? accessibilityValue?.min,
      now: now ?? accessibilityValue?.now,
      text: text ?? accessibilityValue?.text,
    }
  }
  return result as T
}
