import { forwardRef, useContext } from "react"
import type { View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf, useNativeCollectionReceiverRef } from "../../collection/CollectionBuilder"
import { useNativeContextProps } from "../../collection/context"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeTheme } from "../../theme"

import { NativeMenuActionsContext, NativeMenuSeparatorContext } from "./context"
import { getNativeMenuSeparatorStyle } from "./styles"
import type { TNativeMenuSeparatorLabels, TNativeMenuSeparatorProps } from "./types"

const defaultLabels: TNativeMenuSeparatorLabels = { horizontal: "Horizontal", vertical: "Vertical" }

const MenuSeparatorReceiver = forwardRef<
  View,
  TNativeMenuSeparatorProps & { collectionNode: TNativeCollectionNode<unknown> }
>(({ collectionNode, ...authoredProps }, forwardedRef) => {
  const menu = useContext(NativeMenuActionsContext)
  const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeMenuSeparatorContext)
  const receiverRef = useNativeCollectionReceiverRef(collectionNode, ref)
  const {
    render,
    slot: _slot,
    orientation = "horizontal",
    labels,
    ariaDescribedBy,
    ariaDetails,
    "aria-describedby": describedByAlias,
    "aria-details": detailsAlias,
    descriptionLabel = "Description",
    detailsLabel = "Details",
    customStyles: _custom,
    style: _style,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  const theme = useNativeTheme()
  const style = getNativeMenuSeparatorStyle(theme, props)
  const labelledBy = nativeAccessibilityIDs(props.accessibilityLabelledBy ?? props["aria-labelledby"])
  const describedBy = nativeAccessibilityIDs(ariaDescribedBy ?? describedByAlias)
  const detailsBy = nativeAccessibilityIDs(ariaDetails ?? detailsAlias)
  const label = props["aria-label"] ?? props.accessibilityLabel
  const accessible = !!(label?.trim() || labelledBy?.length || describedBy?.length || detailsBy?.length)
  const hasAuthoredValue =
    props.accessibilityValue !== undefined ||
    props["aria-valuetext"] !== undefined ||
    props["aria-valuenow"] !== undefined ||
    props["aria-valuemin"] !== undefined ||
    props["aria-valuemax"] !== undefined
  const orientationLabel = labels?.[orientation] ?? defaultLabels[orientation]
  if (accessible && !hasAuthoredValue && (typeof orientationLabel !== "string" || !orientationLabel.trim()))
    throw new TypeError("MenuSeparator: an accessible orientation label must be nonempty")
  const hostProps = {
    ...native,
    ref: receiverRef,
    testID: testID ?? aliasTestID ?? "menu-separator",
    role: "separator" as const,
    accessible,
    focusable: false,
    nativeTabStop: false,
    nativeLabelledBy: labelledBy,
    nativeDescribedBy: describedBy,
    nativeDetailsBy: detailsBy,
    nativeDescriptionLabel: descriptionLabel,
    nativeDetailsLabel: detailsLabel,
    accessibilityValue: hasAuthoredValue
      ? props.accessibilityValue
      : accessible
        ? { text: orientationLabel }
        : undefined,
    style,
  }
  return (
    <NativeCollectionSemanticsContext.Provider
      value={accessible ? (menu?.separatorSemantics(collectionNode) ?? "") : ""}
    >
      {render ? render(hostProps, undefined) : <NativeFocusView {...hostProps} />}
    </NativeCollectionSemanticsContext.Provider>
  )
})

export const MenuSeparator = createNativeCollectionLeaf<unknown, TNativeMenuSeparatorProps, View>(
  "separator",
  (props, ref, node) => {
    const actions = useContext(NativeCollectionActionsContext)
    return (
      <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
        <MenuSeparatorReceiver {...props} collectionNode={node} ref={ref} />
      </NativeCollectionItemBindingContext.Provider>
    )
  },
)
