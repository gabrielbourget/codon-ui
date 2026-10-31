import { createRef } from "react"
import { PlatformColor, StyleSheet, type View } from "react-native"

import { Link, type LinkProps } from "../src"

const styles = StyleSheet.create({ link: { color: "purple", width: 0, fontSize: 20 } })
export const linkProps: LinkProps = {
  href: "",
  isVisited: false,
  isDisabled: false,
  order: "quintenary",
  visitedColor: PlatformColor("systemBlueColor"),
  customStyles: [styles.link, { textDecorationLine: "underline" }],
  style: (state) => [state.defaultStyle, { opacity: state.isPressed ? 0.8 : 1 }],
  ariaLabel: "Open destination",
  ariaLabelledBy: "native-label",
  accessibilityHint: "Opens the destination in its installed application",
  onPress: (event) => event.preventDefault(),
  onNavigationError: (error, href) => {
    void error
    void href
  },
}
export const ValidLink = (
  <Link {...linkProps} ref={createRef<View>()}>
    Destination
  </Link>
)
// @ts-expect-error A destination is required even when the owner intercepts navigation.
export const MissingLinkDestination = <Link />
// @ts-expect-error Null is not silently converted into a URL.
export const NullLinkDestination = <Link href={null} />
// @ts-expect-error DOM clicks use native onPress payloads.
export const DOMLinkEvent = <Link href="/" onClick={() => undefined} />
// @ts-expect-error A native long press does not expose a browser context menu.
export const DOMLinkContextMenu = <Link href="/" onContextMenu={() => undefined} />
export const NativeLinkKeyboard = <Link href="/" onKeyDown={(event) => event.nativeEvent.nativeCode.toFixed()} />
export const NativeLinkActivation = (
  <Link
    href=""
    onPress={(event) => {
      if ("kind" in event.nativeEvent)
        return event.nativeEvent.kind === "keyboard" ? event.nativeEvent.nativeCode : event.nativeEvent.observedAt
      return event.nativeEvent.pageX
    }}
  />
)
// @ts-expect-error Native key callbacks do not receive DOM KeyboardEvents.
export const DOMLinkKeyboard = <Link href="/" onKeyDown={(event: React.KeyboardEvent) => void event} />
// @ts-expect-error Core Linking does not implement browser windows.
export const DOMLinkTarget = <Link href="/" target="_blank" />
// @ts-expect-error Core Linking does not implement browser referrer policy.
export const DOMLinkReferrer = <Link href="/" referrerPolicy="no-referrer" />
// @ts-expect-error Native style owners replace DOM class names.
export const DOMLinkClass = <Link href="/" className="link" />
export const DescribedNativeLink = (
  <Link
    href=""
    ariaDescribedBy="description second"
    ariaDetails="details"
    labels={{ descriptionLabel: "Description", detailsLabel: "Détails" }}
  />
)
export const EmptyNativeLinkRelationships = (
  <Link href="" aria-describedby="" aria-details="" labels={{ descriptionLabel: "", detailsLabel: "" }} />
)
// @ts-expect-error Relationship IDs are whitespace-separated strings, not arrays.
export const NonStringLinkDescriptions = <Link href="" ariaDescribedBy={["description"]} />
// @ts-expect-error Numeric native tags do not replace ID strings.
export const NumericLinkDetails = <Link href="" ariaDetails={7} />
// @ts-expect-error Supplementary captions are localizable strings.
export const NonStringLinkCaption = <Link href="" labels={{ detailsLabel: false }} />
// @ts-expect-error The root owns link semantics.
export const ReplacedLinkRole = <Link href="/" role="button" />
// @ts-expect-error The native owner uses isDisabled.
export const ReplacedLinkDisabled = <Link href="/" disabled />
// @ts-expect-error The native guard owns the disabled alias too.
export const ReplacedLinkDisabledAlias = <Link href="/" aria-disabled />
// @ts-expect-error Disabled accessibility state follows the authoritative guard.
export const ReplacedLinkDisabledState = <Link href="/" accessibilityState={{ disabled: true }} />
// @ts-expect-error Native decoration controls use the TextStyle union.
export const UnsupportedLinkDecoration = <Link href="/" textDecoration="wavy" />
// @ts-expect-error Actual native View refs are retained.
export const DOMLinkRef = <Link href="/" ref={createRef<HTMLAnchorElement>()} />

// @ts-expect-error The private pressable receiver is not a public package export.
export { NativePressable } from "../src"
