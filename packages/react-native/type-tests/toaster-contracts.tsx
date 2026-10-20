import { createRef } from "react"
import { StyleSheet, type View } from "react-native"

import {
  toast,
  Toaster,
  type TNativeToast,
  type PartialToastLabels,
  TOAST_POSITION__TOP_RIGHT,
  TOAST_TYPE__INFO,
} from "../src"

const styles = StyleSheet.create({ root: { marginTop: 2 }, text: { color: "blue" } })
const accepted = (
  <Toaster
    ref={createRef<View>()}
    offset={0}
    maxVisibleToasts={0}
    toastGap={0}
    customRootStyles={[styles.root, false]}
    toastLabels={{ closeButtonAriaLabel: "" }}
    ariaLabelledBy="heading"
    ariaDescribedBy="summary"
    ariaDetails="details"
    labels={{ descriptionLabel: "Résumé" }}
  />
)
const payload: TNativeToast = {
  id: 0,
  duration: 0,
  important: false,
  raised: false,
  dismissable: false,
  titleText: "",
  showButtons: false,
  customBodyTextStyles: styles.text,
  customStyles: { width: "50%", color: "blue" },
}
const publishEmpty = () => toast({ ...payload, id: "" })
// @ts-expect-error DOM classes have a native style equivalent rather than a silently ignored prop.
const domClass = <Toaster className="web" />
// @ts-expect-error Native offsets use logical units.
const cssOffset = <Toaster offset="15px" />
// @ts-expect-error No uncontrolled mirror of the published queue is accepted.
const mirroredQueue = <Toaster defaultToasts={[]} />
// @ts-expect-error Native dimensions reject CSS rem strings.
const cssToast: TNativeToast = { id: "", width: "20rem" }
const domEvent: TNativeToast = {
  id: 0,
  // @ts-expect-error Existing Button events remain native events.
  customCloseButtonProps: { onPress: (event: { clientX: number }) => event.clientX },
}

void [accepted, publishEmpty, domClass, cssOffset, mirroredQueue, cssToast, domEvent]

const unrestricted = (
  <Toaster expandToggleHotkey={[]} dismissalHotkey={["constructor", "repeat"]} position={TOAST_POSITION__TOP_RIGHT} />
)
const labels: PartialToastLabels = { closeButtonAriaLabel: "" }
const typed: TNativeToast = { id: "", type: TOAST_TYPE__INFO, labels }
void [unrestricted, typed]
