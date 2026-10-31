export type TNativeComboBoxItemActionProps = {
  href?: string
  onAction?: () => void
  onNavigate?: (href: string) => void
  onNavigationError?: (error: unknown, href: string) => void
}
export type TNativeComboBoxItemRequest =
  | { kind: "select" | "commit" | "close" }
  | { kind: "action"; action: () => void }
  | { kind: "link"; props: TNativeComboBoxItemActionProps; resetSelection: boolean }

export const getNativeComboBoxSelectionRequest = (props: TNativeComboBoxItemActionProps): TNativeComboBoxItemRequest =>
  props.href ? { kind: "link", props, resetSelection: true } : { kind: "select" }

export const getNativeComboBoxPressRequest = (
  props: TNativeComboBoxItemActionProps,
  listAction?: () => void,
): TNativeComboBoxItemRequest =>
  props.onAction || listAction
    ? {
        kind: "action",
        action: () => {
          props.onAction?.()
          listAction?.()
        },
      }
    : getNativeComboBoxSelectionRequest(props)

export const getNativeComboBoxInputRequest = (
  props: TNativeComboBoxItemActionProps,
  mode: "enter" | "tab",
): TNativeComboBoxItemRequest => {
  if (props.href) return mode === "tab" ? { kind: "close" } : { kind: "link", props, resetSelection: false }
  if (props.onAction) return { kind: "action", action: props.onAction }
  return { kind: "commit" }
}
