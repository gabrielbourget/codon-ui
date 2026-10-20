export const nativeAccessibilityIDs = (value: string | readonly string[] | undefined): readonly string[] | undefined =>
  typeof value === "string" ? value.split(/\s+/u).filter(Boolean) : value

type TNativeLabelInput = {
  id?: string
  nativeID?: string
  accessibilityLabel?: string
  "aria-label"?: string
  accessibilityLabelledBy?: string | readonly string[]
  "aria-labelledby"?: string
  nativeLabelledBy?: readonly string[]
}

// Pinned useLabels composition, after native aliases have selected their actual host identity.
export const nativeCompositeLabelProps = (props: TNativeLabelInput, generatedID: string) => {
  const nativeID = (props.id !== undefined ? props.id : props.nativeID) || generatedID
  const label = props["aria-label"] !== undefined ? props["aria-label"] : props.accessibilityLabel
  const references =
    props.nativeLabelledBy ?? nativeAccessibilityIDs(props.accessibilityLabelledBy ?? props["aria-labelledby"])
  return {
    id: undefined,
    nativeID,
    nativeLabelledBy: label && references?.length ? [...new Set([nativeID, ...references])] : references,
  }
}
